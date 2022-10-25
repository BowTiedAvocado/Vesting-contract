// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vesting {
    uint256 public unlockTime; // Unix time stamp in which the full amount of tokens will be available for withdrawal
    uint256 public amount; // Amount of vested ERC20 tokens
    address public owner; // Address which provides the vested funds
    address payable public immutable beneficiary; // Address which recieves the vested funds
    address public tokenAddress; // Contract address of the ERC20 tokens vested
    bool public isVested; // Boolean used to check if the contract has been funded
    IERC20 public token; // ERC20 interface to interact with the token contract

    constructor(address payable _beneficiary) {
        require(_beneficiary != address(0), "Beneficiary can't be 0 address");

        beneficiary = payable(_beneficiary);
        owner = payable(msg.sender);
    }

    function fundEth(uint256 _unlockTime) public payable {
        require(msg.sender == owner, "Only the contract owner can fund it");
        require(!isVested, "Tokens are already vested");
        require(
            _unlockTime > block.timestamp,
            "Unlock time should be in the future"
        );
        require(msg.value > 0, "Amount of vested tokens must be positive");

        unlockTime = _unlockTime;
        isVested = true;
    }

    function fundToken(
        uint256 _unlockTime,
        address _tokenAddress,
        uint256 _amount
    ) public {
        require(msg.sender == owner, "Only the contract owner can fund it");
        require(!isVested, "Tokens are already vested");
        require(
            _unlockTime > block.timestamp,
            "Unlock time should be in the future"
        );

        token = IERC20(_tokenAddress);
        require(
            token.balanceOf(msg.sender) >= _amount,
            "Insufficient ERC20 funds to vest"
        );
        require(
            token.allowance(msg.sender, address(this)) >= _amount,
            "Insufficient ERC20 allowance"
        );

        token.transferFrom(msg.sender, address(this), _amount);

        tokenAddress = _tokenAddress;
        amount = _amount;
        unlockTime = _unlockTime;
        isVested = true;
    }

    function withdrawToken() public {
        require(msg.sender == beneficiary, "You aren't the beneficiary");
        require(block.timestamp >= unlockTime, "You can't withdraw yet");

        uint256 _amount = amount;

        amount = 0;

        token.transfer(msg.sender, _amount);
    }

    function withdrawEth() public {
        require(msg.sender == beneficiary, "You aren't the beneficiary");
        require(block.timestamp >= unlockTime, "You can't withdraw yet");

        beneficiary.transfer(address(this).balance);
    }
}
