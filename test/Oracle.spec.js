const { deployments, ethers } = require('hardhat')
const { BigNumber } = require('../hardhat.config')
const { parseHexString } = require('./util')
const { expect } = require('chai')
const { fixture } = require('./fixtures')
const { sharedFixture } = require('./sharedFixture')

describe("Oracle", () => {
  let oracle

  beforeEach(async () => {
    const {
      oracle: _oracle,
    } = await sharedFixture()

    oracle = _oracle
  })

  it("setPrice", async () => {
    await oracle.setPrice(4000 * 10 ** 6).then((tx) => tx.wait())
    const price1 = await oracle.getPrice(1).then(([price]) => parseHexString(price))
    expect(price1).to.equal(new BigNumber(4000 * 10 ** 6).toString())

    await oracle.setPrice(8000 * 10 ** 6).then((tx) => tx.wait())
    const price2 = await oracle.getPrice(2).then(([price]) => parseHexString(price))
    expect(price2).to.equal(new BigNumber(8000 * 10 ** 6).toString())

    await oracle.setPrice(12000 * 10 ** 6).then((tx) => tx.wait())
    const price3 = await oracle.getPrice(3).then(([price]) => parseHexString(price))
    expect(price3).to.equal(new BigNumber(12000 * 10 ** 6).toString())
  })

  it("getLatestPrice", async () => {
    await oracle.setPrice(1200 * 10 ** 6).then((tx) => tx.wait())
    const latestPrice1 = await oracle.getLatestPrice().then(([price]) => parseHexString(price))
    expect(latestPrice1).to.equal(new BigNumber(1200 * 10 ** 6).toString())

    await oracle.setPrice(1100 * 10 ** 6).then((tx) => tx.wait())
    const latestPrice2 = await oracle.getLatestPrice().then(([price]) => parseHexString(price))
    expect(latestPrice2).to.equal(new BigNumber(1100 * 10 ** 6).toString())

    await oracle.setPrice(1000 * 10 ** 6).then((tx) => tx.wait())
    const latestPrice3 = await oracle.getLatestPrice().then(([price]) => parseHexString(price))
    expect(latestPrice3).to.equal(new BigNumber(1000 * 10 ** 6).toString())
  })

  it("round id should be increased after setting the price.", async () => {
    await oracle.setPrice(1200 * 10 ** 6).then((tx) => tx.wait())
    const roundId1 = await oracle.roundId().then((roundId) => parseHexString(roundId))
    expect(roundId1).to.equal("1")

    await oracle.setPrice(1300 * 10 ** 6).then((tx) => tx.wait())
    const roundId2 = await oracle.roundId().then((roundId) => parseHexString(roundId))
    expect(roundId2).to.equal("2")

    await oracle.setPrice(1400 * 10 ** 6).then((tx) => tx.wait())
    const roundId3 = await oracle.roundId().then((roundId) => parseHexString(roundId))
    expect(roundId3).to.equal("3")
  })
})