require('dotenv').config();
const { ethers } = require("ethers");
const {LiquidationStore} = require('./liquidation-store');
const {MarketStore} = require('../execution_bot/market-store');
const {PriceUpdater} = require('../execution_bot/priceUpdator');
const {Liquidator} = require('./liquidator');

if (Number(process.env.POLL_INTERVAL_MS) < 1000 ){
    throw new Error('Poll Interval too low');
}

async function start() {

    const liquidationStore = new LiquidationStore();
    const marketPriceStore = new MarketStore();
    const marketPriceUpdater = new PriceUpdater(marketPriceStore);
    const liquidator = new Liquidator(liquidationStore, marketPriceStore);
    
    marketPriceStore.start();
    liquidationStore.start();
    marketPriceUpdater.start();
    liquidator.start();
}

start();