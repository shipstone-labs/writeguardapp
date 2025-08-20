import type { NextRequest } from "next/server";
import {
  validateEntityData,
  validateRelationData,
} from "../../../lib/hypergraph-schema";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, dataType, data } = body;

    let validation: { valid: boolean; errors?: string[] } | undefined;

    if (type === "entity") {
      validation = validateEntityData(dataType, data);
    } else if (type === "relation") {
      validation = validateRelationData(dataType, data);
    } else {
      return Response.json(
        { error: "Invalid validation type" },
        { status: 400 }
      );
    }

    return Response.json({
      valid: validation.valid,
      errors: validation.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Validation error:", error);
    return Response.json(
      {
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
