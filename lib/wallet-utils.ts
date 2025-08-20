import { getWallet } from "./wallet";

// Helper function to check wallet status
export async function getWalletStatus() {
  try {
    console.log("🔍 Checking wallet status...");
    const { account, publicClient } = await getWallet();
    const balance = await publicClient.getBalance({ address: account.address });

    const status = {
      address: account.address,
      balance: balance.toString(),
      balanceETH: Number(balance) / 1e18,
      network: "sepolia",
      funded: balance > 0n,
      faucetUrl: "https://faucet.sepolia.dev",
    };

    console.log("💰 Wallet status:", status);
    return status;
  } catch (error) {
    console.error("❌ Wallet status check failed:", error);
    throw error;
  }
}

// Helper function to get wallet info
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