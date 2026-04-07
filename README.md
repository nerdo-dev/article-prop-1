# Article Prop

A Vite app for writing, previewing, and publishing proposal snapshots. Published proposals are stored in Vercel Blob and shared as public `?blob=...` links.

<!-- noop: force a fresh deployment on Vercel -->

## Local development.  

Prerequisites:
- Node.js
- A Vercel Blob store with a read/write token

Setup:
1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local`
3. Set `BLOB_READ_WRITE_TOKEN` in `.env.local`
4. Run `npm run dev`

`vite dev` also serves the local `/api/publish` and `/api/proposal` endpoints, so the full publish flow works locally.

## Deploy on Vercel

1. Import the repo into Vercel as a Vite project
2. Add `BLOB_READ_WRITE_TOKEN` to the project environment variables
3. Deploy

The production app uses:
- `POST /api/publish` to create immutable proposal snapshots
- direct Blob-backed share links so the public viewer can load proposal JSON without a second server lookup
