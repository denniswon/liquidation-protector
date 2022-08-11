// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.10;

interface IOracle {
  function getPrice(uint256 roundId) external view returns(uint256 price, uint256 timestamp);
  function getLatestPrice() external view returns(uint256 price, uint256 timestamp);
}