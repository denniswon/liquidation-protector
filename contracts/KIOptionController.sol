// SPDX-License-Identifier: UNLICENSED

import "hardhat/console.sol";
import "./util/OwnableUpgradeable.sol";
import "./util/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IAddressRouter.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IOption.sol";
import "./interfaces/IOptionFactory.sol";
import "./interfaces/IERC20.sol";

pragma solidity ^0.8.10;

contract KIOptionController is OwnableUpgradeable, ReentrancyGuardUpgradeable {
  mapping(address => bool) public isExecuted;
  IAddressRouter public addressRouter;
  uint256 public DISPUTE_BUFFER;

  event Executed(bytes32 indexed optionId, address indexed optionAddress, uint256 roundID, string optionName);

  function initialize(IAddressRouter _addressRouter) public initializer {
    __Ownable_init();
    addressRouter = _addressRouter;
    DISPUTE_BUFFER = 86400; // 1 day
  }

  function canExecute(bytes32 _optionID, uint256 _roundID) public view returns (bool) {

    address oracle = addressRouter.oracle();

    (uint256 roundPrice, uint256 roundTimestamp) = IOracle(oracle).getPrice(_roundID);
    // If oracle price is not set,
    if (roundPrice == 0 || roundTimestamp == 0) {
      return false;
    }

    address optionFactory = addressRouter.optionFactory();
    address optionAddress = IOptionFactory(optionFactory).optionIdToAddress(_optionID);

    if (optionAddress == address(0)) {
      return false;
    }

    // If already executed,
    if (isExecuted[optionAddress]) {
      return false;
    }
    
    (
      address underlyingAddress, 
      address collateralAddress, 
      uint256 barrierPrice, 
      uint256 expiry, 
      bool isUp,
      uint256 createdAt
    ) = IOption(optionAddress).getDetail();

    // timestamp validity check
    // valid timestamp:
    // option createdAt < roundTimestamp < expiry
    if (roundTimestamp < createdAt || roundTimestamp > expiry) {
      return false;
    }

    // @dev
    // Since timestamp validity check will be processed based on a "round" 
    // There's no need to check whether the option is expired.
    // if (block.timestamp > expiry) {
    //   return false;
    // }

    return isUp 
      ? roundPrice >= barrierPrice // up-in barrier
      : roundPrice <= barrierPrice; // down-in barrier
  }

  function execute(bytes32 _optionID, uint256 _roundID) public {
    require(canExecute(_optionID, _roundID) == true);

    address optionFactory = addressRouter.optionFactory();
    address optionAddress = IOptionFactory(optionFactory).optionIdToAddress(_optionID);

    isExecuted[optionAddress] = true;

    string memory optionName = IERC20(optionAddress).name();

    emit Executed(_optionID, optionAddress, _roundID, optionName);
  }

  function executeMulti(bytes32[] memory _optionIds, uint256[] memory _roundIds) public {
    require(_optionIds.length == _roundIds.length);
    
    for (uint256 i = 0; i < _optionIds.length; i++) {
      execute(_optionIds[i], _roundIds[i]);
    }
  }

  function setDisputePeriod(uint256 _disputeBuffer) public onlyOwner {
    DISPUTE_BUFFER = _disputeBuffer;
  }
}