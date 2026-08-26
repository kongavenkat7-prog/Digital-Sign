import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from './db';
import { User } from './models/User';
import { RolePermission } from './models/RolePermission';
import { SignatureRecord } from './models/SignatureRecord';
import { AuditLog } from './models/AuditLog';
import { calculateSHA256 } from './utils/crypto';

const GENESIS_HASH = '0'.repeat(64);
const chainHash = (prevHash: string, documentId: string, action: string, timestamp: Date, details: any) =>
  calculateSHA256(`${prevHash}|${documentId}|${action}|${timestamp.toISOString()}|${JSON.stringify(details)}`);

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'konga.venkat7@gmail.com').toLowerCase();

const USERS = [
  { name: 'Sarah Jenkins', email: ADMIN_EMAIL, title: 'Compliance Officer', role: 'Administrator', status: 'active' },
  { name: 'David Miller', email: 'd.miller@millerholding.com', title: 'Tenant', role: 'Manager', status: 'active' },
  { name: 'Elena Rostova', email: 'elena.r@rostova.io', title: 'Witness', role: 'Signer', status: 'active' },
  { name: 'Marcus Aurelius', email: 'marcus@rome.org', title: 'Auditor', role: 'Viewer', status: 'inactive' },
  { name: 'Sophia Martinez', email: 'sophia.m@signvault.com', title: 'Signer', role: 'Signer', status: 'active' },
];

const PERMISSIONS = [
  { key: 'create_documents', label: 'Create Documents', description: 'Allow uploading and staging new document requests.', order: 1, roles: { Administrator: true, Manager: true, Signer: false, Viewer: false } },
  { key: 'sign_documents', label: 'Sign Documents', description: 'Access the digital envelope signature pad and execute signatures.', order: 2, roles: { Administrator: true, Manager: true, Signer: true, Viewer: false } },
  { key: 'view_documents', label: 'View Documents', description: 'Search and view system-wide stored document PDF instances.', order: 3, roles: { Administrator: true, Manager: true, Signer: true, Viewer: true } },
  { key: 'manage_users', label: 'Manage Users', description: 'Create, invite, edit, or disable user profiles.', order: 4, roles: { Administrator: true, Manager: false, Signer: false, Viewer: false } },
  { key: 'view_audit_trail', label: 'View Audit Trail', description: 'Inspect detailed server verification logs, timestamps, and IP addresses.', order: 5, roles: { Administrator: true, Manager: true, Signer: false, Viewer: false } },
  { key: 'export_reports', label: 'Export Reports', description: 'Print PDF summary metrics or export CSV logging pools.', order: 6, roles: { Administrator: true, Manager: true, Signer: false, Viewer: false } },
  { key: 'delete_documents', label: 'Delete Documents', description: 'Hard-delete archived legal packages from vault storage.', order: 7, roles: { Administrator: true, Manager: false, Signer: false, Viewer: false } },
  { key: 'manage_roles', label: 'Manage Roles', description: 'Update privileges and assign matrix capabilities.', order: 8, roles: { Administrator: true, Manager: false, Signer: false, Viewer: false } },
];

async function seed() {
  await connectDB();

  await Promise.all(USERS.map((u) => User.findOneAndUpdate({ email: u.email }, u, { upsert: true, new: true })));
  await Promise.all(PERMISSIONS.map((p) => RolePermission.findOneAndUpdate({ key: p.key }, p, { upsert: true, new: true })));

  const existing = await SignatureRecord.findOne({ documentId: 'demo-lease-405' });
  if (!existing) {
    await SignatureRecord.create({
      documentId: 'demo-lease-405',
      fileName: 'Commercial Lease Agreement - Suite 405.pdf',
      fileSize: 152000,
      requestedBy: 'Sarah Jenkins',
      dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
      signers: [
        { name: 'Sarah Jenkins', roleLabel: 'Landlord', order: 0, status: 'signed', signedAt: new Date(), ipAddress: '192.168.1.45' },
        { name: 'David Miller', roleLabel: 'Tenant', order: 1, status: 'pending' },
        { name: 'Elena Rostova', roleLabel: 'Witness', order: 2, status: 'awaiting' },
      ],
      pdfHash: 'seed-placeholder-hash',
      status: 'pending',
    });

    const documentId = 'demo-lease-405';
    const documentName = 'Commercial Lease Agreement - Suite 405.pdf';
    const t1 = new Date(Date.now() - 3600_000);
    const t2 = new Date();
    const hash1 = chainHash(GENESIS_HASH, documentId, 'Document Created', t1, {});
    const hash2 = chainHash(hash1, documentId, 'Document Signed', t2, {});

    await AuditLog.create([
      { documentId, documentName, userName: 'Sarah Jenkins', action: 'Document Created', timestamp: t1, ipAddress: '192.168.1.45', details: {}, prevHash: GENESIS_HASH, hash: hash1 },
      { documentId, documentName, userName: 'Sarah Jenkins', action: 'Document Signed', timestamp: t2, ipAddress: '192.168.1.45', details: {}, prevHash: hash1, hash: hash2 },
    ]);
  }

  console.log('✅ SignVault demo data seeded');
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
