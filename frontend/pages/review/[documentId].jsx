import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import styles from '@/styles/Review.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const ReviewPage = () => {
  useRequireAuth();
  const router = useRouter();
  const { documentId } = router.query;
  const [doc, setDoc] = useState(null);
  const [approved, setApproved] = useState(false);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    api
      .getDocument(documentId)
      .then((res) => setDoc(res.data.data))
      .catch(() => toast.error('Failed to load document'));
  }, [documentId]);

  const reviewer = doc?.signers?.[0];

  const handleReview = async () => {
    if (!documentId) return;
    try {
      setSubmitting(true);
      await api.reviewDocument(documentId, approved, comments);
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
        {reviewer && (
          <div className={styles.reviewerSection}>
            <h2>Assigned Reviewer</h2>
            <div className={styles.reviewerCard}>
              <div className={styles.reviewerName}>{reviewer.name}</div>
              <div className={styles.reviewerMeta}>
                {reviewer.roleLabel} · {reviewer.email}
              </div>
            </div>
          </div>
        )}

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
            <span>
              {reviewer
                ? `I, verifying as the assigned reviewer (${reviewer.name}), approve this document for signing`
                : 'I approve this document for signing'}
            </span>
          </label>
          <p className={styles.approvalHint}>
            Without approval here, the audit for this document will stay marked "Approval Pending" and it cannot be
            signed, completed, or downloaded.
          </p>
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
