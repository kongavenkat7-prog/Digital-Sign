import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';
import styles from '@/styles/Review.module.css';

const ReviewPage: React.FC = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const [approved, setApproved] = useState(false);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReview = async () => {
    try {
      setSubmitting(true);
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/signatures/${documentId}/review`,
        {
          approved,
          comments,
        }
      );
      toast.success('Document reviewed successfully');
      router.push(`/sign/${documentId}`);
    } catch (error) {
      console.error('Review error:', error);
      toast.error('Failed to review document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Step 5: Review & Confirm</h1>

      <div className={styles.reviewCard}>
        <div className={styles.checklistSection}>
          <h2>Pre-Signature Checklist</h2>
          <div className={styles.checklist}>
            <label className={styles.checkItem}>
              <input type="checkbox" disabled checked readOnly />
              <span>✓ PDF uploaded</span>
            </label>
            <label className={styles.checkItem}>
              <input type="checkbox" disabled checked readOnly />
              <span>✓ PDF previewed</span>
            </label>
            <label className={styles.checkItem}>
              <input type="checkbox" disabled checked readOnly />
              <span>✓ Signature created</span>
            </label>
            <label className={styles.checkItem}>
              <input type="checkbox" disabled checked readOnly />
              <span>✓ Signature placed</span>
            </label>
          </div>
        </div>

        <div className={styles.approvalSection}>
          <h2>Approval</h2>
          <label className={styles.approvalCheck}>
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            <span>I approve this document for signing</span>
          </label>
        </div>

        <div className={styles.commentsSection}>
          <h2>Comments (Optional)</h2>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any comments here..."
            className={styles.textarea}
          />
        </div>

        <button
          onClick={handleReview}
          disabled={!approved || submitting}
          className={styles.btnPrimary}
        >
          {submitting ? 'Reviewing...' : 'Proceed to Sign →'}
        </button>
      </div>
    </div>
  );
};

export default ReviewPage;
