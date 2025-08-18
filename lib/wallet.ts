import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  type Account,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";

import crypto from "node:crypto";
import type { Op } from "@graphprotocol/grc-20";
export type { Op } from "@graphprotocol/grc-20";
import { getKVStorage } from "./kv-storage";

// Environment variables
const ENCRYPTION_KEY =
  process.env.WALLET_ENCRYPTION_KEY || "demo-key-32-bytes-for-testing-only"; // 32-byte key
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const PRIVATE_KEY_STORAGE_KEY = "ethereum_wallet_key";

// Encryption/Decryption helpers
function encryptPrivateKey(privateKey: string, password: string): string {
  const cipher = crypto.createCipher("aes-256-cbc", password);
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptPrivateKey(encryptedKey: string, password: string): string {
  const decipher = crypto.createDecipher("aes-256-cbc", password);
  let decrypted = decipher.update(encryptedKey, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Generate random private key
function generatePrivateKey(): string {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

// Wallet management with KV storage
export async function getWallet(): Promise<{
  account: Account;
  client: WalletClient;
  publicClient: PublicClient;
}> {
  console.log("🔐 Initializing wallet...");

  try {
    let privateKey: string;

    // Always prioritize WALLET_PRIVATE_KEY environment variable first
    const envPrivateKey = process.env.WALLET_PRIVATE_KEY;

    if (envPrivateKey) {
      console.log("🔍 Using wallet from WALLET_PRIVATE_KEY env var");
      privateKey = envPrivateKey;
    } else {
      // Fallback to KV storage and other methods
      const kv = getKVStorage();
      const storedEncryptedKey = await kv.get(PRIVATE_KEY_STORAGE_KEY);

      if (storedEncryptedKey) {
        console.log("🔍 Found existing wallet in storage");
        privateKey = decryptPrivateKey(storedEncryptedKey, ENCRYPTION_KEY);
      } else {
        const envEncryptedKey = process.env.ENCRYPTED_WALLET_KEY;

        if (envEncryptedKey) {
          console.log("🔍 Using wallet from ENCRYPTED_WALLET_KEY env var");
          privateKey = decryptPrivateKey(envEncryptedKey, ENCRYPTION_KEY);
        } else {
          // Generate new wallet and store it
          console.log("🆕 No existing wallet found, generating new one...");
          privateKey = generatePrivateKey();
          const encrypted = encryptPrivateKey(privateKey, ENCRYPTION_KEY);

          // Store in KV for future use
          await kv.put(PRIVATE_KEY_STORAGE_KEY, encrypted);

          console.log("✨ NEW WALLET CREATED:");
          console.log("🔑 Public Address will be logged below");
          console.log("🔐 Private key stored securely in KV storage");
          console.log("💡 For production, fund this address with Sepolia ETH");
        }
      }
    }

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create wallet client for transactions
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    });

    // Create public client for reading blockchain state
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC_URL),
    });

    console.log("✅ Wallet loaded successfully");
    console.log("📍 PUBLIC ADDRESS:", account.address);
    console.log("🌐 Network: Sepolia Testnet");
    console.log("🔗 Fund URL: https://faucet.sepolia.dev");

    return { account, client: walletClient, publicClient };
  } catch (error) {
    console.error("❌ Wallet initialization failed:", error);
    throw error;
  }
}

// Account Abstraction helpers (placeholder for your implementation)
export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export async function sendUserOperation(
  userOp: UserOperation
): Promise<string> {
  try {
    // This is where you'd integrate with your Account Abstraction provider
    // Examples: Alchemy, Biconomy, Stackup, etc.

    console.log("📤 Sending UserOperation:", userOp);

    // Placeholder implementation - replace with actual AA provider
    const response = await fetch(
      "https://sepolia.api.your-aa-provider.com/v1/userops",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AA_API_KEY}`,
        },
        body: JSON.stringify({
          userOperation: userOp,
          entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // EntryPoint v0.6
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AA Provider error: ${response.statusText}`);
    }

    const result = await response.json();
    const userOpHash = result.userOpHash;

    console.log("✅ UserOperation sent:", userOpHash);
    return userOpHash;
  } catch (error) {
    console.error("❌ UserOperation failed:", error);
    throw error;
  }
}

// Graph Protocol constants
const GRAPH_TESTNET_API_ORIGIN = "https://api.thegraph.com/testnet"; // Update with actual URL

// Upload edit operations to IPFS using @graphprotocol/grc-20
export async function publishEditToIPFS(
  name: string,
  editOps: Op[],
  network: "TESTNET" | "MAINNET" = "TESTNET"
): Promise<string> {
  try {
    console.log("📝 Publishing edit operations to IPFS via Graph Protocol...");
    console.log("🔧 Operations count:", editOps.length);
    console.log("🌐 Network:", network);

    // Use @graphprotocol/grc-20 library
    const { Ipfs, getWalletClient } = await import("@graphprotocol/grc-20");

    // Get private key for GRC-20 library (must match the one used in getWallet)
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error(
        "WALLET_PRIVATE_KEY environment variable is required for GRC-20 operations"
      );
    }

    console.log("🔐 Creating wallet client for GRC-20...");
    console.log(
      "🔍 Private key format:",
      privateKey.startsWith("0x") ? "hex with 0x prefix" : "hex without prefix"
    );
    const smartAccountWalletClient = await getWalletClient({
      privateKey: privateKey as `0x${string}`,
    });

    if (!smartAccountWalletClient.account?.address) {
      throw new Error("No author");
    }

    console.log("📤 Publishing edit to IPFS...");
    const publishResult = await Ipfs.publishEdit({
      name,
      ops: editOps,
      network,
      author: smartAccountWalletClient.account.address,
    });

    // Remove ipfs:// prefix if present
    const cid = publishResult.cid.replace("ipfs://", "");

    console.log("✅ Edit published to IPFS successfully");
    console.log("📁 CID:", cid);

    return cid;
  } catch (error) {
    console.error("❌ Graph Protocol IPFS publish failed:", error);
    console.error("📋 Error details:", {
      message: (error as { message?: string }).message,
      stack: (error as { stack?: string }).stack,
    });
    throw error;
  }
}

// Get transaction calldata from Graph Protocol API
export async function getSpaceEditCalldata(
  spaceId: string,
  cid: string
): Promise<{ to: string; data: string; value: string }> {
  try {
    console.log("🔍 Fetching calldata for space:", spaceId, "with CID:", cid);

    const response = await fetch(
      `${GRAPH_TESTNET_API_ORIGIN}/space/${spaceId}/edit/calldata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cid }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Graph API calldata fetch failed: ${response.statusText}`
      );
    }

    const calldataResult = await response.json();

    console.log("📄 Calldata retrieved from Graph Protocol:", {
      to: calldataResult.to,
      dataLength: calldataResult.data?.length,
    });

    return {
      to: calldataResult.to,
      data: calldataResult.data,
      value: calldataResult.value || "0x0",
    };
  } catch (error) {
    console.error("❌ Graph Protocol calldata fetch failed:", error);
    throw error;
  }
}

// Utility to check wallet balance
export async function getWalletBalance(): Promise<string> {
  const { publicClient, account } = await getWallet();
  const balance = await publicClient.getBalance({ address: account.address });
  return balance.toString();
}
