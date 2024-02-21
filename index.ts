import * as fs from 'fs';
import * as path from 'path';
import * as xmulticall from "@argent/x-multicall";
import { CallData, RpcProvider, uint256, Account } from "starknet";
import dotenv from "dotenv";

const addressesStr = `
0x123132123123
0x4584986748964897
`;
const addresses = addressesStr.split('\n')
    .map(address => address.trim())
    .filter(address => address.length > 0)
    .map(address => address.toLowerCase());


const maxClaimMulticallSize = 30;

dotenv.config({ override: true });

if (new Set(addresses).size !== addresses.length) {
    throw new Error('Duplicate addresses found');
}

const provisionDataPath = path.join('provisions-data/starknet/');

if (!fs.existsSync(provisionDataPath)) {
    throw new Error('Provision data not found, Take a look at the README.md file.');
}

function findAccountAddress(accountAddress: string) {
    // count files in folder
    const filesCount = fs.readdirSync(provisionDataPath).length;
    for (let fileIndex = 0; fileIndex < filesCount; fileIndex++) {
        const jsonFilePath = path.join(provisionDataPath, `starknet-${fileIndex}.json`);
        const rawData = JSON.parse(fs.readFileSync(jsonFilePath, { encoding: 'utf-8' }));
        for (const eligibilityData of rawData.eligibles) {
            if (eligibilityData.identity === accountAddress) {
                return {
                    ...eligibilityData,
                    contract_address: rawData.contract_address
                }
            }
        }
    }
    return null;
}

console.log('finding claim data... ');

const nonEligibleAccount: string[] = [];
const accountsEligibilityData = addresses.map(address => {
    const accountEligibilityData = findAccountAddress(address)
    if (!accountEligibilityData) {
        nonEligibleAccount.push(address);
    }
    return accountEligibilityData;
});

if (nonEligibleAccount.length > 0) {
    console.log('Non eligible accounts:', nonEligibleAccount);
    throw new Error('Some accounts are not eligible');
}

function splitIntoChunks<T>(array: T[], maxSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += maxSize) {
        chunks.push(array.slice(i, i + maxSize));
    }
    return chunks;
}

const address = process.env.ADDRESS as string;
const privateKey = process.env.PRIVATE_KEY as string;
const rpcUrl = process.env.RPC_URL as string;
const provider = new RpcProvider({ nodeUrl: rpcUrl });
const readBatchingSize = 50

function getCallData(accountData: any) {
    return CallData.compile({
        identity: accountData.identity,
        balance: uint256.bnToUint256(BigInt(accountData.amount) * 10n ** 18n),
        index: accountData.merkle_index,
        merkle_path: accountData.merkle_path
    })
}

console.log('validating eligibility... ');
const invalidClaimAddresses: string[] = [];
const alreadyClaimedAddresses: string[] = [];
for (const accountsEligibilityDataChunk of splitIntoChunks(accountsEligibilityData, readBatchingSize)) {
    const batchingProvider = xmulticall.getBatchProvider(provider, { maxBatchSize: readBatchingSize });
    const promises = accountsEligibilityDataChunk.map(async (accountData) => {
        const calldata = getCallData(accountData);
        const call = {
            contractAddress: accountData.contract_address,
            entrypoint: "is_claimable",
            calldata
        };
        return batchingProvider.callContract(call)
    });
    (await Promise.all(promises)).forEach((result, index) => {
        const account = accountsEligibilityDataChunk[index].identity;
        const resultValue = result.result[0];
        switch (resultValue) {
            case "0x0":
                // all good
                break;
            case "0x2":
                console.log("invalid claim for account:", account, "error: already claimed");
                alreadyClaimedAddresses.push(account);
                break;
            default:
                console.log("invalid claim for account:", account, "error:", resultValue);
                invalidClaimAddresses.push(account);
                break;
        }
    });
};

if (alreadyClaimedAddresses.length > 0) {
    console.log('Already claimed addresses:', alreadyClaimedAddresses);
    throw new Error('Some accounts are already claimed');
}

if (invalidClaimAddresses.length > 0) {
    console.log('Invalid claim addresses:', invalidClaimAddresses);
    throw new Error('Some accounts claims are invalid');
}

console.log("Press 'y' to proceed with the claiming");
for await (const line of console) {
    if (line === 'y') {
        break;
    }
    throw new Error('Aborted');
}

const relayer = new Account(provider, address, privateKey);
for (const accountsEligibilityDataChunk of splitIntoChunks(accountsEligibilityData, maxClaimMulticallSize)) {
    console.log('claiming for accounts:', accountsEligibilityDataChunk.map(account => account.identity));
    const calls = accountsEligibilityDataChunk.map((accountData) => {
        return {
            contractAddress: accountData.contract_address,
            entrypoint: "claim",
            calldata: getCallData(accountData)
        };
    });
    const estimate = await relayer.estimateInvokeFee(calls);
    console.log('estimate:', estimate.overall_fee);

    const txHash = (await relayer.execute(calls)).transaction_hash;
    console.log('sent tx hash:', txHash);
    console.log('waiting for transaction to complete...';
    const receipt = await provider.waitForTransaction(txHash);
    console.log('tx included:', receipt.execution_status);
    if (receipt.execution_status !== "SUCCEEDED") {
        throw new Error("Transaction didn't succeed, stopping");
    }
};