'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { baseSepolia } from 'wagmi/chains';

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
  const { address } = useAccount();
  const [isConfirming, setIsConfirming] = useState(false);
  
  const { 
    writeContract, 
    data: hash,
    isPending: isWriting,
    isSuccess: isWritten,
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

  const getButtonText = () => {
    if (isWriting) return 'Preparing Transaction...';
    if (isConfirming2) return 'Confirming...';
    if (isConfirmed) return 'Successfully Minted!';
    return 'Mint NFT';
  };

  const isDisabled = isWriting || isConfirming2 || isConfirmed;

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ Using test contract on Base Sepolia. Requires small amount of testnet ETH.
        </p>
      </div>
      
      <button
        onClick={handleMint}
        disabled={isDisabled}
        className={`
          w-full px-6 py-3 rounded-lg font-medium transition-all duration-200
          ${isDisabled
            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
          }
          ${isConfirmed ? 'bg-green-600 hover:bg-green-600' : ''}
        `}
      >
        {getButtonText()}
      </button>
      
      {writeError && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            Error: {writeError.message}
          </p>
        </div>
      )}
      
      {isConfirmed && hash && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200 mb-2">
            ✓ Paper successfully minted!
          </p>
          <a
            href={`https://basescan.org/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View transaction →
          </a>
        </div>
      )}
    </div>
  );
}