const { ethers } = require("hardhat");
const { deployLogic, deployProxy } = require("./proxyUtil");
const { BigNumber } = require("../hardhat.config");
const { MAX_UINT } = require("./util");

const sharedFixture = async function () {
  const [deployer] = await ethers.getSigners();

  const oracle = await deployLogic("OracleMock");

  const Dai = await deployLogic("Dai");
  const dai = await deployProxy({
    contractFactoryName: "Dai",
    logicContract: Dai,
    admin: deployer.address,
    initializeSignature: "initialize()",
    initializeArgs: {
      types: [],
      args: [],
    },
    signer: deployer,
  });

  const weth = await deployLogic("ERC20Mock");
  await weth.__ERC20__init("WETH", "WETH").then((tx) => tx.wait());
  await weth
    .mint(
      deployer.address,
      new BigNumber(10000).multipliedBy(10 ** 18).toString()
    )
    .then((tx) => tx.wait());

  return {
    oracle,
    dai,
    weth,
  };
};

module.exports = {
  sharedFixture,
};
