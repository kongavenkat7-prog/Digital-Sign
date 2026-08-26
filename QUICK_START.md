# SignVault — Quick Start

## Docker
```bash
docker-compose up -d --build
```
- Frontend: http://localhost:3000 (redirects to `/dashboard`)
- Backend: http://localhost:3001 (`/health` for a liveness check)
- Mongo Express: http://localhost:8081

## Local development

```bash
# Backend
cd backend
npm install
npm run dev        # http://localhost:3001
npm run seed        # demo users, role permissions, one sample document

# Frontend (new terminal)
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Configure `backend/.env`:
```
MONGODB_URI=mongodb://localhost:27017/signvault
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=signvault-documents
FRONTEND_URL=http://localhost:3000
```

And `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Try it end to end

1. Run `npm run seed` in `backend/` — this creates the demo users (Sarah
   Jenkins, David Miller, Elena Rostova, …), the role permission matrix, and
   one sample document (`Commercial Lease Agreement - Suite 405.pdf`).
2. Open the **Dashboard** — it shows the seeded stats and awaiting-signature
   list.
3. **User Management** / **Role Privileges** / **Audit Logs** are backed by
   the seeded data immediately.
4. To exercise the full signing flow: **Upload New Document** → draw/place a
   signature on **Preview** → approve on **Review** → sign it on
   **Document Sign** → verify + complete on **Audit** → **Download**.

## Troubleshooting

- **MongoDB connection error** — make sure Mongo is running
  (`docker-compose up mongodb`) and `MONGODB_URI` is correct.
- **AWS S3 errors** — the upload/sign/download endpoints require real AWS
  credentials with access to `S3_BUCKET_NAME`.
- **CORS errors** — check `FRONTEND_URL` in `backend/.env` matches where the
  frontend is actually served from.
