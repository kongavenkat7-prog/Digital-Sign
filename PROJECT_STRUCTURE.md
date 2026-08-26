# SignVault Project Structure

```
signvault/
├── backend/
│   ├── src/
│   │   ├── db.ts                     # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.ts               # System users (Administrator/Manager/Signer/Viewer)
│   │   │   ├── RolePermission.ts     # Role x permission matrix
│   │   │   ├── SignatureRecord.ts    # Document + signer pipeline
│   │   │   └── AuditLog.ts           # Hash-chained audit events
│   │   ├── routes/
│   │   │   ├── documents.ts          # Upload/preview/sign/decline/audit/download
│   │   │   ├── users.ts
│   │   │   ├── roles.ts
│   │   │   ├── auditLogs.ts          # Global audit log list + CSV export
│   │   │   ├── dashboard.ts          # Aggregate stats
│   │   │   └── auth.ts               # Fixed "current user" (no login screen in the design)
│   │   ├── utils/
│   │   │   ├── crypto.ts             # SHA-256
│   │   │   ├── s3.ts                 # AWS S3 upload/download
│   │   │   ├── pdfSign.ts            # Embeds the signature image into the PDF (pdf-lib)
│   │   │   └── audit.ts              # Hash-chain audit log creation + verification
│   │   ├── seed.ts                   # Demo users/roles/document
│   │   └── server.ts                 # Express app assembly
│   ├── package.json / tsconfig.json / Dockerfile
│
├── frontend/
│   ├── components/
│   │   ├── AppShell.tsx / Sidebar.tsx   # Shared SignVault shell (nav, vault badge, user identity)
│   │   └── Badge.tsx                     # Role/status pill badges
│   ├── lib/
│   │   ├── api.ts                        # Axios client for every backend route
│   │   └── types.ts                      # Shared TS types (User, SignatureRecord, AuditLog, …)
│   ├── pages/
│   │   ├── dashboard.tsx                 # Dashboard mockup
│   │   ├── documents/index.tsx           # Document list -> Document Sign
│   │   ├── sign/[documentId].tsx         # Document Sign mockup (PDF + signer pipeline)
│   │   ├── users.tsx                     # User Management mockup
│   │   ├── audit-logs.tsx                # Audit Logs mockup
│   │   ├── roles.tsx                     # Role Privileges mockup
│   │   └── upload.tsx, preview/, review/, audit/, download/   # underlying sign workflow
│   ├── styles/                            # One CSS module per page + globals.css (SignVault theme tokens)
│   ├── package.json / tsconfig.json / next.config.js / Dockerfile
│
├── docker-compose.yml                     # mongodb + backend + frontend + mongo-express
└── README.md
```

## API surface

See `README.md` for the full endpoint list and the signing workflow diagram.
