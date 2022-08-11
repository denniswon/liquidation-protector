const { ethers } = require("hardhat");
const { deployLogic, deployProxy } = require("./proxyUtil");
const { BigNumber } = require("../hardhat.config");
const { MAX_UINT } = require("./util");

const makerDaoFixture = async function ({ oracle, dai, weth }) {
  const [deployer] = await ethers.getSigners();

  const MakerDaoController = await ethers.getContractFactory(
    "MakerDaoController"
  );
  const makerDaoController = await MakerDaoController.deploy();
  await makerDaoController.deployed();

  const MakerDaoVault = await ethers.getContractFactory("MakerDaoVault");
  const makerDaoVault = await MakerDaoVault.deploy();
  await makerDaoVault.deployed();

  await makerDaoController.setConfig(
    oracle.address,
    makerDaoVault.address,
    dai.address,
    weth.address,
    8000
  );
  await makerDaoVault.setVaultManager(makerDaoController.address, true);
  await dai.setDaiMinter(makerDaoController.address, true);

  await weth
    .connect(deployer)
    .approve(makerDaoController.address, MAX_UINT)
    .then((tx) => tx.wait());
  await dai
    .connect(deployer)
    .approve(makerDaoController.address, MAX_UINT)
    .then((tx) => tx.wait());

  return {
    makerDaoController,
    makerDaoVault,
    oracle,
    dai,
    weth,
  };
};

module.exports = {
  makerDaoFixture,
};
