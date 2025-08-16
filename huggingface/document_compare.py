#!/usr/bin/env python3

import os
import hashlib
from typing import List, Dict, Tuple
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from rich.console import Console
from rich.table import Table
from rich.progress import track

console = Console()

class DocumentVectorizer:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", persist_dir: str = "./chroma_db"):
        console.print(f"[cyan]Initializing with model: {model_name}[/cyan]")
        self.model = SentenceTransformer(model_name)
        
        self.chroma_client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False)
        )
        
        self.collection = self.chroma_client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        console.print(f"[green]✓ Vector database ready at {persist_dir}[/green]")
    
    def _generate_doc_id(self, content: str) -> str:
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def add_document(self, content: str, metadata: Dict = None) -> str:
        doc_id = self._generate_doc_id(content)
        
        existing = self.collection.get(ids=[doc_id])
        if existing['ids']:
            console.print(f"[yellow]Document already exists with ID: {doc_id}[/yellow]")
            return doc_id
        
        embedding = self.model.encode(content).tolist()
        
        self.collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}],
            ids=[doc_id]
        )
        
        console.print(f"[green]✓ Added document with ID: {doc_id}[/green]")
        return doc_id
    
    def add_documents_batch(self, documents: List[str], metadatas: List[Dict] = None) -> List[str]:
        if not documents:
            return []
        
        if metadatas and len(metadatas) != len(documents):
            raise ValueError("Documents and metadatas must have the same length")
        
        doc_ids = [self._generate_doc_id(doc) for doc in documents]
        
        existing = self.collection.get(ids=doc_ids)
        new_indices = [i for i, doc_id in enumerate(doc_ids) if doc_id not in existing['ids']]
        
        if not new_indices:
            console.print("[yellow]All documents already exist in database[/yellow]")
            return doc_ids
        
        new_docs = [documents[i] for i in new_indices]
        new_ids = [doc_ids[i] for i in new_indices]
        new_metas = [metadatas[i] if metadatas else {} for i in new_indices]
        
        console.print(f"[cyan]Encoding {len(new_docs)} new documents...[/cyan]")
        embeddings = self.model.encode(new_docs, show_progress_bar=True).tolist()
        
        self.collection.add(
            embeddings=embeddings,
            documents=new_docs,
            metadatas=new_metas,
            ids=new_ids
        )
        
        console.print(f"[green]✓ Added {len(new_docs)} documents[/green]")
        return doc_ids
    
    def find_similar(self, query: str, n_results: int = 5) -> List[Tuple[str, float, str, Dict]]:
        query_embedding = self.model.encode(query).tolist()
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        if not results['ids'][0]:
            return []
        
        similar_docs = []
        for i in range(len(results['ids'][0])):
            similar_docs.append((
                results['ids'][0][i],
                results['distances'][0][i],
                results['documents'][0][i],
                results['metadatas'][0][i]
            ))
        
        return similar_docs
    
    def compare_documents(self, doc1: str, doc2: str) -> float:
        embedding1 = self.model.encode(doc1)
        embedding2 = self.model.encode(doc2)
        
        from numpy import dot
        from numpy.linalg import norm
        
        similarity = dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2))
        return float(similarity)
    
    def get_all_documents(self) -> Dict:
        return self.collection.get()
    
    def clear_database(self):
        self.chroma_client.delete_collection("documents")
        self.collection = self.chroma_client.create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        console.print("[red]✓ Database cleared[/red]")


def display_results(results: List[Tuple[str, float, str, Dict]]):
    if not results:
        console.print("[yellow]No similar documents found[/yellow]")
        return
    
    table = Table(title="Similar Documents", show_header=True, header_style="bold magenta")
    table.add_column("Rank", style="cyan", width=6)
    table.add_column("ID", style="yellow", width=18)
    table.add_column("Similarity", style="green", width=12)
    table.add_column("Content Preview", style="white", width=50)
    table.add_column("Metadata", style="blue", width=20)
    
    for i, (doc_id, distance, content, metadata) in enumerate(results, 1):
        similarity = 1 - distance
        preview = content[:100] + "..." if len(content) > 100 else content
        meta_str = str(metadata) if metadata else "-"
        table.add_row(
            str(i),
            doc_id,
            f"{similarity:.4f}",
            preview,
            meta_str
        )
    
    console.print(table)


def main():
    console.print("[bold cyan]Document Comparison System[/bold cyan]\n")
    
    vectorizer = DocumentVectorizer()
    
    sample_documents = [
        "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        "Deep learning uses neural networks with multiple layers to process complex patterns.",
        "Natural language processing helps computers understand and generate human language.",
        "Computer vision enables machines to interpret and analyze visual information from images.",
        "Reinforcement learning trains agents through rewards and penalties in an environment.",
        "The weather today is sunny with clear skies and mild temperatures.",
        "Python is a popular programming language for data science and machine learning.",
        "Neural networks are inspired by the structure and function of the human brain.",
        "Transformers have revolutionized NLP with attention mechanisms for better context understanding.",
        "Gradient descent is an optimization algorithm used to minimize loss functions in ML models."
    ]
    
    sample_metadata = [
        {"category": "ML", "topic": "fundamentals"},
        {"category": "ML", "topic": "deep_learning"},
        {"category": "ML", "topic": "nlp"},
        {"category": "ML", "topic": "computer_vision"},
        {"category": "ML", "topic": "reinforcement"},
        {"category": "general", "topic": "weather"},
        {"category": "programming", "topic": "python"},
        {"category": "ML", "topic": "neural_networks"},
        {"category": "ML", "topic": "transformers"},
        {"category": "ML", "topic": "optimization"}
    ]
    
    console.print("\n[cyan]Adding sample documents to database...[/cyan]")
    vectorizer.add_documents_batch(sample_documents, sample_metadata)
    
    while True:
        console.print("\n[bold]Options:[/bold]")
        console.print("1. Search for similar documents")
        console.print("2. Compare two documents directly")
        console.print("3. Add a new document")
        console.print("4. Show all documents")
        console.print("5. Clear database")
        console.print("6. Exit")
        
        choice = console.input("\n[cyan]Enter your choice (1-6): [/cyan]")
        
        if choice == "1":
            query = console.input("\n[cyan]Enter search query: [/cyan]")
            n_results = int(console.input("[cyan]Number of results (default 5): [/cyan]") or "5")
            
            console.print(f"\n[cyan]Searching for documents similar to: '{query}'[/cyan]")
            results = vectorizer.find_similar(query, n_results)
            display_results(results)
            
        elif choice == "2":
            doc1 = console.input("\n[cyan]Enter first document: [/cyan]")
            doc2 = console.input("[cyan]Enter second document: [/cyan]")
            
            similarity = vectorizer.compare_documents(doc1, doc2)
            console.print(f"\n[green]Similarity score: {similarity:.4f}[/green]")
            console.print(f"[yellow]Interpretation: {similarity*100:.1f}% similar[/yellow]")
            
        elif choice == "3":
            content = console.input("\n[cyan]Enter document content: [/cyan]")
            category = console.input("[cyan]Enter category (optional): [/cyan]") or None
            topic = console.input("[cyan]Enter topic (optional): [/cyan]") or None
            
            metadata = {}
            if category:
                metadata["category"] = category
            if topic:
                metadata["topic"] = topic
            
            doc_id = vectorizer.add_document(content, metadata)
            
        elif choice == "4":
            all_docs = vectorizer.get_all_documents()
            
            if not all_docs['ids']:
                console.print("[yellow]No documents in database[/yellow]")
            else:
                table = Table(title="All Documents", show_header=True)
                table.add_column("ID", style="yellow")
                table.add_column("Content Preview", style="white")
                table.add_column("Metadata", style="blue")
                
                for i in range(len(all_docs['ids'])):
                    content = all_docs['documents'][i]
                    preview = content[:80] + "..." if len(content) > 80 else content
                    table.add_row(
                        all_docs['ids'][i],
                        preview,
                        str(all_docs['metadatas'][i])
                    )
                
                console.print(table)
                console.print(f"\n[cyan]Total documents: {len(all_docs['ids'])}[/cyan]")
            
        elif choice == "5":
            confirm = console.input("\n[red]Are you sure? This will delete all documents (y/n): [/red]")
            if confirm.lower() == 'y':
                vectorizer.clear_database()
            
        elif choice == "6":
            console.print("[green]Goodbye![/green]")
            break
        
        else:
            console.print("[red]Invalid choice. Please try again.[/red]")


if __name__ == "__main__":
    main()