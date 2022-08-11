require("dotenv").config();
const { gql, GraphQLClient } = require("graphql-request");
const { ethers } = require("ethers");
const { loadWallet } = require("./wallet");

const KIOptionABI = require("./abis/ERC20.json");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class Redeem {
  client;
  lastTimestamp = 0;
  executedStore;

  constructor(executedStore) {
    this.executedStore = executedStore;
    const endpoint = "https://api.thegraph.com/subgraphs/name/ivanzrx/option";
    this.client = new GraphQLClient(endpoint, { headers: {} });
  }

  start = () => {
    this._poll();
  };

  _poll = async () => {
    for (;;) {
      await this._storeExecutedOptions();
      const executedOptions = (await this.executedStore.values()).map(
        (option) => JSON.parse(option)
      );
      await this._redeemExecutedOptions(executedOptions);
      await delay(Number(process.env.POLL_INTERVAL_MS));
    }
  };

  _storeExecutedOptions = async () => {
    const response = await this._requestExecuted(this.lastTimestamp);
    const executedOptions = response.optionExecuteds;

    if (executedOptions.length === 0) return;

    for await (let option of executedOptions) {
      await this.executedStore.set(option);
    }
    this.lastTimestamp = executedOptions[0].blockTimestamp;
  };

  _requestExecuted = async (lastTimestamp) => {
    const query = gql`
      query manyOptions($lastTS: BigInt) {
        optionExecuteds(
          first: 100
          orderBy: blockTimestamp
          orderDirection: desc
          where: { blockTimestamp_gt: $lastTS }
        ) {
          id
          optionId
          optionName
          optionAddress
          roundId
          blockTimestamp
        }
      }
    `;
    const variables = {
      lastTS: lastTimestamp,
    };

    return await this.client.request(query, variables);
  };

  _redeemExecutedOptions = async (executedOptions) => {
    console.log(
      "[Redeem Bot] Executed options counter: ",
      executedOptions.length
    );
    if (executedOptions.length === 0) return;

    for await (let option of executedOptions) {
      const optionAddress = option.optionAddress;
      const response = await this._requestRedeemers(optionAddress);
      const redeemers = response.optionTokenBalances;

      if (redeemers.length === 0) {
        console.log(`[Redeem Bot] Option ${optionAddress} : ${0} redeemers.`);
        await this.executedStore.remove(option);
        continue;
      }
      console.log(`[Redeem Bot] Option ${optionAddress} :  ${redeemers.length} redeemers.`);

      const wallet = loadWallet();
      const optionContract = new ethers.Contract(
        optionAddress,
        KIOptionABI,
        wallet.signer
      );

      for await (let redeemer of redeemers) {
        const owner = redeemer.owner;

        try {
          const tx = await optionContract.redeem(owner, {
            maxFeePerGas: 40000000000,
            maxPriorityFeePerGas: 40000000000,
          });
          const receipt = await tx.wait();
          // console.log(receipt);

          if (receipt.status) {
            console.log(`[Redeem Bot] ${owner} succeeded.`);
          } else {
            console.log(`[Redeem Bot] ${owner} failed.`);
          }
        } catch (error) {
          console.log(`[Redeem Bot] redeem failed.`);
        }
      }
      console.log(`[Redeem Bot] Option ${optionAddress} : operation done.`);
    }
  };

  _requestRedeemers = async (optionAddress) => {
    // console.log("Get redeemers for option address ", optionAddress);

    const query = gql`
      query manyOptions($optionAddress: Bytes) {
        optionTokenBalances(
          first: 100
          where: {
            tokenAddress: $optionAddress
            redeemed: false
            owner_not_in: [
              "0x0000000000000000000000000000000000000000"
              "0xe4a486c26c0304a0bd45455da98415422717c5f5"
            ]
          }
        ) {
          id
          tokenAddress
          owner
          balance
          redeemed
        }
      }
    `;
    const variables = {
      optionAddress: optionAddress,
    };

    return await this.client.request(query, variables);
  };
}

module.exports = { Redeem };
