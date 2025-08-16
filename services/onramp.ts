import { base, baseSepolia } from 'viem/chains';

// Onramp configuration
const ONRAMP_API_URL = 'https://api.developer.coinbase.com/onramp/v1';
export const REGISTRATION_FEE_USD = 5; // $5 registration fee

export interface OnrampConfig {
  destinationWallets: {
    address: string;
    blockchains: string[];
    assets: string[];
  }[];
  presetFiatAmount: number;
  fiatCurrency: string;
}

export interface OnrampSession {
  sessionToken: string;
  sessionUrl: string;
  expiresAt: string;
}

export interface OnrampTransaction {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  amount: string;
  currency: string;
  walletAddress: string;
  txHash?: string;
}

/**
 * Generate Onramp configuration for WriteguardApp
 */
export function getOnrampConfig(walletAddress: string, isTestnet = true): OnrampConfig {
  const chain = isTestnet ? baseSepolia : base;
  const blockchain = isTestnet ? 'base-sepolia' : 'base';
  
  return {
    destinationWallets: [{
      address: walletAddress,
      blockchains: [blockchain],
      assets: ['USDC'] // Using USDC for zero fees on Base
    }],
    presetFiatAmount: REGISTRATION_FEE_USD,
    fiatCurrency: 'USD'
  };
}

/**
 * Create a secure Onramp session (should be called from server-side)
 */
export async function createOnrampSession(
  projectId: string,
  walletAddress: string,
  isTestnet = true
): Promise<OnrampSession> {
  const config = getOnrampConfig(walletAddress, isTestnet);
  
  try {
    const response = await fetch(`${ONRAMP_API_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CDP-Project-ID': projectId,
      },
      body: JSON.stringify({
        ...config,
        // Additional security options
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/mint/success`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/mint`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Onramp session: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      sessionToken: data.sessionToken,
      sessionUrl: data.sessionUrl,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    console.error('Error creating Onramp session:', error);
    throw error;
  }
}

/**
 * Generate Onramp URL for headless integration
 */
export function generateOnrampUrl(config: OnrampConfig, projectId: string): string {
  const params = new URLSearchParams({
    appId: projectId,
    destinationWallets: JSON.stringify(config.destinationWallets),
    presetFiatAmount: config.presetFiatAmount.toString(),
    fiatCurrency: config.fiatCurrency,
    handlingRequestedUrls: 'true', // For headless mode
  });
  
  return `https://pay.coinbase.com/v3/buy?${params.toString()}`;
}

/**
 * Check transaction status (for polling)
 */
export async function checkTransactionStatus(
  projectId: string,
  transactionId: string
): Promise<OnrampTransaction> {
  try {
    const response = await fetch(`${ONRAMP_API_URL}/transactions/${transactionId}`, {
      headers: {
        'CDP-Project-ID': projectId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check transaction status: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      transactionId: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      walletAddress: data.destinationAddress,
      txHash: data.transactionHash,
    };
  } catch (error) {
    console.error('Error checking transaction status:', error);
    throw error;
  }
}

/**
 * Validate that payment was received before minting
 */
export async function validatePayment(
  walletAddress: string,
  expectedAmount: number,
  txHash?: string
): Promise<boolean> {
  // In production, verify the transaction on-chain
  // For now, we'll trust the Onramp callback
  if (!txHash) return false;
  
  // TODO: Add on-chain verification using viem
  // Check that walletAddress received expectedAmount USDC
  
  return true;
}

/**
 * Helper to handle Apple Pay integration
 */
export function isApplePayAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if Apple Pay is available in the browser
  // ApplePaySession is a browser API that may not be in TypeScript types
  return 'ApplePaySession' in window && 
         typeof (window as any).ApplePaySession?.canMakePayments === 'function' &&
         (window as any).ApplePaySession.canMakePayments();
}

/**
 * Format USD amount for display
 */
export function formatUSDAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}