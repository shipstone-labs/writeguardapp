import gradio as gr
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import hashlib
import json
import os
from flask import Flask, request, jsonify
from functools import wraps
import threading
import pdfplumber
import io
import base64
import requests
import feedparser
import xml.etree.ElementTree as ET
from urllib.parse import quote
import random
import time
from datetime import datetime

# API Key Authentication for Flask endpoints
API_KEY = os.environ.get('API_KEY', 'demo-api-key-change-in-production')
CRON_COUNT = int(os.environ.get('CRON_COUNT', '10'))  # Default 10 papers per query for cron runs

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not api_key or api_key != API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

model = SentenceTransformer("all-MiniLM-L6-v2")

# Separate ChromaDB clients for demo UI vs production API
chroma_client = chromadb.PersistentClient(
    path="./chroma_db",
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True,
        is_persistent=True
    )
)

# Demo collection (for public UI)
demo_collection = chroma_client.get_or_create_collection(
    name="demo_documents",
    metadata={"hnsw:space": "cosine"}
)

# Production collection (for API)
api_collection = chroma_client.get_or_create_collection(
    name="api_documents", 
    metadata={"hnsw:space": "cosine"}
)

# arXiv queries collection (for managing search queries)
arxiv_queries_collection = chroma_client.get_or_create_collection(
    name="arxiv_queries",
    metadata={"hnsw:space": "cosine"}
)

# Use demo collection for Gradio functions
collection = demo_collection

def generate_doc_id(content: str) -> str:
    return hashlib.md5(content.encode()).hexdigest()[:16]

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text content from PDF bytes"""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text_parts = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            full_text = '\n\n'.join(text_parts)
            return full_text.strip()
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

def search_arxiv_papers(query: str, max_results: int = 100) -> list:
    """Search arXiv for papers matching the query"""
    try:
        # Format query for arXiv API
        encoded_query = quote(query)
        url = f"https://export.arxiv.org/api/query?search_query={encoded_query}&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"
        
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Parse XML response
        root = ET.fromstring(response.content)
        namespace = {'atom': 'http://www.w3.org/2005/Atom'}
        
        papers = []
        for entry in root.findall('atom:entry', namespace):
            title_elem = entry.find('atom:title', namespace)
            summary_elem = entry.find('atom:summary', namespace)
            published_elem = entry.find('atom:published', namespace)
            id_elem = entry.find('atom:id', namespace)
            
            # Extract PDF link
            pdf_link = None
            for link in entry.findall('atom:link', namespace):
                if link.get('type') == 'application/pdf':
                    pdf_link = link.get('href')
                    break
            
            if title_elem is not None and summary_elem is not None and pdf_link:
                paper = {
                    'title': title_elem.text.strip().replace('\n', ' '),
                    'summary': summary_elem.text.strip().replace('\n', ' '),
                    'published': published_elem.text if published_elem is not None else '',
                    'arxiv_id': id_elem.text.split('/')[-1] if id_elem is not None else '',
                    'pdf_url': pdf_link,
                    'query': query
                }
                papers.append(paper)
        
        return papers
    except Exception as e:
        raise ValueError(f"Failed to search arXiv: {str(e)}")

def download_and_process_arxiv_paper(paper: dict, subject_matter: str) -> tuple:
    """Download arXiv paper PDF and extract text"""
    try:
        # Check if paper already exists (by arXiv ID)
        existing = api_collection.get(where={"arxiv_id": paper['arxiv_id']})
        if existing['ids']:
            return False, f"Paper {paper['arxiv_id']} already exists"
        
        # Download PDF
        pdf_response = requests.get(paper['pdf_url'], timeout=60)
        pdf_response.raise_for_status()
        
        # Extract text
        extracted_text = extract_text_from_pdf(pdf_response.content)
        
        if not extracted_text.strip():
            return False, f"No text found in PDF for {paper['arxiv_id']}"
        
        # Create metadata
        metadata = {
            "source": "arxiv_auto",
            "subject_matter": subject_matter,
            "title": paper['title'],
            "arxiv_id": paper['arxiv_id'],
            "pdf_url": paper['pdf_url'],
            "published": paper['published'],
            "query": paper['query'],
            "text_length": len(extracted_text),
            "added_date": datetime.now().isoformat()
        }
        
        # Generate doc ID and add to collection
        doc_id = generate_doc_id(extracted_text)
        embedding = model.encode(extracted_text).tolist()
        
        api_collection.add(
            embeddings=[embedding],
            documents=[extracted_text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        
        return True, f"✅ Added: {paper['title'][:100]}..."
        
    except Exception as e:
        return False, f"❌ Error processing {paper.get('arxiv_id', 'unknown')}: {str(e)}"

def add_arxiv_query(query: str, subject_matter: str) -> str:
    """Add a new arXiv search query"""
    try:
        query_id = generate_doc_id(f"{query}_{subject_matter}")
        
        # Check if query already exists
        existing = arxiv_queries_collection.get(ids=[query_id])
        if existing['ids']:
            return f"Query already exists: {query}"
        
        metadata = {
            "query": query,
            "subject_matter": subject_matter,
            "added_date": datetime.now().isoformat(),
            "last_run": None,
            "papers_added": 0
        }
        
        # Add query (using subject matter as document for searching)
        embedding = model.encode(f"{query} {subject_matter}").tolist()
        
        arxiv_queries_collection.add(
            embeddings=[embedding],
            documents=[f"{query} - {subject_matter}"],
            metadatas=[metadata],
            ids=[query_id]
        )
        
        return f"✅ Added query: {query} (Subject: {subject_matter})"
        
    except Exception as e:
        return f"❌ Error adding query: {str(e)}"

def fetch_arxiv_papers(max_papers_per_query: int = 3) -> str:
    """Fetch papers for all configured queries"""
    try:
        # Get all queries
        all_queries = arxiv_queries_collection.get()
        
        if not all_queries['ids']:
            return "No arXiv queries configured. Please add some queries first."
        
        total_added = 0
        results = []
        
        for i, query_id in enumerate(all_queries['ids']):
            metadata = all_queries['metadatas'][i]
            query = metadata['query']
            subject_matter = metadata['subject_matter']
            
            results.append(f"\n🔍 Processing query: {query}")
            
            try:
                # Search for papers
                papers = search_arxiv_papers(query, max_results=50)
                
                if not papers:
                    results.append("  No papers found")
                    continue
                
                # Randomly select a few papers to avoid overwhelming
                selected_papers = random.sample(papers, min(max_papers_per_query, len(papers)))
                
                query_added = 0
                for paper in selected_papers:
                    success, message = download_and_process_arxiv_paper(paper, subject_matter)
                    results.append(f"  {message}")
                    
                    if success:
                        query_added += 1
                        total_added += 1
                    
                    # Small delay to be respectful
                    time.sleep(1)
                
                # Update query metadata
                updated_metadata = metadata.copy()
                updated_metadata['last_run'] = datetime.now().isoformat()
                updated_metadata['papers_added'] = updated_metadata.get('papers_added', 0) + query_added
                
                arxiv_queries_collection.update(
                    ids=[query_id],
                    metadatas=[updated_metadata]
                )
                
                results.append(f"  Added {query_added} papers for this query")
                
            except Exception as e:
                results.append(f"  ❌ Error with query '{query}': {str(e)}")
        
        summary = f"\n📊 Summary: Added {total_added} new papers total"
        return "\n".join(results) + summary
        
    except Exception as e:
        return f"❌ Error fetching papers: {str(e)}"

def add_document(content: str, metadata: str = ""):
    if not content.strip():
        return "Please enter document content", display_all_documents()
    
    doc_id = generate_doc_id(content)
    
    existing = collection.get(ids=[doc_id])
    if existing['ids']:
        return f"Document already exists with ID: {doc_id}", display_all_documents()
    
    embedding = model.encode(content).tolist()
    
    meta_dict = {"source": "user_input"}  # Always have at least one metadata field
    if metadata.strip():
        try:
            user_meta = json.loads(metadata)
            meta_dict.update(user_meta)
        except:
            meta_dict["note"] = metadata
    
    collection.add(
        embeddings=[embedding],
        documents=[content],
        metadatas=[meta_dict],
        ids=[doc_id]
    )
    
    return f"✅ Added document with ID: {doc_id}", display_all_documents()

def search_similar(query: str, n_results: int = 5):
    if not query.strip():
        return "Please enter a search query"
    
    # Check if collection is empty
    doc_count = collection.count()
    if doc_count == 0:
        return "No documents in database. Please add some documents first!"
    
    query_embedding = model.encode(query).tolist()
    
    # Ensure n_results is at least 1 and not more than available docs
    n_results = max(1, min(n_results, doc_count))
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results
    )
    
    if not results['ids'][0]:
        return "No documents found. Add some documents first!"
    
    output = f"🔍 **Search Query:** {query}\n\n"
    output += "## Similar Documents:\n\n"
    
    for i in range(len(results['ids'][0])):
        similarity = 1 - results['distances'][0][i]
        doc_id = results['ids'][0][i]
        content = results['documents'][0][i]
        metadata = results['metadatas'][0][i]
        
        preview = content[:200] + "..." if len(content) > 200 else content
        
        output += f"### {i+1}. Document ID: {doc_id}\n"
        output += f"**Similarity:** {similarity:.2%}\n"
        output += f"**Content:** {preview}\n"
        if metadata:
            output += f"**Metadata:** {json.dumps(metadata)}\n"
        output += "\n---\n\n"
    
    return output

def compare_two_documents(doc1: str, doc2: str):
    if not doc1.strip() or not doc2.strip():
        return "Please enter both documents"
    
    embedding1 = model.encode(doc1)
    embedding2 = model.encode(doc2)
    
    from numpy import dot
    from numpy.linalg import norm
    
    similarity = dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2))
    
    output = "## Document Comparison\n\n"
    output += f"**Document 1:** {doc1[:100]}{'...' if len(doc1) > 100 else ''}\n\n"
    output += f"**Document 2:** {doc2[:100]}{'...' if len(doc2) > 100 else ''}\n\n"
    output += f"### Similarity Score: {float(similarity):.4f} ({float(similarity)*100:.1f}%)\n\n"
    
    if similarity > 0.9:
        output += "🟢 **Very Similar** - Documents are nearly identical in meaning"
    elif similarity > 0.7:
        output += "🟡 **Similar** - Documents share significant semantic overlap"
    elif similarity > 0.5:
        output += "🟠 **Somewhat Similar** - Documents have some related concepts"
    else:
        output += "🔴 **Different** - Documents are semantically distinct"
    
    return output

def display_all_documents():
    all_docs = collection.get()
    
    if not all_docs['ids']:
        return "📂 No documents in database"
    
    output = f"📚 **Total Documents:** {len(all_docs['ids'])}\n\n"
    
    for i in range(len(all_docs['ids'])):
        content = all_docs['documents'][i]
        preview = content[:150] + "..." if len(content) > 150 else content
        output += f"**ID:** {all_docs['ids'][i]}\n"
        output += f"**Content:** {preview}\n"
        if all_docs['metadatas'][i]:
            output += f"**Metadata:** {json.dumps(all_docs['metadatas'][i])}\n"
        output += "\n---\n"
    
    return output

def clear_database():
    global collection
    try:
        chroma_client.delete_collection("documents")
    except:
        pass
    collection = chroma_client.create_collection(
        name="documents",
        metadata={"hnsw:space": "cosine"}
    )
    return "🗑️ Database cleared", display_all_documents()

def add_pdf_document(pdf_file, metadata: str = ""):
    if pdf_file is None:
        return "Please upload a PDF file", display_all_documents()
    
    try:
        # Read PDF file
        with open(pdf_file.name, 'rb') as f:
            pdf_bytes = f.read()
        
        # Extract text
        extracted_text = extract_text_from_pdf(pdf_bytes)
        
        if not extracted_text.strip():
            return "No text found in PDF", display_all_documents()
        
        # Process metadata
        meta_dict = {"source": "pdf_upload", "filename": pdf_file.name.split('/')[-1]}
        if metadata.strip():
            try:
                user_meta = json.loads(metadata)
                meta_dict.update(user_meta)
            except:
                meta_dict["note"] = metadata
        
        # Add text length info
        meta_dict["text_length"] = len(extracted_text)
        meta_dict["pages"] = len(extracted_text.split('\n\n'))
        
        doc_id = generate_doc_id(extracted_text)
        
        existing = collection.get(ids=[doc_id])
        if existing['ids']:
            return f"Document already exists with ID: {doc_id}", display_all_documents()
        
        embedding = model.encode(extracted_text).tolist()
        
        collection.add(
            embeddings=[embedding],
            documents=[extracted_text],
            metadatas=[meta_dict],
            ids=[doc_id]
        )
        
        return f"✅ PDF processed and added with ID: {doc_id}\nExtracted {len(extracted_text)} characters", display_all_documents()
        
    except Exception as e:
        return f"Error processing PDF: {str(e)}", display_all_documents()

def load_sample_data():
    samples = [
        ("Machine learning is a subset of artificial intelligence that enables systems to learn from data.", {"category": "ML", "topic": "fundamentals"}),
        ("Deep learning uses neural networks with multiple layers to process complex patterns.", {"category": "ML", "topic": "deep_learning"}),
        ("Natural language processing helps computers understand and generate human language.", {"category": "ML", "topic": "nlp"}),
        ("Computer vision enables machines to interpret and analyze visual information.", {"category": "ML", "topic": "computer_vision"}),
        ("Python is a popular programming language for data science and machine learning.", {"category": "programming", "topic": "python"}),
        ("Transformers revolutionized NLP with attention mechanisms.", {"category": "ML", "topic": "transformers"}),
        ("Gradient descent optimizes machine learning model parameters.", {"category": "ML", "topic": "optimization"}),
    ]
    
    for content, metadata in samples:
        doc_id = generate_doc_id(content)
        existing = collection.get(ids=[doc_id])
        if not existing['ids']:
            embedding = model.encode(content).tolist()
            collection.add(
                embeddings=[embedding],
                documents=[content],
                metadatas=[metadata],
                ids=[doc_id]
            )
    
    return "✅ Sample documents loaded", display_all_documents()

with gr.Blocks(title="Document Similarity Demo", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 📄 Document Similarity Search Demo
    
    This demo uses **Sentence-BERT** embeddings to find semantically similar documents.
    Vector storage is handled by **ChromaDB** with cosine similarity search.
    
    **Note**: This demo interface uses separate storage from the API endpoints.
    Documents added here won't appear in API searches and vice versa.
    """)
    
    with gr.Tab("🔍 Search"):
        with gr.Row():
            with gr.Column():
                search_input = gr.Textbox(
                    label="Search Query",
                    placeholder="Enter text to find similar documents...",
                    lines=2
                )
                num_results = gr.Slider(
                    minimum=1, maximum=10, value=5, step=1,
                    label="Number of Results"
                )
                search_btn = gr.Button("Search", variant="primary")
            
            with gr.Column():
                search_output = gr.Markdown(label="Search Results")
        
        search_btn.click(
            search_similar,
            inputs=[search_input, num_results],
            outputs=search_output
        )
    
    with gr.Tab("📝 Add Document"):
        with gr.Row():
            with gr.Column():
                doc_input = gr.Textbox(
                    label="Document Content",
                    placeholder="Enter document text...",
                    lines=4
                )
                metadata_input = gr.Textbox(
                    label="Metadata (JSON format)",
                    placeholder='{"category": "example", "topic": "demo"}',
                    lines=2
                )
                add_btn = gr.Button("Add Document", variant="primary")
                load_samples_btn = gr.Button("Load Sample Documents", variant="secondary")
                
                gr.Markdown("---")
                gr.Markdown("### 📄 Upload PDF")
                pdf_input = gr.File(
                    label="Upload PDF File",
                    file_types=[".pdf"],
                    file_count="single"
                )
                pdf_metadata_input = gr.Textbox(
                    label="PDF Metadata (JSON format)",
                    placeholder='{"category": "document", "type": "manual"}',
                    lines=1
                )
                add_pdf_btn = gr.Button("Extract Text & Add PDF", variant="secondary")
            
            with gr.Column():
                add_output = gr.Textbox(label="Status", lines=1)
                doc_list = gr.Markdown(label="Current Documents")
        
        add_btn.click(
            add_document,
            inputs=[doc_input, metadata_input],
            outputs=[add_output, doc_list]
        )
        
        load_samples_btn.click(
            load_sample_data,
            outputs=[add_output, doc_list]
        )
        
        add_pdf_btn.click(
            add_pdf_document,
            inputs=[pdf_input, pdf_metadata_input],
            outputs=[add_output, doc_list]
        )
    
    with gr.Tab("🔄 Compare Documents"):
        with gr.Row():
            with gr.Column():
                doc1_input = gr.Textbox(
                    label="Document 1",
                    placeholder="Enter first document...",
                    lines=3
                )
                doc2_input = gr.Textbox(
                    label="Document 2",
                    placeholder="Enter second document...",
                    lines=3
                )
                compare_btn = gr.Button("Compare", variant="primary")
            
            with gr.Column():
                compare_output = gr.Markdown(label="Comparison Result")
        
        compare_btn.click(
            compare_two_documents,
            inputs=[doc1_input, doc2_input],
            outputs=compare_output
        )
    
    with gr.Tab("📚 View All"):
        with gr.Row():
            refresh_btn = gr.Button("Refresh", variant="primary")
            clear_btn = gr.Button("Clear Database", variant="stop")
        
        all_docs_output = gr.Markdown(label="All Documents")
        
        refresh_btn.click(
            display_all_documents,
            outputs=all_docs_output
        )
        
        clear_btn.click(
            clear_database,
            outputs=[gr.Textbox(visible=False), all_docs_output]
        )
        
        demo.load(display_all_documents, outputs=all_docs_output)
    
    with gr.Tab("📚 arXiv Management"):
        gr.Markdown("""
        ### Configure automatic arXiv paper fetching
        
        Add search queries that will be used to automatically download and process papers.
        Papers are added to the **API collection** (not demo collection).
        """)
        
        with gr.Row():
            with gr.Column():
                query_input = gr.Textbox(
                    label="arXiv Search Query",
                    placeholder="quantum computing, machine learning, natural language processing",
                    lines=2,
                    info="Use arXiv search syntax, e.g.: 'quantum AND computing' or 'cat:cs.AI'"
                )
                subject_input = gr.Textbox(
                    label="Subject Matter",
                    placeholder="quantum-computing, machine-learning, nlp",
                    lines=1,
                    info="Subject matter tag for categorizing papers"
                )
                add_query_btn = gr.Button("Add Query", variant="primary")
                
                gr.Markdown("---")
                
                papers_per_query = gr.Slider(
                    minimum=1, maximum=50, value=CRON_COUNT, step=1,
                    label="Papers per Query (per run)",
                    info=f"Number of random papers to fetch from each query (default: {CRON_COUNT})"
                )
                fetch_btn = gr.Button("🔄 Fetch Papers Now", variant="secondary")
                
            with gr.Column():
                arxiv_output = gr.Textbox(
                    label="Status", 
                    lines=15,
                    max_lines=20
                )
        
        with gr.Row():
            with gr.Column():
                gr.Markdown("### Current Queries")
                queries_display = gr.Markdown(label="Configured Queries")
                refresh_queries_btn = gr.Button("Refresh Query List")
            
            with gr.Column():
                gr.Markdown("### Recent arXiv Papers")
                arxiv_papers_display = gr.Markdown(label="Recent Papers")
                refresh_papers_btn = gr.Button("Refresh Papers")
        
        def display_queries():
            try:
                all_queries = arxiv_queries_collection.get()
                if not all_queries['ids']:
                    return "No queries configured yet."
                
                output = "## Configured arXiv Queries\n\n"
                for i, query_id in enumerate(all_queries['ids']):
                    metadata = all_queries['metadatas'][i]
                    query = metadata['query']
                    subject = metadata['subject_matter']
                    last_run = metadata.get('last_run', 'Never')
                    papers_added = metadata.get('papers_added', 0)
                    
                    output += f"**{i+1}. {query}**\n"
                    output += f"- Subject: {subject}\n"
                    output += f"- Papers Added: {papers_added}\n"
                    output += f"- Last Run: {last_run}\n\n"
                
                return output
            except Exception as e:
                return f"Error loading queries: {str(e)}"
        
        def display_arxiv_papers():
            try:
                # Get recent arXiv papers from API collection
                all_docs = api_collection.get(where={"source": "arxiv_auto"})
                
                if not all_docs['ids']:
                    return "No arXiv papers added yet."
                
                # Sort by added_date (most recent first)
                papers_with_dates = []
                for i, doc_id in enumerate(all_docs['ids']):
                    metadata = all_docs['metadatas'][i]
                    papers_with_dates.append((metadata.get('added_date', ''), metadata, doc_id))
                
                papers_with_dates.sort(reverse=True)
                
                output = f"## Recent arXiv Papers ({len(papers_with_dates)} total)\n\n"
                
                # Show last 10 papers
                for added_date, metadata, doc_id in papers_with_dates[:10]:
                    title = metadata.get('title', 'Unknown Title')[:100]
                    subject = metadata.get('subject_matter', 'Unknown')
                    arxiv_id = metadata.get('arxiv_id', 'Unknown')
                    
                    output += f"**{title}...**\n"
                    output += f"- arXiv ID: {arxiv_id}\n"
                    output += f"- Subject: {subject}\n"
                    output += f"- Added: {added_date[:10] if added_date else 'Unknown'}\n"
                    output += f"- Doc ID: {doc_id}\n\n"
                
                if len(papers_with_dates) > 10:
                    output += f"*... and {len(papers_with_dates) - 10} more papers*\n"
                
                return output
            except Exception as e:
                return f"Error loading papers: {str(e)}"
        
        def add_query_handler(query: str, subject: str):
            if not query.strip() or not subject.strip():
                return "Please enter both query and subject matter", display_queries()
            result = add_arxiv_query(query.strip(), subject.strip())
            return result, display_queries()
        
        def fetch_papers_handler(papers_per_query: int):
            return fetch_arxiv_papers(max_papers_per_query=papers_per_query)
        
        add_query_btn.click(
            add_query_handler,
            inputs=[query_input, subject_input],
            outputs=[arxiv_output, queries_display]
        )
        
        fetch_btn.click(
            fetch_papers_handler,
            inputs=[papers_per_query],
            outputs=[arxiv_output]
        )
        
        refresh_queries_btn.click(
            display_queries,
            outputs=[queries_display]
        )
        
        refresh_papers_btn.click(
            display_arxiv_papers,
            outputs=[arxiv_papers_display]
        )
        
        # Load initial data
        demo.load(display_queries, outputs=queries_display)
        demo.load(display_arxiv_papers, outputs=arxiv_papers_display)

# Create Flask app for API endpoints
app = Flask(__name__)

@app.route('/api/health', methods=['GET'])
def api_health():
    return jsonify({
        "status": "healthy", 
        "api_documents": api_collection.count(),
        "demo_documents": demo_collection.count()
    })

@app.route('/api/add', methods=['POST'])
@require_api_key
def api_add_document():
    data = request.json
    content = data.get('content', '')
    metadata = data.get('metadata', {})
    
    if not content:
        return jsonify({"error": "Content is required"}), 400
    
    doc_id = generate_doc_id(content)
    
    existing = api_collection.get(ids=[doc_id])
    if existing['ids']:
        return jsonify({"message": "Document already exists", "id": doc_id}), 200
    
    embedding = model.encode(content).tolist()
    
    # Ensure metadata is not empty
    meta_dict = {"source": "api"}
    meta_dict.update(metadata)
    
    api_collection.add(
        embeddings=[embedding],
        documents=[content],
        metadatas=[meta_dict],
        ids=[doc_id]
    )
    
    return jsonify({"message": "Document added", "id": doc_id}), 201

@app.route('/api/add-pdf', methods=['POST'])
@require_api_key
def api_add_pdf():
    try:
        # Check if file is in request
        if 'pdf' not in request.files:
            return jsonify({"error": "No PDF file provided"}), 400
        
        pdf_file = request.files['pdf']
        if pdf_file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not pdf_file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "File must be a PDF"}), 400
        
        # Read PDF bytes
        pdf_bytes = pdf_file.read()
        
        # Extract text from PDF
        try:
            extracted_text = extract_text_from_pdf(pdf_bytes)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        
        if not extracted_text.strip():
            return jsonify({"error": "No text found in PDF"}), 400
        
        # Get metadata from form data
        metadata = {}
        if request.form.get('metadata'):
            try:
                metadata = json.loads(request.form.get('metadata'))
            except:
                metadata = {"note": request.form.get('metadata')}
        
        # Add filename to metadata
        metadata.update({
            "source": "pdf_upload",
            "filename": pdf_file.filename,
            "pages": len(extracted_text.split('\n\n'))
        })
        
        # Generate doc ID from extracted text
        doc_id = generate_doc_id(extracted_text)
        
        # Check if document already exists
        existing = api_collection.get(ids=[doc_id])
        if existing['ids']:
            return jsonify({"message": "Document already exists", "id": doc_id, "filename": pdf_file.filename}), 200
        
        # Create embedding and add to collection
        embedding = model.encode(extracted_text).tolist()
        
        api_collection.add(
            embeddings=[embedding],
            documents=[extracted_text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        
        return jsonify({
            "message": "PDF processed and document added",
            "id": doc_id,
            "filename": pdf_file.filename,
            "text_length": len(extracted_text),
            "pages": metadata["pages"]
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 500

@app.route('/api/search', methods=['POST'])
@require_api_key
def api_search():
    data = request.json
    query = data.get('query', '')
    n_results = data.get('n_results', 5)
    
    if not query:
        return jsonify({"error": "Query is required"}), 400
    
    doc_count = api_collection.count()
    if doc_count == 0:
        return jsonify({"results": [], "message": "No documents in database"}), 200
    
    n_results = max(1, min(n_results, doc_count))
    query_embedding = model.encode(query).tolist()
    
    results = api_collection.query(
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

@app.route('/api/compare', methods=['POST'])
@require_api_key
def api_compare():
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

@app.route('/api/documents', methods=['GET'])
@require_api_key
def api_get_all_documents():
    all_docs = api_collection.get()
    
    documents = []
    for i in range(len(all_docs['ids'])):
        documents.append({
            "id": all_docs['ids'][i],
            "content": all_docs['documents'][i],
            "metadata": all_docs['metadatas'][i]
        })
    
    return jsonify({"documents": documents, "count": len(documents)})

@app.route('/api/documents/<doc_id>', methods=['DELETE'])
@require_api_key
def api_delete_document(doc_id):
    try:
        # Check if document exists
        existing = api_collection.get(ids=[doc_id])
        if not existing['ids']:
            return jsonify({"error": "Document not found"}), 404
        
        # Delete the document
        api_collection.delete(ids=[doc_id])
        return jsonify({"message": "Document deleted", "id": doc_id}), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to delete document: {str(e)}"}), 500

@app.route('/api/clear', methods=['DELETE'])
@require_api_key
def api_clear_database():
    global api_collection
    try:
        chroma_client.delete_collection("api_documents")
    except:
        pass
    api_collection = chroma_client.create_collection(
        name="api_documents",
        metadata={"hnsw:space": "cosine"}
    )
    return jsonify({"message": "API database cleared"})

@app.route('/api/arxiv/add-query', methods=['POST'])
@require_api_key
def api_add_arxiv_query():
    data = request.json
    query = data.get('query', '')
    subject_matter = data.get('subject_matter', '')
    
    if not query or not subject_matter:
        return jsonify({"error": "Both query and subject_matter are required"}), 400
    
    result = add_arxiv_query(query, subject_matter)
    
    if "Error" in result:
        return jsonify({"error": result}), 500
    
    return jsonify({"message": result}), 201

@app.route('/api/arxiv/fetch', methods=['POST'])
@require_api_key
def api_fetch_arxiv_papers():
    data = request.json or {}
    max_papers_per_query = data.get('max_papers_per_query', CRON_COUNT)
    
    if max_papers_per_query < 1 or max_papers_per_query > 50:
        return jsonify({"error": "max_papers_per_query must be between 1 and 50"}), 400
    
    result = fetch_arxiv_papers(max_papers_per_query)
    
    return jsonify({"message": result}), 200

@app.route('/api/arxiv/queries', methods=['GET'])
@require_api_key
def api_get_arxiv_queries():
    try:
        all_queries = arxiv_queries_collection.get()
        
        queries = []
        for i, query_id in enumerate(all_queries['ids']):
            metadata = all_queries['metadatas'][i]
            queries.append({
                "id": query_id,
                "query": metadata['query'],
                "subject_matter": metadata['subject_matter'],
                "added_date": metadata.get('added_date'),
                "last_run": metadata.get('last_run'),
                "papers_added": metadata.get('papers_added', 0)
            })
        
        return jsonify({"queries": queries, "count": len(queries)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Create Flask app for API endpoints
flask_app = Flask(__name__)

# Re-add all the API routes here (I'll add just the essential ones)
@flask_app.route('/api/health', methods=['GET'])
def api_health():
    return jsonify({
        "status": "healthy", 
        "api_documents": api_collection.count(),
        "demo_documents": demo_collection.count()
    })

@flask_app.route('/api/arxiv/fetch', methods=['POST'])
@require_api_key
def api_fetch_arxiv_papers():
    data = request.json or {}
    max_papers_per_query = data.get('max_papers_per_query', CRON_COUNT)
    
    if max_papers_per_query < 1 or max_papers_per_query > 50:
        return jsonify({"error": "max_papers_per_query must be between 1 and 50"}), 400
    
    result = fetch_arxiv_papers(max_papers_per_query)
    return jsonify({"message": result}), 200

if __name__ == "__main__":
    # Mount Flask routes into Gradio using the built-in FastAPI server
    import gradio as gr
    
    # Convert Flask routes to FastAPI (Gradio's underlying server)
    @demo.app.get("/api/health")
    def health_endpoint():
        return {
            "status": "healthy", 
            "api_documents": api_collection.count(),
            "demo_documents": demo_collection.count()
        }
    
    @demo.app.post("/api/arxiv/fetch")
    def fetch_endpoint(request: dict):
        # Simple API key check
        # Note: In production, implement proper FastAPI authentication
        max_papers_per_query = request.get('max_papers_per_query', CRON_COUNT)
        
        if max_papers_per_query < 1 or max_papers_per_query > 50:
            return {"error": "max_papers_per_query must be between 1 and 50"}
        
        result = fetch_arxiv_papers(max_papers_per_query)
        return {"message": result}
    
    # Launch Gradio with API endpoints on same port
    demo.launch()