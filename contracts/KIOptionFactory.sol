// SPDX-License-Identifier: UNLICENSED
import "./util/OwnableUpgradeable.sol";
import "./proxy/TransparentUpgradeableProxy.sol";
import "./interfaces/IOption.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IAddressRouter.sol";
import "./interfaces/IOptionFactory.sol";

import "hardhat/console.sol";

pragma solidity ^0.8.10;

contract KIOptionFactory is IOptionFactory, OwnableUpgradeable {
    IAddressRouter public addressRouter;
    address[] public options;
    
    uint8 public constant TRADING_UNIT = 1; // 1 eth
    
    mapping(bytes32 => address) public optionIdToAddress;

    event OptionCreated(
        address tokenAddress,
        address creator,
        address indexed underlying,
        address indexed collateral,
        uint256 barrierPrice,
        uint256 expiry,
        bool isUp, // up-in barrier, down-in barrier
        bool isPlus // plus option, minus option
    );

    function initialize(IAddressRouter _addressRouter) public initializer {
      __Ownable_init();
      addressRouter = _addressRouter;
    }

    function createOption(Option memory _option) external returns (address, address, uint256) {
        require(_option._expiry > block.timestamp);

        uint256 collateralAmount = getNeededCollateralAmount(_option._collateralAsset, _option._multiplier);    

        require(IERC20(_option._collateralAsset).balanceOf(msg.sender) >= collateralAmount);

        bytes memory initCalldata = abi.encodeWithSelector(
            bytes4(keccak256("initialize(address,address,address,uint256,uint256,bool)")),
            addressRouter,
            _option._underlyingAsset,
            _option._collateralAsset,
            _option._barrierPrice,
            _option._expiry,
            _option._isUp
        );

        // * In MVP, collateral amount & option amount to mint is same.
        uint256 optionAmountToMint = TRADING_UNIT * (10 ** 18) * _option._multiplier;

        // Mint Option Minus Position Token
        address minusOption = _mintOption(
            optionAmountToMint, 
            getOptionId(
                _option._underlyingAsset, 
                _option._collateralAsset, 
                _option._barrierPrice, 
                _option._expiry, 
                _option._isUp, 
                false
            ), 
            initCalldata, 
            addressRouter.minusOptionImplementation()
        );

        // Mint Option Plus Position Token
        address plusOption = _mintOption(
            optionAmountToMint, 
            getOptionId(
                _option._underlyingAsset, 
                _option._collateralAsset, 
                _option._barrierPrice, 
                _option._expiry, 
                _option._isUp, 
                true
            ), 
            initCalldata, 
            addressRouter.plusOptionImplementation()
        );

        // User send collateral asset * multiplier to this contract.
        IERC20(_option._collateralAsset).transferFrom(
            msg.sender, 
            minusOption, 
            collateralAmount
        );

        // Approve minus option's collaterals to plus option
        // When the underlying price touched the barrier price, 
        // Plus option owner can redeem the collateral from minus option token.
        IOption(minusOption).approveCollateral(_option._collateralAsset, plusOption, type(uint256).max);

        addressRouter.setOppositeAddress(minusOption, plusOption);

        emit OptionCreated(
            minusOption, 
            msg.sender, 
            _option._underlyingAsset, 
            _option._collateralAsset, 
            _option._barrierPrice, 
            _option._expiry, 
            _option._isUp, 
            false
        );

        emit OptionCreated(
            plusOption, 
            msg.sender, 
            _option._underlyingAsset, 
            _option._collateralAsset, 
            _option._barrierPrice, 
            _option._expiry, 
            _option._isUp, 
            true
        );

        return (minusOption, plusOption, optionAmountToMint);
    }

    function _mintOption(uint256 amountToMint, bytes32 id, bytes memory initCalldata, address optionImplementation) internal returns (address) {
        address optionToken = optionIdToAddress[id];
        // If it's already created option, just mint new tokens
        if (optionToken == address(0)) {
            optionToken = address(new TransparentUpgradeableProxy(optionImplementation, address(this), initCalldata));
            
            optionIdToAddress[id] = optionToken;
            options.push(optionToken);
        }

        IERC20(optionToken).mint(msg.sender, amountToMint);

        return optionToken;
    }

    function getOptionAddress(address _underlyingAsset, address _collateralAsset, uint256 _barrierPrice, uint256 _expiry, bool _isUp, bool _isPlus) external view returns (address) {
        bytes32 id = getOptionId(_underlyingAsset, _collateralAsset, _barrierPrice, _expiry, _isUp, _isPlus);
        return optionIdToAddress[id];
    }

    function getOptionId(address _underlyingAsset, address _collateralAsset, uint256 _barrierPrice, uint256 _expiry, bool _isUp, bool _isPlus) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_underlyingAsset, TRADING_UNIT, _collateralAsset, _barrierPrice, _expiry, _isUp, _isPlus));
    }

    function getOptionsLength() external view returns (uint256) {
        return options.length;
    }

    function getNeededCollateralAmount(address _collateralAsset, uint256 _multiplier) public view returns (uint256 collateralAmount) {
        collateralAmount = TRADING_UNIT * (10 ** IERC20(_collateralAsset).decimals()) * _multiplier;
    }
}
