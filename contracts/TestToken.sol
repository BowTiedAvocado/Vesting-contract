// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(uint256 _amount) ERC20("Test Token", "TEST") {
        _mint(msg.sender, _amount);
    }
}
