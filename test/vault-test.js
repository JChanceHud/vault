const { timeAndMine, ethers } = require('hardhat')
const { BigNumber } = require('ethers')
const assert = require('assert')

async function getDeployedContracts(fullUsers = [], partialUsers = [], liquidateUsers = []) {
  const Vault = await ethers.getContractFactory('Vault')
  const vault = await Vault.deploy(fullUsers, partialUsers, liquidateUsers)
  await vault.deployed()

  const TestToken = await ethers.getContractFactory('TestToken')
  const testToken = await TestToken.deploy()
  await testToken.deployed()

  return { vault, testToken }
}

const LIQUIDATE_USER = 1
const PARTIAL_USER = 2
const FULL_USER = 3

const UINT_MAX = 2**256 - 1

describe('Vault', function () {
  it('should add user', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])

    try {
      const tx = await vault.connect(liquidateUser).addUser(test1.address, FULL_USER)
      await tx.wait()
      assert(false)
    } catch (err) {}
    {
      const tx = await vault.connect(partialUser).addUser(test1.address, FULL_USER)
      await tx.wait()
    }
    {
      const tx = await vault.connect(fullUser).addUser(test2.address, FULL_USER)
      await tx.wait()
    }

    try {
      const tx = await vault.connect(test1).withdrawEther(0, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    try {
      const tx = await vault.connect(test2).withdrawEther(0, test2.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
  })

  it('should withdraw ether', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])

    await (await test2.sendTransaction({
      to: vault.address,
      value: 1,
    })).wait()

    try {
      const tx = await vault.connect(liquidateUser).withdrawEther(1, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    try {
      const tx = await vault.connect(partialUser).withdrawEther(1, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    try {
      const tx = await vault.connect(fullUser).withdrawEther(1000, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    const tx = await vault.connect(fullUser).withdrawEther(1, test1.address)
    await tx.wait()
  })

  it('should withdraw token', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault, testToken } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])

    await (await testToken.connect(test1).mint(100)).wait()
    await (await testToken.connect(test1).transfer(vault.address, 100)).wait()

    const startBalance = await testToken.connect(test1).balanceOf(vault.address)
    assert.equal(startBalance.toString(), '100')

    try {
      const tx = await vault.connect(liquidateUser).withdrawToken(testToken.address, 100, test2.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    try {
      const tx = await vault.connect(partialUser).withdrawToken(testToken.address, 100, test2.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    try {
      const tx = await vault.connect(fullUser).withdrawToken(testToken.address, 100000, test2.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    const tx = await vault.connect(fullUser).withdrawToken(testToken.address, 100, test2.address)
    await tx.wait()

    const endBalance = await testToken.connect(test1).balanceOf(vault.address)
    assert.equal(endBalance.toString(), '0')

    const test2Balance = await testToken.connect(test1).balanceOf(test2.address)
    assert.equal(test2Balance.toString(), '100')
  })

  it('should begin liquidation', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault, testToken } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])
    const LIQUIDATION_TIME = +(await vault.LIQUIDATION_TIME()).toString()
    const start = +new Date() / 1000

    try {
      const tx = await vault.connect(test1).beginLiquidation()
      await tx.wait()
      assert(false)
    } catch (err) {}

    {
      const tx = await vault.connect(liquidateUser).beginLiquidation()
      await tx.wait()
      const newNextLiquidation = await vault.nextLiquidation()
      assert(+newNextLiquidation.toString() < (+new Date() / 1000) + 100 + LIQUIDATION_TIME)
      assert(+newNextLiquidation.toString() > start + LIQUIDATION_TIME)
    }
    {
      const tx = await vault.connect(partialUser).beginLiquidation()
      await tx.wait()
      const newNextLiquidation = await vault.nextLiquidation()
      assert(+newNextLiquidation.toString() < (+new Date() / 1000) + 100 + LIQUIDATION_TIME)
      assert(+newNextLiquidation.toString() > start + LIQUIDATION_TIME)
    }
    {
      const tx = await vault.connect(fullUser).beginLiquidation()
      await tx.wait()
      const newNextLiquidation = await vault.nextLiquidation()
      assert(+newNextLiquidation.toString() < (+new Date() / 1000) + 100 + LIQUIDATION_TIME)
      assert(+newNextLiquidation.toString() > start + LIQUIDATION_TIME)
    }
  })

  it('should cancel liquidation', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault, testToken } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])
    {
      const tx = await vault.connect(liquidateUser).beginLiquidation()
      await tx.wait()
    }
    {
      const nextLiquidation = await vault.nextLiquidation()
      assert(UINT_MAX > +nextLiquidation.toString())
    }
    try {
      const tx = await vault.connect(liquidateUser).cancelLiquidation()
      await tx.wait()
      assert(false)
    } catch (err) {}
    {
      const nextLiquidation = await vault.nextLiquidation()
      assert(UINT_MAX > +nextLiquidation.toString())
    }
    {
      const tx = await vault.connect(partialUser).cancelLiquidation()
      await tx.wait()
    }
    {
      const nextLiquidation = await vault.nextLiquidation()
      assert(UINT_MAX === +nextLiquidation.toString())
    }
    {
      const tx = await vault.connect(liquidateUser).beginLiquidation()
      await tx.wait()
    }
    {
      const nextLiquidation = await vault.nextLiquidation()
      assert(UINT_MAX > +nextLiquidation.toString())
    }
    {
      const tx = await vault.connect(fullUser).cancelLiquidation()
      await tx.wait()
    }
    {
      const nextLiquidation = await vault.nextLiquidation()
      assert(UINT_MAX === +nextLiquidation.toString())
    }
  })

  it('should withdraw ether during liquidation', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault, testToken } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])
    await (await test2.sendTransaction({
      to: vault.address,
      value: 1,
    })).wait()

    {
      const tx = await vault.connect(liquidateUser).beginLiquidation()
      await tx.wait()
    }

    try {
      const tx = await vault.connect(liquidateUser).liquidateWithdrawEther(1, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}

    const nextLiquidation = await vault.nextLiquidation()
    await timeAndMine.setTime(+nextLiquidation.toString() + 1)

    try {
      const tx = await vault.connect(test1).liquidateWithdrawEther(1, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}
    try {
      const tx = await vault.connect(liquidateUser).liquidateWithdrawEther(1000, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}

    const tx = await vault.connect(liquidateUser).liquidateWithdrawEther(1, test1.address)
    await tx.wait()
  })

  it('should withdraw token during liquidation', async () => {
    const [ fullUser, partialUser, liquidateUser, test1, test2 ] = await ethers.getSigners()
    const { vault, testToken } = await getDeployedContracts([fullUser.address], [partialUser.address], [liquidateUser.address])

    await (await testToken.connect(test1).mint(100)).wait()
    await (await testToken.connect(test1).transfer(vault.address, 100)).wait()

    {
      const tx = await vault.connect(liquidateUser).beginLiquidation()
      await tx.wait()
    }
    const nextLiquidation = await vault.nextLiquidation()
    await timeAndMine.setTime(+nextLiquidation.toString() + 1)

    try {
      const tx = await vault.connect(test1).liquidateWithdrawToken(testToken.address, 100, test1.address)
      await tx.wait()
      assert(false)
    } catch (err) {}

    try {
      const tx = await vault.connect(liquidateUser).liquidateWithdrawToken(testToken.address, 100000, test1.address)
      await tx.wait()
    } catch (err) {}

    const tx = await vault.connect(liquidateUser).liquidateWithdrawToken(testToken.address, 100, test1.address)
    await tx.wait()
  })
})
