const { deployments, ethers } = require('hardhat')
const { fixture, _createOption } = require('./fixtures')
const { BigNumber } = require('../hardhat.config')
const { parseHexString, MAX_UINT } = require('./util')
const { increaseTime } = require('./timeUtil')
const { expect } = require('chai')
const { sharedFixture } = require('./sharedFixture')
const { makerDaoFixture } = require('./makerDaoFixtures')

describe("PlusOption", () => {
  let controller
  let optionFactory
  let addressRouter
  let oracle
  let weth
  let dai

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
  })

  it("Plus option owner can redeem when the price hit the barrier (Up-in)", async () => {
    const [owner, optionCreator] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    // mint WETH(collateral) to option creator
    await weth.mint(optionCreator.address, new BigNumber(1).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: optionCreator,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 100000,
      isUp: true,
    })

    // Set oracle price
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait())
    const roundId = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId)).to.equal(true)
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)

    // Execute
    await controller.execute(plusOptionId, roundId).then((tx) => tx.wait())

    expect(await plusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    // Redeem
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(true)
    await plusOptionToken.connect(optionCreator).redeem(optionCreator.address).then((tx) => tx.wait())

    const [ underlying, collateral ] = await plusOptionToken.getDetail()

    const collateralToken = await ethers.getContractAt("IERC20", collateral)

    // Check plus option token burned
    expect(await plusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal("0")

    // Receive collateral token
    expect(await collateralToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(
      new BigNumber(multiplier).multipliedBy(10 ** 18).toString()
    )
  })

  it("Plus option owner can redeem when the price hit the barrier (Down-in)", async () => {
    const [owner, optionCreator] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    // mint WETH(collateral) to option creator
    await weth.mint(optionCreator.address, new BigNumber(1).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: optionCreator,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 100000,
      isUp: false,
    })

    // Set oracle price
    await oracle.setPrice(1300 * 10 ** 6).then((tx) => tx.wait())
    const roundId = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId)).to.equal(true)
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)

    // Execute
    await controller.execute(plusOptionId, roundId).then((tx) => tx.wait())

    expect(await plusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    // Redeem
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(true)
    await plusOptionToken.connect(optionCreator).redeem(optionCreator.address).then((tx) => tx.wait())

    const [underlying, collateral] = await plusOptionToken.getDetail()

    const collateralToken = await ethers.getContractAt("IERC20", collateral)

    // Check plus option token burned
    expect(await plusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal("0")

    // Receive collateral token
    expect(await collateralToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(
      new BigNumber(multiplier).multipliedBy(10 ** 18).toString()
    )
  })

  it("Plus option owner can't redeem when the price didn't hit the barrier (Up-in)", async () => {
    const [owner, optionCreator] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    // mint WETH(collateral) to option creator
    await weth.mint(optionCreator.address, new BigNumber(1).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: optionCreator,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 100000,
      isUp: true,
    })

    // Set oracle price
    await oracle.setPrice(1300 * 10 ** 6).then((tx) => tx.wait())
    const roundId = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId)).to.equal(false)
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)

    // Execute
    await expect(controller.execute(plusOptionId, roundId)).to.be.reverted

    expect(await plusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    // Redeem
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)
    await expect(plusOptionToken.connect(optionCreator).redeem(optionCreator.address)).to.be.reverted
  })

  it("Plus option owner can't redeem when the price didn't hit the barrier (Up-in)", async () => {
    const [owner, optionCreator] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    // mint WETH(collateral) to option creator
    await weth.mint(optionCreator.address, new BigNumber(1).multipliedBy(10 ** 18).toString()).then((tx) => tx.wait())

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: optionCreator,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 100000,
      isUp: false,
    })

    // Set oracle price
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait())
    const roundId = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId)).to.equal(false)
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)

    // Execute
    await expect(controller.execute(plusOptionId, roundId)).to.be.reverted

    expect(await plusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    // Redeem
    expect(await plusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)
    await expect(plusOptionToken.connect(optionCreator).redeem(optionCreator.address)).to.be.reverted
  })
})