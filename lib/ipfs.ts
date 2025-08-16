// IPFS integration using Pinata or Web3.Storage
// This module handles uploading files to IPFS for decentralized storage

interface IPFSUploadResult {
  cid: string;
  url: string;
  gateway: string;
}

// Using Pinata IPFS Gateway (you can also use Web3.Storage or Infura)
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export async function uploadToIPFS(file: File): Promise<IPFSUploadResult> {
  // For production, use Pinata API
  if (PINATA_API_KEY && PINATA_SECRET_KEY) {
    return uploadToPinata(file);
  }
  
  // Fallback to Web3.Storage or local IPFS node
  return uploadToWeb3Storage(file);
}

async function uploadToPinata(file: File): Promise<IPFSUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add metadata
  const metadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      type: 'research-paper',
      timestamp: new Date().toISOString()
    }
  });
  formData.append('pinataMetadata', metadata);
  
  // Pin to IPFS via Pinata
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': PINATA_API_KEY,
      'pinata_secret_api_key': PINATA_SECRET_KEY,
    },
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload to IPFS');
  }
  
  const data = await response.json();
  
  return {
    cid: data.IpfsHash,
    url: `ipfs://${data.IpfsHash}`,
    gateway: `${PINATA_GATEWAY}${data.IpfsHash}`,
  };
}

async function uploadToWeb3Storage(file: File): Promise<IPFSUploadResult> {
  // Web3.Storage implementation
  const WEB3_STORAGE_TOKEN = process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN;
  
  if (!WEB3_STORAGE_TOKEN) {
    // Return mock data for development
    console.warn('No IPFS provider configured. Using mock data.');
    return {
      cid: 'QmMockCID' + Math.random().toString(36).substring(7),
      url: 'ipfs://QmMockCID',
      gateway: 'https://ipfs.io/ipfs/QmMockCID',
    };
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WEB3_STORAGE_TOKEN}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload to Web3.Storage');
  }
  
  const data = await response.json();
  
  return {
    cid: data.cid,
    url: `ipfs://${data.cid}`,
    gateway: `https://w3s.link/ipfs/${data.cid}`,
  };
}

export async function fetchFromIPFS(cid: string): Promise<ArrayBuffer> {
  // Try multiple gateways for redundancy
  const gateways = [
    `${PINATA_GATEWAY}${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://w3s.link/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];
  
  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway);
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${gateway}:`, error);
    }
  }
  
  throw new Error('Failed to fetch from IPFS');
}

export function getIPFSUrl(cid: string, useGateway = true): string {
  if (useGateway) {
    return `${PINATA_GATEWAY}${cid}`;
  }
  return `ipfs://${cid}`;
}