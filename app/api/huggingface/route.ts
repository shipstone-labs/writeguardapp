import { NextRequest, NextResponse } from 'next/server';

// HuggingFace API endpoint for creating embeddings from research papers
// This will be called after a paper is uploaded to create its model

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'; // Fast, good for semantic similarity

export async function POST(request: NextRequest) {
  try {
    const { text, fileHash, ipfsCid } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 }
      );
    }

    if (!HF_API_KEY) {
      console.warn('HuggingFace API key not configured');
      // Return mock embedding for development
      return NextResponse.json({
        embedding: Array(384).fill(0).map(() => Math.random()),
        model: HF_MODEL,
        fileHash,
        ipfsCid,
        timestamp: new Date().toISOString(),
      });
    }

    // Create embedding using HuggingFace
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.statusText}`);
    }

    const embedding = await response.json();
    
    // Store embedding reference (in production, this would go to a vector DB)
    const modelData = {
      embedding,
      model: HF_MODEL,
      fileHash,
      ipfsCid,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(modelData);
  } catch (error) {
    console.error('HuggingFace API error:', error);
    return NextResponse.json(
      { error: 'Failed to create embedding' },
      { status: 500 }
    );
  }
}

// Compare two papers for similarity
export async function PUT(request: NextRequest) {
  try {
    const { embedding1, embedding2 } = await request.json();
    
    if (!embedding1 || !embedding2) {
      return NextResponse.json(
        { error: 'Two embeddings are required for comparison' },
        { status: 400 }
      );
    }

    // Calculate cosine similarity
    const similarity = cosineSimilarity(embedding1, embedding2);
    
    return NextResponse.json({
      similarity: Math.round(similarity * 100), // Return as percentage
      threshold: 80, // Threshold for violation
      isViolation: similarity * 100 > 80,
    });
  } catch (error) {
    console.error('Similarity calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate similarity' },
      { status: 500 }
    );
  }
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}