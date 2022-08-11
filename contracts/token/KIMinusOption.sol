// SPDX-License-Identifier: UNLICENSED

import "../interfaces/IKIOptionController.sol";
import "../interfaces/IOption.sol";
import "../util/OwnableUpgradeable.sol";
import "../util/ReentrancyGuardUpgradeable.sol";
import "./ERC20.sol";
import "./KIOption.sol";

pragma solidity ^0.8.10;

// Minus option:
// If the execution doesn't happen until expiry,
// option seller can redeem a collateral token
// After redeeming, Option(-) token will be burn.
contract KIMinusOption is KIOption {
  bool public constant isPlus = false;

  function canRedeem(address redeemer) public view returns (bool) {

    // When the option token is on the market, it can't be redeemed.
    // To redeem, EOA should take it from the market.
    if (redeemer == addressRouter.optionMarket()) {
      return false;
    }

    IKIOptionController controller = IKIOptionController(addressRouter.controller());

    address plusOption = addressRouter.oppositeAddress(address(this));

    uint256 optionBalance = balanceOf(redeemer);

    return (optionBalance > 0) && (block.timestamp >= (expiry + controller.DISPUTE_BUFFER())) && !controller.isExecuted(plusOption);
  }

  function redeem(address redeemer) public nonReentrant {
    require(canRedeem(redeemer));

    uint256 optionBalance = balanceOf(redeemer);

    uint256 totalCollateralAmount = collateralAddress.balanceOf(address(this));

    uint256 redeemableAmount = optionBalance * totalCollateralAmount / totalSupply();

    collateralAddress.transfer(redeemer, redeemableAmount);

    // Burn Option(-) Token
    _burn(redeemer, optionBalance);

    emit Redeem(address(this), redeemer, optionBalance, address(collateralAddress), redeemableAmount, isPlus);
  }
}