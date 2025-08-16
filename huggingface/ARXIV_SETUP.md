# arXiv Auto-Fetcher Setup Guide

## 🤖 Automated arXiv Paper Collection

This system automatically downloads and processes academic papers from arXiv based on your configured search queries.

## 🎯 Features

- **Query Management**: Add custom search queries with subject matter tags
- **Smart Deduplication**: Skips papers already in the database (by arXiv ID)
- **Rate Limiting**: Respectful API usage with delays between requests
- **Metadata Tracking**: Full paper metadata including arXiv ID, title, subject matter
- **Random Sampling**: Fetches random papers from search results to avoid bias

## 🚀 Setup Options

### Option 1: GitHub Actions Cron (Recommended)

1. **Fork this repository** to your GitHub account

2. **Set GitHub Secrets** in your repo:
   - Go to Settings → Secrets and variables → Actions
   - Add secrets:
     ```
     HF_SPACES_URL = https://huggingface.co/spaces/YOUR_USERNAME/text-compare
     API_KEY = your-secret-api-key
     ```

3. **Set HF Spaces Environment Variables** (optional):
   - In your Space settings → Variables and secrets:
     ```
     CRON_COUNT = 10    # Papers per query (default: 10)
     ```

4. **Configure Schedule** in `.github/workflows/arxiv-cron.yml`:
   ```yaml
   schedule:
     - cron: '0 */6 * * *'  # Every 6 hours
     - cron: '0 9 * * MON'  # Every Monday at 9 AM
   ```

5. **Enable Actions** in your GitHub repo

### Option 2: External Cron Service

Use any cron service (Railway, Render, DigitalOcean) to call:

```bash
curl -X POST "https://your-hf-space.com/api/arxiv/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{}'  # Uses CRON_COUNT environment variable
```

### Option 3: Manual Trigger

Use the "📚 arXiv Management" tab in your HF Spaces interface to manually trigger fetches.

## 📋 Query Configuration

### Via Web Interface (HF Spaces)

1. Go to the "📚 arXiv Management" tab
2. Add queries with subject matter tags
3. Click "🔄 Fetch Papers Now" to test

### Via API

```bash
# Add a query
curl -X POST "https://your-hf-space.com/api/arxiv/add-query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "query": "quantum computing",
    "subject_matter": "quantum-computing"
  }'

# Trigger fetch (uses CRON_COUNT default)
curl -X POST "https://your-hf-space.com/api/arxiv/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{}'

# Or specify custom count
curl -X POST "https://your-hf-space.com/api/arxiv/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{"max_papers_per_query": 5}'
```

## 🔍 arXiv Query Syntax

### Basic Queries
```
quantum computing
machine learning
natural language processing
```

### Advanced Queries
```
quantum AND computing              # Both terms required
quantum OR machine learning        # Either term
cat:cs.AI                         # Computer Science - AI category
cat:quant-ph                      # Quantum Physics category
au:einstein                       # Author search
ti:transformer                    # Title search
abs:neural network                # Abstract search
submittedDate:[202301010000 TO 202312312359]  # Date range
```

### Category Codes
- `cs.AI` - Artificial Intelligence
- `cs.CL` - Computation and Language (NLP)
- `cs.CV` - Computer Vision
- `cs.LG` - Machine Learning
- `quant-ph` - Quantum Physics
- `math.QA` - Quantum Algebra
- `physics.atom-ph` - Atomic Physics

## 📊 Monitoring

### Check Status
```bash
curl "https://your-hf-space.com/api/health"
```

### View Queries
```bash
curl -H "X-API-Key: your-key" "https://your-hf-space.com/api/arxiv/queries"
```

### Search Papers
```bash
curl -X POST "https://your-hf-space.com/api/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"query": "quantum error correction", "n_results": 5}'
```

## 🎛️ Configuration

### Fetch Parameters

- **max_papers_per_query**: 1-50 papers per query per run (default from `CRON_COUNT`)
- **CRON_COUNT**: Environment variable setting default papers per query (default: 10)
- **Frequency**: Recommended every 6-12 hours
- **Rate Limiting**: 1 second delay between paper downloads

### Metadata Structure

Each paper gets metadata:
```json
{
  "source": "arxiv_auto",
  "subject_matter": "quantum-computing",
  "title": "Quantum Error Correction with...",
  "arxiv_id": "2024.01234",
  "pdf_url": "https://arxiv.org/pdf/2024.01234.pdf",
  "published": "2024-01-15T10:30:00Z",
  "query": "quantum computing",
  "text_length": 25847,
  "added_date": "2024-01-15T15:45:30"
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Rate Limiting**: arXiv may block requests if too frequent
   - Solution: Increase delays, reduce papers per query

2. **PDF Download Fails**: Some PDFs are corrupted or protected
   - Solution: System skips failed downloads automatically

3. **Memory Issues**: Large batches may cause timeouts
   - Solution: Reduce `max_papers_per_query` to 1-2

### Logs and Monitoring

- GitHub Actions logs show fetch results
- HF Spaces logs show processing details
- Use health endpoint to monitor document counts

## 📚 Example Queries

### Machine Learning Research
```
query: "transformer OR attention mechanism"
subject_matter: "ml-attention"

query: "few-shot learning"
subject_matter: "ml-few-shot"

query: "cat:cs.LG AND (reinforcement OR RL)"
subject_matter: "ml-reinforcement"
```

### Quantum Computing
```
query: "quantum error correction"
subject_matter: "quantum-error-correction"

query: "cat:quant-ph AND (algorithm OR computation)"
subject_matter: "quantum-algorithms"

query: "quantum machine learning"
subject_matter: "quantum-ml"
```

### Natural Language Processing
```
query: "cat:cs.CL AND (large language model OR LLM)"
subject_matter: "nlp-llm"

query: "sentiment analysis OR text classification"
subject_matter: "nlp-classification"
```

This setup allows subject matter experts to configure relevant queries once, then automatically collect and process new papers in their field!