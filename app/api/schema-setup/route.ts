import type { NextRequest } from "next/server";
import {
  HYPERGRAPH_SCHEMA,
  generateSchemaSetupOperations,
} from "../../../lib/hypergraph-schema";

export async function GET() {
  console.log("📋 Schema setup API called");
  console.log("📥 Method: GET");

  // Return the current schema definition
  console.log("📖 Returning hypergraph schema");

  return Response.json({
    schema: HYPERGRAPH_SCHEMA,
    spaceId: process.env.HYPERGRAPH_SPACE_ID || HYPERGRAPH_SCHEMA.spaceId,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  console.log("📋 Schema setup API called");
  console.log("📥 Method: POST");

  // Initialize the schema in the hypergraph
  console.log("🚀 Initializing hypergraph schema...");

  try {
    // Generate schema setup operations
    const { operations, generatedIds } = generateSchemaSetupOperations();

    console.log("📝 Generated schema operations:", operations.length);
    console.log(
      "🔑 Generated property IDs:",
      JSON.stringify(generatedIds.properties, null, 2)
    );
    console.log(
      "🏷️ Generated type IDs:",
      JSON.stringify(generatedIds.types, null, 2)
    );

    // Call the hypergraph operations API to create schema entities
    const spaceId =
      process.env.HYPERGRAPH_SPACE_ID || HYPERGRAPH_SCHEMA.spaceId;

    const origin = request.headers.get("origin") || request.headers.get("host");
    const baseUrl = origin
      ? `${origin.includes("://") ? "" : "https://"}${origin}`
      : "";

    const response = await fetch(`${baseUrl}/api/hypergraph-ops`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        spaceId,
        operations,
        name: "Schema Initialization",
      }),
    });

    if (!response.ok) {
      throw new Error(`Schema initialization failed: ${response.statusText}`);
    }

    const result = await response.json();

    console.log("✅ Schema initialized successfully");
    console.log("📁 CID:", result.cid);
    console.log("🔗 UserOp Hash:", result.userOpHash);

    return Response.json({
      success: true,
      message: "Schema initialized in hypergraph",
      schema: HYPERGRAPH_SCHEMA,
      spaceId,
      operationsCreated: operations.length,
      generatedIds,
      cid: result.cid,
      userOpHash: result.userOpHash,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Schema initialization failed:", error);

    return Response.json(
      {
        error: "Schema initialization failed",
        message: error instanceof Error ? error.message : "Unknown error",
        schema: HYPERGRAPH_SCHEMA,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
