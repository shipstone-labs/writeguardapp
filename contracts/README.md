# WriteguardApp Smart Contracts

This directory contains the smart contracts for WriteguardApp's research paper protection system.

## Contracts

### WriteguardNFT.sol
The main NFT contract for minting research papers as NFTs on Base blockchain.

**Features:**
- Mint research papers as NFTs with file hash and metadata
- Prevent duplicate minting via hash checking
- Store HuggingFace model references
- Owner-controlled minting fee (default: 0.001 ETH)

### ViolationNFT.sol
Contract for tracking and settling plagiarism violations.

**Features:**
- Create violation NFTs when plagiarism is detected (>80% similarity)
- Settlement mechanism for violators to pay original authors
- Automatic NFT burning upon settlement
- Track multiple violations per paper

## Deployment

### Prerequisites

1. Install dependencies:
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

2. Create `.env` file in project root:
```env
PRIVATE_KEY=your_wallet_private_key
BASESCAN_API_KEY=your_basescan_api_key
```

### Deploy to Base Sepolia (Testnet)

1. Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

2. Deploy contracts:
```bash
npx hardhat run contracts/deploy.js --network base-sepolia
```

### Deploy to Base Mainnet

```bash
npx hardhat run contracts/deploy.js --network base
```

### Verify Contracts on BaseScan

After deployment, verify your contracts:

```bash
# WriteguardNFT
npx hardhat verify --network base-sepolia YOUR_WRITEGUARD_ADDRESS

# ViolationNFT
npx hardhat verify --network base-sepolia YOUR_VIOLATION_ADDRESS YOUR_WRITEGUARD_ADDRESS
```

## Integration

After deployment, update the frontend:

1. Copy the WriteguardNFT address from `contracts/deployment.json`
2. Update `CONTRACT_ADDRESS` in `components/MintButton.tsx`
3. Copy the contract ABI from compilation artifacts if needed

## Contract Interactions

### Minting a Paper
```javascript
const tx = await contract.mintPaper(fileHash, fileName, {
  value: ethers.parseEther("0.001")
});
```

### Creating a Violation
```javascript
const tx = await violationContract.createViolation(
  originalTokenId,
  violatingTokenId,
  violatingSource,
  similarityScore,
  settlementAmount
);
```

### Settling a Violation
```javascript
const tx = await violationContract.settleViolation(violationId, {
  value: settlementAmount
});
```

## Gas Optimization

The contracts are optimized with:
- Efficient storage patterns
- Minimal external calls
- Optimized compiler settings (200 runs)

## Security Considerations

- Only contract owner can create violations
- Hash-based duplicate prevention
- Reentrancy protection on settlements
- Access control for sensitive functions

## Testing

Run the test suite:
```bash
npx hardhat test
```

## License

MIT