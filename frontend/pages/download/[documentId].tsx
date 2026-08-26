import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';
import styles from '@/styles/Download.module.css';

const DownloadPage: React.FC = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const [documentStatus, setDocumentStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchStatus = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}/status`
        );
        setDocumentStatus(response.data.data);
      } catch (error) {
        console.error('Status fetch error:', error);
        toast.error('Failed to fetch document status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [documentId]);

  const handleDownload = async (type: 'signed' | 'original') => {
    try {
      setDownloading(type);
      const endpoint =
        type === 'signed'
          ? `/api/documents/${documentId}/download-signed`
          : `/api/documents/${documentId}/download-original`;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        type === 'signed' ? `${documentStatus.fileName}-signed.pdf` : documentStatus.fileName
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      toast.success(`${type === 'signed' ? 'Signed' : 'Original'} PDF downloaded`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading document...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.badge}>12</div>
        <h1>Download Signed Document</h1>
      </div>

      {documentStatus && (
        <div className={styles.contentContainer}>
          <div className={styles.successCard}>
            <div className={styles.checkmark}>✓</div>
            <h2>Signature Complete!</h2>
            <p>Your document has been successfully signed and verified.</p>
          </div>

          <div className={styles.documentInfo}>
            <h3>Document Details</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <label>File Name</label>
                <p>{documentStatus.fileName}</p>
              </div>
              <div className={styles.infoItem}>
                <label>Status</label>
                <p className={styles.statusBadge}>{documentStatus.status}</p>
              </div>
              <div className={styles.infoItem}>
                <label>Original PDF Hash</label>
                <code className={styles.hash}>{documentStatus.pdfHash?.substring(0, 32)}...</code>
              </div>
              <div className={styles.infoItem}>
                <label>Signed PDF Hash</label>
                <code className={styles.hash}>{documentStatus.signedPdfHash?.substring(0, 32)}...</code>
              </div>
              <div className={styles.infoItem}>
                <label>Signed Date</label>
                <p>{new Date(documentStatus.signedAt).toLocaleString()}</p>
              </div>
              <div className={styles.infoItem}>
                <label>Verified Date</label>
                <p>{new Date(documentStatus.verifiedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className={styles.downloadSection}>
            <h3>Download Your Files</h3>
            <div className={styles.downloadButtons}>
              <button
                onClick={() => handleDownload('signed')}
                disabled={downloading !== null}
                className={styles.btnPrimary}
              >
                {downloading === 'signed' ? 'Downloading...' : '⬇ Download Signed PDF'}
              </button>
              <button
                onClick={() => handleDownload('original')}
                disabled={downloading !== null}
                className={styles.btnSecondary}
              >
                {downloading === 'original' ? 'Downloading...' : '⬇ Download Original PDF'}
              </button>
            </div>
          </div>

          <div className={styles.actionsSection}>
            <button
              onClick={() => router.push('/')}
              className={styles.btnText}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadPage;
