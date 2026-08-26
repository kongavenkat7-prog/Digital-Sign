# 🚀 DigiSign - Quick Start Guide

Get up and running in 5 minutes!

## Option 1: Docker (Easiest)

### Prerequisites
- Docker & Docker Compose installed

### Setup
```bash
# Navigate to project
cd digisign

# Start all services
docker-compose up -d

# Wait 30 seconds for services to initialize
sleep 30

# Open in browser
# Frontend: http://localhost:3000
# MongoDB UI: http://localhost:8081
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f backend   # Backend logs
docker-compose logs -f frontend  # Frontend logs
docker-compose logs -f mongodb   # MongoDB logs
```

---

## Option 2: Local Development

### Prerequisites
- Node.js >= 16.0.0
- MongoDB running (local or Docker)
- AWS Account (for S3)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env .env.local

# Edit .env.local and add:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - S3_BUCKET_NAME
# - MONGODB_URI

# Start backend server
npm run dev

# Server runs on http://localhost:3001
# Check health: curl http://localhost:3001/health
```

### Frontend Setup (New Terminal)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local .env.local

# Verify NEXT_PUBLIC_API_URL=http://localhost:3001

# Start frontend dev server
npm run dev

# Open browser: http://localhost:3000
```

---

## 🧪 Test the Application

### Step 1: Upload PDF
1. Navigate to http://localhost:3000
2. Click "Get Started" button
3. Upload a PDF file
4. Click "Upload PDF"

### Step 2: Preview & Sign
1. Preview your PDF
2. Click "Proceed to Sign"
3. Draw a signature
4. Click "Save Signature"

### Step 3: Place Signature
1. Click on PDF where you want signature
2. Review placement
3. Click "Confirm & Proceed"

### Step 4: Review
1. Approve the document
2. Click "Approve & Sign"

### Step 5: Complete Process
1. View signing progress
2. View audit trail
3. Download both PDFs

---

## 📋 Checklist

### Initial Setup
- [ ] Cloned/extracted repository
- [ ] Installed Node dependencies
- [ ] Configured AWS credentials
- [ ] Configured MongoDB connection

### Local Development
- [ ] Backend running on :3001
- [ ] Frontend running on :3000
- [ ] MongoDB accessible
- [ ] S3 bucket accessible

### Docker
- [ ] Docker installed
- [ ] docker-compose.yml validated
- [ ] All services healthy
- [ ] Can access all UIs

---

## 🔧 Configuration

### AWS S3 Setup
1. Create S3 bucket
2. Generate IAM user credentials
3. Add to backend .env:
   ```
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   S3_BUCKET_NAME=your_bucket
   ```

### MongoDB Setup
- **Docker**: Included in docker-compose
- **Local**: 
  ```bash
  # macOS
  brew install mongodb-community
  brew services start mongodb-community
  
  # Linux
  sudo systemctl start mongod
  
  # Windows
  # Use MongoDB installer or docker
  ```

### Environment Variables
- Backend: `backend/.env`
- Frontend: `frontend/.env.local`

---

## 🚨 Troubleshooting

### Docker Issues
```bash
# Check service status
docker-compose ps

# Restart services
docker-compose restart

# Rebuild images
docker-compose build --no-cache

# Full reset
docker-compose down -v
docker-compose up -d
```

### MongoDB Connection Error
```bash
# Check if MongoDB is running
# Docker: docker-compose logs mongodb
# Local: mongod --version

# Test connection
mongosh "mongodb://localhost:27017"
```

### Frontend Can't Connect to Backend
- Check NEXT_PUBLIC_API_URL in frontend/.env.local
- Ensure backend is running on :3001
- Check CORS settings in backend
- Try: `curl http://localhost:3001/health`

### Port Already in Use
```bash
# macOS/Linux
lsof -i :3000  # Find process
kill -9 <PID>  # Kill process

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
npm run build
```

---

## 📚 File Locations

| Item | Location |
|------|----------|
| Backend Code | `backend/src/server.ts` |
| Frontend Pages | `frontend/pages/` |
| Styles | `frontend/styles/` |
| API Client | `frontend/lib/api.ts` |
| State Store | `frontend/lib/store.ts` |
| Backend Env | `backend/.env` |
| Frontend Env | `frontend/.env.local` |

---

## 🎯 Next Steps

1. **Upload Test PDF**: Try the workflow end-to-end
2. **Check Audit Trail**: View MongoDB collections
3. **Review S3**: Confirm PDFs are stored
4. **Customize UI**: Modify colors in globals.css
5. **Add Features**: Extend API endpoints

---

## 📞 Commands Reference

```bash
# Backend
npm run dev      # Start dev server
npm run build    # Build TypeScript
npm start        # Run production build

# Frontend
npm run dev      # Start dev server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run linter

# Docker
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose logs -f    # View all logs
docker-compose ps         # Show service status
```

---

## 🎓 Learning Path

1. **Frontend**: Explore `pages/` to understand the workflow
2. **Backend**: Check `backend/src/server.ts` for API endpoints
3. **Styling**: Review CSS modules in `frontend/styles/`
4. **Database**: Examine MongoDB schemas in server.ts
5. **AWS**: Understand S3 integration in server.ts

---

## ✅ Success Indicators

- [ ] See "DigiSign" dashboard at http://localhost:3000
- [ ] Upload button is clickable
- [ ] No console errors in browser
- [ ] Backend logs show requests
- [ ] MongoDB shows collections
- [ ] S3 receives uploaded files

---

**You're ready to go! 🎉**

If you have questions, refer to README.md or check logs with:
```bash
docker-compose logs -f
```
