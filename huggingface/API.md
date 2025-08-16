# Document Comparison API

Flask API for document similarity search using sentence embeddings.

## Authentication

All endpoints (except `/health`) require an API key:

**Header method (recommended):**
```
X-API-Key: your-secret-api-key
```

**Query parameter method:**
```
?api_key=your-secret-api-key
```

## Endpoints

### Health Check
```http
GET /api/health
```
No authentication required.

**Response:**
```json
{
  "status": "healthy",
  "api_documents": 42,
  "demo_documents": 15
}
```

**Note**: API endpoints use separate storage from the demo UI. Documents added via API won't appear in the demo interface and vice versa.

### Add Document
```http
POST /api/add
Content-Type: application/json
X-API-Key: your-secret-api-key

{
  "content": "Your document text here",
  "metadata": {
    "category": "example",
    "source": "api"
  }
}
```

**Response:**
```json
{
  "message": "Document added",
  "id": "a1b2c3d4e5f6g7h8"
}
```

### Add PDF Document
```http
POST /api/add-pdf
Content-Type: multipart/form-data
X-API-Key: your-secret-api-key

Form Data:
- pdf: [PDF file]
- metadata: {"category": "document", "type": "manual"} (optional)
```

**Response:**
```json
{
  "message": "PDF processed and document added",
  "id": "a1b2c3d4e5f6g7h8",
  "filename": "document.pdf",
  "text_length": 1547,
  "pages": 3
}
```

### Search Similar Documents
```http
POST /api/search
Content-Type: application/json
X-API-Key: your-secret-api-key

{
  "query": "machine learning algorithms",
  "n_results": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "a1b2c3d4e5f6g7h8",
      "similarity": 0.8547,
      "content": "Machine learning is...",
      "metadata": {"category": "ML"}
    }
  ],
  "query": "machine learning algorithms"
}
```

### Compare Two Documents
```http
POST /api/compare
Content-Type: application/json
X-API-Key: your-secret-api-key

{
  "doc1": "First document text",
  "doc2": "Second document text"
}
```

**Response:**
```json
{
  "similarity": 0.7234,
  "percentage": 72.34,
  "doc1_preview": "First document text",
  "doc2_preview": "Second document text"
}
```

### Get All Documents
```http
GET /api/documents
X-API-Key: your-secret-api-key
```

**Response:**
```json
{
  "documents": [
    {
      "id": "a1b2c3d4e5f6g7h8",
      "content": "Document content...",
      "metadata": {"category": "example"}
    }
  ],
  "count": 1
}
```

### Delete Single Document
```http
DELETE /api/documents/{doc_id}
X-API-Key: your-secret-api-key
```

**Response:**
```json
{
  "message": "Document deleted",
  "id": "a1b2c3d4e5f6g7h8"
}
```

**Error responses:**
```json
{
  "error": "Document not found"
}
```

### Clear Database
```http
DELETE /api/clear
X-API-Key: your-secret-api-key
```

**Response:**
```json
{
  "message": "API database cleared"
}
```

## Usage Examples

### JavaScript/Fetch
```javascript
const API_KEY = 'your-secret-api-key';
const API_URL = 'https://your-api-domain.com';

// Add document
async function addDocument(content, metadata = {}) {
  const response = await fetch(`${API_URL}/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ content, metadata })
  });
  return response.json();
}

// Search similar documents
async function searchSimilar(query, nResults = 5) {
  const response = await fetch(`${API_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ query, n_results: nResults })
  });
  return response.json();
}

// Compare documents
async function compareDocuments(doc1, doc2) {
  const response = await fetch(`${API_URL}/api/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ doc1, doc2 })
  });
  return response.json();
}

// Delete document
async function deleteDocument(docId) {
  const response = await fetch(`${API_URL}/api/documents/${docId}`, {
    method: 'DELETE',
    headers: {
      'X-API-Key': API_KEY
    }
  });
  return response.json();
}

// Add PDF document
async function addPDF(pdfFile, metadata = {}) {
  const formData = new FormData();
  formData.append('pdf', pdfFile);
  formData.append('metadata', JSON.stringify(metadata));
  
  const response = await fetch(`${API_URL}/api/add-pdf`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  });
  return response.json();
}
```

### Python/Requests
```python
import requests

API_KEY = 'your-secret-api-key'
API_URL = 'https://your-api-domain.com'

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
}

# Add document
def add_document(content, metadata=None):
    data = {'content': content}
    if metadata:
        data['metadata'] = metadata
    
    response = requests.post(f'{API_URL}/add', 
                           json=data, 
                           headers=headers)
    return response.json()

# Search similar documents
def search_similar(query, n_results=5):
    data = {'query': query, 'n_results': n_results}
    response = requests.post(f'{API_URL}/search', 
                           json=data, 
                           headers=headers)
    return response.json()

# Compare documents
def compare_documents(doc1, doc2):
    data = {'doc1': doc1, 'doc2': doc2}
    response = requests.post(f'{API_URL}/api/compare', 
                           json=data, 
                           headers=headers)
    return response.json()

# Delete document
def delete_document(doc_id):
    response = requests.delete(f'{API_URL}/api/documents/{doc_id}', 
                              headers={'X-API-Key': API_KEY})
    return response.json()

# Add PDF document
def add_pdf(pdf_file_path, metadata=None):
    with open(pdf_file_path, 'rb') as pdf_file:
        files = {'pdf': pdf_file}
        data = {}
        if metadata:
            data['metadata'] = json.dumps(metadata)
        
        response = requests.post(f'{API_URL}/api/add-pdf',
                               files=files,
                               data=data,
                               headers={'X-API-Key': API_KEY})
    return response.json()
```

### cURL
```bash
# Add document
curl -X POST https://your-api-domain.com/add \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "content": "Machine learning is awesome",
    "metadata": {"category": "ML"}
  }'

# Search similar documents
curl -X POST https://your-api-domain.com/api/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "query": "artificial intelligence",
    "n_results": 3
  }'

# Delete document
curl -X DELETE https://your-api-domain.com/api/documents/a1b2c3d4e5f6g7h8 \
  -H "X-API-Key: your-secret-api-key"

# Upload PDF
curl -X POST https://your-api-domain.com/api/add-pdf \
  -H "X-API-Key: your-secret-api-key" \
  -F "pdf=@document.pdf" \
  -F "metadata={\"category\":\"manual\",\"type\":\"research\"}"
```

## Deployment

### Local Development
```bash
# Set API key
export API_KEY=your-secret-api-key

# Run API
python api.py
```

### Docker
```bash
# Copy environment file
cp .env.example .env
# Edit .env with your API key

# Run with Docker Compose
docker-compose up -d

# Or with Docker directly
docker build -t text-compare-api .
docker run -p 8080:8080 -e API_KEY=your-secret-api-key text-compare-api
```

### Cloud Run (Google Cloud)
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/text-compare-api
gcloud run deploy text-compare-api \
  --image gcr.io/PROJECT_ID/text-compare-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars API_KEY=your-secret-api-key \
  --memory 2Gi
```

## Error Responses

```json
{
  "error": "Invalid or missing API key"
}
```

```json
{
  "error": "Content is required"
}
```

```json
{
  "error": "Both documents are required"
}
```

## Security Notes

- Always use HTTPS in production
- Keep your API key secret
- Consider rate limiting for production use
- The API accepts CORS requests from any origin - restrict this in production