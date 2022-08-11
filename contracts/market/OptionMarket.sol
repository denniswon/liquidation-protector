// SPDX-License-Identifier: MIT
import "../util/OwnableUpgradeable.sol";
import "../interfaces/IOptionFactory.sol";
import "../interfaces/IERC20.sol";

pragma solidity ^0.8.10;

contract OptionMarket is OwnableUpgradeable {
  IOptionFactory public optionFactory;
  uint256 public orderNonce;

  enum OrderStatus {
    NOT_EXIST,
    OPEN,
    FILLED,
    CANCELLED
  }

  mapping(bytes32 => OrderStatus) public orderStatus;

  struct Order {
    address underlyingAsset;
    address collateralAsset;
    uint256 quantity;
    uint256 barrierPrice;
    uint256 expiry;
    bool isUp;
    uint256 premium;
  }

  event OrderCreated(
    bytes32 orderId,
    address creator,
    address underlyingAsset,
    address collateralAsset,
    uint256 quantity,
    uint256 barrierPrice,
    uint256 expiry,
    bool isUp,
    uint256 premium,
    uint256 orderNonce
  );

  event OrderStatusChanged(
    bytes32 orderId,
    uint256 orderStatus
  );

  function initialize(IOptionFactory _optionFactory) public initializer {
    __Ownable_init();
    optionFactory = _optionFactory;
  }

  // Make options & sell it to the market.
  function makeOrder(Order memory _order) public {
    bytes32 orderId = getOrderId(
      msg.sender,
      _order.underlyingAsset,
      _order.collateralAsset,
      _order.barrierPrice, 
      _order.quantity, 
      _order.expiry,
      _order.isUp,
      _order.premium,
      orderNonce
    );

    uint256 collateralAmount = optionFactory.getNeededCollateralAmount(_order.collateralAsset, _order.quantity);

    // Send collateral amount to option market contract
    IERC20(_order.collateralAsset).transferFrom(msg.sender, address(this), collateralAmount);
    
    // Approve collateral assets to option factory
    if (IERC20(_order.collateralAsset).allowance(address(this), address(optionFactory)) == 0) {
      IERC20(_order.collateralAsset).approve(address(optionFactory), type(uint256).max);
    }

    IOptionFactory.Option memory option = IOptionFactory.Option(
      _order.underlyingAsset,
      _order.collateralAsset,
      _order.quantity,
      _order.barrierPrice,
      _order.expiry,
      _order.isUp
    );

    // Create options
    (address minusOption, address plusOption, uint256 mintedAmount) = optionFactory.createOption(option);

    // MinusOption -> EOA (option creator)
    IERC20(minusOption).transfer(msg.sender, mintedAmount);

    // @TODO: PlusOption -> Trade Pool?
    // IERC20(plusOption)

    orderStatus[orderId] = OrderStatus.OPEN;

    emit OrderCreated(
      orderId,
      msg.sender,
      _order.underlyingAsset,
      _order.collateralAsset,
      _order.quantity, 
      _order.barrierPrice, 
      _order.expiry, 
      _order.isUp,
      _order.premium,
      orderNonce
    );

    orderNonce++;
  }

  function getOrderId(
    address _maker,
    address _underlyingAsset,
    address _collateralAsset,
    uint256 _barrierPrice, 
    uint256 _quantity, 
    uint256 _expiry, 
    bool _isUp,
    uint256 _premium,
    uint256 _orderNonce
  ) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(
      _maker,
      _underlyingAsset,
      _collateralAsset,
      _barrierPrice,
      _quantity,
      _expiry,
      _isUp,
      _premium,
      _orderNonce
    ));
  }

  function takeOrder(
    address _maker,
    address _underlyingAsset,
    address _collateralAsset,
    uint256 _barrierPrice, 
    uint256 _quantity, 
    uint256 _expiry,
    bool _isUp,
    uint256 _premium,
    uint256 _orderNonce
  ) public {

    bytes32 orderId = getOrderId(_maker, _underlyingAsset, _collateralAsset, _barrierPrice, _quantity, _expiry, _isUp, _premium, _orderNonce);

    require(orderStatus[orderId] == OrderStatus.OPEN);
  
    // Taker sends premium to maker.
    IERC20(_collateralAsset).transferFrom(msg.sender, _maker, _premium * _quantity);

    address plusOption = optionFactory.getOptionAddress(
      _underlyingAsset,
      _collateralAsset,
      _barrierPrice, 
      _expiry, 
      _isUp,
      true
    );

    // Market sends plus option to taker.
    IERC20(plusOption).transfer(msg.sender, _quantity * 10 ** 18);

    orderStatus[orderId] = OrderStatus.FILLED;

    emit OrderStatusChanged(orderId, uint256(OrderStatus.FILLED));
  }

  function cancelOrder(
    address _maker,
    address _underlyingAsset,
    address _collateralAsset,
    uint256 _barrierPrice,
    uint256 _quantity,
    uint256 _expiry,
    bool _isUp,
    uint256 _premium,
    uint256 _orderNonce
  ) public {
    require(msg.sender == _maker);
    
    bytes32 orderId = getOrderId(_maker, _underlyingAsset, _collateralAsset, _barrierPrice, _quantity, _expiry, _isUp, _premium, _orderNonce);

    require(orderStatus[orderId] == OrderStatus.OPEN);

    orderStatus[orderId] = OrderStatus.CANCELLED;

    address plusOption = optionFactory.getOptionAddress(
      _underlyingAsset,
      _collateralAsset,
      _barrierPrice, 
      _expiry, 
      _isUp,
      true
    );

    // Market sends plus option to order creator.
    IERC20(plusOption).transfer(msg.sender, _quantity * 10 ** 18);

    emit OrderStatusChanged(orderId, uint256(OrderStatus.CANCELLED));
  }
}