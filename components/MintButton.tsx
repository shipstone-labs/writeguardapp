'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { 
  generateOnrampUrl, 
  getOnrampConfig, 
  formatUSDAmount,
  isApplePayAvailable,
  REGISTRATION_FEE_USD 
} from '../services/onramp';

interface MintButtonProps {
  fileHash: string;
  fileName: string;
  ipfsCid?: string;
}

// Contract address - Using a test ERC721 contract on Base Sepolia
// This is a generic NFT contract that allows open minting for testing
// For production, deploy your own contract using: npx hardhat run scripts/deploy.js --network base-sepolia
const CONTRACT_ADDRESS = '0x79c3114b519380e352f26b99acf44e436633e9fa' as const;

// Standard ERC721 ABI for minting
const CONTRACT_ABI = [
  {
    name: 'safeMint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'mint',
    type: 'function', 
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
] as const;

export default function MintButton({ fileHash, fileName }: MintButtonProps) {
  const { address, isConnected } = useAccount();
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'onramp'>('wallet');
  const [onrampLoading, setOnrampLoading] = useState(false);
  
  const { 
    writeContract, 
    data: hash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { 
    isLoading: isConfirming2,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = async () => {
    if (!address) return;
    
    // TODO: When WriteguardNFT is deployed, pass fileHash and fileName
    // to the mintPaper function instead of using generic safeMint
    console.log('Minting NFT for:', { fileHash, fileName });
    
    try {
      // Try safeMint first, fallback to mint
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'safeMint',
        args: [address],
        value: parseEther('0.0001'), // Small mint fee for test contract
      });
    } catch (error) {
      console.error('Minting error:', error);
    }
  };

  const handleOnrampPayment = async () => {
    if (!address) return;
    
    setOnrampLoading(true);
    try {
      // Get CDP Project ID from environment
      const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID || process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
      
      if (!projectId) {
        throw new Error('CDP Project ID not configured');
      }

      // Generate Onramp configuration
      const config = getOnrampConfig(address, true); // true for testnet
      
      // Generate and open Onramp URL
      const onrampUrl = generateOnrampUrl(config, projectId);
      
      // Open in new window (not iframe due to restrictions)
      const onrampWindow = window.open(onrampUrl, '_blank', 'width=500,height=700');
      
      // Listen for completion message
      window.addEventListener('message', async (event) => {
        if (event.origin !== 'https://pay.coinbase.com') return;
        
        if (event.data.type === 'onramp_success') {
          // Payment successful, now mint the NFT
          setOnrampLoading(false);
          onrampWindow?.close();
          
          // Trigger the mint after payment confirmation
          await handleMint();
        } else if (event.data.type === 'onramp_cancel') {
          setOnrampLoading(false);
          onrampWindow?.close();
        }
      });
    } catch (error) {
      console.error('Onramp error:', error);
      setOnrampLoading(false);
    }
  };

  const getButtonText = () => {
    if (onrampLoading) return 'Processing Payment...';
    if (isWriting) return 'Preparing Transaction...';
    if (isConfirming2) return 'Confirming...';
    if (isConfirmed) return 'Successfully Minted!';
    if (paymentMethod === 'onramp') return `Pay ${formatUSDAmount(REGISTRATION_FEE_USD)} & Mint`;
    return 'Mint NFT';
  };

  const isDisabled = isWriting || isConfirming2 || isConfirmed || onrampLoading;
  const showApplePay = isApplePayAvailable();

  if (!isConnected) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Please connect your wallet to mint
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Payment Method Selection */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-lg">
        <p className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Choose Payment Method:
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPaymentMethod('wallet')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              paymentMethod === 'wallet'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Wallet (Testnet ETH)
          </button>
          <button
            onClick={() => setPaymentMethod('onramp')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              paymentMethod === 'onramp'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {showApplePay ? 'Apple Pay / Card' : 'Credit Card'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {paymentMethod === 'wallet' 
            ? 'ℹ️ Using test contract on Base Sepolia. Requires small amount of testnet ETH.'
            : `ℹ️ Pay ${formatUSDAmount(REGISTRATION_FEE_USD)} to mint your paper as NFT. Zero fees for USDC on Base.`
          }
        </p>
      </div>
      
      {/* Mint Button */}
      <button
        onClick={paymentMethod === 'wallet' ? handleMint : handleOnrampPayment}
        disabled={isDisabled}
        className="w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
        style={{
          backgroundColor: isDisabled ? '#9CA3AF' : isConfirmed ? '#10B981' : '#2563EB',
          color: '#FFFFFF',
          cursor: isDisabled ? 'not-allowed' : 'pointer'
        }}
      >
        {getButtonText()}
      </button>
      
      {/* Error Display */}
      {writeError && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            Error: {writeError.message}
          </p>
        </div>
      )}
      
      {/* Success Display */}
      {isConfirmed && hash && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200 mb-2">
            ✓ NFT successfully minted!
          </p>
          <a
            href={`https://sepolia.basescan.org/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on BaseScan →
          </a>
        </div>
      )}
    </div>
  );
}