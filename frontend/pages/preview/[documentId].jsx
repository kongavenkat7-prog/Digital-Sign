import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';
import styles from '@/styles/Preview.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import AppShell from '@/components/AppShell';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Must match the scale used to render the PDF pages below, so that a click on
// the rendered canvas can be converted back into real PDF point coordinates.
const RENDER_SCALE = 1.5;

const PreviewPage = () => {
  useRequireAuth();
  const router = useRouter();
  const { documentId } = router.query;
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signatureType, setSignatureType] = useState('draw');
  const [signatureImage, setSignatureImage] = useState(null);
  const [typedSignature, setTypedSignature] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [placements, setPlacements] = useState([]);
  const [placing, setPlacing] = useState(false);

  const canvasRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const signatureInputRef = useRef(null);

  // Load and render PDF
  useEffect(() => {
    if (!documentId) return;

    const loadPDF = async () => {
      try {
        setLoading(true);
        const response = await api.previewDocument(documentId);

        const pdf = await pdfjsLib.getDocument({ data: response.data }).promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const context = canvas.getContext('2d');
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          pages.push(canvas);
        }

        setPdfPages(pages);
        setLoading(false);
        toast.success('PDF loaded successfully');
      } catch (error) {
        console.error('PDF load error:', error);
        toast.error('Failed to load PDF');
        setLoading(false);
      }
    };

    loadPDF();
  }, [documentId]);

  // Render current PDF page
  useEffect(() => {
    if (pdfPages.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const pageCanvas = pdfPages[currentPage];
      canvasRef.current.width = pageCanvas.width;
      canvasRef.current.height = pageCanvas.height;
      ctx.drawImage(pageCanvas, 0, 0);
    }
  }, [pdfPages, currentPage]);

  // Initialize signature canvas
  useEffect(() => {
    if (signatureCanvasRef.current && signatureType === 'draw') {
      const canvas = signatureCanvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [signatureType]);

  // Handle canvas drawing
  const startDrawing = (e) => {
    if (!signatureCanvasRef.current || signatureType !== 'draw') return;
    setIsDrawing(true);
    const ctx = signatureCanvasRef.current.getContext('2d');
    const rect = signatureCanvasRef.current.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing || !signatureCanvasRef.current || signatureType !== 'draw') return;
    const ctx = signatureCanvasRef.current.getContext('2d');
    const rect = signatureCanvasRef.current.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (signatureCanvasRef.current && signatureType === 'draw') {
      setSignatureImage(signatureCanvasRef.current.toDataURL());
    }
  };

  // Handle typed signature
  const handleTypedSignature = (value) => {
    setTypedSignature(value);
    if (value.trim()) {
      // Create canvas with typed signature
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = 'italic 60px cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, canvas.width / 2, canvas.height / 2);
      setSignatureImage(canvas.toDataURL());
    }
  };

  // Handle uploaded signature
  const handleUploadSignature = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result;
      setSignatureImage(imageData);
      toast.success('Signature uploaded');
    };
    reader.readAsDataURL(file);
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current && signatureType === 'draw') {
      const ctx = signatureCanvasRef.current.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
    }
    setSignatureImage(null);
    setTypedSignature('');
    if (signatureInputRef.current) {
      signatureInputRef.current.value = '';
    }
  };

  const removePlacement = (index) => {
    setPlacements((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllPlacements = () => setPlacements([]);

  // Clicking the rendered PDF page adds another signature placement. The
  // click is captured in on-screen pixels, then converted back into PDF
  // point coordinates (dividing out RENDER_SCALE) so the backend stamps the
  // signature exactly where the user pointed rather than a hardcoded spot.
  // Placements accumulate (rather than overwrite) so the same signature can
  // be stamped in several spots, even across different pages.
  const handleCanvasClick = (e) => {
    if (!signatureImage) {
      toast.error('Create a signature below first, then click the document to place it');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const pageWidthPt = canvas.width / RENDER_SCALE;
    const pageHeightPt = canvas.height / RENDER_SCALE;

    setPlacements((prev) => [
      ...prev,
      {
        page: currentPage + 1,
        xPt: xRatio * pageWidthPt,
        yFromTopPt: yRatio * pageHeightPt,
        xRatio,
        yRatio,
        image: signatureImage,
      },
    ]);
  };

  const handlePlaceSignature = async () => {
    if (!documentId) return;
    if (placements.length === 0) {
      toast.error('Click on the document at least once to place your signature');
      return;
    }

    try {
      setPlacing(true);
      await api.placeSignatures(
        documentId,
        placements.map((p) => ({
          signatureImage: p.image,
          signatureX: p.xPt,
          signatureY: p.yFromTopPt,
          pageNumber: p.page,
        }))
      );

      toast.success(`${placements.length} signature placement${placements.length > 1 ? 's' : ''} saved`);
      router.push(`/review/${documentId}`);
    } catch (error) {
      console.error('Signature placement error:', error);
      toast.error('Failed to place signature');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <AppShell active="sign" title="Preview & Sign" subtitle="Loading document…">
        <div className={styles.loading}>Loading PDF...</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="sign"
      title="Preview & Sign"
      subtitle="Draw, type, or upload your signature, then click the document to place it."
    >
      <div className={styles.previewSection}>
        <div className={styles.pdfViewer}>
          <h2>PDF Preview</h2>
          {signatureImage && (
            <p className={styles.hint} style={{ color: 'var(--sv-primary)', fontWeight: 600 }}>
              Click anywhere on the document to add a signature — click multiple spots (and pages) to place it more than once
            </p>
          )}
          <div className={styles.pdfCanvasWrapper}>
            <canvas
              ref={canvasRef}
              className={styles.pdfCanvas}
              onClick={handleCanvasClick}
              style={{ cursor: signatureImage ? 'crosshair' : 'default' }}
            />
            {placements
              .filter((p) => p.page === currentPage + 1)
              .map((p, i) => (
                <img
                  key={i}
                  src={p.image}
                  alt="Signature placement preview"
                  className={styles.placementMarker}
                  style={{
                    left: `${p.xRatio * 100}%`,
                    top: `${p.yRatio * 100}%`,
                  }}
                />
              ))}
          </div>
          {pdfPages.length > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                ← Previous
              </button>
              <span>
                Page {currentPage + 1} of {pdfPages.length}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(pdfPages.length - 1, currentPage + 1))}
                disabled={currentPage === pdfPages.length - 1}
              >
                Next →
              </button>
            </div>
          )}

          {placements.length > 0 && (
            <div className={styles.placementsList}>
              <h3>
                Placed Signatures ({placements.length})
                <button type="button" onClick={clearAllPlacements} className={styles.clearAllBtn}>
                  Clear all
                </button>
              </h3>
              <ul>
                {placements.map((p, i) => (
                  <li key={i}>
                    <span>Page {p.page}</span>
                    <button type="button" onClick={() => removePlacement(i)} title="Remove this placement">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.signatureSection}>
          <h2>Step 3: Create Your Signature</h2>

          {/* Signature Type Tabs */}
          <div className={styles.signatureTabs}>
            <button
              className={`${styles.tab} ${signatureType === 'draw' ? styles.active : ''}`}
              onClick={() => {
                setSignatureType('draw');
                clearSignature();
              }}
            >
              ✏️ Draw
            </button>
            <button
              className={`${styles.tab} ${signatureType === 'type' ? styles.active : ''}`}
              onClick={() => {
                setSignatureType('type');
                clearSignature();
              }}
            >
              📝 Type
            </button>
            <button
              className={`${styles.tab} ${signatureType === 'upload' ? styles.active : ''}`}
              onClick={() => {
                setSignatureType('upload');
                clearSignature();
              }}
            >
              📤 Upload
            </button>
          </div>

          {/* Draw Signature */}
          {signatureType === 'draw' && (
            <div className={styles.drawContainer}>
              <p className={styles.hint}>Draw your signature in the box below</p>
              <canvas
                ref={signatureCanvasRef}
                className={styles.signatureCanvas}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          )}

          {/* Type Signature */}
          {signatureType === 'type' && (
            <div className={styles.typeContainer}>
              <p className={styles.hint}>Type your signature below</p>
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => handleTypedSignature(e.target.value)}
                placeholder="Enter your signature"
                className={styles.signatureInput}
              />
              {typedSignature && (
                <div className={styles.signaturePreview}>
                  <img src={signatureImage} alt="Signature preview" />
                </div>
              )}
            </div>
          )}

          {/* Upload Signature */}
          {signatureType === 'upload' && (
            <div className={styles.uploadContainer}>
              <p className={styles.hint}>Upload a signature image (PNG, JPG)</p>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadSignature}
                className={styles.fileInput}
              />
              {signatureImage && (
                <div className={styles.signaturePreview}>
                  <img src={signatureImage} alt="Signature preview" />
                </div>
              )}
            </div>
          )}

          {signatureImage && (
            <div className={styles.signatureActions}>
              <button onClick={clearSignature} className={styles.btnSecondary}>
                Clear
              </button>
              <button onClick={handlePlaceSignature} className={styles.btnPrimary} disabled={placements.length === 0 || placing}>
                {placing
                  ? 'Placing…'
                  : placements.length > 0
                  ? `Place ${placements.length} Signature${placements.length > 1 ? 's' : ''} →`
                  : 'Click document to place'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default PreviewPage;
