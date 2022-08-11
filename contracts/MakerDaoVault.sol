// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.10;

import "./interfaces/IERC20.sol";

contract MakerDaoVault {
    // --- Auth ---
    mapping(address => bool) public vaultManagers;
    modifier onlyVaultManager() {
        require(vaultManagers[msg.sender] == true, "Not authorized");
        _;
    }

    // --- Data ---
    struct Vault {
        uint256 debt;
        uint256 collateral;
        uint256 liquidationPrice;
        uint256 lastUpdated;
        bool isLiquidated;
    }

    mapping(address => Vault) public vaults;
    uint256 public totalDebt;
    uint256 public totalCollateral;

    event VaultUpdated(
        address indexed account,
        uint256 debt,
        uint256 collateral,
        uint256 liquidationPrice
    );

    event Liquidated(
        address indexed account,
        uint256 collateral,
        uint256 price
    );

    constructor() {
        vaultManagers[msg.sender] = true;
    }

    function pledge(
        address _srcAccount,
        uint256 _collateralAmount,
        uint256 _collateralMarketPrice,
        uint256 _payout
    ) external onlyVaultManager {
        Vault memory v = vaults[_srcAccount];

        v.debt = v.debt + _payout;
        v.collateral = v.collateral + _collateralAmount;

        v.liquidationPrice = (v.debt * (10**6)) / v.collateral;
        require(
            v.liquidationPrice < _collateralMarketPrice,
            "Pledge: Liquidation price exceeds the market price."
        );

        v.lastUpdated = block.timestamp;
        v.isLiquidated = false;

        totalDebt = totalDebt + _payout;
        totalCollateral = totalCollateral + _collateralAmount;

        vaults[_srcAccount] = v;

        emit VaultUpdated(
            _srcAccount,
            v.debt,
            v.collateral,
            v.liquidationPrice
        );
    }

    function retrieve(address _account, uint256 _debt)
        external
        onlyVaultManager
        returns (uint256 collateralToRetrieve_)
    {
        Vault memory v = vaults[_account];

        require(
            v.isLiquidated == false,
            "Retrieve: not allowed due to liquidation."
        );
        require(_debt <= v.debt, "Retrieve: exceeds the debt amount.");

        collateralToRetrieve_ = (v.collateral * _debt) / v.debt;

        v.debt = v.debt - _debt;
        v.collateral = v.collateral - collateralToRetrieve_;
        v.lastUpdated = block.timestamp;

        totalDebt = totalDebt - _debt;
        totalCollateral = totalCollateral - collateralToRetrieve_;

        vaults[_account] = v;

        emit VaultUpdated(_account, v.debt, v.collateral, v.liquidationPrice);
    }

    function liquidate(
        address _account,
        uint256 _oraclePrice,
        uint256 _oracleTimestamp
    )
        external
        onlyVaultManager
        returns (uint256 liquidatedCollateral_, bool isLiquidated_)
    {
        Vault memory v = vaults[_account];

        require(
            _oracleTimestamp > v.lastUpdated,
            "Liquidate: an old oracle price."
        );
        require(v.isLiquidated == false, "Liquidate: Already liquidated.");

        if (_oraclePrice <= v.liquidationPrice) {
            liquidatedCollateral_ = v.collateral;
            isLiquidated_ = true;

            v.debt = 0;
            v.collateral = 0;
            v.liquidationPrice = 0;
            v.lastUpdated = block.timestamp;
            v.isLiquidated = true;

            vaults[_account] = v;

            emit VaultUpdated(
                _account,
                v.debt,
                v.collateral,
                v.liquidationPrice
            );
            emit Liquidated(_account, liquidatedCollateral_, _oraclePrice);
        } else {
            liquidatedCollateral_ = 0;
            isLiquidated_ = false;
        }
    }

    function isLiquidated(address _account) external view returns (bool) {
        return vaults[_account].isLiquidated;
    }

    function setVaultManager(address vaultManager_, bool authorized_)
        external
        onlyVaultManager
    {
        vaultManagers[vaultManager_] = authorized_;
    }
}
