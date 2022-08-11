const { deployments, ethers } = require("hardhat");
const { fixture, _createOption } = require("./fixtures");
const { BigNumber } = require("../hardhat.config");
const { parseHexString, MAX_UINT } = require("./util");
const { increaseTime } = require("./timeUtil");
const { expect } = require("chai");
const { makerDaoFixture } = require("./makerDaoFixtures");
const { sharedFixture } = require("./sharedFixture");

describe("Scenario", () => {
  let controller;
  let optionFactory;
  let addressRouter;
  let oracle;
  let weth;
  let dai;
  let makerDaoController;
  let makerDaoVault;

  beforeEach(async () => {
    const { oracle: _oracle, dai: _dai, weth: _weth } = await sharedFixture();

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

    controller = _controller;
    optionFactory = _optionFactory;
    addressRouter = _addressRouter;
    oracle = _oracle;
    weth = _weth;
    dai = _dai;
    optionMarket = _optionMarket;

    makerDaoController = _makerDaoController;
    makerDaoVault = _makerDaoVault;
  });

  it("Scenario 1", async () => {
    const [owner, optionSeller, eoa1, eoa2] = await ethers.getSigners();
    const block = await ethers.provider.getBlock();

    await oracle.setPrice(1600 * 10 ** 6).then((tx) => tx.wait());
    const roundId0 = await oracle.roundId().then(parseHexString);

    // 100 WETH Giveaway for each accounts(option seller, eoa1, eoa2)
    await weth
      .connect(owner)
      .mint(
        optionSeller.address,
        new BigNumber(100).multipliedBy(10 ** 18).toString()
      )
      .then((tx) => tx.wait());
    await weth
      .connect(owner)
      .mint(eoa1.address, new BigNumber(100).multipliedBy(10 ** 18).toString())
      .then((tx) => tx.wait());
    await weth
      .connect(owner)
      .mint(eoa2.address, new BigNumber(100).multipliedBy(10 ** 18).toString())
      .then((tx) => tx.wait());

    // EOA#1 (Liquidiation Protector user)

    // 0. Option Seller creates option & sell it to the market.
    await weth
      .connect(optionSeller)
      .approve(optionMarket.address, MAX_UINT)
      .then((tx) => tx.wait());

    const quantity = 1;
    const expiry = block.timestamp + 10000;
    const isUp = false;
    const premium = new BigNumber(0.3).multipliedBy(10 ** 18).toString();
    const barrierPrice = new BigNumber(1400).multipliedBy(10 ** 6).toString();

    const collateralAmount = new BigNumber(1).multipliedBy(10 ** 18).toString();
    const collateralLtv = 8000;
    const minDaiAmount = 0;

    await optionMarket
      .connect(optionSeller)
      .makeOrder([
        weth.address, // underlying
        weth.address, // collateral
        quantity, // quantity
        barrierPrice, // barrier price
        expiry, // expiry
        isUp, // isUp
        premium,
      ])
      .then((tx) => tx.wait());

    // 1-EOA1 Option Buyer(EOA1) loans from MakerDao Mock
    // (=> Position (Liquidiation Price) Set)
    await weth
      .connect(eoa1)
      .approve(makerDaoController.address, MAX_UINT)
      .then((tx) => tx.wait());

    await makerDaoController
      .connect(eoa1)
      .loan(
        eoa1.address,
        eoa1.address,
        collateralAmount,
        collateralLtv,
        minDaiAmount
      )
      .then((tx) => tx.wait());

    const eoa1_liquidationPrice = await makerDaoVault
      .vaults(eoa1.address)
      .then(({ liquidationPrice }) => {
        return parseHexString(liquidationPrice);
      });

    // 1-EOA2 liquidation protector non-user loans from MakerDao Mock
    await weth
      .connect(eoa2)
      .approve(makerDaoController.address, MAX_UINT)
      .then((tx) => tx.wait());
    await makerDaoController
      .connect(eoa2)
      .loan(
        eoa2.address,
        eoa2.address,
        collateralAmount,
        collateralLtv,
        minDaiAmount
      )
      .then((tx) => tx.wait());

    const eoa2_liquidationPrice = await makerDaoVault
      .vaults(eoa1.address)
      .then(({ liquidationPrice }) => {
        return parseHexString(liquidationPrice);
      });

    expect(eoa1_liquidationPrice).to.equal(eoa2_liquidationPrice);

    // 2. EOA1 Option Buyer buys "plus option" from market.
    await weth
      .connect(eoa1)
      .approve(optionMarket.address, MAX_UINT)
      .then((tx) => tx.wait());
    await optionMarket
      .connect(eoa1)
      .takeOrder(
        optionSeller.address, // maker
        weth.address, // underlying
        weth.address, // collateral
        barrierPrice, // barrier price
        quantity, // quantity
        expiry, // expiry
        isUp, // isUp
        premium,
        0 // order nonce
      )
      .then((tx) => tx.wait());

    const plusOptionId = await optionFactory.getOptionId(
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      expiry, // expiry
      isUp, // isUp
      true
    );

    const plusOptionAddress = await optionFactory.getOptionAddress(
      weth.address, // underlying
      weth.address, // collateral
      barrierPrice, // barrier price
      expiry, // expiry
      isUp, // isUp
      true
    );

    const plusOption = await ethers.getContractAt(
      "KIPlusOption",
      plusOptionAddress
    );

    expect(await controller.canExecute(plusOptionId, roundId0)).to.equal(false);

    // 3. set oracle price to hit the barrier price.
    await oracle.setPrice(1400 * 10 ** 6).then((tx) => tx.wait());
    const roundId1 = await oracle.roundId().then(parseHexString);

    // *(option bot) execution*
    // 4. execute
    expect(await controller.canExecute(plusOptionId, roundId1)).to.equal(true);
    await controller.execute(plusOptionId, roundId1).then((tx) => tx.wait());

    // (redeem & additional loan)

    // const eoa1_weth_before = await weth
    //   .balanceOf(eoa1.address)
    //   .then(parseHexString);

    await plusOption.redeem(eoa1.address).then((tx) => tx.wait());

    // const eoa1_weth_increased = new BigNumber(
    //   await weth.balanceOf(eoa1.address).then(parseHexString)
    // )
    //   .minus(eoa1_weth_before)
    //   .toString();

    // await makerDaoController
    //   .connect(eoa1)
    //   .loan(eoa1.address, eoa1.address, eoa1_weth_increased, 0, 0)
    //   .then((tx) => tx.wait());

    // // 5. set oracle price to hit the liquidation price.
    // // (expect: even though it will not liquidate.)
    await oracle.setPrice(eoa1_liquidationPrice).then((tx) => tx.wait());

    const liquidationPriceRoundID = await oracle.roundId().then(parseHexString);

    // await expect(makerDaoController.settle(eoa1.address, liquidationPriceRoundID)).to.be.reverted
    await makerDaoController
      .settle(eoa1.address, liquidationPriceRoundID)
      .then((tx) => tx.wait());

    const eoa1_isLiquidated = await makerDaoVault
      .vaults(eoa1.address)
      .then(({ isLiquidated }) => {
        return isLiquidated;
      });

    // * EOA2 start * //

    // 3. settle(liquidate)
    await makerDaoController
      .settle(eoa2.address, liquidationPriceRoundID)
      .then((tx) => tx.wait());

    // 4. check liquidation status (expect: true)
    const eoa2_isLiquidated = await makerDaoVault
      .vaults(eoa2.address)
      .then(({ isLiquidated }) => {
        return isLiquidated;
      });

    // * EOA2 end * //

    // // 6. check liquidation status (eoa1, expect: false)
    expect(eoa1_isLiquidated).to.equal(false);

    // // 6. check liquidation status (eoa2, expect: true)
    expect(eoa2_isLiquidated).to.equal(true);

    // // (7.set oracle price )
    await oracle.setPrice(1800 * 10 ** 6).toString();

    // // 8. check total assets.
    const eoa1_weth_in_vault = await makerDaoVault
      .vaults(eoa1.address)
      .then(({ collateral }) => parseHexString(collateral));
    const eoa1_total_weth = new BigNumber(
      await weth.balanceOf(eoa1.address).then(parseHexString)
    )
      .plus(eoa1_weth_in_vault)
      .div(10 ** 18)
      .toString();
    console.log(eoa1_total_weth, "eoa1_total_weth");

    const wethPrice = await oracle
      .getLatestPrice()
      .then(([price]) => parseHexString(price));

    const eoa1_total_weth_in_usd = new BigNumber(eoa1_total_weth)
      .multipliedBy(wethPrice)
      .div(10 ** 6)
      .toNumber()
      .toLocaleString("en-us", { maximumFractionDigits: 2 });

    console.log("EOA1: $" + eoa1_total_weth_in_usd, "eoa1_total_weth_in_usd");

    const eoa2_weth_in_vault = await makerDaoVault
      .vaults(eoa2.address)
      .then(({ collateral }) => parseHexString(collateral));
    const eoa2_total_weth = new BigNumber(
      await weth.balanceOf(eoa2.address).then(parseHexString)
    )
      .plus(eoa2_weth_in_vault)
      .div(10 ** 18)
      .toString();

    console.log(eoa2_total_weth, "eoa2_total_weth");
    const eoa2_total_weth_in_usd = new BigNumber(eoa2_total_weth)
      .multipliedBy(wethPrice)
      .div(10 ** 6)
      .toNumber()
      .toLocaleString("en-us", { maximumFractionDigits: 2 });

    console.log("EOA2: $" + eoa2_total_weth_in_usd, "eoa2_total_weth_in_usd");
  });

  it("Scenario 2 ETH MAXI", async () => {
    // # EOA1 (0.5 ETH -> buy all options, 0.5 ETH hold)
    // 1. buy option
    // 2. set oracle price to hit the barrier
    // 3. check total assets
    // # EOA2 (hold 1 ETH)
    // 2. set oracle price (to hit the barrier)
    // 3. check total assets
  });
});
