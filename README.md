# WriteguardApp

Protect your research papers on the blockchain. Mint research papers as NFTs on Base to protect against unauthorized use.

## Features

- 🔐 **Blockchain Protection**: Mint your research papers as NFTs on Base blockchain
- 📄 **File Upload**: Support for PDF, TXT, MD, and DOCX formats  
- 🔗 **Coinbase Wallet Integration**: Seamless wallet connection with smart wallet support
- 🔍 **SHA-256 Hashing**: Cryptographic fingerprinting of uploaded documents
- ⚡ **Static Site**: Fast, serverless deployment on Cloudflare Pages

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Blockchain**: Base (Ethereum L2), OnchainKit, Wagmi, Viem
- **Wallet**: Coinbase Wallet, RainbowKit
- **Deployment**: Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Coinbase Wallet or compatible Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/shipstone-labs/writeguardapp.git
cd writeguardapp

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
# OnchainKit Configuration
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_api_key_here
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Base Network Configuration
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_CHAIN_NAME=Base
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
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

## Smart Contract

The minting functionality requires deploying a smart contract on Base. Update the contract address in `components/MintButton.tsx`:

```typescript
const CONTRACT_ADDRESS = 'your_deployed_contract_address';
```

## Project Structure

```
writeguardapp/
├── app/
│   ├── page.tsx          # Main application page
│   ├── providers.tsx     # Web3 providers configuration
│   └── layout.tsx        # Root layout with providers
├── components/
│   ├── FileUpload.tsx    # File upload component with hashing
│   └── MintButton.tsx    # NFT minting interface
├── public/               # Static assets
└── next.config.ts        # Next.js configuration
```

## Workflow

1. **Connect Wallet**: Users connect their Coinbase Wallet or compatible Web3 wallet
2. **Upload Paper**: Drag and drop or select research paper (PDF, TXT, MD, DOCX)
3. **Generate Hash**: SHA-256 hash is automatically generated for the file
4. **Mint NFT**: Paper is minted as an NFT on Base blockchain
5. **Protection**: The NFT serves as proof of authorship and timestamp

## Future Features

- Integration with HuggingFace for paper modeling
- Automated plagiarism detection via arxiv crawling
- Violation NFT system for copyright protection
- Payment resolution for violations

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For questions or support, please open an issue on GitHub.