# DigiSign - Digital Signature & Audit Platform

A complete full-stack web application for digital document signing with comprehensive audit trail management and AWS S3 storage.

## 🎯 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- Docker & Docker Compose (optional)
- MongoDB >= 4.0 (or use Docker)
- AWS Account with S3 access

### Option 1: Docker (Recommended)
```bash
# Start all services
docker-compose up -d

# Services will be available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# MongoDB UI: http://localhost:8081
```

### Option 2: Local Development
```bash
# Backend
cd backend
npm install
cp .env .env.local  # Edit with AWS credentials
npm run dev  # Runs on :3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev  # Runs on :3000
```

## 📁 Project Structure

```
digisign/
├── backend/
│   ├── src/
│   │   └── server.ts          # Main Express server
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   ├── .gitignore
│   └── Dockerfile
│
├── frontend/
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── index.tsx          # Dashboard
│   │   ├── upload.tsx         # Step 1
│   │   ├── preview/[documentId].tsx
│   │   ├── review/[documentId].tsx
│   │   ├── sign/[documentId].tsx
│   │   ├── audit/[documentId].tsx
│   │   └── download/[documentId].tsx
│   ├── lib/
│   │   ├── store.ts          # Zustand store
│   │   └── api.ts            # API functions
│   ├── styles/
│   │   ├── globals.css
│   │   ├── Dashboard.module.css
│   │   ├── Upload.module.css
│   │   ├── Preview.module.css
│   │   ├── Review.module.css
│   │   ├── Sign.module.css
│   │   ├── Audit.module.css
│   │   └── Download.module.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── .env.local
│   ├── .gitignore
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

## 🚀 Features

### 12-Step Workflow
1. ✅ Upload PDF → 2. Preview → 3. Create Signature → 4. Place Signature
5. Review & Confirm → 6. Sign PDF → 7. Generate Signed PDF → 8. Calculate Hash
9. Audit Records → 10. Verify Chain → 11. Complete Audit → 12. Download

### Core Features
- Digital signature drawing with canvas
- PDF preview with PDF.js
- AWS S3 secure storage (AES-256 encrypted)
- MongoDB audit trail logging
- SHA-256 integrity verification
- Complete audit chain verification
- Download original and signed PDFs
- Responsive UI with Tailwind CSS
- Real-time notifications

### Security
- 🔒 AWS S3 AES-256 encryption at rest
- 🔐 CORS and Helmet security headers
- 📊 Complete audit trail with timestamps
- ✅ SHA-256 hashing for integrity
- 🛡️ Rate limiting and input validation
- 📝 Immutable event logging

## 🛠️ API Endpoints

```
# Documents
POST   /api/documents/upload
GET    /api/documents/:id/preview
GET    /api/documents/:id/status
GET    /api/documents/:id/download-original
GET    /api/documents/:id/download-signed

# Signatures
POST   /api/signatures/place
POST   /api/signatures/:id/review
POST   /api/signatures/:id/sign

# Audit
GET    /api/documents/:id/audit-records
POST   /api/documents/:id/verify-audit
POST   /api/documents/:id/complete-audit

# Health
GET    /health
```

## 📝 Environment Variables

### Backend (.env)
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/digital-signatures
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=digital-signatures
JWT_SECRET=your_secret
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENV=development
```

## 🗄️ Database Schema

### SignatureRecord
- documentId (unique, indexed)
- fileName, userId, status
- signatureImage, signatureX, signatureY, pageNumber
- s3OriginalKey, s3SignedKey
- pdfHash, signedPdfHash (SHA-256)
- auditTrail (array of audit log IDs)
- Timestamps: createdAt, signedAt, verifiedAt

### AuditLog
- documentId (indexed), userId
- action (event type)
- timestamp (indexed)
- details (event-specific data)
- ipAddress, userAgent

## 🔄 Technology Stack

### Frontend
- React 18 + Next.js 14
- TypeScript
- Zustand (state management)
- Axios (HTTP client)
- PDF.js (PDF rendering)
- CSS Modules + Global CSS
- React Hot Toast (notifications)

### Backend
- Node.js 16+
- Express.js
- TypeScript
- MongoDB + Mongoose
- AWS SDK (S3)
- Helmet (security headers)
- Morgan (logging)

### Infrastructure
- Docker & Docker Compose
- AWS S3
- MongoDB
- Node.js runtime

## 📚 Documentation

- **README.md** - This file
- **backend/.env** - Backend configuration template
- **frontend/.env.local** - Frontend configuration template

## 🚢 Deployment

### Docker
```bash
docker-compose up -d
```

### Vercel (Frontend)
```bash
cd frontend
vercel
```

### Heroku (Backend)
```bash
cd backend
heroku create your-app
heroku config:set AWS_ACCESS_KEY_ID=...
git push heroku main
```

## 🐛 Troubleshooting

### MongoDB Connection Error
```bash
# Check if MongoDB is running
mongod --version

# Or use Docker
docker-compose up mongodb
```

### AWS S3 Access Denied
- Verify credentials in .env
- Check S3 bucket policy
- Ensure IAM user has s3:* permissions

### CORS Errors
- Update FRONTEND_URL in backend/.env
- Ensure both services can communicate

### Port Already in Use
- Change PORT in .env or docker-compose.yml
- Kill process: `lsof -i :3001` then `kill -9 <PID>`

## 📞 Support

For issues:
1. Check .env configurations
2. Review docker-compose logs: `docker-compose logs`
3. Check backend logs: `docker logs digisign-backend`
4. Check frontend logs: `docker logs digisign-frontend`

## 📄 License

MIT License

## 🎓 Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Docs](https://docs.mongodb.com/)
- [AWS S3 API](https://docs.aws.amazon.com/s3/)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)

---

**Made with ❤️ - Digital Signature Platform v1.0.0**
# Digital-Sign
A modern web-based digital singing platform, Built with React for a seamless, responsive user experience.
