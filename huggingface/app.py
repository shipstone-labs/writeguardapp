import gradio as gr
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import hashlib
import json
import os
# Flask imports removed - using Gradio API instead
# from flask import Flask, request, jsonify
# from functools import wraps
import pdfplumber
import io
import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote
import random
import time
from datetime import datetime

# API Key Authentication for Gradio API endpoints
API_KEY = os.environ.get('API_KEY', 'demo-api-key-change-in-production')
CRON_COUNT = int(os.environ.get('CRON_COUNT', '10'))  # Default 10 papers per query for cron runs

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
        
        **Note**: Manual fetches from this UI go to **demo storage** (public playground).
        Automated GitHub Actions fetches go to **production API storage**.
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

# Flask app code removed - using Gradio API instead

# Create separate API demo interface
def create_api_demo():
    with gr.Blocks(title="Document Similarity API Documentation", theme=gr.themes.Soft()) as api_demo:
        gr.Markdown("""
        # 📚 Document Similarity API Documentation
        
        Welcome to the Document Similarity API! This API provides semantic document search and management capabilities using Sentence-BERT embeddings and ChromaDB vector storage.
        
        ## 🔐 Authentication
        
        Most endpoints require an API key passed as a parameter. Contact the administrator for access.
        
        ## 📖 API Reference
        """)
        
        # Health Check Section
        with gr.Group():
            gr.Markdown("## 🏥 Health Check")
            gr.Markdown("""
            **Endpoint**: `GET /api/health`  
            **Authentication**: None required  
            **Description**: Check API status and document counts
            
            ### Response Example:
            ```json
            {
              "status": "healthy",
              "api_documents": 42,
              "demo_documents": 7
            }
            ```
            """)
            
            with gr.Row():
                health_btn = gr.Button("🔍 Test Health Check", variant="primary")
                health_output = gr.JSON(label="Response")
        
        # Document Management Section  
        with gr.Group():
            gr.Markdown("## 📄 Document Management")
            
            gr.Markdown("""
            ### Add Document
            **Endpoint**: `POST /api/add`  
            **Authentication**: Required  
            **Description**: Add a new text document to the vector database
            
            **Parameters**:
            - `content` (string, required): The document text content
            - `metadata` (object, optional): Additional metadata as JSON
            - `api_key` (string, required): Your API authentication key
            
            **Response Example**:
            ```json
            {
              "message": "Document added",
              "id": "abc123def456"
            }
            ```
            """)
            
            gr.Markdown("""
            ### Add PDF Document  
            **Endpoint**: `POST /api/add_pdf`  
            **Authentication**: Required  
            **Description**: Upload and process a PDF file, extracting text and adding to vector database
            
            **Parameters**:
            - `pdf_file` (file, required): PDF file to upload
            - `metadata` (object, optional): Additional metadata as JSON  
            - `api_key` (string, required): Your API authentication key
            
            **Response Example**:
            ```json
            {
              "message": "PDF processed and document added",
              "id": "pdf789ghi012", 
              "filename": "document.pdf",
              "text_length": 5420,
              "pages": 12
            }
            ```
            """)
            
            gr.Markdown("""
            ### Search Documents
            **Endpoint**: `POST /api/search`  
            **Authentication**: Required  
            **Description**: Search for semantically similar documents
            
            **Parameters**:
            - `query` (string, required): Search query text
            - `n_results` (integer, optional): Number of results to return (default: 5)
            - `api_key` (string, required): Your API authentication key
            
            **Response Example**:
            ```json
            {
              "results": [
                {
                  "id": "doc123",
                  "similarity": 0.89,
                  "content": "Machine learning is...",
                  "metadata": {"source": "api", "category": "ML"}
                }
              ],
              "query": "artificial intelligence"
            }
            ```
            """)
            
            gr.Markdown("""
            ### Compare Documents
            **Endpoint**: `POST /api/compare`  
            **Authentication**: Required  
            **Description**: Calculate semantic similarity between two text documents
            
            **Parameters**:
            - `doc1` (string, required): First document text
            - `doc2` (string, required): Second document text  
            - `api_key` (string, required): Your API authentication key
            
            **Response Example**:
            ```json
            {
              "similarity": 0.7234,
              "percentage": 72.34,
              "doc1_preview": "Machine learning is a subset...",
              "doc2_preview": "Artificial intelligence encompasses..."
            }
            ```
            """)
            
            gr.Markdown("""
            ### List All Documents
            **Endpoint**: `GET /api/documents`  
            **Authentication**: Required  
            **Description**: Retrieve all documents in the database
            
            **Parameters**:
            - `api_key` (string, required): Your API authentication key
            
            **Response Example**:
            ```json
            {
              "documents": [
                {
                  "id": "doc123",
                  "content": "Full document text...",
                  "metadata": {"source": "api", "category": "ML"}
                }
              ],
              "count": 1
            }
            ```
            """)
            
            gr.Markdown("""
            ### Delete Document
            **Endpoint**: `DELETE /api/delete`  
            **Authentication**: Required  
            **Description**: Remove a document from the database
            
            **Parameters**:
            - `doc_id` (string, required): Document ID to delete
            - `api_key` (string, required): Your API authentication key
            
            **Response Example**:
            ```json
            {
              "message": "Document deleted",
              "id": "doc123"
            }
            ```
            """)
        
        # arXiv Integration Section
        with gr.Group():
            gr.Markdown("## 📚 arXiv Paper Integration")
            gr.Markdown("""
            ### Fetch arXiv Papers
            **Endpoint**: `POST /api/arxiv_fetch`  
            **Authentication**: Optional (affects limits and storage)  
            **Description**: Automatically fetch and process arXiv papers based on configured queries
            
            **Parameters**:
            - `max_papers` (integer, required): Number of papers to fetch per query (1-50)
            - `api_key` (string, optional): Your API authentication key
            
            **Storage Behavior**:
            - 🔓 **Without API key**: Papers go to demo storage, limited to 1 paper
            - 🔐 **With valid API key**: Papers go to production storage, up to 50 papers
            
            **Response Example**:
            ```json
            {
              "message": "Would fetch 5 papers to API storage",
              "storage_used": "API storage (production)", 
              "papers_requested": 5,
              "authenticated": true,
              "limit_applied": "5 papers max"
            }
            ```
            """)
            
            with gr.Row():
                with gr.Column():
                    fetch_papers_input = gr.Number(value=1, minimum=1, maximum=50, label="Papers to Fetch", info="Public demo: 1 max, API key: up to 50")
                    api_key_input = gr.Textbox(label="API Key (Optional)", type="password", placeholder="Leave empty for demo storage, or enter key for production storage")
                with gr.Column():
                    fetch_papers_btn = gr.Button("🔄 Test Fetch Papers", variant="secondary") 
                    fetch_output = gr.JSON(label="Response")
        
        # Usage Examples Section
        with gr.Group():
            gr.Markdown("""
            ## 💡 Usage Examples
            
            ### Python Example
            ```python
            import requests
            
            # Health check (no auth required)
            response = requests.get("https://your-space.hf.space/api/health")
            print(response.json())
            
            # Add a document (requires API key)
            payload = {
                "content": "Machine learning is transforming industries...",
                "metadata": {"category": "AI", "source": "blog"}, 
                "api_key": "your-api-key"
            }
            response = requests.post("https://your-space.hf.space/api/add", json=payload)
            print(response.json())
            
            # Search for similar documents
            search_payload = {
                "query": "artificial intelligence applications",
                "n_results": 3,
                "api_key": "your-api-key"
            }
            response = requests.post("https://your-space.hf.space/api/search", json=search_payload)
            print(response.json())
            ```
            
            ### curl Example
            ```bash
            # Health check
            curl -X GET "https://your-space.hf.space/api/health"
            
            # Add document
            curl -X POST "https://your-space.hf.space/api/add" \\
                 -H "Content-Type: application/json" \\
                 -d '{
                   "content": "Your document text here",
                   "metadata": {"category": "example"},
                   "api_key": "your-api-key"
                 }'
            
            # Search documents  
            curl -X POST "https://your-space.hf.space/api/search" \\
                 -H "Content-Type: application/json" \\
                 -d '{
                   "query": "search term",
                   "n_results": 5,
                   "api_key": "your-api-key"
                 }'
            ```
            """)
        
        # Rate Limits and Notes
        with gr.Group():
            gr.Markdown("""
            ## ⚠️ Rate Limits & Notes
            
            - **Document Storage**: Authenticated requests use production storage, public requests use demo storage
            - **arXiv Fetching**: Public users limited to 1 paper, authenticated users up to 50 papers per request
            - **API Keys**: Contact administrator for production API key access
            - **Embeddings**: Uses `all-MiniLM-L6-v2` Sentence-BERT model
            - **Vector Database**: ChromaDB with cosine similarity search
            - **File Formats**: PDF text extraction supported via pdfplumber
            
            ## 🔗 Quick Links
            - **Live API Testing**: Add `?view=api` to this URL
            - **Demo Interface**: [Main Application](/)
            - **GitHub**: [Source Code](https://github.com/your-repo)
            """)
        
        # Function definitions for API testing
        def check_health():
            return {
                "status": "healthy", 
                "api_documents": api_collection.count(),
                "demo_documents": demo_collection.count()
            }
        
        def api_add_document(content: str, metadata: dict = None, api_key: str = ""):
            if api_key != API_KEY:
                return {"error": "Invalid or missing API key"}
            
            if not content:
                return {"error": "Content is required"}
            
            doc_id = generate_doc_id(content)
            existing = api_collection.get(ids=[doc_id])
            if existing['ids']:
                return {"message": "Document already exists", "id": doc_id}
            
            embedding = model.encode(content).tolist()
            meta_dict = {"source": "api"}
            if metadata:
                meta_dict.update(metadata)
            
            api_collection.add(
                embeddings=[embedding],
                documents=[content],
                metadatas=[meta_dict],
                ids=[doc_id]
            )
            
            return {"message": "Document added", "id": doc_id}
        
        def api_search_documents(query: str, n_results: int = 5, api_key: str = ""):
            if api_key != API_KEY:
                return {"error": "Invalid or missing API key"}
            
            if not query:
                return {"error": "Query is required"}
            
            doc_count = api_collection.count()
            if doc_count == 0:
                return {"results": [], "message": "No documents in database"}
            
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
            
            return {"results": formatted_results, "query": query}
        
        def api_compare_documents(doc1: str, doc2: str, api_key: str = ""):
            if api_key != API_KEY:
                return {"error": "Invalid or missing API key"}
            
            if not doc1 or not doc2:
                return {"error": "Both documents are required"}
            
            embedding1 = model.encode(doc1)
            embedding2 = model.encode(doc2)
            
            from numpy import dot
            from numpy.linalg import norm
            
            similarity = float(dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2)))
            
            return {
                "similarity": similarity,
                "percentage": similarity * 100,
                "doc1_preview": doc1[:100],
                "doc2_preview": doc2[:100]
            }
        
        def api_list_documents(api_key: str = ""):
            if api_key != API_KEY:
                return {"error": "Invalid or missing API key"}
            
            all_docs = api_collection.get()
            
            documents = []
            for i in range(len(all_docs['ids'])):
                documents.append({
                    "id": all_docs['ids'][i],
                    "content": all_docs['documents'][i],
                    "metadata": all_docs['metadatas'][i]
                })
            
            return {"documents": documents, "count": len(documents)}
        
        def api_delete_document(doc_id: str, api_key: str = ""):
            if api_key != API_KEY:
                return {"error": "Invalid or missing API key"}
            
            try:
                existing = api_collection.get(ids=[doc_id])
                if not existing['ids']:
                    return {"error": "Document not found"}
                
                api_collection.delete(ids=[doc_id])
                return {"message": "Document deleted", "id": doc_id}
                
            except Exception as e:
                return {"error": f"Failed to delete document: {str(e)}"}
        
        def api_add_pdf_document(pdf_file, metadata: dict = None, api_key: str = ""):
            if api_key != API_KEY:
                return {"error": "Invalid or missing API key"}
            
            if pdf_file is None:
                return {"error": "No PDF file provided"}
            
            try:
                with open(pdf_file.name, 'rb') as f:
                    pdf_bytes = f.read()
                
                extracted_text = extract_text_from_pdf(pdf_bytes)
                
                if not extracted_text.strip():
                    return {"error": "No text found in PDF"}
                
                meta_dict = {"source": "pdf_upload", "filename": pdf_file.name.split('/')[-1]}
                if metadata:
                    meta_dict.update(metadata)
                
                meta_dict["text_length"] = len(extracted_text)
                meta_dict["pages"] = len(extracted_text.split('\n\n'))
                
                doc_id = generate_doc_id(extracted_text)
                existing = api_collection.get(ids=[doc_id])
                if existing['ids']:
                    return {"message": "Document already exists", "id": doc_id, "filename": pdf_file.name}
                
                embedding = model.encode(extracted_text).tolist()
                
                api_collection.add(
                    embeddings=[embedding],
                    documents=[extracted_text],
                    metadatas=[meta_dict],
                    ids=[doc_id]
                )
                
                return {
                    "message": "PDF processed and document added",
                    "id": doc_id,
                    "filename": pdf_file.name.split('/')[-1],
                    "text_length": len(extracted_text),
                    "pages": meta_dict["pages"]
                }
                
            except Exception as e:
                return {"error": f"Failed to process PDF: {str(e)}"}
        
        def trigger_fetch(max_papers, api_key=""):
            # Determine which storage to use based on API key
            if api_key == API_KEY:
                # Authenticated: production API storage, normal limits
                if max_papers < 1 or max_papers > 50:
                    return {"error": "Papers count must be between 1 and 50"}
                storage_type = "API storage (production)"
                # For now, just simulate - we'd need to modify fetch_arxiv_papers to accept target collection
                result = f"Would fetch {max_papers} papers to API storage (production data)"
            else:
                # Public demo: limit to 1 paper only
                if max_papers != 1:
                    return {"error": "Public demo limited to 1 paper. Use API key for higher limits."}
                storage_type = "Demo storage (public)"
                result = "Would fetch 1 paper to demo storage (public playground)"
                max_papers = 1  # Enforce limit
            
            return {
                "message": result,
                "storage_used": storage_type,
                "papers_requested": max_papers,
                "authenticated": api_key == API_KEY,
                "limit_applied": "1 paper max" if api_key != API_KEY else f"{max_papers} papers max"
            }
        
        # Connect button handlers
        health_btn.click(check_health, outputs=health_output)
        fetch_papers_btn.click(trigger_fetch, inputs=[fetch_papers_input, api_key_input], outputs=fetch_output)
    
    return api_demo

# Create the API demo interface  
api_demo = create_api_demo()

# Add API endpoints to main demo
with demo:
    # Create hidden buttons to register API endpoints
    # These buttons are not visible but make the functions available via API
    hidden_add_btn = gr.Button("Add Document", visible=False)
    hidden_search_btn = gr.Button("Search", visible=False) 
    hidden_compare_btn = gr.Button("Compare", visible=False)
    hidden_list_btn = gr.Button("List Documents", visible=False)
    hidden_delete_btn = gr.Button("Delete Document", visible=False)
    hidden_pdf_btn = gr.Button("Add PDF", visible=False)
    
    # Hidden outputs for API endpoints
    hidden_output = gr.JSON(visible=False)
    
    # Function definitions for API endpoints
    def check_health():
        return {
            "status": "healthy", 
            "api_documents": api_collection.count(),
            "demo_documents": demo_collection.count()
        }
    
    def api_add_document(content: str, metadata: dict = None, api_key: str = ""):
        if api_key != API_KEY:
            return {"error": "Invalid or missing API key"}
        
        if not content:
            return {"error": "Content is required"}
        
        doc_id = generate_doc_id(content)
        existing = api_collection.get(ids=[doc_id])
        if existing['ids']:
            return {"message": "Document already exists", "id": doc_id}
        
        embedding = model.encode(content).tolist()
        meta_dict = {"source": "api"}
        if metadata:
            meta_dict.update(metadata)
        
        api_collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[meta_dict],
            ids=[doc_id]
        )
        
        return {"message": "Document added", "id": doc_id}
    
    def api_search_documents(query: str, n_results: int = 5, api_key: str = ""):
        if api_key != API_KEY:
            return {"error": "Invalid or missing API key"}
        
        if not query:
            return {"error": "Query is required"}
        
        doc_count = api_collection.count()
        if doc_count == 0:
            return {"results": [], "message": "No documents in database"}
        
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
        
        return {"results": formatted_results, "query": query}
    
    def api_compare_documents(doc1: str, doc2: str, api_key: str = ""):
        if api_key != API_KEY:
            return {"error": "Invalid or missing API key"}
        
        if not doc1 or not doc2:
            return {"error": "Both documents are required"}
        
        embedding1 = model.encode(doc1)
        embedding2 = model.encode(doc2)
        
        from numpy import dot
        from numpy.linalg import norm
        
        similarity = float(dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2)))
        
        return {
            "similarity": similarity,
            "percentage": similarity * 100,
            "doc1_preview": doc1[:100],
            "doc2_preview": doc2[:100]
        }
    
    def api_list_documents(api_key: str = ""):
        if api_key != API_KEY:
            return {"error": "Invalid or missing API key"}
        
        all_docs = api_collection.get()
        
        documents = []
        for i in range(len(all_docs['ids'])):
            documents.append({
                "id": all_docs['ids'][i],
                "content": all_docs['documents'][i],
                "metadata": all_docs['metadatas'][i]
            })
        
        return {"documents": documents, "count": len(documents)}
    
    def api_delete_document(doc_id: str, api_key: str = ""):
        if api_key != API_KEY:
            return {"error": "Invalid or missing API key"}
        
        try:
            existing = api_collection.get(ids=[doc_id])
            if not existing['ids']:
                return {"error": "Document not found"}
            
            api_collection.delete(ids=[doc_id])
            return {"message": "Document deleted", "id": doc_id}
            
        except Exception as e:
            return {"error": f"Failed to delete document: {str(e)}"}
    
    def api_add_pdf_document(pdf_file, metadata: dict = None, api_key: str = ""):
        if api_key != API_KEY:
            return {"error": "Invalid or missing API key"}
        
        if pdf_file is None:
            return {"error": "No PDF file provided"}
        
        try:
            with open(pdf_file.name, 'rb') as f:
                pdf_bytes = f.read()
            
            extracted_text = extract_text_from_pdf(pdf_bytes)
            
            if not extracted_text.strip():
                return {"error": "No text found in PDF"}
            
            meta_dict = {"source": "pdf_upload", "filename": pdf_file.name.split('/')[-1]}
            if metadata:
                meta_dict.update(metadata)
            
            meta_dict["text_length"] = len(extracted_text)
            meta_dict["pages"] = len(extracted_text.split('\n\n'))
            
            doc_id = generate_doc_id(extracted_text)
            existing = api_collection.get(ids=[doc_id])
            if existing['ids']:
                return {"message": "Document already exists", "id": doc_id, "filename": pdf_file.name}
            
            embedding = model.encode(extracted_text).tolist()
            
            api_collection.add(
                embeddings=[embedding],
                documents=[extracted_text],
                metadatas=[meta_dict],
                ids=[doc_id]
            )
            
            return {
                "message": "PDF processed and document added",
                "id": doc_id,
                "filename": pdf_file.name.split('/')[-1],
                "text_length": len(extracted_text),
                "pages": meta_dict["pages"]
            }
            
        except Exception as e:
            return {"error": f"Failed to process PDF: {str(e)}"}
    
    def trigger_fetch(max_papers, api_key=""):
        # Determine which storage to use based on API key
        if api_key == API_KEY:
            # Authenticated: production API storage, normal limits
            if max_papers < 1 or max_papers > 50:
                return {"error": "Papers count must be between 1 and 50"}
            storage_type = "API storage (production)"
            # For now, just simulate - we'd need to modify fetch_arxiv_papers to accept target collection
            result = f"Would fetch {max_papers} papers to API storage (production data)"
        else:
            # Public demo: limit to 1 paper only
            if max_papers != 1:
                return {"error": "Public demo limited to 1 paper. Use API key for higher limits."}
            storage_type = "Demo storage (public)"
            result = "Would fetch 1 paper to demo storage (public playground)"
            max_papers = 1  # Enforce limit
        
        return {
            "message": result,
            "storage_used": storage_type,
            "papers_requested": max_papers,
            "authenticated": api_key == API_KEY,
            "limit_applied": "1 paper max" if api_key != API_KEY else f"{max_papers} papers max"
        }
    
    # Register the API endpoints
    hidden_add_btn.click(api_add_document, inputs=[gr.Textbox(visible=False), gr.JSON(visible=False), gr.Textbox(visible=False)], outputs=hidden_output, api_name="add")
    hidden_search_btn.click(api_search_documents, inputs=[gr.Textbox(visible=False), gr.Number(visible=False), gr.Textbox(visible=False)], outputs=hidden_output, api_name="search")
    hidden_compare_btn.click(api_compare_documents, inputs=[gr.Textbox(visible=False), gr.Textbox(visible=False), gr.Textbox(visible=False)], outputs=hidden_output, api_name="compare")
    hidden_list_btn.click(api_list_documents, inputs=[gr.Textbox(visible=False)], outputs=hidden_output, api_name="documents")
    hidden_delete_btn.click(api_delete_document, inputs=[gr.Textbox(visible=False), gr.Textbox(visible=False)], outputs=hidden_output, api_name="delete")
    hidden_pdf_btn.click(api_add_pdf_document, inputs=[gr.File(visible=False), gr.JSON(visible=False), gr.Textbox(visible=False)], outputs=hidden_output, api_name="add_pdf")
    
    # Also register health and arxiv_fetch endpoints
    gr.Button("Health", visible=False).click(check_health, outputs=hidden_output, api_name="health")
    gr.Button("Fetch", visible=False).click(trigger_fetch, inputs=[gr.Number(visible=False), gr.Textbox(visible=False)], outputs=hidden_output, api_name="arxiv_fetch")

# Create combined interface with API docs as last tab
with demo:
    with gr.Tab("📖 API Documentation"):
        gr.Markdown("""
        # 📚 Document Similarity API Documentation
        
        This space provides REST API endpoints for programmatic access to document similarity features.
        
        ## 🔐 Authentication
        Most endpoints require an API key. Contact the administrator for production access.
        
        ## 📋 Quick Reference
        
        | Endpoint | Method | Auth | Description |
        |----------|--------|------|-------------|
        | `/api/health` | GET | None | Health check and document counts |
        | `/api/add` | POST | Required | Add text document |
        | `/api/add_pdf` | POST | Required | Upload and process PDF |
        | `/api/search` | POST | Required | Search similar documents |
        | `/api/compare` | POST | Required | Compare two documents |
        | `/api/documents` | GET | Required | List all documents |
        | `/api/delete` | DELETE | Required | Delete document |
        | `/api/arxiv_fetch` | POST | Optional | Fetch arXiv papers |
        
        ## 📝 Example Usage
        
        ```python
        import requests
        
        # Health check (no auth)
        response = requests.get("https://your-space.hf.space/api/health")
        
        # Add document (requires API key)
        response = requests.post("https://your-space.hf.space/api/add", json={
            "content": "Your document text here",
            "metadata": {"category": "example"},
            "api_key": "your-api-key"
        })
        
        # Search documents
        response = requests.post("https://your-space.hf.space/api/search", json={
            "query": "search term",
            "n_results": 5,
            "api_key": "your-api-key"
        })
        ```
        
        ## 🔗 Interactive API Testing
        Add `?view=api` to this URL for interactive testing interface.
        
        ---
        *For detailed documentation with request/response examples, contact the administrator.*
        """)

if __name__ == "__main__":
    demo.launch()