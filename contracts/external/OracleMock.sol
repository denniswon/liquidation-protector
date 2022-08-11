// SPDX-License-Identifier: UNLICENSED

import "../util/OwnableUpgradeable.sol";

pragma solidity ^0.8.10;

contract OracleMock {

  struct Price {
      uint256 price;
      uint256 timestamp; // timestamp at which the price is pushed to this oracle
  }

  modifier onlyOperator {
    require(operators[msg.sender] == true);
    _;
  }

  event PriceUpdate(uint256 indexed roundId, uint256 indexed timestamp, uint256 price);

  uint256 public roundId;
  uint256 public decimal;
  mapping(uint256 => Price) public roundPrice;
  mapping(address => bool) public operators;

  constructor() {
    operators[msg.sender] = true;
  }

  function setPrice(uint256 _price) public onlyOperator {
    uint256 timestamp = block.timestamp;
    
    roundId++;

    roundPrice[roundId] = Price(_price, timestamp);

    emit PriceUpdate(roundId, timestamp, _price);
  }

  function setOperator(address _operator, bool _set) public onlyOperator {
    operators[_operator] = _set;
  }

  function getPrice(uint256 _roundId) public view returns (uint256, uint256) {
    return (roundPrice[_roundId].price, roundPrice[_roundId].timestamp);
  }

  function getLatestPrice() public view returns (uint256, uint256) {
    return getPrice(roundId);
  }
}