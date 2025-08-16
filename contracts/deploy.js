// Deploy script for WriteguardNFT and ViolationNFT contracts
// Run with: npx hardhat run contracts/deploy.js --network base

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy WriteguardNFT
  const WriteguardNFT = await ethers.getContractFactory("WriteguardNFT");
  const writeguardNFT = await WriteguardNFT.deploy();
  await writeguardNFT.deployed();
  console.log("WriteguardNFT deployed to:", writeguardNFT.address);

  // Deploy ViolationNFT with WriteguardNFT address
  const ViolationNFT = await ethers.getContractFactory("ViolationNFT");
  const violationNFT = await ViolationNFT.deploy(writeguardNFT.address);
  await violationNFT.deployed();
  console.log("ViolationNFT deployed to:", violationNFT.address);

  // Save deployment addresses
  const fs = require('fs');
  const deploymentInfo = {
    network: network.name,
    writeguardNFT: writeguardNFT.address,
    violationNFT: violationNFT.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    './contracts/deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment complete! Contract addresses saved to contracts/deployment.json");
  console.log("\nNext steps:");
  console.log("1. Update CONTRACT_ADDRESS in components/MintButton.tsx");
  console.log("2. Verify contracts on BaseScan");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });