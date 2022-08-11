const { ethers } = require("hardhat")
const { deployLogic, deployProxy } = require("./proxyUtil")
const { BigNumber } = require("../hardhat.config")
const { parseHexString, MAX_UINT } = require('./util')

const fixture = async function ({ oracle, makerDaoController, makerDaoVault }) {
  const [owner] = await ethers.getSigners()

  const addressRouterImplemenation = await deployLogic("AddressRouter")
  const addressRouter = await deployProxy({
    contractFactoryName: "AddressRouter",
    logicContract: addressRouterImplemenation,
    admin: owner.address,
    initializeSignature: "initialize()",
    initializeArgs: {
      types: [],
      args: [],
    },
    signer: owner,
  })

  const controllerImlementation = await deployLogic("KIOptionController")
  const controller = await deployProxy({
    contractFactoryName: "KIOptionController",
    logicContract: controllerImlementation,
    admin: owner.address,
    initializeSignature: "initialize(address)",
    initializeArgs: {
      types: ['address'],
      args: [addressRouter.address],
    },
    signer: owner,
  })

  const plusOptionImplemenation = await deployLogic("KIPlusOption")
  const minusOptionImplemenation = await deployLogic("KIMinusOption")

  const optionFactoryImplemenation = await deployLogic("KIOptionFactory")
  const optionFactory = await deployProxy({
    contractFactoryName: "KIOptionFactory",
    logicContract: optionFactoryImplemenation,
    admin: owner.address,
    initializeSignature: "initialize(address)",
    initializeArgs: {
      types: ['address'],
      args: [addressRouter.address],
    },
    signer: owner,
  })

  // Add OptionFactory to address router's operator
  await addressRouter.setOperator(optionFactory.address, true).then((tx) => tx.wait())

  // Option Market
  const optionMarketImplementation = await deployLogic("OptionMarket")
  const optionMarket = await deployProxy({
    contractFactoryName: "OptionMarket",
    logicContract: optionMarketImplementation,
    admin: owner.address,
    initializeSignature: "initialize(address)",
    initializeArgs: {
      types: ['address'],
      args: [optionFactory.address],
    },
    signer: owner,
  })

  await addressRouter.setConfig(
    controller.address,
    oracle.address,
    optionFactory.address,
    plusOptionImplemenation.address,
    minusOptionImplemenation.address,
    optionMarket.address,
    makerDaoVault.address,
    makerDaoController.address
  ).then((tx) => tx.wait())

  return { 
    controller, 
    addressRouter, 
    optionFactory, 
    oracle,
    optionMarket,
  }
}

const _createOption = async ({ underlying, collateral, multiplier, barrierPrice, expiry, isUp, signer, optionFactory }) => {

  // Approve
  const collateralToken = await ethers.getContractAt("IERC20", collateral)

  const allowance = await collateralToken.allowance(signer.address, optionFactory.address).then(parseHexString)

  if (allowance == 0) {
    await collateralToken.connect(signer).approve(optionFactory.address, MAX_UINT).then((tx) => tx.wait())
  }

  await optionFactory.connect(signer).createOption([
    underlying, // underlying
    collateral, // collateral
    multiplier, // multiplier
    barrierPrice, // barrier price
    expiry, // expiry
    isUp, // isUp
  ]).then((tx) => tx.wait())

  const plusOptionAddress = await optionFactory.getOptionAddress(
    underlying, // underlying
    collateral, // collateral
    barrierPrice, // barrier price
    expiry, // expiry
    isUp, // isUp
    true,
  )

  const minusOptionAddress = await optionFactory.getOptionAddress(
    underlying, // underlying
    collateral, // collateral
    barrierPrice, // barrier price
    expiry, // expiry
    isUp, // isUp
    false,
  )

  const plusOptionId = await optionFactory.getOptionId(
    underlying, // underlying
    collateral, // collateral
    barrierPrice, // barrier price
    expiry, // expiry
    isUp, // isUp
    true,
  )

  const minusOptionId = await optionFactory.getOptionId(
    underlying, // underlying
    collateral, // collateral
    barrierPrice, // barrier price
    expiry, // expiry
    isUp, // isUp
    false,
  )

  const plusOptionToken = await ethers.getContractAt("KIPlusOption", plusOptionAddress)
  const minusOptionToken = await ethers.getContractAt("KIMinusOption", minusOptionAddress)

  return {
    multiplier,
    plusOptionToken,
    minusOptionToken,
    plusOptionId,
    minusOptionId,
  }
}

module.exports = {
  fixture,
  _createOption,
}