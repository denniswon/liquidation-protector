const { deployments, ethers } = require('hardhat')
const { fixture, _createOption } = require('./fixtures')
const { BigNumber } = require('../hardhat.config')
const { parseHexString, MAX_UINT } = require('./util')
const { increaseTime } = require('./timeUtil')
const { expect } = require('chai')
const { sharedFixture } = require('./sharedFixture')
const { makerDaoFixture } = require('./makerDaoFixtures')

describe("OptionController", () => {
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

  it("Controller can execute the option when the price hit the barrier (Up-in)", async () => {
    const [owner] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: owner,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 100000,
      isUp: true,
    })

    const roundId1 = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId1)).to.equal(false)

    // After the price touched the barrier price,
    // Option can be executed.
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait())
    const roundId2 = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId2)).to.equal(true)

    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(false)

    // Execute
    await controller.execute(plusOptionId, roundId2).then((tx) => tx.wait())
    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(true)
  })

  it("Controller can execute the option when the price hit the barrier (Down-in)", async () => {
    const [owner] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: owner,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 100000,
      isUp: false,
    })

    const roundId1 = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId1)).to.equal(false)

    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait())
    const roundId2 = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId2)).to.equal(false)

    // After the price touched the barrier price,
    // Option can be executed.
    await oracle.setPrice(1300 * 10 ** 6).then((tx) => tx.wait())
    const roundId3 = await oracle.roundId().then(parseHexString)
    expect(await controller.canExecute(plusOptionId, roundId3)).to.equal(true)

    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(false)
    
    // Execute
    await controller.execute(plusOptionId, roundId3).then((tx) => tx.wait())
    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(true)
  })

  it("Can't execute with the round which happened before option creation", async () => {
    const [owner] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait())
    const roundId = await oracle.roundId().then(parseHexString)

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: owner,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 1000,
      isUp: true,
    })

    // Try to execute with invalid round
    expect(await controller.canExecute(plusOptionId, roundId)).to.equal(false)
    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(false)
    await expect(controller.execute(plusOptionId, roundId)).to.be.reverted

    // With valid round
    await oracle.setPrice(1600 * 10 ** 6).then((tx) => tx.wait())
    const roundId2 = await oracle.roundId().then(parseHexString)

    expect(await controller.canExecute(plusOptionId, roundId2)).to.equal(true)
    await controller.execute(plusOptionId, roundId2).then((tx) => tx.wait())
    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(true)
  })

  it("Can't execute with the round which happened before option creation", async () => {
    const [owner] = await ethers.getSigners()
    const block = await ethers.provider.getBlock()

    const { plusOptionToken, minusOptionToken, plusOptionId, minusOptionId, multiplier } = await _createOption({
      signer: owner,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: new BigNumber(1400).multipliedBy(10 ** 6).toString(),
      multiplier: 1,
      expiry: block.timestamp + 1000,
      isUp: true,
    })

    await increaseTime(1000)

    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait())
    const roundId = await oracle.roundId().then(parseHexString)

    // Try to execute with invalid round
    expect(await controller.canExecute(plusOptionId, roundId)).to.equal(false)
    expect(await controller.isExecuted(plusOptionToken.address)).to.equal(false)
    await expect(controller.execute(plusOptionId, roundId)).to.be.reverted
  })
})