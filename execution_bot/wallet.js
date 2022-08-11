const { ethers } = require("ethers");
require("dotenv").config();
const provider = new ethers.providers.JsonRpcProvider(process.env.NODE_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const wallet = {};

function loadWallet() {
    if (!process.env.PRIVATE_KEY){
        return ;
    }
    wallet.provider = provider;
    wallet.signer = signer;
    return wallet;
}

module.exports = { loadWallet }