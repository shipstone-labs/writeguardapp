import { getWalletStatus } from "../../../lib/wallet-utils";


export async function GET() {
  console.log("🔍 Wallet status API called");

  try {
    const status = await getWalletStatus();

    console.log("✅ Wallet status retrieved successfully");
    return Response.json(status);
  } catch (error) {
    console.error("❌ Wallet status API failed:", error);

    const errorResponse = {
      error: "Failed to get wallet status",
      message: error instanceof Error ? error.message : "Unknown error",
    };

    return Response.json(errorResponse, { status: 500 });
  }
}
