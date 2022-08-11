const { deployments, ethers } = require('hardhat')
const { fixture, _createOption } = require('./fixtures')
const { BigNumber } = require('../hardhat.config')
const { parseHexString, MAX_UINT } = require('./util')
const { increaseTime } = require('./timeUtil')
const { expect } = require('chai')
const { sharedFixture } = require('./sharedFixture')
const { makerDaoFixture } = require('./makerDaoFixtures')

describe("MinusOption", () => {
  let controller
  let optionFactory
  let addressRouter
  let oracle
  let weth
  let dai

  let DISPUTE_BUFFER

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

    DISPUTE_BUFFER = await controller.DISPUTE_BUFFER().then(a => BigNumber(a._hex).toNumber())
  })

  it("Minus option owner can redeem when the price hit the barrier (Up-in)", async () => {
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
    expect(await controller.canExecute(minusOptionId, roundId)).to.equal(false)
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)
    await expect(minusOptionToken.connect(optionCreator).redeem(optionCreator.address)).to.be.reverted

    // Makes the option expired.
    await increaseTime(100000)
    await increaseTime(DISPUTE_BUFFER)

    // Execute (Revert)
    expect(await controller.canExecute(minusOptionId, roundId)).to.equal(false)
    await expect(controller.execute(plusOptionId, roundId)).to.be.reverted

    // redeem
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(true)

    expect(await minusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())
    
    await minusOptionToken.connect(optionCreator).redeem(optionCreator.address).then((tx) => tx.wait())

    const [underlying, collateral] = await plusOptionToken.getDetail()

    const collateralToken = await ethers.getContractAt("IERC20", collateral)

    // Check minus option token burned
    expect(await minusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal("0")
    // Receive collateral token
    expect(await collateralToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(
      new BigNumber(multiplier).multipliedBy(10 ** 18).toString()
    )
  })

  it("Minus option owner can redeem when the price hit the barrier (Down-in)", async () => {
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
    expect(await controller.canExecute(minusOptionId, roundId)).to.equal(false)
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)
    await expect(minusOptionToken.connect(optionCreator).redeem(optionCreator.address)).to.be.reverted

    // Makes the option expired.
    await increaseTime(100000)
    await increaseTime(DISPUTE_BUFFER)

    // Execute (Revert)
    expect(await controller.canExecute(minusOptionId, roundId)).to.equal(false)
    await expect(controller.execute(plusOptionId, roundId)).to.be.reverted

    // redeem
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(true)

    expect(await minusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    await minusOptionToken.connect(optionCreator).redeem(optionCreator.address).then((tx) => tx.wait())

    const [underlying, collateral] = await plusOptionToken.getDetail()

    const collateralToken = await ethers.getContractAt("IERC20", collateral)

    // Check minus option token burned
    expect(await minusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal("0")
    // Receive collateral token
    expect(await collateralToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(
      new BigNumber(multiplier).multipliedBy(10 ** 18).toString()
    )
  })

  it("Minus option owner can't redeem when the price hit the barrier (Up-in)", async () => {
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
    expect(await controller.canExecute(minusOptionId, roundId)).to.equal(true)
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)

    // Execute
    await expect(controller.execute(plusOptionId, roundId))

    expect(await minusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    // Redeem
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)
    await expect(minusOptionToken.connect(optionCreator).redeem(optionCreator.address)).to.be.reverted
  })

  it("Minus option owner can't redeem when the price hit the barrier (Down-in)", async () => {
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
    expect(await controller.canExecute(minusOptionId, roundId)).to.equal(true)
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)

    // Execute
    await expect(controller.execute(plusOptionId, roundId))

    expect(await minusOptionToken.balanceOf(optionCreator.address).then(parseHexString)).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())

    // Redeem
    expect(await minusOptionToken.connect(optionCreator).canRedeem(optionCreator.address)).to.equal(false)
    await expect(minusOptionToken.connect(optionCreator).redeem(optionCreator.address)).to.be.reverted
  })
})