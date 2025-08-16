from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import hashlib
import os
from functools import wraps

app = Flask(__name__)
CORS(app)

# API Key Authentication
API_KEY = os.environ.get('API_KEY', 'your-secret-api-key-here')

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not api_key or api_key != API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

model = SentenceTransformer("all-MiniLM-L6-v2")

chroma_client = chromadb.PersistentClient(
    path="/tmp/chroma_db",
    settings=Settings(anonymized_telemetry=False)
)

collection = chroma_client.get_or_create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"}
)

def generate_doc_id(content: str) -> str:
    return hashlib.md5(content.encode()).hexdigest()[:16]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "documents": collection.count()})

@app.route('/add', methods=['POST'])
@require_api_key
def add_document():
    data = request.json
    content = data.get('content', '')
    metadata = data.get('metadata', {})
    
    if not content:
        return jsonify({"error": "Content is required"}), 400
    
    doc_id = generate_doc_id(content)
    
    existing = collection.get(ids=[doc_id])
    if existing['ids']:
        return jsonify({"message": "Document already exists", "id": doc_id}), 200
    
    embedding = model.encode(content).tolist()
    
    collection.add(
        embeddings=[embedding],
        documents=[content],
        metadatas=[metadata],
        ids=[doc_id]
    )
    
    return jsonify({"message": "Document added", "id": doc_id}), 201

@app.route('/search', methods=['POST'])
@require_api_key
def search():
    data = request.json
    query = data.get('query', '')
    n_results = min(data.get('n_results', 5), collection.count())
    
    if not query:
        return jsonify({"error": "Query is required"}), 400
    
    if collection.count() == 0:
        return jsonify({"results": [], "message": "No documents in database"}), 200
    
    query_embedding = model.encode(query).tolist()
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results
    )
    
    formatted_results = []
    for i in range(len(results['ids'][0])):
        formatted_results.append({
            "id": results['ids'][0][i],
            "similarity": 1 - results['distances'][0][i],
            "content": results['documents'][0][i],
            "metadata": results['metadatas'][0][i]
        })
    
    return jsonify({"results": formatted_results, "query": query})

@app.route('/compare', methods=['POST'])
@require_api_key
def compare():
    data = request.json
    doc1 = data.get('doc1', '')
    doc2 = data.get('doc2', '')
    
    if not doc1 or not doc2:
        return jsonify({"error": "Both documents are required"}), 400
    
    embedding1 = model.encode(doc1)
    embedding2 = model.encode(doc2)
    
    from numpy import dot
    from numpy.linalg import norm
    
    similarity = float(dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2)))
    
    return jsonify({
        "similarity": similarity,
        "percentage": similarity * 100,
        "doc1_preview": doc1[:100],
        "doc2_preview": doc2[:100]
    })

@app.route('/documents', methods=['GET'])
@require_api_key
def get_all_documents():
    all_docs = collection.get()
    
    documents = []
    for i in range(len(all_docs['ids'])):
        documents.append({
            "id": all_docs['ids'][i],
            "content": all_docs['documents'][i],
            "metadata": all_docs['metadatas'][i]
        })
    
    return jsonify({"documents": documents, "count": len(documents)})

@app.route('/clear', methods=['DELETE'])
@require_api_key
def clear_database():
    global collection
    chroma_client.delete_collection("documents")
    collection = chroma_client.create_collection(
        name="documents",
        metadata={"hnsw:space": "cosine"}
    )
    return jsonify({"message": "Database cleared"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))