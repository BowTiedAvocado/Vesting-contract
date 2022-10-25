const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers")
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs")
const { expect } = require("chai")
const { BigNumber } = require("ethers")
const { ethers } = require("hardhat")
const { parseEther } = require("ethers/lib/utils")
const { parse } = require("typechain")
const {
    latestBlock,
} = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time")

describe("Vesting", function () {
    const vestedAmountEth = hre.ethers.utils.parseEther("1")
    const ONE_DAY_IN_SECS = 24 * 60 * 60
    const negativevestedAmountEth = hre.ethers.utils.parseEther("-1")
    const tokenAmount = hre.ethers.utils.parseEther("1")
    const tokenSupply = hre.ethers.utils.parseEther("5")

    async function deployVestingFixture() {
        const [owner, beneficiary, otherAccount] = await ethers.getSigners()
        const Vesting = await ethers.getContractFactory("Vesting")
        const vesting = await Vesting.deploy(beneficiary.address)
        const unlockTime = (await time.latest()) + ONE_DAY_IN_SECS
        const Erc20 = await ethers.getContractFactory("TestToken")
        const erc20 = await Erc20.deploy(tokenSupply)
        const tokenAddress = erc20.address
        await erc20.approve(vesting.address, tokenAmount)

        return {
            erc20,
            tokenAddress,
            vesting,
            owner,
            beneficiary,
            otherAccount,
            unlockTime,
        }
    }

    describe("Deployment", function () {
        it("Should set the right beneficiary", async function () {
            const { vesting, beneficiary } = await loadFixture(
                deployVestingFixture
            )

            expect(await vesting.beneficiary()).to.equal(beneficiary.address)
        })

        it("Should revert with the right error if beneficiary address provided is 0 address", async function () {
            const Vesting = await ethers.getContractFactory("Vesting")

            await expect(
                Vesting.deploy(ethers.constants.AddressZero)
            ).to.be.revertedWith("Beneficiary can't be 0 address")
        })

        it("Should set the right owner", async function () {
            const { vesting, owner } = await loadFixture(deployVestingFixture)

            expect(await vesting.owner()).to.equal(owner.address)
        })
    })

    describe("Funding", function () {
        describe("fundEth", function () {
            describe("Validations", function () {
                it("Should revert with the right error if the unlockTime is not in the future", async function () {
                    const { vesting } = await loadFixture(deployVestingFixture)
                    await expect(
                        vesting.fundEth(await time.latest(), {
                            value: vestedAmountEth,
                        })
                    ).to.be.revertedWith("Unlock time should be in the future")
                })
                it("Should revert with the right error if the caller is not the owner", async function () {
                    const { vesting, otherAccount, unlockTime } =
                        await loadFixture(deployVestingFixture)
                    await expect(
                        vesting
                            .connect(otherAccount)
                            .fundEth(unlockTime, { value: vestedAmountEth })
                    ).to.be.revertedWith("Only the contract owner can fund it")
                })
                it("Should revert with the right error if the contract has already been funded with ether", async function () {
                    const { vesting, unlockTime } = await loadFixture(
                        deployVestingFixture
                    )

                    await vesting.fundEth(unlockTime, {
                        value: vestedAmountEth,
                    })

                    await expect(
                        vesting.fundEth(unlockTime, { value: vestedAmountEth })
                    ).to.be.revertedWith("Tokens are already vested")
                })
                it("Should revert with the right error if the contract has already been funded with an ERC20 token", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    await expect(
                        vesting.fundEth(unlockTime, { value: vestedAmountEth })
                    ).to.be.revertedWith("Tokens are already vested")
                })
                it("Should revert with the right error if the amount of ether sent is 0", async function () {
                    const { vesting, unlockTime } = await loadFixture(
                        deployVestingFixture
                    )

                    await expect(
                        vesting.fundEth(unlockTime, { value: 0 })
                    ).to.be.revertedWith(
                        "Amount of vested tokens must be positive"
                    )
                })
            })

            describe("Storage of funds", function () {
                it("Should receive and store the funds to vest", async function () {
                    const { vesting, unlockTime } = await loadFixture(
                        deployVestingFixture
                    )

                    vesting.fundEth(unlockTime, { value: vestedAmountEth })

                    expect(
                        await ethers.provider.getBalance(vesting.address)
                    ).to.equal(vestedAmountEth)
                })
            })

            describe("Set variables", function () {
                it("Should set the correct unlock time", async function () {
                    const { vesting, unlockTime } = await loadFixture(
                        deployVestingFixture
                    )

                    vesting.fundEth(unlockTime, { value: vestedAmountEth })

                    expect(await vesting.unlockTime()).to.equal(unlockTime)
                })
                it("Should set isVested to true", async function () {
                    const { vesting, unlockTime } = await loadFixture(
                        deployVestingFixture
                    )

                    vesting.fundEth(unlockTime, { value: vestedAmountEth })

                    expect(await vesting.isVested()).to.equal(true)
                })
            })
        })

        describe("fundToken", function () {
            describe("Validations", function () {
                it("Should revert with the right error if the caller is not the owner", async function () {
                    const { vesting, otherAccount, unlockTime, tokenAddress } =
                        await loadFixture(deployVestingFixture)
                    await expect(
                        vesting
                            .connect(otherAccount)
                            .fundToken(unlockTime, tokenAddress, tokenAmount)
                    ).to.be.revertedWith("Only the contract owner can fund it")
                })
                it("Should revert with the right error if the contract has already been funded with ether", async function () {
                    const { vesting, unlockTime, tokenAddress } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundEth(unlockTime, {
                        value: vestedAmountEth,
                    })

                    await expect(
                        vesting.fundToken(unlockTime, tokenAddress, tokenAmount)
                    ).to.be.revertedWith("Tokens are already vested")
                })
                it("Should revert with the right error if the contract has already been funded with an ERC20 token", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    await expect(
                        vesting.fundToken(unlockTime, tokenAddress, tokenAmount)
                    ).to.be.revertedWith("Tokens are already vested")
                })
                it("Should revert with the right error if the unlockTime is not in the future", async function () {
                    const { vesting, tokenAddress } = await loadFixture(
                        deployVestingFixture
                    )
                    await expect(
                        vesting.fundToken(
                            await time.latest(),
                            tokenAddress,
                            tokenAmount
                        )
                    ).to.be.revertedWith("Unlock time should be in the future")
                })

                it("Should revert with the right error if the caller doesn't have enough tokens to fund", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await expect(
                        vesting.fundToken(
                            unlockTime,
                            tokenAddress,
                            parseEther("6")
                        )
                    ).to.be.revertedWith("Insufficient ERC20 funds to vest")
                })
                it("Should revert with the right error if the contract doesn't have insufficient allowance to transfer tokens", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await expect(
                        vesting.fundToken(
                            unlockTime,
                            tokenAddress,
                            parseEther("2")
                        )
                    ).to.be.revertedWith("Insufficient ERC20 allowance")
                })
            })

            describe("ERC20 balance transfer", function () {
                it("Should transfer the right ERC20 balance of vested tokens to the contract", async function () {
                    const { tokenAddress, vesting, unlockTime, erc20 } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    expect(await erc20.balanceOf(vesting.address)).to.equal(
                        tokenAmount
                    )
                })
            })

            describe("Set variables", function () {
                it("Should set the right ERC20 token address", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    expect(await vesting.tokenAddress()).to.equal(tokenAddress)
                })
                it("Should set the right amount of ERC20 tokens that are vested", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    expect(await vesting.amount()).to.equal(tokenAmount)
                })
                it("Should set the right unlock time", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    expect(await vesting.unlockTime()).to.equal(unlockTime)
                })
                it("Should set isVested to true", async function () {
                    const { tokenAddress, vesting, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    expect(await vesting.isVested()).to.equal(true)
                })
            })
        })
    })

    describe("Withdrawal", function () {
        describe("withdrawEth", function () {
            describe("Validations", function () {
                it("Should revert with the right error if called too soon", async function () {
                    const { vesting, beneficiary, unlockTime } =
                        await loadFixture(deployVestingFixture)
                    await vesting.fundEth(unlockTime, {
                        value: vestedAmountEth,
                    })

                    await expect(
                        vesting.connect(beneficiary).withdrawEth()
                    ).to.be.revertedWith("You can't withdraw yet")
                })

                it("Should revert with the right error if the caller is not the beneficiary", async function () {
                    const { vesting, otherAccount, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundEth(unlockTime, {
                        value: vestedAmountEth,
                    })

                    await time.increaseTo(unlockTime)

                    await expect(
                        vesting.connect(otherAccount).withdrawEth()
                    ).to.be.revertedWith("You aren't the beneficiary")
                })

                it("Shouldn't fail if the unlockTime has arrived and the beneficiary calls it", async function () {
                    const { vesting, beneficiary, unlockTime } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundEth(unlockTime, {
                        value: vestedAmountEth,
                    })

                    await time.increaseTo(unlockTime)

                    await expect(vesting.connect(beneficiary).withdrawEth()).not
                        .to.be.reverted
                })
            })

            describe("Transfer", function () {
                it("Should transfer the funds to the beneficiary", async function () {
                    const { vesting, unlockTime, beneficiary } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundEth(unlockTime, {
                        value: vestedAmountEth,
                    })

                    await time.increaseTo(unlockTime)

                    await expect(
                        vesting.connect(beneficiary).withdrawEth()
                    ).to.changeEtherBalances(
                        [beneficiary, vesting],
                        [vestedAmountEth, negativevestedAmountEth]
                    )
                })
            })
        })
        describe("withdrawToken", function () {
            describe("Validations", function () {
                it("Should revert with the right error if the caller is not the beneficiary", async function () {
                    const { tokenAddress, vesting, unlockTime, otherAccount } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    await time.increaseTo(unlockTime)

                    await expect(
                        vesting.connect(otherAccount).withdrawToken()
                    ).to.be.revertedWith("You aren't the beneficiary")
                })
                it("Should revert with the right error if called too soon", async function () {
                    const { tokenAddress, vesting, unlockTime, beneficiary } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    await expect(
                        vesting.connect(beneficiary).withdrawToken()
                    ).to.be.revertedWith("You can't withdraw yet")
                })
                it("Shouldn't fail if the unlockTime has arrived and the beneficiary calls it", async function () {
                    const { tokenAddress, vesting, unlockTime, beneficiary } =
                        await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    await time.increaseTo(unlockTime)

                    await expect(vesting.connect(beneficiary).withdrawToken())
                        .not.to.be.reverted
                })
            })

            describe("ERC20 balance transfer", function () {
                it("Should transfer the right ERC20 balance of vested tokens to the beneficiary", async function () {
                    const {
                        tokenAddress,
                        vesting,
                        unlockTime,
                        beneficiary,
                        erc20,
                    } = await loadFixture(deployVestingFixture)

                    await vesting.fundToken(
                        unlockTime,
                        tokenAddress,
                        tokenAmount
                    )

                    await time.increaseTo(unlockTime)

                    await vesting.connect(beneficiary).withdrawToken()

                    expect(await erc20.balanceOf(beneficiary.address)).to.equal(
                        tokenAmount
                    )
                })
            })
        })
    })
})
