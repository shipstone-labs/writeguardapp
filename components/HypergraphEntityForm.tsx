import React, { useState } from 'react';
import { DOCUMENT_ENTITY_TYPE, validateEntityData } from '../lib/hypergraph-schema';
import { createDocumentEntity } from '../lib/schema-ids';
import type { Op } from '@graphprotocol/grc-20';

interface EntityFormData {
  entityId: string;
  title: string;
  authors: string[];
  date: string;
  summary: string;
}

interface HypergraphEntityFormProps {
  onSubmit: (operation: Op) => void;
  loading?: boolean;
}

export function HypergraphEntityForm({ onSubmit, loading = false }: HypergraphEntityFormProps) {
  const [formData, setFormData] = useState<EntityFormData>({
    entityId: '',
    title: '',
    authors: [''],
    date: new Date().toISOString().split('T')[0], // Today's date
    summary: ''
  });
  
  const [errors, setErrors] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form data
    const { valid, errors: validationErrors } = validateEntityData('Document', formData);
    
    if (!valid) {
      setErrors(validationErrors);
      return;
    }
    
    // Additional validation
    const newErrors: string[] = [];
    
    if (!formData.entityId.trim()) {
      newErrors.push('Entity ID is required');
    }
    
    if (formData.authors.filter(a => a.trim()).length === 0) {
      newErrors.push('At least one author is required');
    }
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Clean up authors (remove empty entries)
    const cleanedData = {
      ...formData,
      authors: formData.authors.filter(a => a.trim()).map(a => a.trim())
    };
    
    // Create GRC-20 operation using the schema IDs
    const operation = createDocumentEntity(
      cleanedData.entityId,
      cleanedData.title,
      cleanedData.authors,
      cleanedData.date,
      cleanedData.summary
    );
    
    setErrors([]);
    onSubmit(operation);
  };

  const addAuthor = () => {
    if (authorInput.trim()) {
      setFormData(prev => ({
        ...prev,
        authors: [...prev.authors, authorInput.trim()]
      }));
      setAuthorInput('');
    }
  };

  const removeAuthor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      authors: prev.authors.filter((_, i) => i !== index)
    }));
  };

  const updateAuthor = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      authors: prev.authors.map((author, i) => i === index ? value : author)
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Create Document Entity</h2>
      
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
        {/* Entity ID */}
        <div>
          <label htmlFor="entityId" className="block text-sm font-medium text-gray-700 mb-2">
            Entity ID *
          </label>
          <input
            type="text"
            id="entityId"
            value={formData.entityId}
            onChange={(e) => setFormData(prev => ({ ...prev, entityId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., paper-transformer-2017"
            required
          />
          <p className="text-sm text-gray-500 mt-1">Unique identifier for this document</p>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Attention Is All You Need"
            required
          />
        </div>

        {/* Authors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Authors *
          </label>
          
          {/* Existing authors */}
          <div className="space-y-2 mb-3">
            {formData.authors.map((author, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={author}
                  onChange={(e) => updateAuthor(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Author name"
                />
                <button
                  type="button"
                  onClick={() => removeAuthor(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          {/* Add new author */}
          <div className="flex gap-2">
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add another author"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
            />
            <button
              type="button"
              onClick={addAuthor}
              className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Add
            </button>
          </div>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            Publication Date *
          </label>
          <input
            type="date"
            id="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Summary */}
        <div>
          <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-2">
            Summary *
          </label>
          <textarea
            id="summary"
            value={formData.summary}
            onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief summary or abstract of the document..."
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Entity...' : 'Create Document Entity'}
        </button>
      </form>

      {/* Schema Information */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium text-gray-800 mb-2">Schema Information</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Entity Type:</strong> {DOCUMENT_ENTITY_TYPE.name}</p>
          <p><strong>Description:</strong> {DOCUMENT_ENTITY_TYPE.description}</p>
          <p><strong>Required Fields:</strong> {
            DOCUMENT_ENTITY_TYPE.properties
              .filter(p => p.required && !['created_at', 'created_by'].includes(p.name))
              .map(p => p.name)
              .join(', ')
          }</p>
        </div>
      </div>
    </div>
  );
}