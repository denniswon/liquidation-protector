// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.10;

import "./interfaces/IERC20.sol";
import "./interfaces/IDai.sol";

interface OracleLike {
    function getPrice(uint256) external returns (uint256, uint256);

    function getLatestPrice() external returns (uint256, uint256);
}

interface VaultLike {
    function pledge(
        address,
        uint256,
        uint256,
        uint256
    ) external;

    function retrieve(address, uint256) external returns (uint256);

    function liquidate(
        address,
        uint256,
        uint256
    ) external returns (uint256, bool);
}

contract MakerDaoController {
    // -- Auth --
    mapping(address => bool) public controllerManagers;
    modifier onlyControllerManager() {
        require(controllerManagers[msg.sender] == true, "Auth: not Authorized");
        _;
    }

    address public ORACLE;
    address public VAULT;
    address public DAI;
    address public WETH;
    uint256 public limitLTV;

    event Loan(
        address indexed srcAccount,
        address indexed dstAccount,
        uint256 payout,
        uint256 collateralAmount,
        uint256 collateralMarketPrice
    );
    event Repay(
        address indexed srcAccount,
        uint256 daiAmount,
        address indexed dstAccount,
        uint256 collateralAmount
    );
    event DaiMinted(address indexed account, uint256 amount);
    event DaiBurned(address indexed account, uint256 amount);

    constructor() {
        controllerManagers[msg.sender] = true;
    }

    function loan(
        address _srcAccount,
        address _dstAccount,
        uint256 _collateralAmount,
        uint256 _collateralLtv,
        uint256 _minDaiAmount
    ) external returns (uint256 payout_) {
        require(limitLTV != 0, "Loan: LTV should be set.");
        require(
            _collateralLtv <= limitLTV,
            "Loan: Collateral LTV exceeds the limit value."
        );

        (uint256 collateralMarketPrice, ) = OracleLike(ORACLE).getLatestPrice();
        payout_ =
            (((_collateralAmount / 10**6) * collateralMarketPrice) / 10000) *
            _collateralLtv;
        require(
            payout_ >= _minDaiAmount,
            "Loan: Payout is less than minimum amount."
        );

        VaultLike(VAULT).pledge(
            _dstAccount,
            _collateralAmount,
            collateralMarketPrice,
            payout_
        );

        IERC20(WETH).transferFrom(
            _srcAccount,
            address(this),
            _collateralAmount
        );
        IDai(DAI).mint(_dstAccount, payout_);

        emit Loan(
            _srcAccount,
            _dstAccount,
            payout_,
            _collateralAmount,
            collateralMarketPrice
        );
        emit DaiMinted(_dstAccount, payout_);
    }

    function repay(
        address _srcAccount,
        address _dstAccount,
        uint256 _daiAmount
    ) external returns (uint256 collateralAmount_) {
        collateralAmount_ = VaultLike(VAULT).retrieve(_dstAccount, _daiAmount);

        IERC20(WETH).transfer(_dstAccount, collateralAmount_);
        IDai(DAI).burnFrom(_srcAccount, _daiAmount);

        emit Repay(_srcAccount, _daiAmount, _dstAccount, collateralAmount_);
        emit DaiBurned(_srcAccount, _daiAmount);
    }

    function settle(address _account, uint256 _oracleId)
        external
        returns (bool isSettled_)
    {
        (uint256 oraclePrice, uint256 oracleTimestamp) = OracleLike(ORACLE)
            .getPrice(_oracleId);
        (, isSettled_) = VaultLike(VAULT).liquidate(
            _account,
            oraclePrice,
            oracleTimestamp
        );
    }

    function setConfig(
        address _oracle,
        address _vault,
        address _dai,
        address _weth,
        uint256 _limitLtv
    ) external onlyControllerManager {
        require(
            _oracle != address(0) &&
                _vault != address(0) &&
                _dai != address(0) &&
                _weth != address(0),
            "Config: Address should not be zero."
        );
        require(
            _limitLtv > 0 && _limitLtv < 10000,
            "Config: LTV should be between 0 and 10000."
        );

        ORACLE = _oracle;
        VAULT = _vault;
        DAI = _dai;
        WETH = _weth;
        limitLTV = _limitLtv;
    }

    function setControllerManager(address _controllerManager, bool _authorized)
        external
        onlyControllerManager
    {
        controllerManagers[_controllerManager] = _authorized;
    }
}
