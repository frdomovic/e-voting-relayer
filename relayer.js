const http = require("http");
const crypto = require("crypto");
const big = require("bn.js");
const { MongoClient, ServerApiVersion } = require("mongodb");
const nearAPI = require("near-api-js");
const { keyStores, KeyPair, connect, Contract } = nearAPI;

require("dotenv").config();

const CONTRACT_ACCOUNT_ID = process.env.CONTRACT_ACCOUNT_ID;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const RELAYER_ACCOUNT_ID = process.env.RELAYER_ACCOUNT_ID;
const MONGO_DB_URI = process.env.MONGO_DB_URI;
const DATABASE_NAME = process.env.DATABASE_NAME;
const COLLECTION_NAME = process.env.COLLECTION_NAME;
const SERVER_PORT = process.env.SERVER_PORT;

const client = new MongoClient(MONGO_DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const getNearObjects = async () => {
  const myKeyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(RELAYER_PRIVATE_KEY);
  await myKeyStore.setKey("testnet", RELAYER_ACCOUNT_ID, keyPair);

  const connectionConfig = {
    networkId: "testnet",
    keyStore: myKeyStore,
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://testnet.mynearwallet.com/",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://explorer.testnet.near.org",
  };
  const nearConnection = await connect(connectionConfig);

  const relayerAccount = await nearConnection.account(RELAYER_ACCOUNT_ID);

  const contract = new Contract(relayerAccount, CONTRACT_ACCOUNT_ID, {
    viewMethods: [
      "viewVotingKeys",
      "viewVoters",
      "viewVotingOptions",
      "viewTimeLimits",
    ],
    changeMethods: ["addVotingKey", "castVote"],
  });
  return { relayerAccount, contract, myKeyStore };
};

const viewVotingOptions = async (contract) => {
  let votingOptions = [];
  try {
    const inputArray = await contract.viewVotingOptions();
    votingOptions = inputArray.map(([name, vote_count]) => ({
      name,
      vote_count,
    }));
    return JSON.stringify(votingOptions);
  } catch (error) {
    console.error(error);
    return { error: "Could not view voting options" };
  }
};

const viewTimeLimits = async (contract) => {
  try {
    const limits = JSON.parse(await contract.viewTimeLimits());

    return JSON.stringify({
      voteTime: limits.vote_time,
      registerTime: limits.register_time,
    });
  } catch (error) {
    console.error(error);
    return { error: "Could not view voting options" };
  }
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const addKeysToContract = async (items, collection, relayerAccount) => {
  try {
    await collection.deleteMany({
      _id: { $in: items.map((item) => item._id) },
    });
    shuffleArray(items);
    items.forEach(async (item) => {
      const voting_key = item.key;
      if (voting_key) {
        try {
          await relayerAccount.functionCall({
            contractId: CONTRACT_ACCOUNT_ID,
            methodName: "addVotingKey",
            args: {
              _secret_key: voting_key,
            },
            gas: new big.BN("300000000000000"),
          });
        } catch (error) {
          console.log(error);
        }
      }
    });
  } catch (error) {
    console.error(error);
  }
};

const castVote = async (keyHash, votingOption, relayerAccount) => {
  try {
    const res = await relayerAccount.functionCall({
      contractId: CONTRACT_ACCOUNT_ID,
      methodName: "castVote",
      args: {
        _secret_key: keyHash,
        _vote_option: votingOption,
      },
      gas: new big.BN("300000000000000"),
    });
    return res;
  } catch (error) {
    console.log(error);
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const database = client.db(DATABASE_NAME);
    const collection = database.collection(COLLECTION_NAME);

    const server = http.createServer(async (req, res) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
      res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

      const { relayerAccount, contract } = await getNearObjects();

      if (req.method === "GET" && req.url === "/health") {
        res.end(JSON.stringify({ status: "running" }));
      } else if (req.method === "GET" && req.url === "/viewVotingOptions") {
        const response = await viewVotingOptions(contract);
        res.end(JSON.stringify({ response: response }));
      } else if (req.method === "GET" && req.url === "/viewTimeLimits") {
        const response = await viewTimeLimits(contract);
        res.end(JSON.stringify({ response: response }));
      } else if (req.method === "POST" && req.url === "/addkey") {
        let requestData = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          requestData += chunk;
        });
        req.on("end", async () => {
          try {
            const jsonData = JSON.parse(requestData);
            if (jsonData.key) {
              const existingItem = await collection.findOne({
                key: jsonData.key,
              });
              if (!existingItem) {
                await collection.insertOne({ key: jsonData.key });
                console.log("Key added successfully");
              } else {
                console.log(`Item with key already exists.`);
              }
            }
            const items = await collection.find().limit(10).toArray();
            if (items.length >= 3) {
              await addKeysToContract(items, collection, relayerAccount);
            }
            res.end(JSON.stringify({ response: true }));
          } catch (error) {
            console.error(error);
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                response: false,
                error: "Failed to process internal functions",
              })
            );
          }
        });
      } else if (req.method === "POST" && req.url === "/adminAddKey") {
        let requestData = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          requestData += chunk;
        });
        req.on("end", async () => {
          try {
            const jsonData = JSON.parse(requestData);
            const adminAPIkey = jsonData.adminAPIKey;
            if (adminAPIkey === process.env.ADMIN_API_KEY) {
              const items = await collection.find().limit(10).toArray();
              await addKeysToContract(items, collection, relayerAccount);
              res.end(JSON.stringify({ response: true }));
            } else {
              res.statusCode = 401;
              res.end(
                JSON.stringify({ response: { error: "Invalid API key" } })
              );
            }
          } catch (error) {
            console.error(error);
            res.statusCode = 400;
            res.end(
              JSON.stringify({ response: { error: "Invalid JSON data" } })
            );
          }
        });
      } else if (req.method === "POST" && req.url === "/castVote") {
        let requestData = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          requestData += chunk;
        });
        req.on("end", async () => {
          try {
            const jsonData = JSON.parse(requestData);
            const votingOption = jsonData.voting_option;

            const response = await castVote(
              jsonData.key,
              votingOption,
              relayerAccount
            );
            res.end(
              JSON.stringify({
                response: response.receipts_outcome[0].outcome.logs[0],
              })
            );
          } catch (error) {
            console.error(error);
            res.statusCode = 400;
            res.end(JSON.stringify({ response: { error: "Failed to vote" } }));
          }
        });
      } else {
        res.statusCode = 400;
        res.end(JSON.stringify({ response: { error: "Endpoint not found" } }));
      }
    });

    server.listen(SERVER_PORT, () => {
      console.log(`Server is running on port ${SERVER_PORT}`);
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

run().catch(console.dir);
