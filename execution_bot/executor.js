require("dotenv").config();
const { executeOption } = require("./helper");
const { gql, request, GraphQLClient } = require("graphql-request");
const { ExecutionResult } = require("./enum");
const { ethers } = require("ethers");
const keccak256 = require("keccak256");

const abi = require("../artifacts/contracts/KIOptionFactory.sol/KIOptionFactory.json");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class Executor {
  client;
  lastTimeStampForGraphQuery = 0;
  lastTimeStampForOptionExecution = 0;
  executionStore;
  marketStore;
  constructor(executionStore, marketStore) {
    this.executionStore = executionStore;
    this.marketStore = marketStore;
    const endpoint = "https://api.thegraph.com/subgraphs/name/ivanzrx/option";
    this.client = new GraphQLClient(endpoint, { headers: {} });
  }

  start = () => {
    this._poll();
  };

  _poll = async () => {
    for (;;) {
      const exectuableOptions = await this._getExecutableOptions();
      await this._executeOptions(exectuableOptions);
      await delay(Number(process.env.POLL_INTERVAL_MS));

    }
  };

  _executeOptions = async (executableOptions) => {

    if (!executableOptions) {
      return;
    }
    if (executableOptions.length === 0) {
      return;
    }
    const executeFailed = (await this.executionStore.values("FAILED")).map(
      (option) => JSON.parse(option)
    );
    const optionList = executableOptions.concat(executeFailed);

    if (optionList.length == 0) {
      return;
    }

    for await (let option of optionList) {
      try {
        const execution = await executeOption(option);
        console.log("[Execution Bot] Execute option result : ", execution);
        if (execution !== ExecutionResult.TXUNREACHED) {
          await this.executionStore.remove("OPTION", option);
          console.log("[Execution Bot] Execute succeeded -> option deleted in 'OPTION'");
          if (execution === ExecutionResult.TXSUCCEED) {
            this.lastTimeStampForOptionExecution = option.blockTimeStamp;
            if (await this.executionStore.contains("FAILED", option)) {
              await this.executionStore.remove("FAILED", option);
            }
          }
          if (execution === ExecutionResult.TXFAILED) {
            console.log("[Execution Bot] Execute failed -> option added in 'FAILED OPTION'");
            await this.executionStore.addFailed(option);
          }
        }
      } catch (error) {
        console.log("[Execution Bot] Execute failed.");
      }
    }
  };

  async _getExecutableOptions() {
    
    const response = await this._request(this.lastTimeStampForGraphQuery);
    const kiOptions = response.kiOptions;
    if (response.kiOptions.length == 0) {
      console.log("[Execution Bot] No new fetched option data");
    } else {
    
      const rawOptions = kiOptions.map((entity) => {
        const hexId = keccak256(
          ethers.utils.solidityPack(
            [
              "address",
              "uint8",
              "address",
              "uint256",
              "uint256",
              "bool",
              "bool",
            ],
            [
              entity.underlying,
              1,
              entity.collateral,
              entity.barrierPrice,
              entity.expiry,
              entity.isUp,
              entity.isPlus,
            ]
          )
        ).toString("hex");
        return {
          id: `0x${hexId}`,
          barrierPrice: entity.barrierPrice,
          expiry: entity.expiry,
          isUp: entity.isUp,
          isPlus: entity.isPlus,
          blockTimeStamp: entity.blockTimeStamp,
          barrier_hit_round_Id: 0,
        };
      });
      for await (let option of rawOptions) {
        const result = await this.executionStore.add(option);

      }
      this.lastTimeStampForGraphQuery = rawOptions[0].blockTimeStamp;

    }

    let currentTS = Math.floor(Date.now() / 1000).toString();

    const marketPriceMap = await this._getMarketPrice(
      this.lastTimeStampForOptionExecution,
      currentTS
    );
    const executableOptions = await this._calculateExecutables(
      marketPriceMap,
      currentTS
    );
    console.log("[Execution Bot] Executable options counter : ", executableOptions.length);
    return executableOptions;
  }

  async _request(lastTimeStampForGraphQuery) {
    
    let variables = {};
    let query;
    const optionValues = await this.executionStore.values("OPTION");
    if (optionValues.length == 0) {

      console.log("First option subgraph fetch");
      query = gql`
        query {
          kiOptions(
            first: 1000
            orderBy: blockTimeStamp
            orderDirection: desc
            where: { isPlus_not: false }
          ) {
            id
            tokenAddress
            creator
            underlying
            collateral
            barrierPrice
            expiry
            isUp
            isPlus
            blockTimeStamp
          }
        }
      `;
    } else {
      
      query = gql`
        query manyOptions($lastTS: BigInt) {
          kiOptions(
            first: 5
            orderBy: blockTimeStamp
            orderDirection: desc
            where: { blockTimeStamp_gt: $lastTS, isPlus_not: false }
          ) {
            id
            tokenAddress
            creator
            underlying
            collateral
            barrierPrice
            expiry
            isUp
            isPlus
            blockTimeStamp
          }
        }
      `;
      variables = {
        lastTS: lastTimeStampForGraphQuery,
      };
    }

    return await this.client.request(query, variables);
  }

  async _getMarketPrice(lastTimeStampForOptionExecution, currentTS) {

    const rawMarketPrices = await this.marketStore.getRangeByScore(
      lastTimeStampForOptionExecution,
      currentTS
    );

    return rawMarketPrices.map((data) => {
      let obj = {};
      obj.roundId = data.value.split("-")[0];
      obj.price = data.value.split("-")[1];
      obj.timestamp = data.score;
      return obj;
    });
  }

  async _calculateExecutables(marketPriceMap, currentTS) {
    const values = await this.executionStore.values("OPTION");
    
    const options = values.reduce(async (filtered, option) => {
      const filteredAcc = await Promise.resolve(filtered);
      const optionJSON = JSON.parse(option);
      if (optionJSON.isPlus && optionJSON.expiry >= currentTS) {
        if (optionJSON.isUp) {
          const striked = marketPriceMap.find(
            (pMap) =>
              pMap.timestamp >= optionJSON.blockTimeStamp &&
              optionJSON.barrierPrice <= pMap.price
          );
          if (striked) {
            optionJSON.barrier_hit_round_Id = striked.roundId;
            await this.executionStore.add(optionJSON); 
            filteredAcc.push(optionJSON);
          }
        } else {
          const striked = marketPriceMap.find(
            (pMap) =>
              pMap.timestamp >= optionJSON.blockTimeStamp &&
              optionJSON.barrierPrice >= pMap.price
          );
          if (striked) {
            optionJSON.barrier_hit_round_Id = striked.roundId;
            await this.executionStore.add(optionJSON);
            filteredAcc.push(optionJSON);
          }
        }
      }
      return Promise.resolve(filteredAcc);
    }, Promise.resolve([]));
    return options;
  }
}

module.exports = { Executor };
