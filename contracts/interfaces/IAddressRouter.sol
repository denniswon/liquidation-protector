// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

interface IAddressRouter {
  function oppositeAddress(address _option) external view returns (address);
  function controller() external view returns (address);
  function oracle() external view returns (address);
  function optionFactory() external view returns (address);
  function plusOptionImplementation() external view returns(address);
  function minusOptionImplementation() external view returns(address);
  function optionMarket() external view returns(address);
  function makerDaoVault() external view returns(address);
  function makerDaoController() external view returns(address);
  function setOppositeAddress(address _address1, address _address2) external;
}