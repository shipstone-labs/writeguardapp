'use client';

import { useAccount } from 'wagmi';
import { useState, useCallback } from 'react';
import { formatUSDAmount, REGISTRATION_FEE_USD } from '../services/onramp';

interface OnrampButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function OnrampButton({ onSuccess, onError }: OnrampButtonProps) {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);

  const handleOnramp = useCallback(async () => {
    if (!address) {
      onError?.(new Error('Wallet not connected'));
      return;
    }

    setLoading(true);
    
    try {
      // Get the CDP Project ID
      const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID || 
                       process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
      
      if (!projectId) {
        throw new Error('CDP Project ID not configured. Please set NEXT_PUBLIC_CDP_PROJECT_ID in .env.local');
      }

      // Build Onramp URL parameters
      const params = new URLSearchParams({
        appId: projectId,
        destinationWallets: JSON.stringify([{
          address: address,
          blockchains: ['base-sepolia'],
          assets: ['USDC']
        }]),
        presetFiatAmount: REGISTRATION_FEE_USD.toString(),
        fiatCurrency: 'USD',
        handlingRequestedUrls: 'true',
      });
      
      const onrampUrl = `https://pay.coinbase.com/v3/buy?${params.toString()}`;
      
      // Open Onramp in new window
      const onrampWindow = window.open(
        onrampUrl, 
        'coinbase-onramp',
        'width=500,height=700,resizable=yes,scrollbars=yes'
      );
      
      // Set up message listener for completion
      const handleMessage = (event: MessageEvent) => {
        // Verify origin
        if (event.origin !== 'https://pay.coinbase.com') return;
        
        if (event.data.type === 'onramp_success') {
          setLoading(false);
          onrampWindow?.close();
          window.removeEventListener('message', handleMessage);
          onSuccess?.();
        } else if (event.data.type === 'onramp_cancel' || event.data.type === 'onramp_error') {
          setLoading(false);
          onrampWindow?.close();
          window.removeEventListener('message', handleMessage);
          if (event.data.type === 'onramp_error') {
            onError?.(new Error(event.data.error || 'Onramp failed'));
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Check if window was blocked
      if (!onrampWindow || onrampWindow.closed) {
        throw new Error('Popup was blocked. Please allow popups for this site.');
      }
      
      // Cleanup listener after timeout (10 minutes)
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        setLoading(false);
      }, 600000);
      
    } catch (error) {
      setLoading(false);
      onError?.(error as Error);
      console.error('Onramp error:', error);
    }
  }, [address, onSuccess, onError]);

  return (
    <button
      onClick={handleOnramp}
      disabled={loading || !address}
      className="w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
    >
      {loading ? 'Opening Coinbase Pay...' : `Pay ${formatUSDAmount(REGISTRATION_FEE_USD)} with Card`}
    </button>
  );
}