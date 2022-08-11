// SPDX-License-Identifier: MIT

import "./ERC20.sol";

pragma solidity ^0.8.10;

contract ERC20Mock is ERC20 {
    function mint(address account, uint256 amount) public override {
        _mint(account, amount);
    }
}
