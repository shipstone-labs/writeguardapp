#!/usr/bin/env python3
"""
Test script for hypergraph operations API
Run this to test the NextJS API locally
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:3000"  # NextJS dev server
SPACE_ID = "ecc6ea7a-3e7c-4729-8faa-a8636ae6bd93"  # Your actual space ID

def test_wallet_status():
    """Test wallet status endpoint"""
    print("🔍 Testing wallet status...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/wallet-status")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Wallet status retrieved:")
            print(f"   📍 Address: {data['address']}")
            print(f"   💰 Balance: {data['balanceETH']} ETH")
            print(f"   🌐 Network: {data['network']}")
            print(f"   💵 Funded: {data['funded']}")
            if not data['funded']:
                print(f"   🚰 Fund at: {data['faucetUrl']}")
            return data
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_create_entity():
    """Test creating a single entity"""
    print("\n🆕 Testing create entity...")
    
    operations = [
        {
            "type": "createEntity",
            "entityId": "entity-ai-paper-123",
            "title": "Attention Is All You Need",
            "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
            "date": "2017-06-12",
            "summary": "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely."
        }
    ]
    
    return test_hypergraph_operations(operations, "Create Entity Test")

def test_create_relation():
    """Test creating relations between entities"""
    print("\n🔗 Testing create relation...")
    
    operations = [
        {
            "type": "createEntity",
            "entityId": "paper-transformer",
            "title": "Attention Is All You Need",
            "authors": ["Vaswani et al."],
            "date": "2017-06-12",
            "summary": "Introduces the Transformer architecture based on self-attention."
        },
        {
            "type": "createEntity", 
            "entityId": "paper-bert",
            "title": "BERT: Pre-training of Deep Bidirectional Transformers",
            "authors": ["Devlin et al."],
            "date": "2018-10-11",
            "summary": "Bidirectional transformer pre-training for language understanding."
        },
        {
            "type": "createRelation",
            "fromId": "paper-transformer",
            "toId": "paper-bert",
            "closeness": 0.85,
            "violation": True  # closeness > 0.8 threshold
        }
    ]
    
    return test_hypergraph_operations(operations, "Create Relation Test")

def test_complex_operations():
    """Test multiple entities and relations"""
    print("\n🌐 Testing complex graph operations...")
    
    operations = [
        # Create three research papers
        {
            "type": "createEntity",
            "entityId": "transformer-paper",
            "title": "Attention Is All You Need",
            "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
            "date": "2017-06-12",
            "summary": "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms."
        },
        {
            "type": "createEntity",
            "entityId": "bert-paper", 
            "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
            "authors": ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
            "date": "2018-10-11",
            "summary": "We introduce BERT, which stands for Bidirectional Encoder Representations from Transformers."
        },
        {
            "type": "createEntity",
            "entityId": "gpt-paper",
            "title": "Improving Language Understanding by Generative Pre-Training",
            "authors": ["Alec Radford", "Karthik Narasimhan", "Tim Salimans", "Ilya Sutskever"],
            "date": "2018-06-11",
            "summary": "We demonstrate that large gains on these tasks can be realized by generative pre-training of a language model."
        },
        # Create relationships with violation detection
        {
            "type": "createRelation",
            "fromId": "transformer-paper",
            "toId": "bert-paper",
            "closeness": 0.92,
            "violation": True  # High similarity - potential violation
        },
        {
            "type": "createRelation",
            "fromId": "transformer-paper", 
            "toId": "gpt-paper",
            "closeness": 0.88,
            "violation": True  # High similarity - potential violation
        },
        {
            "type": "createRelation",
            "fromId": "bert-paper",
            "toId": "gpt-paper", 
            "closeness": 0.75,
            "violation": False  # Lower similarity - no violation
        }
    ]
    
    return test_hypergraph_operations(operations, "Complex Graph Test")

def test_hypergraph_operations(operations, test_name):
    """Send operations to the API"""
    payload = {
        "spaceId": SPACE_ID,
        "operations": operations,
        "name": test_name
    }
    
    print(f"📤 Sending {len(operations)} operations...")
    print(f"📄 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/hypergraph-ops",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📥 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Operations successful:")
            print(f"   🔗 UserOp Hash: {data['userOpHash']}")
            print(f"   📁 IPFS CID: {data['cid']}")
            print(f"   📍 Wallet: {data['wallet']}")
            print(f"   🔢 Operations: {data['operationsProcessed']}")
            print(f"   ⚠️  Simulation: {data.get('simulation', False)}")
            return data
        else:
            print(f"❌ Failed: {response.status_code}")
            print(f"❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Request error: {e}")
        return None

def main():
    """Run all tests"""
    print("🚀 Starting hypergraph API tests...")
    print("=" * 50)
    
    # Test wallet first
    wallet_status = test_wallet_status()
    
    if not wallet_status:
        print("❌ Cannot proceed without wallet")
        return
    
    # Wait a bit between tests
    time.sleep(1)
    
    # Test operations
    test_create_entity()
    time.sleep(1)
    
    test_create_relation()
    time.sleep(1)
    
    test_complex_operations()
    
    print("\n" + "=" * 50)
    print("🎉 Tests completed!")
    
    if not wallet_status['funded']:
        print("\n💡 Next steps:")
        print(f"1. Fund wallet: {wallet_status['address']}")
        print(f"2. Use faucet: {wallet_status['faucetUrl']}")
        print("3. Run tests again to see actual transactions")

if __name__ == "__main__":
    main()