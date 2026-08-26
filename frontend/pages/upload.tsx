import React, { useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import styles from '@/styles/Upload.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const UploadPage: React.FC = () => {
  useRequireAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast.error('Please select a valid PDF file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        const fileData = e.target?.result as string;
        try {
          const response = await api.uploadDocument(selectedFile.name, fileData);

          toast.success('PDF uploaded successfully');
          router.push(`/preview/${response.data.data.documentId}`);
        } catch (error: any) {
          console.error('Upload error:', error);
          toast.error(error.response?.data?.message || 'Failed to upload PDF');
          setUploading(false);
        }
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to process file');
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>1</div>
          <h1>Step 1: Upload Your PDF</h1>
        </div>

        <div className={styles.uploadArea}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={uploading}
            style={{ display: 'none' }}
            id="fileInput"
          />
          <label htmlFor="fileInput" className={styles.uploadLabel}>
            <div className={styles.uploadIcon}>📄</div>
            <p>Click to select file</p>
          </label>
        </div>

        {selectedFile && (
          <div className={styles.fileInfo}>
            <p className={styles.fileName}>Selected: {selectedFile.name}</p>
            <p className={styles.fileSize}>
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className={styles.maxSize}>Maximum file size: 25MB</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className={styles.uploadButton}
        >
          {uploading ? 'Uploading...' : 'Upload PDF →'}
        </button>
      </div>
    </div>
  );
};

export default UploadPage;
