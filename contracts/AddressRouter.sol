// SPDX-License-Identifier: UNLICENSED

import "./util/OwnableUpgradeable.sol";

pragma solidity ^0.8.10;

contract AddressRouter is OwnableUpgradeable {
  address public optionFactory;
  address public oracle;
  address public plusOptionImplementation;
  address public minusOptionImplementation;
  address public optionMarket;
  address public makerDaoVault;
  address public makerDaoController;

  // oppositeAddress[Option(+)] == Option(-)
  // oppositeAddress[Option(-)] == Option(+)
  mapping(address => address) public oppositeAddress;
  mapping(address => bool) public operators;
  address public controller;

  modifier onlyOperator {
    require(msg.sender == owner() || operators[msg.sender] == true);
    _;
  }

  function initialize() public initializer {
    __Ownable_init();
    
    operators[msg.sender] = true;
  }

  function setConfig(
    address _controller,
    address _oracle,
    address _optionFactory,
    address _plusOptionImplementation,
    address _minusOptionImplementation,
    address _optionMarket,
    address _makerDaoVault,
    address _makerDaoController
  ) public onlyOperator {
    if (_controller != address(0))
      controller = _controller;

    if (_oracle != address(0))
      oracle = _oracle;

    if (_optionFactory != address(0))
      optionFactory = _optionFactory;

    if (_plusOptionImplementation != address(0)) 
      plusOptionImplementation = _plusOptionImplementation;

    if (_minusOptionImplementation != address(0)) 
      minusOptionImplementation = _minusOptionImplementation;
    
    if (_optionMarket != address(0)) 
      optionMarket = _optionMarket;
    
    if (_makerDaoVault != address(0)) 
      makerDaoVault = _makerDaoVault;
    
    if (_makerDaoController != address(0)) 
      makerDaoController = _makerDaoController;
  }
  
  function setOperator(address _operator, bool _set) public onlyOperator {
    operators[_operator] = _set;
  }

  function setOppositeAddress(address _address, address _oppositeAddress) public onlyOperator {
    oppositeAddress[_address] = _oppositeAddress;
    oppositeAddress[_oppositeAddress] = _address;
  }
}