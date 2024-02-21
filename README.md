# starknet-external-claim

Install bun to run this project [https://bun.sh/docs/installation]

then run
```
bun install
```

Download an unzip this file [https://github.com/starknet-io/provisions-data/archive/refs/heads/main.zip] to a folder called `provisions-data` in the root folder of this project

Create a `.env` file similar to the `.env.example` with your own data

RPC_URL: is the url of a starknet url using the 0.5 spec
ADDRESS: address of the account that will pay for the claim transaction, that's not the STRK receiver
PRIVATE_KEY: private key of the account above

Paste the list of addresses to claim in `index.ts`

then run
```
bun run claim
```