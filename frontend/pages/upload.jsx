import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import styles from '@/styles/Upload.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const ROLE_OPTIONS = [
  { value: 'Administrator', label: 'Admin' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Lead', label: 'Signer' },
];

const UploadPage = () => {
  useRequireAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    api
      .getCurrentUser()
      .then((res) => setCurrentUser(res.data.data))
      .catch(() => {
        toast.error('Failed to load your account — refresh to try again');
      });
  }, []);

  const handleFileSelect = (event) => {
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
    if (!selectedRole) {
      toast.error('Select a reviewer role before uploading');
      return;
    }
    if (!currentUser) {
      toast.error('Still loading your account — try again in a moment');
      return;
    }

    try {
      setUploading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        const fileData = e.target?.result;
        try {
          const signers = [{ name: currentUser.name, email: currentUser.email, roleLabel: selectedRole }];
          const response = await api.uploadDocument(selectedFile.name, fileData, { signers });

          toast.success('PDF uploaded — reviewer notified by email');
          router.push(`/preview/${response.data.data.documentId}`);
        } catch (error) {
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

        <div className={styles.reviewerSection}>
          <label className={styles.reviewerLabel} htmlFor="reviewerRole">
            Assign Reviewer (required)
          </label>
          <select
            id="reviewerRole"
            className={styles.reviewerSelect}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={uploading || !currentUser}
          >
            <option value="">Select a role</option>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} {currentUser ? `(${currentUser.email})` : ''}
              </option>
            ))}
          </select>
          <p className={styles.reviewerHint}>
            The selected reviewer is emailed a link to this document as soon as it's uploaded.
          </p>
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading || !selectedRole}
          className={styles.uploadButton}
        >
          {uploading ? 'Uploading...' : 'Upload PDF →'}
        </button>
      </div>
    </div>
  );
};

export default UploadPage;
