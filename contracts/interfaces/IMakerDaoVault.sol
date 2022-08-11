// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

interface IMakerDaoVault {

  struct Vault {
      uint256 debt;
      uint256 collateral;
      uint256 liquidationPrice;
      uint256 lastUpdated;
      bool isLiquidated;
  }

  function vaults(address account) external view returns (Vault memory);
}