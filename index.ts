import * as fs from 'fs';
import * as path from 'path';

const provisionDataPath = path.join('provisions-data/starknet/');

if (!fs.existsSync(provisionDataPath)) {
    throw new Error('Provision data not found, Take a look at the README.md file.');
}

const maxMulticallSize = 3;
const addresses = [
    "0x03dd8956d65db3a3f414ab0c716b46f522c730ed07235721df1831ea59d2cd0d",
    "0x055582a93cd6819e36a4f92d89f947b23df062f7ebf2f8e4d9ccba98f40ac4b8",
    "0x03dd8956d65db3a3f414ab0c716b46f522c730ed07235721df1831ea59d2cd0d",
    "0x055582a93cd6819e36a4f92d89f947b23df062f7ebf2f8e4d9ccba98f40ac4b8",
    "0x03dd8956d65db3a3f414ab0c716b46f522c730ed07235721df1831ea59d2cd0d",
    "0x055582a93cd6819e36a4f92d89f947b23df062f7ebf2f8e4d9ccba98f40ac4b8",
    "0x03dd8956d65db3a3f414ab0c716b46f522c730ed07235721df1831ea59d2cd0d",
    "0x055582a93cd6819e36a4f92d89f947b23df062f7ebf2f8e4d9ccba98f40ac4b8",
];

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

const accountsEligibilityDataChunks = splitIntoChunks(accountsEligibilityData, maxMulticallSize);
console.log('accountsEligibilityDataChunks:', accountsEligibilityDataChunks);
