import React, { useState } from 'react';
import { SIMILARITY_RELATION_TYPE, validateRelationData } from '../lib/hypergraph-schema';
import { createSimilarityRelation } from '../lib/schema-ids';
import type { Op } from '@graphprotocol/grc-20';

interface RelationFormData {
  fromId: string;
  toId: string;
  closeness: number;
  violation: boolean;
}

interface HypergraphRelationFormProps {
  onSubmit: (operation: Op) => void;
  loading?: boolean;
  availableEntities?: Array<{ id: string; title: string }>;
}

export function HypergraphRelationForm({ 
  onSubmit, 
  loading = false, 
  availableEntities = [] 
}: HypergraphRelationFormProps) {
  const [formData, setFormData] = useState<RelationFormData>({
    fromId: '',
    toId: '',
    closeness: 0.5,
    violation: false
  });
  
  const [errors, setErrors] = useState<string[]>([]);

  // Auto-calculate violation when closeness changes
  const handleClosenessChange = (value: number) => {
    const violation = value > 0.8; // Threshold for violation
    setFormData(prev => ({
      ...prev,
      closeness: value,
      violation
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form data
    const { valid, errors: validationErrors } = validateRelationData('Similarity', formData as Record<string, unknown>);
    
    if (!valid) {
      setErrors(validationErrors);
      return;
    }
    
    // Additional validation
    const newErrors: string[] = [];
    
    if (!formData.fromId.trim()) {
      newErrors.push('Source entity is required');
    }
    
    if (!formData.toId.trim()) {
      newErrors.push('Target entity is required');
    }
    
    if (formData.fromId === formData.toId) {
      newErrors.push('Source and target entities must be different');
    }
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Create GRC-20 operation using the schema IDs
    const operation = createSimilarityRelation(
      formData.fromId,
      formData.toId,
      formData.closeness,
      formData.violation
    );
    
    setErrors([]);
    onSubmit(operation);
  };

  const getEntityTitle = (entityId: string) => {
    const entity = availableEntities.find(e => e.id === entityId);
    return entity ? entity.title : entityId;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Create Similarity Relation</h2>
      
      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-red-800 font-medium mb-2">Validation Errors:</h3>
          <ul className="text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm">• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Entity */}
        <div>
          <label htmlFor="fromId" className="block text-sm font-medium text-gray-700 mb-2">
            Source Entity *
          </label>
          {availableEntities.length > 0 ? (
            <select
              id="fromId"
              value={formData.fromId}
              onChange={(e) => setFormData(prev => ({ ...prev, fromId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select source entity...</option>
              {availableEntities.map(entity => (
                <option key={entity.id} value={entity.id}>
                  {entity.title} ({entity.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              id="fromId"
              value={formData.fromId}
              onChange={(e) => setFormData(prev => ({ ...prev, fromId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., paper-transformer-2017"
              required
            />
          )}
          <p className="text-sm text-gray-500 mt-1">The entity this relation starts from</p>
        </div>

        {/* Target Entity */}
        <div>
          <label htmlFor="toId" className="block text-sm font-medium text-gray-700 mb-2">
            Target Entity *
          </label>
          {availableEntities.length > 0 ? (
            <select
              id="toId"
              value={formData.toId}
              onChange={(e) => setFormData(prev => ({ ...prev, toId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select target entity...</option>
              {availableEntities
                .filter(entity => entity.id !== formData.fromId)
                .map(entity => (
                  <option key={entity.id} value={entity.id}>
                    {entity.title} ({entity.id})
                  </option>
                ))}
            </select>
          ) : (
            <input
              type="text"
              id="toId"
              value={formData.toId}
              onChange={(e) => setFormData(prev => ({ ...prev, toId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., paper-bert-2018"
              required
            />
          )}
          <p className="text-sm text-gray-500 mt-1">The entity this relation points to</p>
        </div>

        {/* Closeness Score */}
        <div>
          <label htmlFor="closeness" className="block text-sm font-medium text-gray-700 mb-2">
            Closeness Score * 
            <span className="font-normal text-gray-500">({formData.closeness.toFixed(2)})</span>
          </label>
          <input
            type="range"
            id="closeness"
            min="0"
            max="1"
            step="0.01"
            value={formData.closeness}
            onChange={(e) => handleClosenessChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>0.0 (Not similar)</span>
            <span>0.5 (Moderate)</span>
            <span>1.0 (Very similar)</span>
          </div>
          
          {/* Numeric input for precise values */}
          <div className="mt-2">
            <input
              type="number"
              value={formData.closeness}
              onChange={(e) => handleClosenessChange(parseFloat(e.target.value) || 0)}
              min="0"
              max="1"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.75"
            />
          </div>
        </div>

        {/* Violation Status */}
        <div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="violation"
              checked={formData.violation}
              onChange={(e) => setFormData(prev => ({ ...prev, violation: e.target.checked }))}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="violation" className="text-sm font-medium text-gray-700">
              Violation (similarity exceeds threshold)
            </label>
          </div>
          
          {formData.closeness > 0.8 && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                ⚠️ High similarity detected (&gt;0.8). This may indicate potential plagiarism or duplicate content.
              </p>
            </div>
          )}
          
          <p className="text-sm text-gray-500 mt-1">
            Automatically set to true when closeness &gt; 0.8
          </p>
        </div>

        {/* Relation Preview */}
        {formData.fromId && formData.toId && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">Relation Preview</h3>
            <p className="text-sm text-blue-700">
              <strong>{getEntityTitle(formData.fromId)}</strong> has similarity{' '}
              <strong>{formData.closeness.toFixed(2)}</strong> with{' '}
              <strong>{getEntityTitle(formData.toId)}</strong>
              {formData.violation && <span className="text-red-600"> (⚠️ VIOLATION)</span>}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Relation...' : 'Create Similarity Relation'}
        </button>
      </form>

      {/* Schema Information */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium text-gray-800 mb-2">Schema Information</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Relation Type:</strong> {SIMILARITY_RELATION_TYPE.name}</p>
          <p><strong>Description:</strong> {SIMILARITY_RELATION_TYPE.description}</p>
          <p><strong>Violation Threshold:</strong> Closeness &gt; 0.8</p>
          <p><strong>GraphQL Query:</strong> Find violations with <code>relations(where: {"{violation: true}"})</code></p>
        </div>
      </div>
    </div>
  );
}