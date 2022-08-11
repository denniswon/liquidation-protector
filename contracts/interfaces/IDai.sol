// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.10;

import "./IERC20.sol";

interface IDai is IERC20 {
    function burn(address account, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}
