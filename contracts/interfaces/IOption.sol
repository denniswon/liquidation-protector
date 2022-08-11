// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.10;

interface IOption {
  function initialize(
    address _underlying, 
    address _collateral,
    uint256 _barrierPrice,
    uint256 _expiry,
    bool _isUp
  ) external;

  function approveCollateral(address token, address spender, uint256 amount) external;

  function getDetail() external view returns(
    address underlying, 
    address collateral, 
    uint256 barrierPrice, 
    uint256 expiry, 
    bool isUp, 
    uint256 createdAt
  );
  function expiry() external view returns(uint256);
  function isUp() external view returns(bool);
}