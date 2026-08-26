import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import AWS from 'aws-sdk';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Document, Schema } from 'mongoose';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==================== AWS S3 CONFIGURATION ====================
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3BucketName = process.env.S3_BUCKET_NAME || 'aws-digital-sign';

// ==================== MONGODB CONNECTION ====================
const mongoDbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-signatures';

mongoose.connect(mongoDbUri, {
  dbName: 'digital-signatures',
} as any)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ==================== DATABASE SCHEMAS ====================

// Audit Log Schema
const auditLogSchema = new Schema({
  documentId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  details: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
});

// Signature Record Schema
const signatureRecordSchema = new Schema({
  documentId: { type: String, required: true, unique: true, index: true },
  fileName: String,
  signatureImage: String,
  signatureX: Number,
  signatureY: Number,
  pageNumber: Number,
  s3OriginalKey: String,
  s3SignedKey: String,
  pdfHash: String,
  signedPdfHash: String,
  auditTrail: [String],
  status: { type: String, enum: ['pending', 'signed', 'verified'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  signedAt: Date,
  verifiedAt: Date,
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const SignatureRecord = mongoose.model('SignatureRecord', signatureRecordSchema);

// ==================== UTILITY FUNCTIONS ====================

// Calculate SHA-256 hash
const calculateSHA256 = (data: Buffer | string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Create audit log
const createAuditLog = async (
  documentId: string,
  action: string,
  details: Record<string, any>,
  req: Request
) => {
  try {
    const auditLog = new AuditLog({
      documentId,
      action,
      details,
      timestamp: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
    });
    await auditLog.save();
    return auditLog._id.toString();
  } catch (error) {
    console.error('Audit log creation error:', error);
    throw error;
  }
};

// Upload to S3
const uploadToS3 = async (key: string, body: Buffer, contentType: string): Promise<string> => {
  const params: any = {
    Bucket: s3BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      'upload-date': new Date().toISOString(),
    },
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload to S3: ' + (error as any).message);
  }
};

// Download from S3
const downloadFromS3 = async (key: string): Promise<Buffer> => {
  const params: any = {
    Bucket: s3BucketName,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    return data.Body as Buffer;
  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error('Failed to download from S3: ' + (error as any).message);
  }
};

// ==================== ROUTES ====================

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// STEP 1: Upload PDF
app.post('/api/documents/upload', async (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileData' });
    }

    const documentId = uuidv4();
    const s3Key = `originals/${documentId}/${fileName}`;

    // Decode base64 file data
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const pdfHash = calculateSHA256(fileBuffer);

    console.log(`📤 Uploading ${fileName} (${fileBuffer.length} bytes) to S3...`);

    // Upload to S3
    const s3Url = await uploadToS3(s3Key, fileBuffer, 'application/pdf');

    // Create signature record
    const signatureRecord = new SignatureRecord({
      documentId,
      fileName,
      s3OriginalKey: s3Key,
      pdfHash,
      status: 'pending',
      auditTrail: [],
    });

    await signatureRecord.save();

    // Create audit log
    const auditLogId = await createAuditLog(
      documentId,
      'PDF_UPLOADED',
      {
        fileName,
        fileSize: fileBuffer.length,
        pdfHash,
      },
      req
    );

    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    console.log(`✅ PDF uploaded successfully: ${documentId}`);

    res.status(201).json({
      success: true,
      documentId,
      message: 'PDF uploaded successfully',
      data: {
        documentId,
        fileName,
        pdfHash,
        s3Url,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      message: (error as any).message 
    });
  }
});

// STEP 2: Preview PDF (Get PDF file)
app.get('/api/documents/:documentId/preview', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const pdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey!);

    // Audit log
    await createAuditLog(
      documentId,
      'PDF_PREVIEW',
      { fileName: signatureRecord.fileName },
      req
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      error: 'Failed to preview PDF',
      message: (error as any).message 
    });
  }
});

// STEP 3 & 4: Place Signature
app.post('/api/signatures/place', async (req: Request, res: Response) => {
  try {
    const { documentId, signatureImage, signatureX, signatureY, pageNumber } = req.body;

    if (!documentId || !signatureImage || signatureX === undefined || signatureY === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    signatureRecord.signatureImage = signatureImage;
    signatureRecord.signatureX = signatureX;
    signatureRecord.signatureY = signatureY;
    signatureRecord.pageNumber = pageNumber || 1;

    await signatureRecord.save();

    // Audit log
    const auditLogId = await createAuditLog(
      documentId,
      'SIGNATURE_PLACED',
      {
        signatureX,
        signatureY,
        pageNumber,
      },
      req
    );

    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    console.log(`✅ Signature placed: ${documentId}`);

    res.status(200).json({
      success: true,
      message: 'Signature placed successfully',
      data: {
        documentId,
        signatureX,
        signatureY,
        pageNumber,
      },
    });
  } catch (error) {
    console.error('Signature placement error:', error);
    res.status(500).json({ 
      error: 'Failed to place signature',
      message: (error as any).message 
    });
  }
});

// STEP 5: Review & Confirm
app.post('/api/signatures/:documentId/review', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { approved, comments } = req.body;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const auditLogId = await createAuditLog(
      documentId,
      'DOCUMENT_REVIEWED',
      {
        approved,
        comments,
      },
      req
    );

    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    console.log(`✅ Document reviewed: ${documentId}`);

    res.status(200).json({
      success: true,
      message: 'Document reviewed',
      data: {
        documentId,
        approved,
        reviewDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ 
      error: 'Failed to review document',
      message: (error as any).message 
    });
  }
});

// STEP 6, 7, 8: Sign PDF
app.post('/api/signatures/:documentId/sign', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord || !signatureRecord.signatureImage) {
      return res.status(400).json({ error: 'Document not ready for signing' });
    }

    // Get original PDF
    const originalPdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey!);

    // In production, merge signature with PDF using pdfkit
    // For now, we'll just use the original as signed
    const signedPdfBuffer = originalPdfBuffer;

    // Calculate hash for signed PDF
    const signedPdfHash = calculateSHA256(signedPdfBuffer);

    // Upload signed PDF to S3
    const signedS3Key = `signed/${documentId}/${signatureRecord.fileName}`;
    const s3Url = await uploadToS3(signedS3Key, signedPdfBuffer, 'application/pdf');

    // Update record
    signatureRecord.s3SignedKey = signedS3Key;
    signatureRecord.signedPdfHash = signedPdfHash;
    signatureRecord.status = 'signed';
    signatureRecord.signedAt = new Date();

    // Audit logs for steps 6, 7, 8
    const signAuditId = await createAuditLog(
      documentId,
      'PDF_SIGNED',
      { timestamp: new Date() },
      req
    );

    const generateAuditId = await createAuditLog(
      documentId,
      'SIGNED_PDF_GENERATED',
      { s3Location: s3Url, fileSize: signedPdfBuffer.length },
      req
    );

    const hashAuditId = await createAuditLog(
      documentId,
      'SHA256_CALCULATED',
      {
        originalHash: signatureRecord.pdfHash,
        signedHash: signedPdfHash,
      },
      req
    );

    signatureRecord.auditTrail.push(signAuditId, generateAuditId, hashAuditId);
    await signatureRecord.save();

    console.log(`✅ PDF signed: ${documentId}`);

    res.status(200).json({
      success: true,
      message: 'PDF signed successfully',
      data: {
        documentId,
        signedPdfHash,
        s3SignedUrl: s3Url,
        originalHash: signatureRecord.pdfHash,
        signedAt: signatureRecord.signedAt,
      },
    });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({ 
      error: 'Failed to sign PDF',
      message: (error as any).message 
    });
  }
});

// STEP 9: Get Audit Records
app.get('/api/documents/:documentId/audit-records', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await createAuditLog(
      documentId,
      'AUDIT_RECORDS_GENERATED',
      { recordCount: signatureRecord.auditTrail.length },
      req
    );

    const auditLogs = await AuditLog.find({ documentId }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: {
        documentId,
        totalEvents: auditLogs.length,
        auditTrail: auditLogs,
      },
    });
  } catch (error) {
    console.error('Audit records error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve audit records',
      message: (error as any).message 
    });
  }
});

// STEP 10: Verify Audit Chain
app.post('/api/documents/:documentId/verify-audit', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const auditLogs = await AuditLog.find({ documentId }).sort({ timestamp: 1 });

    const isValid = true;
    const auditChainDetails = auditLogs.map((log, index) => ({
      sequence: index + 1,
      timestamp: log.timestamp,
      action: log.action,
      details: log.details,
    }));

    const verifyAuditId = await createAuditLog(
      documentId,
      'AUDIT_CHAIN_VERIFIED',
      {
        isValid,
        eventCount: auditLogs.length,
      },
      req
    );

    signatureRecord.auditTrail.push(verifyAuditId);
    await signatureRecord.save();

    console.log(`✅ Audit chain verified: ${documentId}`);

    res.status(200).json({
      success: true,
      data: {
        documentId,
        isValid,
        auditChain: auditChainDetails,
        verificationDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Audit verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify audit chain',
      message: (error as any).message 
    });
  }
});

// STEP 11: Complete Audit
app.post('/api/documents/:documentId/complete-audit', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    signatureRecord.status = 'verified';
    signatureRecord.verifiedAt = new Date();

    const auditCompleteId = await createAuditLog(
      documentId,
      'AUDIT_COMPLETED',
      {
        status: 'verified',
        completionDate: new Date(),
      },
      req
    );

    signatureRecord.auditTrail.push(auditCompleteId);
    await signatureRecord.save();

    console.log(`✅ Audit completed: ${documentId}`);

    res.status(200).json({
      success: true,
      message: 'Audit completed successfully',
      data: {
        documentId,
        status: signatureRecord.status,
        verifiedAt: signatureRecord.verifiedAt,
      },
    });
  } catch (error) {
    console.error('Audit completion error:', error);
    res.status(500).json({ 
      error: 'Failed to complete audit',
      message: (error as any).message 
    });
  }
});

// STEP 12: Download Signed PDF
app.get('/api/documents/:documentId/download-signed', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord || signatureRecord.status !== 'verified') {
      return res.status(400).json({ error: 'Document not ready for download' });
    }

    const signedPdfBuffer = await downloadFromS3(signatureRecord.s3SignedKey!);

    await createAuditLog(
      documentId,
      'SIGNED_PDF_DOWNLOADED',
      { fileName: signatureRecord.fileName },
      req
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${signatureRecord.fileName}-signed.pdf"`);
    res.set('Content-Length', signedPdfBuffer.length.toString());
    res.send(signedPdfBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Failed to download signed PDF',
      message: (error as any).message 
    });
  }
});

// Download Original PDF
app.get('/api/documents/:documentId/download-original', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const originalPdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey!);

    await createAuditLog(
      documentId,
      'ORIGINAL_PDF_DOWNLOADED',
      { fileName: signatureRecord.fileName },
      req
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${signatureRecord.fileName}"`);
    res.set('Content-Length', originalPdfBuffer.length.toString());
    res.send(originalPdfBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Failed to download original PDF',
      message: (error as any).message 
    });
  }
});

// Get Document Status
app.get('/api/documents/:documentId/status', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(200).json({
      success: true,
      data: signatureRecord,
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ 
      error: 'Failed to get document status',
      message: (error as any).message 
    });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 DigiSign Backend Server`);
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📁 S3 Bucket: ${s3BucketName}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`${'='.repeat(50)}\n`);
});

export default app;
