---
title: Writeguard
emoji: 🏆
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.42.0
app_file: app.py
pinned: false
license: mit
short_description: Make sure you're the OG
---
# Document Comparison System

A Python-based document similarity system using sentence embeddings and vector search.

## Features

- **Sentence Embeddings**: Uses Sentence-BERT for high-quality document vectorization
- **Vector Storage**: ChromaDB for persistent vector storage with cosine similarity search
- **Batch Processing**: Efficient batch document insertion
- **Interactive CLI**: User-friendly interface with rich formatting
- **Similarity Search**: Find similar documents based on semantic meaning
- **Direct Comparison**: Compare two documents directly for similarity score

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
python document_compare.py
```

The system provides:
1. **Search**: Find documents similar to your query
2. **Compare**: Get similarity score between two documents
3. **Add**: Insert new documents with optional metadata
4. **Storage**: Persistent vector database (./chroma_db)

## How It Works

1. **Tokenization**: Documents are converted to 384-dimensional vectors using all-MiniLM-L6-v2
2. **Storage**: Vectors stored in ChromaDB with HNSW index for fast retrieval
3. **Comparison**: Cosine similarity measures document relatedness (0-1 scale)

## Performance

- Model: all-MiniLM-L6-v2 (22M parameters, fast inference)
- Storage: ChromaDB handles millions of vectors efficiently
- Search: Sub-second query times with HNSW indexing

## Alternative Implementations

For production systems consider:
- **Node.js**: Use @xenova/transformers with ChromaDB JS client
- **Go**: Integrate with Milvus or external embedding APIs
- **Rust**: Use candle with Qdrant for maximum performance
