// SPDX-License-Identifier: UNLICENSED

import "../util/OwnableUpgradeable.sol";
import "../util/ReentrancyGuardUpgradeable.sol";
import "./ERC20.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IAddressRouter.sol";
import { BokkyPooBahsDateTimeLibrary } from "../util/BokkyPooBahsDateTimeLibrary.sol";
import { Strings } from "../util/Strings.sol";

pragma solidity ^0.8.10;

abstract contract KIOption is ERC20, ReentrancyGuardUpgradeable {
  address public underlyingAddress;
  IERC20 public collateralAddress;
  uint256 public barrierPrice;
  uint256 public expiry;
  bool public isUp;
  uint256 public createdAt;
  
  IAddressRouter public addressRouter;

  mapping(address => bool) public minter;

  string constant private UNDERLYING = "ETH";
  string constant private STRIKE = "USD";
  string constant private COLLATERAL = "ETH";
  string constant private TRADING_UNIT = "1";

  event Redeem(
    address indexed optionAddress,
    address indexed redeemer,
    uint256 optionAmount,
    address collateralAddress,
    uint256 payout,
    bool isPlus
  );

  modifier onlyMinter {
    require(minter[msg.sender] == true);
    _;
  }

  function initialize(
    IAddressRouter _addressRouter,
    address _underlying,
    IERC20 _collateral,
    uint256 _barrierPrice,
    uint256 _expiry,
    bool _isUp
  ) public initializer {
    __ReentrancyGuard_init();

    (string memory name, string memory symbol) = _nameAndSymbol(_barrierPrice, _expiry, _isUp);
    __ERC20__init(name, symbol);

    underlyingAddress = _underlying;
    collateralAddress = _collateral;
    barrierPrice = _barrierPrice;
    expiry = _expiry;
    isUp = _isUp;

    addressRouter = _addressRouter;

    createdAt = block.timestamp;

    // // Set Option Factory as minter
    minter[msg.sender] = true;
  }

  function mint(address account, uint256 amount) public override onlyMinter {
    _mint(account, amount);
  }

  function approveCollateral(address collateral, address _spender, uint256 _amount) public onlyMinter {
    IERC20(collateral).approve(_spender, _amount);
  }

  function getDetail() public view returns (address, address, uint256, uint256, bool, uint256) {
    return (underlyingAddress, address(collateralAddress), barrierPrice, expiry, isUp, createdAt);
  }

  function _nameAndSymbol(
    uint256 _barrierPrice,
    uint256 _expiry,
    bool _isUp
  ) internal pure returns (string memory name, string memory symbol) {
    (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(_expiry);
    
    string memory monthString = BokkyPooBahsDateTimeLibrary.getMonth(month);

    name = string(
        abi.encodePacked(
            UNDERLYING,
            STRIKE, //
            "-",
            TRADING_UNIT,
            " ",
            Strings.toString(day),
            "-",
            monthString,
            "-",
            Strings.toString(year),
            " ",
            Strings.toString(_barrierPrice),
            _isUp ? "Up-in" : "Down-in",
            " ",
            COLLATERAL,
            " Collateral"
        )
    );

    symbol = string(
        abi.encodePacked(
            UNDERLYING,
            STRIKE, //
            "-",
            TRADING_UNIT,
            " ",
            Strings.toString(day),
            "-",
            Strings.toString(month),
            "-",
            Strings.toString(year),
            " ",
            Strings.toString(_barrierPrice),
            _isUp ? "Up-in" : "Down-in",
            " ",
            COLLATERAL,
            " Collateral"
        )
    );
  }
}