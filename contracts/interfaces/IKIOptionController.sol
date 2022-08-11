// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IKIOptionController {
  function isExecuted(address optionToken) external view returns (bool);
  function DISPUTE_BUFFER() external view returns (uint256);
}