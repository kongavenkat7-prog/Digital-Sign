# DigiSign Frontend

Digital Signature Application Frontend - React + Next.js 14 + TypeScript

## Features

- ✅ PDF preview with PDF.js
- ✅ Digital signature drawing
- ✅ Multi-step workflow
- ✅ Audit trail visualization
- ✅ Hash verification display
- ✅ Responsive design
- ✅ Real-time updates

## Pages

- `index.tsx` - Dashboard/Home page
- `upload.tsx` - PDF upload page
- `preview.tsx` - PDF preview + signature drawing
- `review.tsx` - Review & approval
- `sign.tsx` - Signing progress
- `audit.tsx` - Audit trail verification
- `download.tsx` - Download signed PDFs

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Workflow

1. **Dashboard** (index.tsx) - Overview
2. **Upload** (upload.tsx) - Select PDF
3. **Preview** (preview.tsx) - View + Draw signature
4. **Review** (review.tsx) - Approve document
5. **Sign** (sign.tsx) - Execute signing
6. **Audit** (audit.tsx) - Verify trail
7. **Download** (download.tsx) - Get files

## API Integration

All API calls go through `/lib/api.ts` axios client:
- `uploadDocument()`
- `previewDocument()`
- `placeSignature()`
- `signDocument()`
- `getAuditRecords()`
- `verifyAudit()`
- `downloadSigned()`

## State Management

Uses Zustand store (`/lib/store.ts`):
```typescript
const { documents, currentDocument, addDocument } = useDigiSignStore();
```

## Styling

CSS Modules for component styling:
- `Dashboard.module.css`
- `Upload.module.css`
- `Preview.module.css`
- `Review.module.css`
- `Sign.module.css`
- `Audit.module.css`
- `Download.module.css`
- `globals.css` - Global styles

## Build

```bash
npm run build
npm start
```

## Dependencies

- **React 18** - UI framework
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Axios** - HTTP client
- **Zustand** - State management
- **React Hot Toast** - Notifications
- **PDF.js** - PDF rendering

## Backend Requirements

Backend must be running on `http://localhost:3001`

See backend setup for API details.

## Troubleshooting

### 404 on localhost:3000
- Backend not started
- Check NEXT_PUBLIC_API_URL in .env.local

### PDF preview blank
- PDF.js worker not loading
- Check CDN link in preview.tsx

### Styles not applying
```bash
rm -rf .next
npm run dev
```

### State persists across pages
Zustand state is in-memory, clears on refresh

## License

2024 DigiSign
