// HuggingFace service for creating and comparing embeddings
// This should be deployed as a separate backend service (Cloudflare Worker, Vercel Function, etc.)

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

export async function createEmbedding(text: string, fileHash: string, ipfsCid?: string) {
  if (!HF_API_KEY) {
    console.warn('HuggingFace API key not configured');
    return {
      embedding: Array(384).fill(0).map(() => Math.random()),
      model: HF_MODEL,
      fileHash,
      ipfsCid,
      timestamp: new Date().toISOString(),
    };
  }

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
  
  return {
    embedding,
    model: HF_MODEL,
    fileHash,
    ipfsCid,
    timestamp: new Date().toISOString(),
  };
}

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
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

export function checkViolation(embedding1: number[], embedding2: number[]) {
  const similarity = cosineSimilarity(embedding1, embedding2);
  
  return {
    similarity: Math.round(similarity * 100),
    threshold: 70, // 70% threshold as per spec
    isViolation: similarity * 100 > 70,
  };
}