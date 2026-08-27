# SignVault Project Structure

```
signvault/
├── backend/
│   ├── src/
│   │   ├── db.js                     # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.js               # System users (Administrator/Manager/Lead/Viewer)
│   │   │   ├── RolePermission.js     # Role x permission matrix
│   │   │   ├── SignatureRecord.js    # Document + signer pipeline
│   │   │   └── AuditLog.js           # Hash-chained audit events
│   │   ├── routes/
│   │   │   ├── documents.js          # Upload/preview/sign/decline/audit/download
│   │   │   ├── users.js
│   │   │   ├── roles.js
│   │   │   ├── auditLogs.js          # Global audit log list + CSV export
│   │   │   ├── dashboard.js          # Aggregate stats
│   │   │   └── auth.js               # Fixed "current user" (no login screen in the design)
│   │   ├── utils/
│   │   │   ├── crypto.js             # SHA-256
│   │   │   ├── s3.js                 # AWS S3 upload/download
│   │   │   ├── pdfSign.js            # Embeds the signature image into the PDF (pdf-lib)
│   │   │   └── audit.js              # Hash-chain audit log creation + verification
│   │   ├── seed.js                   # Demo users/roles/document
│   │   └── server.js                 # Express app assembly
│   ├── package.json / Dockerfile
│
├── frontend/
│   ├── components/
│   │   ├── AppShell.jsx / Sidebar.jsx   # Shared SignVault shell (nav, vault badge, user identity)
│   │   └── Badge.jsx                     # Role/status pill badges
│   ├── lib/
│   │   ├── api.js                        # Axios client for every backend route
│   │   └── constants.js                  # Shared runtime constants (audit action types)
│   ├── pages/
│   │   ├── dashboard.jsx                 # Dashboard mockup
│   │   ├── documents/index.jsx           # Document list -> Document Sign
│   │   ├── sign/[documentId].jsx         # Document Sign mockup (PDF + signer pipeline)
│   │   ├── users.jsx                     # User Management mockup
│   │   ├── audit-logs.jsx                # Audit Logs mockup
│   │   ├── roles.jsx                     # Role Privileges mockup
│   │   └── upload.jsx, preview/, review/, audit/, download/   # underlying sign workflow
│   ├── styles/                            # One CSS module per page + globals.css (SignVault theme tokens)
│   ├── package.json / jsconfig.json / next.config.js / Dockerfile
│
├── docker-compose.yml                     # mongodb + backend + frontend + mongo-express
└── README.md
```

## API surface

See `README.md` for the full endpoint list and the signing workflow diagram.
