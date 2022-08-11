const { deployments, ethers } = require("hardhat");
const { makerDaoFixture } = require("./makerDaoFixtures");
const { BigNumber } = require("../hardhat.config");
const { parseHexString, MAX_UINT } = require("./util");
const { expect } = require("chai");
const { sharedFixture } = require("./sharedFixture");

describe("MakerDao Mechanism", () => {
  let makerDaoController;
  let makerDaoVault;
  let oracle;
  let weth;
  let dai;

  beforeEach(async () => {
    const { oracle: _oracle, dai: _dai, weth: _weth } = await sharedFixture();

    let {
      makerDaoController: _makerDaoController,
      makerDaoVault: _makerDaoVault,
    } = await makerDaoFixture({ oracle: _oracle, dai: _dai, weth: _weth });

    makerDaoController = _makerDaoController;
    makerDaoVault = _makerDaoVault;
    oracle = _oracle;
    dai = _dai;
    weth = _weth;
  });

  it("loan one-time process", async () => {
    const [owner] = await ethers.getSigners();

    // Set oracle price at $1500
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait());
    const price1 = await oracle
      .getPrice(1)
      .then(([price]) => parseHexString(price));
    expect(price1).to.equal(new BigNumber(1500 * 10 ** 6).toString());

    // Loan Information
    // ETH: $1500
    // Debt: $1200, Collateral: 1
    const collateralAmount = new BigNumber(1).multipliedBy(10 ** 18).toString();
    const collateralLtv = new BigNumber(8000).toString();
    const minDaiAmount = new BigNumber(1140).multipliedBy(10 ** 18).toString();
    // const minDaiAmount2 = new BigNumber(1201).multipliedBy(10 ** 18).toString();

    // Execute 'loan' function
    await makerDaoController
      .loan(
        owner.address,
        owner.address,
        collateralAmount,
        collateralLtv,
        minDaiAmount
      )
      .then((tx) => tx.wait());

    // Check debt balance of loaner
    const balance = await dai.balanceOf(owner.address).then(parseHexString);
    expect(balance).to.equal(
      new BigNumber(1200).multipliedBy(10 ** 18).toString()
    );

    // Check liqudiation price
    expect(await makerDaoVault.isLiquidated(owner.address)).to.equal(false);
    const liquidationPrice = await makerDaoVault
      .vaults(owner.address)
      .then(([, , liquidationPrice]) => parseHexString(liquidationPrice));
    expect(liquidationPrice).to.equal(
      new BigNumber(1200).multipliedBy(10 ** 6).toString()
    );
  });

  it("repay debt process", async () => {
    const [owner] = await ethers.getSigners();

    // Set oracle price at $1500
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait());

    // Loan Information
    // ETH: $1500
    // Debt: $1200, Collateral: 1, Min amount: $1140 (5%)
    const collateralAmount = new BigNumber(1).multipliedBy(10 ** 18).toString();
    const collateralLtv = new BigNumber(8000).toString();
    const minDaiAmount = new BigNumber(1140).multipliedBy(10 ** 18).toString();

    // Execute 'loan' function
    await makerDaoController
      .loan(
        owner.address,
        owner.address,
        collateralAmount,
        collateralLtv,
        minDaiAmount
      )
      .then((tx) => tx.wait());

    // Balance check (before & after)
    const balance = await dai.balanceOf(owner.address).then(parseHexString);
    const beforeBalance = await weth
      .balanceOf(owner.address)
      .then(parseHexString);
    await makerDaoController.repay(owner.address, owner.address, balance);
    const afterBalance = await weth
      .balanceOf(owner.address)
      .then(parseHexString);

    expect(
      new BigNumber(afterBalance).minus(beforeBalance).toString()
    ).to.equal(collateralAmount);
  });

  it("loan two-time at different market price process", async () => {
    const [owner] = await ethers.getSigners();
    const collateralLtv = new BigNumber(8000).toString();

    // First loan
    // ETH: $1500
    // Debt: $1480.8, Collateral: 1.234, Min amount: $1406.76 (5%)
    await oracle.setPrice(1500 * 10 ** 6);
    const collateralAmount1 = new BigNumber(1.234)
      .multipliedBy(10 ** 18)
      .toString();
    const minDaiAmount1 = new BigNumber(1406.76)
      .multipliedBy(10 ** 18)
      .toString();
    await makerDaoController
      .loan(
        owner.address,
        owner.address,
        collateralAmount1,
        collateralLtv,
        minDaiAmount1
      )
      .then((tx) => tx.wait());

    // Second loan
    // ETH: $1423
    // Debt: $2276.8, Collateral: 2, Min amount: $2162.96 (5%)
    await oracle.setPrice(1423 * 10 ** 6);
    const collateralAmount2 = new BigNumber(2)
      .multipliedBy(10 ** 18)
      .toString();
    const minDaiAmount2 = new BigNumber(2162.96)
      .multipliedBy(10 ** 18)
      .toString();
    await makerDaoController
      .loan(
        owner.address,
        owner.address,
        collateralAmount2,
        collateralLtv,
        minDaiAmount2
      )
      .then((tx) => tx.wait());

    // Check balance (should be $2923)
    const balance = await dai.balanceOf(owner.address).then(parseHexString);
    expect(balance).to.equal(
      new BigNumber(3757.6).multipliedBy(10 ** 18).toString()
    );

    // Check vault
    // debt : 3757.6
    // collateral : 3.234
    // liquidationPrice : 1252.53333...
    const vault = await makerDaoVault.vaults(owner.address);
    expect(parseHexString(vault[0])).to.equal(
      new BigNumber(3757.6).multipliedBy(10 ** 18).toString()
    );
    expect(parseHexString(vault[1])).to.equal(
      new BigNumber(3.234).multipliedBy(10 ** 18).toString()
    );
    expect(parseHexString(vault[2])).to.equal(
      new BigNumber(1161.904761).multipliedBy(10 ** 6).toString()
    );
  });

  it("liquidation process", async () => {
    const [owner] = await ethers.getSigners();

    // Set oracle price at $1500
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait());

    // Loan Information
    // ETH: $1500
    // Debt: $1200, Collateral: 1, Min amount: $1140 (5%)
    const collateralAmount = new BigNumber(1).multipliedBy(10 ** 18).toString();
    const collateralLtv = new BigNumber(8000).toString();
    const minDaiAmount = new BigNumber(1140).multipliedBy(10 ** 18).toString();

    // Execute 'loan' function
    await makerDaoController
      .loan(
        owner.address,
        owner.address,
        collateralAmount,
        collateralLtv,
        minDaiAmount
      )
      .then((tx) => tx.wait());

    // Check liquidation price
    const vault = await makerDaoVault.vaults(owner.address);
    const liquidationPrice = parseHexString(vault[2]);
    expect(liquidationPrice).to.equal(
      new BigNumber(1200).multipliedBy(10 ** 6).toString()
    );

    // Set oracle price at $1200 and execute liquidation
    await oracle.setPrice(1200 * 10 ** 6).then((tx) => tx.wait());
    await makerDaoController.settle(owner.address, 2);

    // Check whether liquidation executed
    expect(await makerDaoVault.isLiquidated(owner.address)).to.equal(true);
  });

  it("scenario with liquidation protector", async () => {
    const [owner] = await ethers.getSigners();

    // Set oracle price at $1500
    await oracle.setPrice(1500 * 10 ** 6).then((tx) => tx.wait());

    // Loan Information
    // ETH: $1500
    // Debt: $1200, Collateral: 1, Min amount: $1140 (5%)
    const collateralAmount = new BigNumber(1).multipliedBy(10 ** 18).toString();
    const collateralLtv = new BigNumber(8000).toString();
    const minDaiAmount = new BigNumber(1140).multipliedBy(10 ** 18).toString();

    // Execute 'loan' function
    await makerDaoController
      .loan(
        owner.address,
        owner.address,
        collateralAmount,
        collateralLtv,
        minDaiAmount
      )
      .then((tx) => tx.wait());

    // Liquidation Protector (LTV = 0)
    const addCollateral = new BigNumber(1).multipliedBy(10 ** 18).toString();
    const zeroLtv = new BigNumber(0).toString();
    const zeroPayout = new BigNumber(0).multipliedBy(10 ** 18).toString();

    // Execute 'loan' function by Liquidation Protector
    await makerDaoController
      .loan(owner.address, owner.address, addCollateral, zeroLtv, zeroPayout)
      .then((tx) => tx.wait());

    // Check liquidation price (should be $600)
    const vault = await makerDaoVault.vaults(owner.address);
    const liquidationPrice = parseHexString(vault[2]);
    expect(liquidationPrice).to.equal(
      new BigNumber(600).multipliedBy(10 ** 6).toString()
    );

    // Set oracle price at $1200 and execute liquidation
    await oracle.setPrice(1200 * 10 ** 6).then((tx) => tx.wait());
    await makerDaoController.settle(owner.address, 2);

    // Check whether liquidation executed (should be false)
    expect(await makerDaoVault.isLiquidated(owner.address)).to.equal(false);
  });
});
