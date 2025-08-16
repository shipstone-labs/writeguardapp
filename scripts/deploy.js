const hre = require("hardhat");

async function main() {
  console.log("Deploying WriteguardNFT to Base Sepolia...");
  
  const WriteguardNFT = await hre.ethers.getContractFactory("WriteguardNFT");
  const writeguardNFT = await WriteguardNFT.deploy();
  
  await writeguardNFT.waitForDeployment();
  const address = await writeguardNFT.getAddress();
  
  console.log("WriteguardNFT deployed to:", address);
  console.log("\nNext steps:");
  console.log("1. Copy this address:", address);
  console.log("2. Update CONTRACT_ADDRESS in components/MintButton.tsx");
  console.log("3. Verify on BaseScan:");
  console.log(`   npx hardhat verify --network base-sepolia ${address}`);
  
  // Save to file for reference
  const fs = require('fs');
  const deployment = {
    network: "base-sepolia",
    writeguardNFT: address,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    './contracts/deployment.json',
    JSON.stringify(deployment, null, 2)
  );
  console.log("\nDeployment info saved to contracts/deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });