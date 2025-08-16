# WriteGuard App

**Live Site**: [https://writeguard.app](https://writeguard.app)

Protect your research papers on the blockchain. Mint research papers as NFTs on Base to protect against unauthorized use.

## Features

- 🔐 **Blockchain Protection**: Mint your research papers as NFTs on Base blockchain
- 📄 **File Upload**: Support for PDF, TXT, MD, and DOCX formats  
- 🔗 **Coinbase Wallet Integration**: Seamless wallet connection with smart wallet support
- 💳 **NEW - Coinbase Onramp**: Pay $5 with credit card or Apple Pay - no crypto required!
- 🔍 **SHA-256 Hashing**: Cryptographic fingerprinting of uploaded documents
- ⚡ **Static Site**: Fast, serverless deployment on Cloudflare Pages
- 🚫 **Violation Detection**: Coming soon - automated monitoring for unauthorized use

## Payment Options

WriteGuard now supports two payment methods:

### 1. Traditional Wallet Payment
- Connect your Coinbase Wallet or other Web3 wallet
- Pay small minting fee in testnet ETH
- Direct blockchain interaction

### 2. Coinbase Onramp (NEW!)
- Pay $5 USD with credit/debit card
- Apple Pay support for instant payments
- No crypto wallet required (guest checkout)
- Zero fees for USDC on Base
- Automatic conversion from USD to crypto

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Blockchain**: Base (Ethereum L2), OnchainKit, Wagmi, Viem
- **Payments**: Coinbase Onramp API for fiat-to-crypto
- **Wallet**: Coinbase Wallet, RainbowKit
- **Smart Contracts**: Solidity, Hardhat
- **Deployment**: Cloudflare Pages
- **Storage**: IPFS (coming soon)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Coinbase Wallet or compatible Web3 wallet (optional with Onramp)

### Installation

```bash
# Clone the repository
git clone https://github.com/shipstone-labs/writeguardapp.git
cd writeguardapp

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

Edit `.env.local` with your API keys:

```env
# Network Configuration (Base Sepolia for testing)
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# Coinbase Developer Platform
# Get your API key at: https://portal.cdp.coinbase.com/
NEXT_PUBLIC_CDP_PROJECT_ID=your_cdp_project_id_here
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_api_key_here

# WalletConnect (Optional)
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Application URL
NEXT_PUBLIC_APP_URL=https://writeguard.app
```

### Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Build & Deploy

```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run pages:deploy
```

## Smart Contract Deployment

1. Add your private key to `.env`:
```bash
echo "PRIVATE_KEY=your_key_here" >> .env
```

2. Get Base Sepolia ETH from faucets:
- [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet)
- [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)

3. Deploy contracts:
```bash
npx hardhat run scripts/deploy.js --network base-sepolia
```

4. Update contract address in `components/MintButton.tsx`

## Project Structure

```
writeguardapp/
├── app/
│   ├── page.tsx          # Main application page
│   ├── providers.tsx     # Web3 providers configuration
│   └── layout.tsx        # Root layout with providers
├── components/
│   ├── FileUpload.tsx    # File upload component with hashing
│   ├── MintButton.tsx    # NFT minting with payment options
│   └── OnrampButton.tsx  # Coinbase Onramp integration
├── contracts/
│   ├── WriteguardNFT.sol # Main NFT contract
│   └── ViolationNFT.sol  # Violation tracking contract
├── services/
│   ├── onramp.ts         # Coinbase Onramp service
│   ├── huggingface.ts    # AI embedding service
│   └── ipfs.ts           # IPFS storage functions
├── scripts/
│   └── deploy.js         # Contract deployment script
└── next.config.ts        # Next.js configuration
```

## Workflow

1. **Connect Wallet**: Users connect their wallet or choose to pay with card
2. **Upload Paper**: Drag and drop or select research paper (PDF, TXT, MD, DOCX)
3. **Generate Hash**: SHA-256 hash is automatically generated for the file
4. **Choose Payment**: Select wallet payment or credit card via Coinbase Onramp
5. **Mint NFT**: Paper is minted as an NFT on Base blockchain
6. **Protection**: The NFT serves as proof of authorship and timestamp

## API Integration

### Coinbase Onramp

The app integrates with Coinbase Onramp API for fiat payments:

```typescript
// Example usage
import { generateOnrampUrl } from './services/onramp';

const onrampUrl = generateOnrampUrl({
  destinationWallets: [{
    address: userWallet,
    blockchains: ['base-sepolia'],
    assets: ['USDC']
  }],
  presetFiatAmount: 5,
  fiatCurrency: 'USD'
}, projectId);
```

## Future Features

- **x402 Protocol**: Micropayments for API access and violation checking
- **HuggingFace Integration**: AI-powered paper embeddings and similarity detection
- **Arxiv Crawler**: Automated monitoring of academic repositories
- **Violation NFTs**: Automatic creation of proof-of-violation tokens
- **Settlement System**: 90/10 split for violation settlements

## Security Considerations

- Never commit private keys or API keys
- Use environment variables for sensitive data
- Validate payments on-chain before minting
- Audit smart contracts before mainnet deployment
- Implement rate limiting for API endpoints

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For questions or support:
- GitHub Issues: [https://github.com/shipstone-labs/writeguardapp/issues](https://github.com/shipstone-labs/writeguardapp/issues)
- Documentation: Coming soon

## Acknowledgments

- Built on [Base](https://base.org) by Coinbase
- Powered by [OnchainKit](https://onchainkit.xyz)
- Deployed with [Cloudflare Pages](https://pages.cloudflare.com)