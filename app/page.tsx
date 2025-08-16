'use client';

import { useState } from 'react';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { 
  Wallet,
  WalletDropdown, 
  WalletDropdownBasename, 
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import { useAccount } from 'wagmi';
import FileUpload from '@/components/FileUpload';
import MintButton from '@/components/MintButton';

export default function Home() {
  const { isConnected } = useAccount();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string>('');

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                WriteguardApp
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Wallet>
                <ConnectWallet />
                <WalletDropdown>
                  <WalletDropdownBasename />
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Protect Your Research
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Register your research papers on the blockchain to protect against unauthorized use
          </p>
        </div>

        {!isConnected ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Please connect your wallet to start protecting your research
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <FileUpload 
                onFileUpload={(file, hash) => {
                  setUploadedFile(file);
                  setFileHash(hash);
                }}
              />
              
              {uploadedFile && fileHash && (
                <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Ready to Mint
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    File: {uploadedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-mono break-all">
                    Hash: {fileHash}
                  </p>
                  <MintButton fileHash={fileHash} fileName={uploadedFile.name} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}