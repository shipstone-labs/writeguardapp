'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadToIPFS } from '@/lib/ipfs';

interface FileUploadProps {
  onFileUpload: (file: File, hash: string, ipfsCid?: string) => void;
}

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setUploading(true);
    
    try {
      // Calculate hash
      const hash = await calculateFileHash(file);
      
      // Upload to IPFS (optional - can be enabled via env var)
      let ipfsCid: string | undefined;
      if (process.env.NEXT_PUBLIC_ENABLE_IPFS === 'true') {
        try {
          const ipfsResult = await uploadToIPFS(file);
          ipfsCid = ipfsResult.cid;
          console.log('File uploaded to IPFS:', ipfsResult.gateway);
        } catch (ipfsError) {
          console.warn('IPFS upload failed, continuing without:', ipfsError);
        }
      }
      
      onFileUpload(file, hash, ipfsCid);
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setUploading(false);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        
        {uploading ? (
          <div>
            <p className="text-gray-600 dark:text-gray-300">Processing file...</p>
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          </div>
        ) : isDragActive ? (
          <p className="text-blue-600 dark:text-blue-400">Drop your research paper here</p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Drag and drop your research paper here, or click to select
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supported formats: PDF, TXT, MD, DOCX
            </p>
          </div>
        )}
      </div>
      
      {acceptedFiles.length > 0 && !uploading && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✓ File ready: {acceptedFiles[0].name}
          </p>
        </div>
      )}
    </div>
  );
}