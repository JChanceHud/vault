/// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract Vault {
  // Store ERC20's and Ether and whitelist keys

  enum Permission {
    None,
    Liquidate,
    Partial,
    Full
  }

  uint public LIQUIDATION_TIME = 30 days;
  uint public ADD_USER_TIME = 10 days;

  mapping (address => Permission) users;
  mapping (address => uint) userActive;
  uint public nextLiquidation = type(uint).max;

  constructor(
    address[] memory fullUsers,
    address[] memory partialUsers,
    address[] memory liquidators
  ) {
    for (uint8 x = 0; x < fullUsers.length; x++) {
      users[fullUsers[x]] = Permission.Full;
    }
    for (uint8 x = 0; x < liquidators.length; x++) {
      users[liquidators[x]] = Permission.Liquidate;
    }
    for (uint8 x = 0; x < partialUsers.length; x++) {
      users[partialUsers[x]] = Permission.Partial;
    }
  }

  receive () external payable {}

  // Make sure the user has permission and has waited long enough
  function requireActiveUser(address user, Permission perm) public view {
    require(users[user] >= perm, 'nau');
    require(userActive[user] < block.timestamp, 'na');
  }

  function requireActiveLiquidation() public view {
    require(nextLiquidation < block.timestamp);
  }

  function addUser(address user, Permission perm) public {
    requireActiveUser(msg.sender, Permission.Partial);
    users[user] = perm;
    userActive[user] = block.timestamp + ADD_USER_TIME;
  }

  function withdrawEther(uint amount, address destination) public {
    requireActiveUser(msg.sender, Permission.Full);
    (bool sent, ) = destination.call{value: amount}("");
    require(sent);
  }

  function withdrawToken(address token, uint amount, address destination) public {
    requireActiveUser(msg.sender, Permission.Full);
    require(IERC20(token).transfer(destination, amount));
  }

  function beginLiquidation() public {
    requireActiveUser(msg.sender, Permission.Liquidate);
    nextLiquidation = block.timestamp + LIQUIDATION_TIME;
  }

  function cancelLiquidation() public {
    requireActiveUser(msg.sender, Permission.Partial);
    nextLiquidation = type(uint).max;
  }

  function liquidateWithdrawEther(uint amount, address destination) public {
    requireActiveUser(msg.sender, Permission.Liquidate);
    requireActiveLiquidation();
    (bool sent, ) = destination.call{value: amount}("");
    require(sent);
  }

  function liquidateWithdrawToken(address token, uint amount, address destination) public {
    requireActiveUser(msg.sender, Permission.Liquidate);
    requireActiveLiquidation();
    require(IERC20(token).transfer(destination, amount));
  }

}
