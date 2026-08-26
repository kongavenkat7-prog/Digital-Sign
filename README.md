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
    db.js               # MongoDB connection
    models/              # User, RolePermission, SignatureRecord, AuditLog
    routes/               # documents, users, roles, auditLogs, dashboard, auth
    utils/                # crypto (SHA-256), s3, pdfSign (signature embedding), audit (hash-chained logging)
    seed.js               # demo data matching the SignVault mockups
    server.js             # Express app assembly

frontend/
  components/            # AppShell, Sidebar, Badge (shared SignVault UI)
  lib/                   # api.js (HTTP client), types.js
  pages/
    dashboard.jsx        # stats, awaiting/recently-completed lists, status donut
    documents/index.jsx  # document list -> Document Sign
    sign/[documentId].jsx  # Document Sign: PDF viewer + signer pipeline
    users.jsx             # User Management
    audit-logs.jsx        # global Audit Logs (filters, CSV export)
    roles.jsx             # Role Privileges permission matrix
    upload.jsx, preview/, review/, audit/, download/  # the underlying sign workflow
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
POST      /api/auth/login   GET /api/auth/me
```

## Login

SignVault is single-account gated rather than open registration. Every
`/api/*` route except `/api/auth/login` (and `/health`) requires a Bearer
token issued by that login.

- **Email**: `konga.venkat7@gmail.com`
- **Password**: `Venkat@123`

Override these via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`. The
token is a JWT signed with `JWT_SECRET` (12h expiry); the frontend stores it
in `localStorage` and attaches it to every request, redirecting to `/login`
on a 401.

## Notes & known simplifications

- **Single account, not multi-user auth**: there's one gated login (above)
  rather than per-user passwords — the design has a single fixed identity in
  the sidebar. `/api/auth/me` returns the seeded Administrator (Sarah
  Jenkins). Extend `routes/auth.js` before treating other seeded Users as
  real, independently-authenticated accounts.
- **Environment variables**: `backend/.env` (`MONGODB_URI`, `AWS_*`,
  `S3_BUCKET_NAME`, `FRONTEND_URL`, `JWT_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`) and `frontend/.env.local` (`NEXT_PUBLIC_API_URL`).

## License

MIT
