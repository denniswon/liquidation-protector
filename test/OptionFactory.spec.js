const { deployments, ethers } = require('hardhat')
const { fixture, _createOption } = require('./fixtures')
const { BigNumber } = require('../hardhat.config')
const { parseHexString, MAX_UINT } = require('./util')
const { expect } = require('chai')
const { sharedFixture } = require('./sharedFixture')
const { makerDaoFixture } = require('./makerDaoFixtures')

// 1. option create
describe("OptionFactory", () => {
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

  it("addressRouter set", async () => {
    expect(await optionFactory.addressRouter()).to.equal(addressRouter.address)
  })

  it("'createOption' should increase option token balances of creator by +(multiplier * 10 ** 18)", async () => {
    const [owner] = await ethers.getSigners()

    const block = await ethers.provider.getBlock()

    const { plusOptionToken, minusOptionToken, multiplier } = await _createOption({
      signer: owner,
      optionFactory,
      underlying: weth.address,
      collateral: weth.address,
      barrierPrice: 1400,
      multiplier: 1,
      expiry: block.timestamp + 1000,
      isUp: true,
    })

    const plusOptionBalance = await plusOptionToken.balanceOf(owner.address).then(parseHexString)
    const minusOptionBalance = await minusOptionToken.balanceOf(owner.address).then(parseHexString)

    // Check contract existence
    expect(minusOptionToken.address).not.to.equal("0x" + "0".repeat(40))
    expect(plusOptionToken.address).not.to.equal("0x" + "0".repeat(40))

    // Check option token balance
    expect(plusOptionBalance).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())
    expect(minusOptionBalance).to.equal(new BigNumber(multiplier).multipliedBy(10 ** 18).toString())
  })
})