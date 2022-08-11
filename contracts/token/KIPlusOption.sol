// SPDX-License-Identifier: UNLICENSED

import "hardhat/console.sol";
import "../interfaces/IKIOptionController.sol";
import "../interfaces/IMakerDaoVault.sol";
import "../interfaces/IMakerDaoController.sol";
import "../util/OwnableUpgradeable.sol";
import "../util/ReentrancyGuardUpgradeable.sol";
import "./ERC20.sol";
import "./KIOption.sol";

pragma solidity ^0.8.10;

// Plus option:
// If it's executed, 
// option buyer can redeem a collateral token provided by option seller.
// After redeeming, Option(+) token will be burn.
contract KIPlusOption is KIOption {
  bool public constant isPlus = true;

  function canRedeem(address redeemer) public view returns (bool) {
    
    // When the option token is on the market, it can't be redeemed.
    // To redeem, EOA should take it from the market.
    if (redeemer == addressRouter.optionMarket()) {
      return false;
    }

    IKIOptionController controller = IKIOptionController(addressRouter.controller());
  
    return balanceOf(redeemer) >= 0 && controller.isExecuted(address(this));
  }

  function redeem(address redeemer) public nonReentrant {
    require(canRedeem(redeemer));

    uint256 optionBalance = balanceOf(redeemer);
    require(optionBalance > 0);

    address minusOption = addressRouter.oppositeAddress(address(this));
    
    uint256 totalCollateralAmount = collateralAddress.balanceOf(minusOption);
    uint256 redeemableAmount = optionBalance * totalCollateralAmount / totalSupply();

    // *MAKER DAO Liquidation Protection*
    address makerDaoVault = addressRouter.makerDaoVault();
    IMakerDaoVault.Vault memory vault = IMakerDaoVault(makerDaoVault).vaults(redeemer);

    // If the redeemer has maker dao position,
    // Add collateral(WETH) automatically
    if (vault.debt != 0 || vault.collateral != 0) {
      // MakerDao loan
      address makerDaoController = addressRouter.makerDaoController();

      IERC20(collateralAddress).transferFrom(minusOption, address(this), redeemableAmount);

      if (IERC20(collateralAddress).allowance(address(this), makerDaoController) == 0) {
        IERC20(collateralAddress).approve(makerDaoController, type(uint256).max);
      }

      IMakerDaoController(makerDaoController).loan(
        address(this), 
        redeemer, 
        redeemableAmount, 
        0, // collateralLtv (0 when add collateral)
        0 // min dai amount
      );

    } else {
      IERC20(collateralAddress).transferFrom(minusOption, redeemer, redeemableAmount);
    }

    // Burn Option(+) Token
    _burn(redeemer, optionBalance);

    emit Redeem(address(this), redeemer, optionBalance, address(collateralAddress), redeemableAmount, isPlus);
  }
}