# SignVault Frontend

React + Next.js 14 (JavaScript) frontend for SignVault.

## Setup

```bash
npm install
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/login`.

## Pages

- `login.jsx` — sign in
- `dashboard.jsx` — stats, awaiting/recently-completed lists, status donut
- `documents/index.jsx` — document list → Document Sign
- `sign/[documentId].jsx` — Document Sign: PDF viewer + signer pipeline
- `users.jsx` — User Management
- `audit-logs.jsx` — global Audit Logs (filters, CSV export)
- `roles.jsx` — Role Privileges permission matrix
- `upload.jsx`, `preview/[documentId].jsx`, `review/[documentId].jsx`,
  `audit/[documentId].jsx`, `download/[documentId].jsx` — the underlying
  upload → sign → download workflow

## Structure

- `lib/api.js` — the only place that talks to the backend (axios client with
  an interceptor that attaches the auth token and redirects to `/login` on
  401)
- `lib/auth.js` — token storage + `useRequireAuth()` guard
- `lib/constants.js` — shared constants (e.g. audit log action types)
- `components/` — `AppShell`/`Sidebar` (shared shell) and `Badge`
- `styles/` — one CSS module per page, plus `globals.css` for the SignVault
  theme tokens

## Build

```bash
npm run build
npm start
```
