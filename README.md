# SignVault — Enterprise Digital Signature & Audit Platform

A full-stack e-signature platform: upload a PDF, route it through a sequential
signer pipeline, capture a real embedded digital signature, and track every
action in a cryptographically chained audit trail. Includes an enterprise
console — Dashboard, Document Sign, User Management, Audit Logs, and Role
Privileges — matching the SignVault design system.

## Quick Start

### Docker (recommended)
```bash
docker-compose up -d --build
# Frontend:     http://localhost:3000
# Backend:      http://localhost:3001
# Mongo Express: http://localhost:8081
```

### Local development
```bash
# Backend
cd backend
npm install
npm run dev      # http://localhost:3001
npm run seed     # populate demo users, role permissions, and a sample document

# Frontend (new terminal)
cd frontend
npm install
npm run dev       # http://localhost:3000
```

Both services need a MongoDB instance (`MONGODB_URI`, default
`mongodb://localhost:27017/signvault`) and AWS S3 credentials for document
storage (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`).

## Project structure

```
backend/
  src/
    db.ts               # MongoDB connection
    models/              # User, RolePermission, SignatureRecord, AuditLog
    routes/               # documents, users, roles, auditLogs, dashboard, auth
    utils/                # crypto (SHA-256), s3, pdfSign (signature embedding), audit (hash-chained logging)
    seed.ts               # demo data matching the SignVault mockups
    server.ts             # Express app assembly

frontend/
  components/            # AppShell, Sidebar, Badge (shared SignVault UI)
  lib/                   # api.ts (HTTP client), types.ts
  pages/
    dashboard.tsx        # stats, awaiting/recently-completed lists, status donut
    documents/index.tsx  # document list -> Document Sign
    sign/[documentId].tsx  # Document Sign: PDF viewer + signer pipeline
    users.tsx             # User Management
    audit-logs.tsx        # global Audit Logs (filters, CSV export)
    roles.tsx             # Role Privileges permission matrix
    upload.tsx, preview/, review/, audit/, download/  # the underlying sign workflow
```

## Signing workflow

1. **Upload** (`/upload`) — PDF is hashed (SHA-256) and stored in S3.
2. **Preview & place signature** (`/preview/[id]`) — draw, type, or upload a
   signature image and place it on a page.
3. **Review** (`/review/[id]`) — explicit approval is required before signing.
4. **Document Sign** (`/sign/[id]`) — the signer pipeline advances one signer
   at a time; signing actually embeds the signature image into the PDF
   (via `pdf-lib`) and recomputes the hash, so the signed copy is a distinct,
   verifiable artifact.
5. **Audit** (`/audit/[id]`) — the audit trail is a hash chain (each entry
   commits to the previous entry's hash), so verification recomputes the
   chain instead of trusting a stored flag.
6. **Download** (`/download/[id]`) — original and signed PDFs, with hashes.

## API overview

```
GET/POST  /api/documents[...]         document lifecycle (upload, preview, signers, decline, request-changes)
POST      /api/signatures/place       place a signature on a document
POST      /api/signatures/:id/review  approve/comment before signing
POST      /api/signatures/:id/sign    advance the next signer in the pipeline
GET       /api/documents/:id/audit-records
POST      /api/documents/:id/verify-audit
POST      /api/documents/:id/complete-audit
GET       /api/users            POST /api/users            PUT /api/users/:id
GET/PUT   /api/roles/permissions
GET       /api/audit-logs       GET /api/audit-logs/export
GET       /api/dashboard/stats
GET       /api/auth/me
```

## Notes & known simplifications

- **Auth**: there is no login screen (the design has a single fixed identity
  in the sidebar). `/api/auth/me` returns the seeded Administrator
  (Sarah Jenkins). Swap this for real session/JWT auth before exposing this
  to untrusted users.
- **Environment variables**: `backend/.env` (`MONGODB_URI`, `AWS_*`,
  `S3_BUCKET_NAME`, `FRONTEND_URL`) and `frontend/.env.local`
  (`NEXT_PUBLIC_API_URL`).

## License

MIT
