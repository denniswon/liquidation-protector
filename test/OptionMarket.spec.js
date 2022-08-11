const { deployments, ethers } = require('hardhat')
const { fixture, _createOption } = require('./fixtures')
const { BigNumber } = require('../hardhat.config')
const { parseHexString, MAX_UINT } = require('./util')
const { expect } = require('chai')
const { sharedFixture } = require('./sharedFixture')
const { makerDaoFixture } = require('./makerDaoFixtures')

describe("OptionMarket", () => {
  let controller
  let optionFactory
  let addressRouter
  let oracle
  let weth
  let dai
  let optionMarket

  beforeEach(async () => {
    const {
      oracle: _oracle,
      dai: _dai,
      weth: _weth,
    } = await sharedFixture()

    const {
      makerDaoController: _makerDaoController,
      makerDaoVault: _makerDaoVault,
    } = await makerDaoFixture({
      oracle: _oracle,
      dai: _dai,
      weth: _weth,
    })

    let {
      controller: _controller,
      optionFactory: _optionFactory,
      addressRouter: _addressRouter,
      optionMarket: _optionMarket,
    } = await fixture({
      oracle: _oracle,
      makerDaoController: _makerDaoController,
      makerDaoVault: _makerDaoVault,
    })

    controller = _controller
    optionFactory = _optionFactory
    addressRouter = _addressRouter
    oracle = _oracle
    weth = _weth
    dai = _dai
    optionMarket = _optionMarket
  })

  it("After calling makeOrder, minus option -> option maker, plus option -> option market contract", async () => {
    const [owner, optionCreator] = await ethers.getSigners()

    const block = await ethers.provider.getBlock()

    const quantity = "1"
    const barrierPrice = new BigNumber(1400).multipliedBy(10 ** 6).toString()
    const isUp = true
    const premium = new BigNumber(0.3).multipliedBy(10 ** 18).toString()

    await weth.mint(optionCreator.address, new BigNumber(1000).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    await weth.connect(optionCreator).approve(optionMarket.address, MAX_UINT).then((tx) => tx.wait())

    await optionMarket.connect(optionCreator).makeOrder([
      weth.address, // underlying
      weth.address, // collateral
      quantity, // quantity
      barrierPrice, // barrier price
      block.timestamp + 1000, // expiry
      isUp, // isUp
      premium
    ]).then((tx) => tx.wait())

    const minusOptionAddress = optionFactory.getOptionAddress(
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      block.timestamp + 1000, // expiry
      isUp, // isUp
      false, // isPlus
    )
    
    const minusOption = await ethers.getContractAt("KIMinusOption", minusOptionAddress)
    const minusOptionBalance = await minusOption.balanceOf(optionCreator.address).then(parseHexString)

    expect(minusOptionBalance).to.equal(new BigNumber(quantity).multipliedBy(10 ** 18).toString())

    const plusOptionAddress = optionFactory.getOptionAddress(
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      block.timestamp + 1000, // expiry
      isUp, // isUp
      true, // isPlus
    )

    const plusOption = await ethers.getContractAt("KIPlusOption", plusOptionAddress)
    const plusOptionBalance = await plusOption.balanceOf(optionMarket.address).then(parseHexString)
    expect(plusOptionBalance).to.equal(new BigNumber(quantity).multipliedBy(10 ** 18).toString())
  })

  it("Taker ", async () => {
    const [owner, optionCreator, optionTaker] = await ethers.getSigners()

    const block = await ethers.provider.getBlock()

    const quantity = "1"
    const barrierPrice = new BigNumber(1400).multipliedBy(10 ** 6).toString()
    const isUp = true
    const premium = new BigNumber(0.75).multipliedBy(10 ** 18).toString()

    await weth.mint(optionCreator.address, new BigNumber(1000).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    await weth.connect(optionCreator).approve(optionMarket.address, MAX_UINT).then((tx) => tx.wait())

    const expiry = block.timestamp + 1000

    await optionMarket.connect(optionCreator).makeOrder([
      weth.address, // underlying
      weth.address, // collateral
      quantity, // quantity
      barrierPrice, // barrier price
      expiry, // expiry
      isUp, // isUp
      premium
    ]).then((tx) => tx.wait())

    await weth.mint(optionTaker.address, new BigNumber(1000).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    await weth.connect(optionTaker).approve(optionMarket.address, MAX_UINT).then((tx) => tx.wait())

    const makerCollateralBalanceBefore = await weth.balanceOf(optionCreator.address).then(parseHexString)
    const takerCollateralBalanceBefore = await weth.balanceOf(optionTaker.address).then(parseHexString)

    // Take Order
    await optionMarket.connect(optionTaker).takeOrder(
      optionCreator.address,
      weth.address,
      weth.address,
      barrierPrice,
      quantity,
      expiry,
      isUp,
      premium,
      0 // order nonce
    ).then((tx) => tx.wait())

    const makerCollateralBalanceAfter = await weth.balanceOf(optionCreator.address).then(parseHexString)
    const takerCollateralBalanceAfter = await weth.balanceOf(optionTaker.address).then(parseHexString)

    const plusOptionAddress = optionFactory.getOptionAddress(
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      block.timestamp + 1000, // expiry
      isUp, // isUp
      true, // isPlus
    )

    // Check taker received plus option
    const plusOption = await ethers.getContractAt("KIPlusOption", plusOptionAddress)
    const plusOptionBalance = await plusOption.balanceOf(optionTaker.address).then(parseHexString)
    expect(plusOptionBalance).to.equal(new BigNumber(quantity).multipliedBy(10 ** 18).toString())

    // Check taker paid premium
    expect(takerCollateralBalanceAfter).to.equal(new BigNumber(takerCollateralBalanceBefore).minus(premium).toString())

    // Check maker received premium
    expect(makerCollateralBalanceAfter).to.equal(new BigNumber(makerCollateralBalanceBefore).plus(premium).toString())
  })

  it("Cancel order", async () => {
    const [owner, optionCreator, optionTaker] = await ethers.getSigners()

    const block = await ethers.provider.getBlock()

    const quantity = "1"
    const barrierPrice = new BigNumber(1400).multipliedBy(10 ** 6).toString()
    const isUp = true
    const premium = new BigNumber(0.75).multipliedBy(10 ** 18).toString()

    await weth.mint(optionCreator.address, new BigNumber(1000).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    await weth.connect(optionCreator).approve(optionMarket.address, MAX_UINT).then((tx) => tx.wait())

    const expiry = block.timestamp + 1000

    await optionMarket.connect(optionCreator).makeOrder([
      weth.address, // underlying
      weth.address, // collateral
      quantity, // quantity
      barrierPrice, // barrier price
      expiry, // expiry
      isUp, // isUp
      premium
    ]).then((tx) => tx.wait())

    await weth.mint(optionTaker.address, new BigNumber(1000).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    await weth.connect(optionTaker).approve(optionMarket.address, MAX_UINT).then((tx) => tx.wait())

    await optionMarket.connect(optionCreator).cancelOrder(
      optionCreator.address,
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      quantity, // quantity
      expiry, // expiry
      isUp, // isUp
      premium,
      "0" // orderNonce
    ).then((tx) => tx.wait())

    const plusOptionAddress = optionFactory.getOptionAddress(
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      block.timestamp + 1000, // expiry
      isUp, // isUp
      true, // isPlus
    )

    const plusOption = await ethers.getContractAt("KIPlusOption", plusOptionAddress)
    const plusOptionBalance = await plusOption.balanceOf(optionCreator.address).then(parseHexString)
    
    // Return plus option to option creator
    expect(plusOptionBalance).to.equal(new BigNumber(quantity).multipliedBy(10 ** 18).toString())

    // "takeOrder" should revert
    await expect(optionMarket.connect(optionTaker).takeOrder(
      optionCreator.address,
      weth.address,
      weth.address,
      barrierPrice,
      quantity,
      expiry,
      isUp,
      premium,
      0 // order nonce
    )).to.be.reverted
  })
})