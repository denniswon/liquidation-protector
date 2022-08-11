// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.10;

interface IOptionFactory {
    struct Option {
      address _underlyingAsset;
      address _collateralAsset;
      uint256 _multiplier;
      uint256 _barrierPrice;
      uint256 _expiry;
      bool _isUp;
  }
  function createOption(Option memory option) external returns (address, address, uint256);
  function optionIdToAddress(bytes32 optionId) external view returns(address);
  function getNeededCollateralAmount(address collateralAsset, uint256 multiplier) external view returns (uint256);
  function getOptionAddress(
    address _underlyingAsset, 
    address _collateralAsset, 
    uint256 _barrierPrice, 
    uint256 _expiry, 
    bool _isUp, 
    bool _isPlus
  ) external view returns (address);
}