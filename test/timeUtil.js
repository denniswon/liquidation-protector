const { ethers } = require("hardhat")

const increaseTime = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds])
  await ethers.provider.send("evm_mine") // this one will have 02:00 PM as its timestamp
}

const setTime = async (timestamp) => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp])
  await ethers.provider.send("evm_mine") // this one will have 02:00 PM as its timestamp
}

module.exports = {
  increaseTime,
  setTime,
}