import React, { useState } from 'react';
import { HypergraphEntityForm } from './HypergraphEntityForm';
import { HypergraphRelationForm } from './HypergraphRelationForm';
import type { Op } from '@graphprotocol/grc-20';

export function HypergraphDemo() {
  const [operations, setOperations] = useState<Op[]>([]);
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Array<{ id: string; title: string }>>([]);

  const handleEntitySubmit = async (operation: Op) => {
    setLoading(true);
    try {
      // Add entity operation to the list
      setOperations(prev => [...prev, operation]);
      
      // Extract entity info for the relation form dropdown
      if (operation.type === 'UPDATE_ENTITY') {
        const titleValue = operation.entity.values.find(v => v.property === 'title')?.value;
        if (titleValue) {
          setEntities(prev => [...prev, {
            id: operation.entity.id,
            title: titleValue
          }]);
        }
      }

      console.log('Entity operation created:', operation);
    } catch (error) {
      console.error('Error creating entity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRelationSubmit = async (operation: Op) => {
    setLoading(true);
    try {
      // Add relation operation to the list
      setOperations(prev => [...prev, operation]);
      
      console.log('Relation operation created:', operation);
    } catch (error) {
      console.error('Error creating relation:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitToHypergraph = async () => {
    if (operations.length === 0) {
      alert('No operations to submit');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/hypergraph-ops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spaceId: process.env.NEXT_PUBLIC_HYPERGRAPH_SPACE_ID || 'ecc6ea7a-3e7c-4729-8faa-a8636ae6bd93',
          operations,
          name: 'Demo Operations'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Operations submitted successfully:', result);
      alert(`Operations submitted! UserOp: ${result.userOpHash}`);
      
      // Clear operations after successful submission
      setOperations([]);
    } catch (error) {
      console.error('Error submitting operations:', error);
      alert('Error submitting operations. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Hypergraph Demo</h1>
        <p className="text-gray-600">Create entities and relations using native GRC-20 operations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Entity Form */}
        <div>
          <HypergraphEntityForm 
            onSubmit={handleEntitySubmit}
            loading={loading}
          />
        </div>

        {/* Relation Form */}
        <div>
          <HypergraphRelationForm 
            onSubmit={handleRelationSubmit}
            loading={loading}
            availableEntities={entities}
          />
        </div>
      </div>

      {/* Operations Queue */}
      {operations.length > 0 && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Queued Operations ({operations.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {operations.map((op, index) => (
              <div key={index} className="text-sm bg-white p-2 rounded border">
                <strong>{op.type}:</strong> {
                  op.type === 'UPDATE_ENTITY' 
                    ? op.entity.values.find(v => v.property === 'title')?.value || op.entity.id
                    : op.type === 'CREATE_RELATION'
                    ? `${op.relation.fromEntity} → ${op.relation.toEntity}`
                    : 'Unknown operation'
                }
              </div>
            ))}
          </div>
          
          <button
            onClick={submitToHypergraph}
            disabled={loading}
            className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Submitting...' : `Submit ${operations.length} Operations to Hypergraph`}
          </button>
        </div>
      )}

      {/* Schema Info */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Using Generated Schema IDs</h3>
        <div className="text-sm space-y-2">
          <p>✅ Forms now create native GRC-20 operations with proper property IDs</p>
          <p>✅ Operations use the schema IDs generated from your schema setup</p>
          <p>✅ Data is consistent with your hypergraph space schema</p>
          <p className="font-medium text-blue-800">
            Space ID: {process.env.NEXT_PUBLIC_HYPERGRAPH_SPACE_ID || 'ecc6ea7a-3e7c-4729-8faa-a8636ae6bd93'}
          </p>
        </div>
      </div>
    </div>
  );
}