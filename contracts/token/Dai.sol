// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.10;

import "./ERC20.sol";
import "../interfaces/IDai.sol";
import "../util/ReentrancyGuardUpgradeable.sol";

contract Dai is ERC20, IDai, ReentrancyGuardUpgradeable {
    mapping(address => bool) public daiMinters;

    modifier onlyDaiMinter() {
        require(daiMinters[msg.sender] == true, "Not authorized");
        _;
    }

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __ERC20__init("Dai Stabletoken", "DAI");
        daiMinters[msg.sender] = true;
    }

    function mint(address account, uint256 amount)
        external
        override
        onlyDaiMinter
    {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external override {
        _burn(account, amount);
    }

    function burnFrom(address account, uint256 amount) external override {
        _burnFrom(account, amount);
    }

    function _burnFrom(address account, uint256 amount) internal {
        uint256 _currentAllowance = allowance(account, msg.sender);
        require(_currentAllowance - amount >= 0, "ERC20: burn amount exceeds allowance");

        _approve(account, msg.sender, _currentAllowance);
        _burn(account, amount);
    }

    function setDaiMinter(address daiMinter_, bool authorized_)
        external
        onlyDaiMinter
    {
        daiMinters[daiMinter_] = authorized_;
    }
}
