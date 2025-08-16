# Deployment Guide - Ranked by Cost

## 1. 🤗 Hugging Face Spaces (FREE - Recommended)

**Best for: ML demos, prototypes**

```bash
# 1. Create account at huggingface.co
# 2. Create new Space -> Choose Gradio
# 3. Upload these files:
- app.py
- requirements-hf.txt (rename to requirements.txt)

# Or use Git:
git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/text-compare
git push hf main
```

**Pros:**
- Completely free
- Persistent storage
- GPU available (free tier)
- Custom domain support

**URL:** `https://huggingface.co/spaces/YOUR_USERNAME/text-compare`

## 2. 🚂 Railway (FREE trial, then $5/month)

**Best for: Quick deployments**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up

# Add environment variable
railway variables set PORT=8080
```

**Pros:**
- One-click deploy from GitHub
- Persistent volumes ($0.10/GB)
- Good free tier

## 3. 🎨 Render (FREE tier available)

**Best for: Simple web services**

1. Connect GitHub repo
2. Choose "Web Service"
3. Set build command: `pip install -r requirements-api.txt`
4. Set start command: `gunicorn api:app`

**Pros:**
- Free 750 hours/month
- Auto-deploy from Git
- Persistent disk available

## 4. ☁️ Google Cloud Run ($10-20/month)

**Best for: Production, scale-to-zero**

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/text-compare

# Deploy
gcloud run deploy text-compare \
  --image gcr.io/PROJECT_ID/text-compare \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --min-instances 0 \
  --max-instances 10
```

**Container optimizations for Cloud Run:**
```dockerfile
# Multi-stage build for smaller image
FROM python:3.10-slim as builder
WORKDIR /app
COPY requirements-api.txt .
RUN pip install --user -r requirements-api.txt

FROM python:3.10-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 api:app
```

## 5. 🔷 Fly.io (Free tier, then $5/month)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

**fly.toml:**
```toml
app = "text-compare"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80

  [[services.ports]]
    port = 443
```

## 6. 🌐 Vercel (FREE but needs API endpoint)

**For serverless (cold starts issue):**

```python
# api/search.py
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Serverless function code
        pass
```

## Cost Comparison

| Platform | Free Tier | Paid | Best For |
|----------|-----------|------|----------|
| HF Spaces | ✅ Unlimited | $0 | ML Demos |
| Railway | 500 hrs/month | $5+ | Quick deploy |
| Render | 750 hrs/month | $7+ | Web services |
| Cloud Run | 2M requests | $0.00002/req | Production |
| Fly.io | 3 shared VMs | $5+ | Global edge |
| Vercel | ✅ Unlimited | $20+ | Serverless |

## Quick Decision Tree

```
Need ML-specific features? → Hugging Face Spaces
Need production scale? → Cloud Run
Need quick prototype? → Railway/Render
Need global edge? → Fly.io
Need serverless? → Vercel (with limitations)
```

## Local Testing

```bash
# Test Gradio app
python app.py

# Test Flask API
python api.py

# Test with Docker
docker build -t text-compare .
docker run -p 8080:8080 text-compare
```