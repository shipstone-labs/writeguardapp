# WriteguardApp Deployment Guide

## Quick Start - Deploy Smart Contract

### Prerequisites
1. Get Base Sepolia testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
2. Have a wallet with private key ready (MetaMask, Coinbase Wallet, etc.)

### Step 1: Configure Environment
Add your private key to `.env` file:
```
PRIVATE_KEY=your_wallet_private_key_here
```
⚠️ **NEVER commit this file to git!**

### Step 2: Deploy Contract
```bash
npx hardhat run scripts/deploy.js --network base-sepolia
```

### Step 3: Update Frontend
1. Copy the deployed contract address from the console output
2. Open `components/MintButton.tsx`
3. Replace the CONTRACT_ADDRESS with your deployed address:
```typescript
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS' as const;
```

### Step 4: Rebuild and Test
```bash
npm run build
npm run dev
```

Visit http://localhost:3000 and test:
1. Connect your wallet
2. Upload a file
3. Click "Mint NFT"
4. Approve transaction in your wallet

## Contract Addresses

### Base Sepolia (Testnet)
- WriteguardNFT: `[Deploy to get address]`
- Chain ID: 84532
- Explorer: https://sepolia.basescan.org

### Base Mainnet
- WriteguardNFT: `[Not deployed yet]`
- Chain ID: 8453
- Explorer: https://basescan.org

## Troubleshooting

### "Insufficient funds" error
- Make sure you have Base Sepolia ETH
- Get free testnet ETH from the faucet

### "Contract not deployed" warning
- Make sure you've deployed the contract using the steps above
- Verify the CONTRACT_ADDRESS is updated in MintButton.tsx

### Transaction failing
- Check you're on the right network (Base Sepolia)
- Ensure your wallet has enough ETH for gas
- Verify the contract is properly deployed

## Verify Contract on BaseScan
After deployment, verify your contract:
```bash
npx hardhat verify --network base-sepolia YOUR_CONTRACT_ADDRESS
```

This allows users to see the contract source code on BaseScan.