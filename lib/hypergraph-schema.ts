// Hypergraph schema definitions and utilities

export interface EntityProperty {
  name: string;
  type: "string" | "string[]" | "number" | "boolean" | "date";
  required: boolean;
  description?: string;
}

export interface EntityType {
  name: string;
  description: string;
  properties: EntityProperty[];
}

export interface RelationType {
  name: string;
  description: string;
  properties: EntityProperty[];
}

export interface HypergraphSchema {
  entityTypes: EntityType[];
  relationTypes: RelationType[];
  version: string;
  spaceId: string;
}

// Document Entity Schema
export const DOCUMENT_ENTITY_TYPE: EntityType = {
  name: "Document",
  description: "Research papers, articles, and other documents",
  properties: [
    {
      name: "title",
      type: "string",
      required: true,
      description: "Document title",
    },
    {
      name: "authors",
      type: "string[]",
      required: true,
      description: "List of document authors",
    },
    {
      name: "date",
      type: "date",
      required: true,
      description: "Publication or creation date",
    },
    {
      name: "summary",
      type: "string",
      required: true,
      description: "Document summary or abstract",
    },
    // Auto-added by system
    {
      name: "created_at",
      type: "date",
      required: true,
      description: "When this entity was created in the hypergraph",
    },
    {
      name: "created_by",
      type: "string",
      required: true,
      description: "Ethereum address that created this entity",
    },
  ],
};

// Similarity Relation Schema
export const SIMILARITY_RELATION_TYPE: RelationType = {
  name: "Similarity",
  description: "Semantic similarity between documents",
  properties: [
    {
      name: "closeness",
      type: "number",
      required: true,
      description: "Similarity score (0.0 to 1.0)",
    },
    {
      name: "violation",
      type: "boolean",
      required: true,
      description: "True if similarity exceeds threshold (potential violation)",
    },
    // Auto-added by system
    {
      name: "created_at",
      type: "date",
      required: true,
      description: "When this relation was created",
    },
    {
      name: "created_by",
      type: "string",
      required: true,
      description: "Ethereum address that created this relation",
    },
  ],
};

// Complete schema
export const HYPERGRAPH_SCHEMA: HypergraphSchema = {
  entityTypes: [DOCUMENT_ENTITY_TYPE],
  relationTypes: [SIMILARITY_RELATION_TYPE],
  version: "1.0.0",
  spaceId:
    process.env.HYPERGRAPH_SPACE_ID || "ecc6ea7a-3e7c-4729-8faa-a8636ae6bd93",
};

// Schema validation helpers
export function validateEntityData(
  entityType: string,
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const type = HYPERGRAPH_SCHEMA.entityTypes.find((t) => t.name === entityType);
  if (!type) {
    return { valid: false, errors: [`Unknown entity type: ${entityType}`] };
  }

  for (const prop of type.properties) {
    if (prop.required && !(prop.name in data)) {
      errors.push(`Missing required property: ${prop.name}`);
      continue;
    }

    if (prop.name in data) {
      const value = data[prop.name];

      switch (prop.type) {
        case "string":
          if (typeof value !== "string") {
            errors.push(`Property ${prop.name} must be a string`);
          }
          break;
        case "string[]":
          if (
            !Array.isArray(value) ||
            !value.every((v) => typeof v === "string")
          ) {
            errors.push(`Property ${prop.name} must be an array of strings`);
          }
          break;
        case "number":
          if (typeof value !== "number") {
            errors.push(`Property ${prop.name} must be a number`);
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            errors.push(`Property ${prop.name} must be a boolean`);
          }
          break;
        case "date":
          if (typeof value !== "string" || isNaN(Date.parse(value))) {
            errors.push(`Property ${prop.name} must be a valid date string`);
          }
          break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateRelationData(
  relationType: string,
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const type = HYPERGRAPH_SCHEMA.relationTypes.find(
    (t) => t.name === relationType
  );
  if (!type) {
    return { valid: false, errors: [`Unknown relation type: ${relationType}`] };
  }

  // Check required relation fields
  if (!data.from || !data.to) {
    errors.push('Relations must have "from" and "to" entity IDs');
  }

  // Validate properties using same logic as entities
  for (const prop of type.properties) {
    if (prop.required && !(prop.name in data)) {
      errors.push(`Missing required property: ${prop.name}`);
      continue;
    }

    if (prop.name in data) {
      const value = data[prop.name];

      switch (prop.type) {
        case "number":
          if (typeof value !== "number") {
            errors.push(`Property ${prop.name} must be a number`);
          } else if (prop.name === "closeness" && (value < 0 || value > 1)) {
            errors.push(`Closeness must be between 0.0 and 1.0`);
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            errors.push(`Property ${prop.name} must be a boolean`);
          }
          break;
        // Add other type validations as needed
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Import GRC-20 functions
import { Graph, Op } from "@graphprotocol/grc-20";

// Generated property and type IDs from GRC-20 setup
export let PROPERTY_IDS: Record<string, string> = {
  title: "1d44865e-65e1-41e8-b6ca-ec58dc691722",
  authors: "8f16856f-7891-4d4c-9b00-332aa79d6750",
  date: "7400ead9-1da9-4928-b4b8-67002317a1a2",
  summary: "27be2820-10e8-4831-9cec-f28269b62aef",
  created_at: "4b6a5b88-2794-4683-8636-9bc186dd519d",
  created_by: "f4c79daa-eec5-46ac-95a8-82edbf1935b2",
  closeness: "441d5c21-bf35-4c21-b9c1-c2019f4e38a3",
  violation: "9ce70640-bc25-42c2-ad88-243d86e158c6",
};

export let TYPE_IDS: Record<string, string> = {
  document: "8309bad7-64c1-44c2-b777-8561ae32f272",
  similarity: "2bc028cf-91fb-4fa5-ab95-a18e626ac53a",
};

// Helper to generate native GRC-20 schema operations
export function generateSchemaSetupOperations(): {
  operations: Op[];
  generatedIds: {
    properties: Record<string, string>;
    types: Record<string, string>;
  };
} {
  console.log("🏗️ Generating native GRC-20 schema operations...");

  const operations: Op[] = [];
  const generatedIds = {
    properties: {} as Record<string, string>,
    types: {} as Record<string, string>,
  };

  // Create properties for Document entities
  const titleProperty = Graph.createProperty({
    dataType: "STRING",
    name: "Title",
    description: "Document title",
  });
  generatedIds.properties.title = titleProperty.id;
  operations.push(...titleProperty.ops);

  const authorsProperty = Graph.createProperty({
    dataType: "STRING",
    name: "Authors",
    description: "Document authors (JSON array)",
  });
  generatedIds.properties.authors = authorsProperty.id;
  operations.push(...authorsProperty.ops);

  const dateProperty = Graph.createProperty({
    dataType: "TIME",
    name: "Date",
    description: "Document publication date",
  });
  generatedIds.properties.date = dateProperty.id;
  operations.push(...dateProperty.ops);

  const summaryProperty = Graph.createProperty({
    dataType: "STRING",
    name: "Summary",
    description: "Document summary or abstract",
  });
  generatedIds.properties.summary = summaryProperty.id;
  operations.push(...summaryProperty.ops);

  const createdAtProperty = Graph.createProperty({
    dataType: "TIME",
    name: "Created At",
    description: "When entity was created in hypergraph",
  });
  generatedIds.properties.created_at = createdAtProperty.id;
  operations.push(...createdAtProperty.ops);

  const createdByProperty = Graph.createProperty({
    dataType: "STRING",
    name: "Created By",
    description: "Address that created the entity",
  });
  generatedIds.properties.created_by = createdByProperty.id;
  operations.push(...createdByProperty.ops);

  // Create properties for Similarity relations
  const closenessProperty = Graph.createProperty({
    dataType: "NUMBER",
    name: "Closeness",
    description: "Similarity score (0.0 to 1.0)",
  });
  generatedIds.properties.closeness = closenessProperty.id;
  operations.push(...closenessProperty.ops);

  const violationProperty = Graph.createProperty({
    dataType: "BOOLEAN",
    name: "Violation",
    description: "True if similarity exceeds threshold",
  });
  generatedIds.properties.violation = violationProperty.id;
  operations.push(...violationProperty.ops);

  // Create Document entity type
  const documentType = Graph.createType({
    name: "Document",
    description: "Research papers and documents",
    properties: [
      titleProperty.id,
      authorsProperty.id,
      dateProperty.id,
      summaryProperty.id,
      createdAtProperty.id,
      createdByProperty.id,
    ],
  });
  generatedIds.types.document = documentType.id;
  operations.push(...documentType.ops);

  // Create Similarity relation type
  const similarityType = Graph.createType({
    name: "Similarity",
    description: "Semantic similarity between documents",
    properties: [
      closenessProperty.id,
      violationProperty.id,
      createdAtProperty.id,
      createdByProperty.id,
    ],
  });
  generatedIds.types.similarity = similarityType.id;
  operations.push(...similarityType.ops);

  // Update the global IDs
  PROPERTY_IDS = generatedIds.properties;
  TYPE_IDS = generatedIds.types;

  console.log("✅ Generated native GRC-20 operations:", {
    operationCount: operations.length,
    propertyIds: generatedIds.properties,
    typeIds: generatedIds.types,
  });

  return { operations, generatedIds };
}
