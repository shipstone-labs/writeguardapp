import { NextApiRequest } from "next";
import {
  getWallet,
  sendUserOperation,
  UserOperation,
  publishEditToIPFS,
  getSpaceEditCalldata,
  Op,
} from "../../../lib/wallet";
import { encodeFunctionData, parseEther } from "viem";

// Example contract ABI for registering IPFS hashes
const REGISTRY_ABI = [
  {
    name: "registerIPFS",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ipfsHash", type: "string" },
      { name: "metadata", type: "string" },
    ],
    outputs: [],
  },
] as const;

// Your contract address on Sepolia
const REGISTRY_CONTRACT = "0x1234567890123456789012345678901234567890"; // Replace with actual address

interface UpdateRequest {
  // The raw transaction data you want to process
  transaction?: {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
  };

  // Data to upload to IPFS (legacy)
  ipfsData?: {
    content: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };

  // Hypergraph operations (GRC-20)
  hypergraphUpdate?: {
    spaceId: string;
    name: string; // Name for the edit
    editOps: Op[];
    network?: string; // Default: 'sepolia'
  };

  // Custom user operation (if you want to override)
  userOperation?: Partial<UserOperation>;

  // Operation type
  operation: "transaction" | "ipfs_register" | "hypergraph_update" | "custom";
}

export async function POST(request: NextApiRequest) {
  try {
    const body = await request.body();
    const {
      operation,
      transaction,
      ipfsData,
      hypergraphUpdate,
      userOperation,
    }: UpdateRequest = body;

    // Get wallet instance
    const { account, client } = await getWallet();

    console.log("🔄 Processing update request:", {
      operation,
      account: account.address,
    });

    let userOpHash: string;
    let cid: string | undefined;

    switch (operation) {
      case "transaction":
        // Direct transaction execution
        if (!transaction) {
          return Response.json(
            { error: "Transaction data required" },
            { status: 400 }
          );
        }

        userOpHash = await executeTransaction(transaction);
        break;

      case "ipfs_register":
        // Upload to IPFS and register on-chain (legacy)
        if (!ipfsData) {
          return Response.json(
            { error: "IPFS data required" },
            { status: 400 }
          );
        }

        userOpHash = await uploadAndRegister(ipfsData);
        break;

      case "hypergraph_update": {
        // GRC-20 hypergraph update
        if (!hypergraphUpdate) {
          return Response.json(
            { error: "Hypergraph update data required" },
            { status: 400 }
          );
        }

        const result = await executeHypergraphUpdate(hypergraphUpdate);
        userOpHash = result.userOpHash;
        cid = result.cid;
        break;
      }

      case "custom":
        // Custom user operation
        if (!userOperation) {
          return Response.json(
            { error: "User operation data required" },
            { status: 400 }
          );
        }

        userOpHash = await executeCustomUserOp(userOperation);
        break;

      default:
        return Response.json(
          { error: "Invalid operation type" },
          { status: 400 }
        );
    }

    return Response.json({
      success: true,
      userOpHash,
      cid,
      wallet: account.address,
      operation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Update API error:", error);
    return Response.json(
      {
        error: "Update failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Execute a direct transaction
async function executeTransaction(
  transaction: Record<string, unknown>
): Promise<string> {
  const { account } = await getWallet();

  // Convert viem transaction to UserOperation
  const userOp: UserOperation = {
    sender: account.address,
    nonce: "0x0", // You'd get this from the AA provider
    initCode: "0x",
    callData: encodeCallData(transaction),
    callGasLimit: (transaction.gasLimit as `0x${string}`) || "0x5208",
    verificationGasLimit: "0x15F90",
    preVerificationGas: "0x5208",
    maxFeePerGas: "0x9502F9000",
    maxPriorityFeePerGas: "0x9502F900",
    paymasterAndData: "0x",
    signature: "0x", // Will be filled by AA provider
  };

  return await sendUserOperation(userOp);
}

// Upload to IPFS and register on-chain (legacy)
async function uploadAndRegister(
  ipfsData: Record<string, unknown>
): Promise<string> {
  console.log("📁 Uploading to IPFS...");

  // This is legacy - use hypergraph_update for new implementations
  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PINATA_API_KEY}`,
      },
      body: JSON.stringify({
        pinataContent: ipfsData.content,
        pinataMetadata: { name: `legacy-update-${Date.now()}` },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }

  const { IpfsHash } = await response.json();

  console.log("📝 Registering on-chain...");

  // Create transaction to register IPFS hash
  const callData = encodeFunctionData({
    abi: REGISTRY_ABI,
    functionName: "registerIPFS",
    args: [IpfsHash, JSON.stringify(ipfsData.metadata || {})],
  });

  const transaction = {
    to: REGISTRY_CONTRACT,
    value: "0x0",
    data: callData,
    gasLimit: "0x15F90",
  };

  return await executeTransaction(transaction);
}

// Execute hypergraph update using Graph Protocol
async function executeHypergraphUpdate(
  hypergraphUpdate: any
): Promise<{ userOpHash: string; cid: string }> {
  console.log("🌐 Processing hypergraph update via Graph Protocol...");

  const { spaceId, name, editOps, network = "sepolia" } = hypergraphUpdate;

  // 1. Publish edit operations to IPFS using @graphprotocol/grc-20
  console.log("📁 Publishing edit to IPFS via Graph Protocol...");
  const cid = await publishEditToIPFS(name, editOps, network);

  // 2. Get transaction calldata from Graph Protocol API
  console.log("🔍 Fetching transaction calldata from Graph Protocol...");
  const transaction = await getSpaceEditCalldata(spaceId, cid);

  // 3. Execute the transaction via Account Abstraction
  console.log("🚀 Executing hypergraph update transaction...");
  const userOpHash = await executeTransaction(transaction);

  console.log("✅ Hypergraph update completed:", {
    cid,
    userOpHash,
    spaceId,
    name,
    operations: editOps.length,
  });

  return { userOpHash, cid };
}

// Execute custom user operation
async function executeCustomUserOp(
  userOpData: Partial<UserOperation>
): Promise<string> {
  const { account } = await getWallet();

  // Merge with defaults
  const userOp: UserOperation = {
    sender: account.address,
    nonce: "0x0",
    initCode: "0x",
    callData: "0x",
    callGasLimit: "0x5208",
    verificationGasLimit: "0x15F90",
    preVerificationGas: "0x5208",
    maxFeePerGas: "0x9502F9000",
    maxPriorityFeePerGas: "0x9502F900",
    paymasterAndData: "0x",
    signature: "0x",
    ...userOpData,
  };

  return await sendUserOperation(userOp);
}

// Helper to encode call data for simple transactions
function encodeCallData(transaction: any): string {
  if (transaction.data) {
    return transaction.data;
  }

  // For simple ETH transfers, return empty call data
  if (transaction.value && !transaction.data) {
    return "0x";
  }

  throw new Error("Unable to encode call data");
}

// Health check endpoint
export async function getWalletInfo() {
  try {
    const { account, publicClient } = await getWallet();
    const balance = await publicClient.getBalance({ address: account.address });

    return {
      address: account.address,
      balance: balance.toString(),
      balanceETH: Number(balance) / 1e18,
      network: "sepolia",
    };
  } catch (error) {
    throw new Error(`Wallet info failed: ${(error as Error).message}`);
  }
}
