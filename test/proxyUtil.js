const { ethers } = require("hardhat")
const keccak256 = require('keccak256')

const abiCoder = new ethers.utils.AbiCoder()

async function deployLogic(contractFactoryName, signer) {

  const LogicContract = await ethers.getContractFactory(contractFactoryName, signer)
    .then((c) => c.deploy())
    .then((c) => c.deployed())

  return ethers.getContractAt(contractFactoryName, LogicContract.address, signer)
}

async function deployProxy({ logicContract, admin, initializeSignature, initializeArgs, contractFactoryName, signer }) {

  const _proxy = await ethers.getContractFactory("contracts/proxy/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy", signer)
  const signature = keccak256(initializeSignature).toString('hex')

  const data = `0x` + signature.slice(0, 8) + abiCoder.encode(
    initializeArgs.types,
    initializeArgs.args,
  ).slice(2)

  const proxy = await _proxy.deploy(logicContract.address, admin, data)
  const proxyContract = await proxy.deployed()

  return ethers.getContractAt(contractFactoryName, proxyContract.address, signer)
}

async function upgradeProxy(proxyAddress, implementationAddress, signer) {
  const _proxy = await ethers.getContractAt("TransparentUpgradeableProxy", proxyAddress, signer)
  const response = await _proxy.upgradeTo(implementationAddress)
}

module.exports = {
  deployLogic,
  deployProxy,
  upgradeProxy,
}