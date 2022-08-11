// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

interface IMakerDaoController {
  function loan(
    address _srcAccount,
    address _dstAccount,
    uint256 _collateralAmount,
    uint256 _collateralLtv,
    uint256 _minDaiAmount
  ) external;
}