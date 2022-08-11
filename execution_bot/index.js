require("dotenv").config();
const { Executor } = require("./executor");
const { ExecutionStore } = require("./execution-store");
const { MarketStore } = require("./market-store");
const { PriceUpdater } = require("./priceUpdator");
const { ExecutedStore } = require("./executed-store");
const { Redeem } = require("./executed-redeem");

if (Number(process.env.POLL_INTERVAL_MS) < 1000) {
  throw new Error("Poll Interval too low");
}

async function start() {
  //const wallet = loadWallet();
  const executionStore = new ExecutionStore();
  const marketPriceStore = new MarketStore();
  const executedStore = new ExecutedStore();

  const marketPriceUpdater = new PriceUpdater(marketPriceStore);
  const executor = new Executor(executionStore, marketPriceStore);
  const redeem = new Redeem(executedStore);

  marketPriceStore.start();
  executionStore.start();
  executedStore.start();

  // console.log("MarketPrice updater start-----");
  marketPriceUpdater.start();
  // const values = await marketPriceUpdater.test();
  // console.log("Values : ", values);
  executor.start();
  redeem.start();
}

start();
