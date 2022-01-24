async function main() {
  const Vault = await ethers.getContractFactory('Vault')
  const vault = await Vault.deploy([], [], [])
  await vault.deployed()

  console.log(`Vault address: ${vault.address}`)
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
