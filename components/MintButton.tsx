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

// Contract address - Deploy using: npx hardhat run scripts/deploy.js --network base-sepolia
// IMPORTANT: Update this address after deploying your contract
const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// WriteguardNFT contract ABI
const CONTRACT_ABI = [
  {
    name: 'mintPaper',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'fileHash', type: 'string' },
      { name: 'fileName', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
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
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'mintPaper',
        args: [fileHash, fileName],
        value: parseEther('0.001'), // Minting fee
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

  const isDisabled = isWriting || isConfirming2 || isConfirmed || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000';

  return (
    <div>
      {CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000' && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Smart contract not deployed yet. Deploy your contract and update the address.
          </p>
        </div>
      )}
      
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