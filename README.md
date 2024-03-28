### NEAR Protocol TypeScript Smart Contract

This repository contains a TypeScript smart contract designed to run on the NEAR Protocol blockchain. The smart contract is implemented in TypeScript using the NEAR SDK.

### Getting Started

#### 1. Clone the Repository

```bash
$: git clone https://https://github.com/frdomovic/e-voting-relayer
```

#### 2. Install dependencies

```bash
$: npm install
```

#### 2. Add Environment variables to .env

```bash
CONTRACT_ACCOUNT_ID=""
RELAYER_ACCOUNT_ID=""
RELAYER_PRIVATE_KEY=""
RELAYER_PUBLIC_KEY=""
MONGO_DB_URI=""
DATABASE_NAME=""
COLLECTION_NAME=""
ADMIN_API_KEY=""
SERVER_PORT=3001
```

1. CONTRACT_ACCOUNT_ID - NEAR accountId where the voting smart contract is deployed (e.g. voting-contract.testnet)

2. RELAYER_ACCOUNT_ID - NEAR accountId of relayer account

   2.1. RELAYER_PRIVATE_KEY - NEAR privateKey of relayer account

   2.2. RELAYER_PUBLIC_KEY - NEAR publicKey of relayer account

   ```bash
   $: near create-account relayer-account.testnet --useFaucet
   > ~/.near-credentials/testnet/relayer-account.testnet.json
   ```

   Copy credentials from the .json
   RELAYER_ACCOUNT_ID - e.g. relayer-account.testnet
   RELAYER_PRIVATE_KEY - e.g. 2eQP...a8sw ()
   RELAYER_PUBLIC_KEY - e.g. ed25519:62WU79rjHuyBT7dcE1iYBHEcamSkmURGoRbcNDYB65rV

3. MONGO_DB_URI - Mongo database connection URI
   [MongoDB](https://cloud.mongodb.com/) - go through process of setting up database.
   Connect to cluster -> Connect your application (Drivers) -> Driver Node.js -> Version 5.5 or later -> copy connection url from step 3. on the page
4. DATABASE_NAME - MongoDB database name
5. COLLECTION_NAME - MongoDB collection name
6. ADMIN_API_KEY - Secure API key (random 64 character password) e.g. 12nak2Wx12...
   Prevents no web application API calls

#### 4. Start relayer Server

```bash
$: npm start
```

#### 5. To run the whole project - Continue on readme.md for frontend
