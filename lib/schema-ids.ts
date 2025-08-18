// Schema IDs for GRC-20 operations
import { Id } from '@graphprotocol/grc-20';
import { PROPERTY_IDS, TYPE_IDS } from './hypergraph-schema';

// Helper to get typed property IDs
export function getPropertyIdTyped(property: string): ReturnType<typeof Id> {
  const id = PROPERTY_IDS[property];
  if (!id) {
    throw new Error(`Property ID for '${property}' not found. Did you run schema setup?`);
  }
  return Id(id);
}

export function getTypeIdTyped(type: string): ReturnType<typeof Id> {
  const id = TYPE_IDS[type];
  if (!id) {
    throw new Error(`Type ID for '${type}' not found. Did you run schema setup?`);
  }
  return Id(id);
}

// Helper functions for creating entities and relations with proper GRC-20 operations
export function createDocumentEntity(entityId: string, title: string, authors: string[], date: string, summary: string) {
  return {
    type: "UPDATE_ENTITY" as const,
    entity: {
      id: Id(entityId),
      values: [
        {
          property: getPropertyIdTyped("title"),
          value: title,
        },
        {
          property: getPropertyIdTyped("authors"),
          value: JSON.stringify(authors),
        },
        {
          property: getPropertyIdTyped("date"),
          value: date,
        },
        {
          property: getPropertyIdTyped("summary"),
          value: summary,
        },
      ],
    },
  };
}

export function createSimilarityRelation(fromId: string, toId: string, closeness: number, violation: boolean) {
  const relationId = `${fromId}-${toId}`;
  return {
    type: "CREATE_RELATION" as const,
    relation: {
      id: Id(relationId),
      type: getTypeIdTyped("similarity"),
      fromEntity: Id(fromId),
      toEntity: Id(toId),
      entity: Id(relationId),
      verified: !violation,
      position: closeness.toString(),
    },
  };
}