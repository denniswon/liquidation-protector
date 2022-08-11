const { deployAll } = require("./deploy");
const { parseHexString, MAX_UINT } = require("../test/util");

const BigNumber = require("bignumber.js");
const keccak256 = require("keccak256");
BigNumber.config({
  EXPONENTIAL_AT: 1000,
  DECIMAL_PLACES: 80,
});

/*
 * Contract
 */
const ORACLE_MOCK = "0x8f84e95ccde0d63dd7789d13a023821da8abc52b";
const OPTION_CONTROLLER = "0x1ee95b5a0e4988c88ce5043f2f2d1ee2dc84fb82";
const OPTION_FACTORY = "0x513658febe7f4d91f542214df2cbfa3cc67a5932";
const ADDRESS_ROUTER = "0x031f354ab83ee48d07dd2d6cfa25a9f0fe263fff";
const MAKERDAO_CONTROLLER = "0xA12428268E99FE07aEbC488626E8DD56f2ba65eD";
const MAKERDAO_VAULT = "0xb2C951244AfFAe2D8602E7Cc8cf73d5485355705";

/*
 * Token
 */
const WETH = "0xCc4ac11b4e0e5bf00078E117fb3c017BD696F6Ba";
const DAI = "0x39b40434Ca4CD641Bc35dfaE593386861Cd72668";

task("balance")
  .addParam("tokenAddress")
  .addParam("account")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.ethers.getContractAt(
      "IERC20",
      taskArgs.tokenAddress
    );

    const balance = await contract.balanceOf(taskArgs.account);
    const decimals = await contract.decimals();

    console.log(
      `${taskArgs.account}'s balance: `,
      new BigNumber(balance.toString()).div(10 ** decimals).toString()
    );

    return balance;
  });

task("deploy-all")
  .addOptionalParam("oracleaddress")
  .setAction(async (taskArgs, hre) => {
    const {
      controller,
      addressRouter,
      optionFactory,
      oracle,
      optionMarket,
    } = await deployAll(taskArgs, hre);

    console.log(controller.address, "controller");
    console.log(addressRouter.address, "addressRouter");
    console.log(optionFactory.address, "optionFactory");
    console.log(oracle.address, "oracle");
    console.log(optionMarket.address, "optionMarket");
  });

task("deploy-oracle").setAction(async (taskArgs, hre) => {
  const _contract = await hre.ethers.getContractFactory("OracleMock");

  const contract = await _contract.deploy().then((c) => c.deployed());

  console.log(contract, "contract");
  console.log(contract.address);
});

task("oracle-setprice")
  .addParam("price")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.ethers.getContractAt("OracleMock", ORACLE_MOCK);

    const price = new BigNumber(taskArgs.price)
      .multipliedBy(10 ** 6)
      .toString();

    await contract.setPrice(price).then((tx) => tx.wait());

    const latestPrice = await contract
      .getLatestPrice()
      .then(([_price, _timestamp]) => {
        console.log(_price);
        console.log(_timestamp);
      });
  });

task("oracle-setoperator")
  .addParam("operator")
  .addParam("set")
  .setAction(async (taskArgs, hre) => {
    const contract = await hre.ethers.getContractAt("OracleMock", ORACLE_MOCK);

    await contract
      .setOperator(taskArgs.operator, eval(taskArgs.set))
      .then((tx) => tx.wait());

    const isOperator = await contract.operators(taskArgs.operator);

    console.log(taskArgs.operator, "taskArgs.operator");
    console.log(isOperator, "isOperator");
  });

task("vault-loan")
  .addParam("colamount")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    console.log("Signer : ", signer.address);
    const weth = await hre.ethers.getContractAt("IERC20", WETH, signer);
    const controller = await hre.ethers.getContractAt(
      "MakerDaoController",
      MAKERDAO_CONTROLLER,
      signer
    );
    const collateral_amount = new BigNumber(taskArgs.colamount)
      .multipliedBy(10 ** 18)
      .toString();
    const ltv = 8000;
    const minDaiAmount = 0;
    const allowance = await weth.allowance(
      signer.address,
      controller.address
    ).then(parseHexString);
    if (allowance == 0) {
      await weth.approve(controller.address, MAX_UINT).then((tx) => tx.wait());
    }
    const result = await controller.loan(
      signer.address,
      signer.address,
      collateral_amount,
      ltv,
      minDaiAmount
    );
    const receipt = await result.wait();
    console.log("Loan tx receipt status :", receipt.status);
    await hre.run("balance", { tokenAddress: DAI, account: signer.address });
  });

task("create-option")
  .addParam("multiplier")
  .addParam("barrier")
  .addParam("expiry")
  .addParam("up")
  .setAction(async (taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners();
    //console.log("Owners : ", owner);
    const block = await hre.ethers.provider.getBlock();
    const signer = owner;
    const underlying = WETH;
    const collateralAddr = WETH;
    const collateral = await hre.ethers.getContractAt("IERC20", collateralAddr);
    //console.log("owner :", owner);
    const contract = await hre.ethers.getContractAt(
      "KIOptionFactory",
      OPTION_FACTORY,
      signer
    );
    const expiryDate = new Date(
      Date.now() + 3600 * 1000 * 24 * parseInt(taskArgs.expiry)
    );
    //const expiry = Math.floor(expiryDate.getTime()/1000);
    const expiry =
      block.timestamp + 3600 * 1000 * 24 * parseInt(taskArgs.expiry);
    console.log("Expiry: ", expiry);
    const allowance = await collateral
      .allowance(signer.address, contract.address)
      .then(parseHexString);

    if (allowance == 0) {
      await collateral
        .approve(contract.address, MAX_UINT)
        .then((tx) => tx.wait());
    }
    const barrier = new BigNumber(taskArgs.barrier)
      .multipliedBy(10 ** 6)
      .toString();
    // const barrier = taskArgs.barrier;
    console.log("Create Option start");
    const isUp = eval(taskArgs.up);
    console.log("taskArgs.up : ", isUp, typeof isUp);
    const result = await contract.createOption([
      underlying,
      collateralAddr,
      taskArgs.multiplier,
      barrier,
      expiry,
      isUp,
    ]);
    const receipt = await result.wait();
    //console.log("Receipt : ", receipt);
    const plusOption = await contract.getOptionAddress(
      underlying,
      collateralAddr,
      barrier,
      expiry,
      isUp,
      true
    );
    const minusOption = await contract.getOptionAddress(
      underlying,
      collateralAddr,
      barrier,
      expiry,
      isUp,
      false
    );
    console.log("Plus / Minus : ", plusOption, minusOption);
    const plusOptionId = await contract.getOptionId(
      underlying,
      collateralAddr,
      barrier,
      expiry,
      isUp,
      true
    );
    console.log("Plus Option Id : ", plusOptionId);
  });

task("canExecute").setAction(async (taskArgs, { ethers }) => {
  const optionFactory = await ethers.getContractAt(
    "KIOptionFactory",
    OPTION_FACTORY
  );
  const optionController = await ethers.getContractAt(
    "KIOptionController",
    OPTION_CONTROLLER
  );

  const oracle = await hre.ethers.getContractAt("OracleMock", ORACLE_MOCK);

  const addressRouter = await ethers.getContractAt(
    "AddressRouter",
    ADDRESS_ROUTER
  );
  // console.log(await addressRouter.oracle())

  // console.log(await optionController.addressRouter())

  const minusOptionAddress = await optionFactory.getOptionAddress(
    WETH, // underlying
    WETH, // collateral
    1200, // barrier price
    1919218427, // expiry
    true, // isUp
    false
  );

  const minusOptionId = await optionFactory.getOptionId(
    WETH, // underlying
    WETH, // collateral
    1380, // barrier price
    1918609614, // expiry
    true, // isUp
    false
  );

  const packed = ethers.utils.solidityPack(
    ["address", "uint8", "address", "uint256", "uint256", "bool", "bool"],
    [
      WETH, // underlying
      1,
      WETH, // collateral
      1380, // barrier price
      1918609614, // expiry
      true, // isUp
      false,
    ]
  );

  // console.log(packed, 'packed')
  const keccaked = "0x" + keccak256(packed).toString("hex");
  console.log(minusOptionId, "minusOptionId");
  console.log(keccaked, "keccaked");

  // console.log(minusOptionAddress, 'minusOptionAddress')

  console.log(await optionController.canExecute(minusOptionId, "0"));
});

task("scneraio1-test").setAction(async (taskArgs, { ethers }) => {
  // 1. create option
  // 2. set price to hit the barrier
});

/*
 * Ivan
 */
task("token-approve")
  .addParam("token")
  .addParam("spender")
  .setAction(async (taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners();

    let token;
    if (taskArgs.token == "WETH") {
      token = WETH;
    } else if (taskArgs.token == "DAI") {
      token = DAI;
    } else {
      token = taskArgs.token;
    }

    const contract = await hre.ethers.getContractAt("IERC20", token);
    await contract.approve(taskArgs.spender, MAX_UINT);
    const allowance = await contract.allowance(owner.address, taskArgs.spender);

    console.log("TOKEN : ", token);
    console.log("SPENDER : ", taskArgs.spender);
    console.log("ALLOWANCE : " + allowance);
    console.log("OWNER : ", owner.address);
  });

task("get-oracle-latest-id").setAction(async (taskArgs, hre) => {
  const contract = await hre.ethers.getContractAt("OracleMock", ORACLE_MOCK);
  const roundId = await contract.roundId();
  console.log(roundId);

  return roundId;
});

task("execute-option")
  .addParam("optionid")
  .addParam("oracleid")
  .setAction(async (taskArgs, hre) => {
    const optionController = await hre.ethers.getContractAt(
      "KIOptionController",
      OPTION_CONTROLLER
    );

    await optionController.execute(taskArgs.optionid, taskArgs.oracleid);
  });

task("check-execution")
  .addParam("token")
  .setAction(async (taskArgs, hre) => {
    const optionController = await hre.ethers.getContractAt(
      "KIOptionController",
      OPTION_CONTROLLER
    );
    const result = await optionController.isExecuted(taskArgs.token);
    console.log(result);

    return result;
  });

task("redeem")
  .addParam("token")
  .setAction(async (taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt(
      "KIMinusOption",
      taskArgs.token
    );

    // await contract.redeem(owner.address);
    const balance = await contract.balanceOf(owner.address);

    console.log(balance);
    return balance;
  });
