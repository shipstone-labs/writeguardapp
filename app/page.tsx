'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  const [ipfsCid, setIpfsCid] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/writeguard-logo.png"
                alt="WriteGuard Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                WriteGuard
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

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <Image
              src="/writeguard-logo.png"
              alt="WriteGuard"
              width={150}
              height={150}
              className="mx-auto mb-8 rounded-2xl shadow-2xl"
            />
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Protect Your Research
            </h2>
            <p className="text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Secure your academic papers on the blockchain. Defend against plagiarism with immutable proof of authorship.
            </p>
            
            {!isConnected ? (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-lg text-blue-900 dark:text-blue-100">
                  Connect your wallet to get started
                </p>
              </div>
            ) : (
              !showUpload && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Protect Your Paper Now
                </button>
              )
            )}
          </div>
        </section>

        {/* Features Section */}
        {!showUpload && (
          <section className="bg-white dark:bg-gray-800 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h3 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
                How It Works
              </h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    1. Upload Your Paper
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300">
                    Upload your research paper in PDF, DOCX, or text format
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    2. Generate Fingerprint
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300">
                    We create a unique SHA-256 hash of your document
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    3. Mint NFT
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300">
                    Create an immutable record on Base blockchain
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Payment Options Section */}
        {!showUpload && (
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-12 text-white">
                <h3 className="text-3xl font-bold text-center mb-8">
                  Simple, Transparent Pricing
                </h3>
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                    <h4 className="text-xl font-semibold mb-3">💳 Pay with Card</h4>
                    <p className="mb-4">$5 USD via Coinbase Onramp</p>
                    <ul className="space-y-2 text-sm">
                      <li>✓ Credit/Debit Card</li>
                      <li>✓ Apple Pay</li>
                      <li>✓ No crypto required</li>
                      <li>✓ Zero fees for USDC</li>
                    </ul>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                    <h4 className="text-xl font-semibold mb-3">🔗 Pay with Crypto</h4>
                    <p className="mb-4">Direct wallet payment</p>
                    <ul className="space-y-2 text-sm">
                      <li>✓ Base network</li>
                      <li>✓ Instant settlement</li>
                      <li>✓ Lower fees</li>
                      <li>✓ Full Web3 experience</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Upload Section - Only show when button clicked */}
        {showUpload && isConnected && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setShowUpload(false)}
                className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Home
              </button>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Upload Your Research Paper
                </h3>
                
                <FileUpload 
                  onFileUpload={(file, hash, cid) => {
                    setUploadedFile(file);
                    setFileHash(hash);
                    if (cid) setIpfsCid(cid);
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono break-all">
                      Hash: {fileHash}
                    </p>
                    {ipfsCid && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                          IPFS CID: {ipfsCid}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <a
                            href={`https://ipfs.io/ipfs/${ipfsCid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View on IPFS Gateway
                          </a>
                          <span className="text-xs text-gray-400">•</span>
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${ipfsCid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Pinata Gateway
                          </a>
                        </div>
                      </div>
                    )}
                    <MintButton fileHash={fileHash} fileName={uploadedFile.name} ipfsCid={ipfsCid} />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-400">
              © 2025 WriteGuard. Protecting academic integrity on the blockchain.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}