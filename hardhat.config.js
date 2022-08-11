require("@nomiclabs/hardhat-ethers")
require("@nomiclabs/hardhat-waffle")
require("@nomicfoundation/hardhat-chai-matchers")

const { resolve } = require("path")
const { config } = require("dotenv")
config({ path: resolve(__dirname, "./test.env") })
config({ path: resolve(__dirname, "./secret.env") })

const BigNumber = require("bignumber.js");
BigNumber.config({
  EXPONENTIAL_AT: 1000,
  DECIMAL_PLACES: 80,
})

require("./tasks")

module.exports = {
  BigNumber,
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ]
  },
  networks: {
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts: [process.env.PRIVATE_TASK_KEY]
    },
    hardhat: {
      accounts: [
        {
          privateKey: `${process.env.TEST_PRIVATE_KEY}`,
          balance: `${new BigNumber(100000000 * 10 ** 18).toString()}`,
        },
        {
          privateKey: `${process.env.TEST2_PRIVATE_KEY}`,
          balance: `${new BigNumber(100000000 * 10 ** 18).toString()}`,
        },
        {
          privateKey: `${process.env.TEST3_PRIVATE_KEY}`,
          balance: `${new BigNumber(100000000 * 10 ** 18).toString()}`,
        },
        {
          privateKey: `${process.env.TEST4_PRIVATE_KEY}`,
          balance: `${new BigNumber(100000000 * 10 ** 18).toString()}`,
        },
        {
          privateKey: `${process.env.TEST5_PRIVATE_KEY}`,
          balance: `${new BigNumber(100000000 * 10 ** 18).toString()}`,
        },
      ],
    }
  },
  mocha: {
    timeout: 120000
  }
}