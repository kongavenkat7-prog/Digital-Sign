import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import styles from '@/styles/Upload.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const UploadPage = () => {
  useRequireAuth();
  const router = useRouter();
  const REVIEWER_SLOTS = 4;
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState([]);
  const [reviewerIds, setReviewerIds] = useState(Array(REVIEWER_SLOTS).fill(''));

  useEffect(() => {
    api
      .listUsers()
      .then((res) => setUsers(res.data.data))
      .catch(() => {
        toast.error('Failed to load reviewers — refresh to try again');
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

  const selectedReviewers = reviewerIds.filter(Boolean);
  const reviewersComplete = selectedReviewers.length === REVIEWER_SLOTS;
  const reviewerEmails = selectedReviewers.map((id) => users.find((u) => u._id === id)?.email?.toLowerCase());
  const hasDuplicateReviewer = new Set(reviewerEmails).size !== reviewerEmails.length;

  const handleReviewerChange = (slotIndex, value) => {
    setReviewerIds((prev) => {
      const next = [...prev];
      next[slotIndex] = value;
      return next;
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }
    if (!reviewersComplete) {
      toast.error(`Assign all ${REVIEWER_SLOTS} reviewers before uploading`);
      return;
    }
    if (hasDuplicateReviewer) {
      toast.error('Each reviewer must have a different email — no duplicates allowed');
      return;
    }

    try {
      setUploading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        const fileData = e.target?.result;
        try {
          const signers = reviewerIds.map((id) => {
            const reviewer = users.find((u) => u._id === id);
            return { name: reviewer.name, email: reviewer.email, roleLabel: reviewer.role };
          });
          const extra = { signers };
          const response = await api.uploadDocument(selectedFile.name, fileData, extra);

          toast.success('PDF uploaded successfully');
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
          <label className={styles.reviewerLabel}>Assign Reviewers / Signers (required — 4 distinct people)</label>
          {reviewerIds.map((value, index) => (
            <select
              key={index}
              className={styles.reviewerSelect}
              style={{ marginBottom: 10 }}
              value={value}
              onChange={(e) => handleReviewerChange(index, e.target.value)}
              disabled={uploading}
            >
              <option value="">Reviewer {index + 1} — select a person</option>
              {users.map((u) => (
                <option key={u._id} value={u._id} disabled={reviewerIds.includes(u._id) && value !== u._id}>
                  {u.name} — {u.role} ({u.email})
                </option>
              ))}
            </select>
          ))}
          {hasDuplicateReviewer && (
            <p className={styles.reviewerError}>Each reviewer must use a different email address.</p>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading || !reviewersComplete || hasDuplicateReviewer}
          className={styles.uploadButton}
        >
          {uploading ? 'Uploading...' : 'Upload PDF →'}
        </button>
      </div>
    </div>
  );
};

export default UploadPage;
