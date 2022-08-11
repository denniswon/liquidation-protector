require("dotenv").config();
const { gql, request, GraphQLClient } = require("graphql-request");
const { ExecutionResult: ResultType } = require("../execution_bot/enum");
const { ethers } = require("ethers");
const keccak256 = require("keccak256");
const { STORETYPE } = require("./enum");
const helper = require("./helper");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class Liquidator {
  client;
  lastTimeStampForGraphQuery = 0;
  lastTimeStampForLiquidation = 0;
  liquidationStore;
  marketStore;

  constructor(liquidationStore, marketStore) {
    this.liquidationStore = liquidationStore;
    const endpoint = "https://api.thegraph.com/subgraphs/name/ivanzrx/vault";
    this.client = new GraphQLClient(endpoint, { headers: {} });
    this.marketStore = marketStore;
  }

  start = () => {
    this._poll();
  };

  _poll = async () => {
    for (;;) {
      const liquidableVaults = await this._getliquidableVaults();
      await this._liquidate(liquidableVaults);
      await delay(Number(process.env.POLL_INTERVAL_MS));
    }
  };

  _liquidate = async (liquidableVaults) => {
    if (!liquidableVaults) {
      return;
    }
    if (liquidableVaults.length == 0) {
      return;
    }

    const liquidateFailed = (
      await this.liquidationStore.values(STORETYPE.FAILEDVAULT)
    ).map((vaultStr) => {
      return JSON.parse(vaultStr);
    });
    const vaultList = liquidableVaults.concat(liquidateFailed);
    if (vaultList.length == 0) {
      return;
    }
    console.log(
      "[Liquidation Bot] Liquidable vault counter : ",
      vaultList.length
    );
    for await (let vault of vaultList) {
      try {
        const liquidation = await helper.liquidateVault(vault);

        if (liquidation !== ResultType.TXUNREACHED) {

          await this.liquidationStore.remove(STORETYPE.VAULT, vault);

          if (liquidation === ResultType.TXSUCCEED) {
            this.lastTimeStampForLiquidation = vault.blockTimeStamp;
            console.log(`[Liquidation Bot] ${vault.id} liquidation succeeded.`);
            if (
              await this.liquidationStore.contains(STORETYPE.FAILEDVAULT, vault)
            ) {
              await this.liquidationStore.remove(STORETYPE.FAILEDVAULT, vault);

            }
          }
          if (liquidation === ResultType.TXFAILED) {
            console.log(`[Liquidation Bot] ${vault.id} liquidation failed.`);
            await this.liquidationStore.add(STORETYPE.FAILEDVAULT, vault);

          }
        }
      } catch (e) {
        console.log(`[Liquidation Bot] Liquidation failed.`);
      }
    }
  };

  async _getliquidableVaults() {
    const response = await this._request(this.lastTimeStampForGraphQuery);
    const vaults = response.vaults;
    if (vaults.length == 0) {
      console.log("[Liquidation Bot] No new fetched vault data");
    } else {
      const rawVaults = vaults.map((entity) => {
        return {
          id: entity.id,
          debt: entity.debt,
          collateral: entity.collateral,
          liquidationPrice: entity.liquidationPrice,
          blockTimeStamp: entity.blockTimeStamp,
          liquidation_hit_round_Id: 0,
        };
      });
      for await (let vault of rawVaults) {
        const result = await this.liquidationStore.add(STORETYPE.VAULT, vault);

      }
      this.lastTimeStampForGraphQuery = rawVaults[0].blockTimeStamp;
    }
    let currentTS = Math.floor(Date.now() / 1000).toString();
    const marketPriceMap = await this._getMarketPrice(
      this.lastTimeStampForLiquidation,
      currentTS
    );
    const liquidableOptions = await this._calculateLiquidable(
      marketPriceMap,
      currentTS
    );


    return liquidableOptions;
  }

  async _request(lastTimeStampForGraphQuery) {
    console.log(
      "_request lastTimeStampForGraphQuery : ",
      lastTimeStampForGraphQuery
    );
    let variables = {};
    let query;
    const vaults = await this.liquidationStore.values(STORETYPE.VAULT);
    if (vaults.length == 0) {

      query = gql`
        query firstPulloptions($lastTS: BigInt) {
          vaults(
            first: 1000
            orderBy: blockTimeStamp
            orderDirection: desc
            where: { blockTimeStamp_gt: $lastTS, debt_gt: 0, collateral_gt: 0 }
          ) {
            id
            debt
            collateral
            liquidationPrice
            blockTimeStamp
          }
        }
      `;
      variables = {
        lastTS: lastTimeStampForGraphQuery,
      };
    } else {
      query = gql`
        query manyOptions($lastTS: BigInt) {
          vaults(
            first: 5
            orderBy: blockTimeStamp
            orderDirection: desc
            where: { blockTimeStamp_gt: $lastTS, debt_gt: 0, collateral_gt: 0 }
          ) {
            id
            debt
            collateral
            liquidationPrice
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

  async _getMarketPrice(lastTimeStampForLiquidation, currentTS) {
    const rawMarketPrices = await this.marketStore.getRangeByScore(
      lastTimeStampForLiquidation,
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

  async _calculateLiquidable(marketPriceMap, currentTS) {
    const vaults = await this.liquidationStore.values(STORETYPE.VAULT);
    const liquidableVaults = vaults.reduce(async (filtered, vault) => {
      const filteredAcc = await Promise.resolve(filtered);
      const vaultJSON = JSON.parse(vault);
      if (vaultJSON.collateral > 0 || vaultJSON.debt > 0) {
        const striked = marketPriceMap.find(
          (pMap) =>
            pMap.timestamp >= vaultJSON.blockTimeStamp &&
            vaultJSON.liquidationPrice >= pMap.price
        );
        if (striked) {
          vaultJSON.liquidation_hit_round_Id = striked.roundId;
          await this.liquidationStore.add(STORETYPE.VAULT, vaultJSON);
          filteredAcc.push(vaultJSON);
        }
      }
      return Promise.resolve(filteredAcc);
    }, Promise.resolve([]));
    return liquidableVaults;
  }
}

module.exports = { Liquidator };
