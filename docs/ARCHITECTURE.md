# Architecture

```
Browser
   │  (Static hosting: HTML, CSS, client JS from /public)
   ▼
Firebase Hosting (CDN edge, https://mclean-handover.web.app)
   │  (Rewrites /api/** to Cloud Run)
   ▼
Cloud Run service "mclean-handover" (Node.js 22 + Express API, region: asia-southeast1)
   ├── Vertex AI (Gemini 2.5 Flash) → area labels, photo comparison, complaint check
   ├── Cloud Storage bucket → photos (private)
   └── Firestore (Native) → collection "jobs"
```
Firebase Hosting serves static files from `/public` via global CDN and proxies `/api/**` calls directly to the Cloud Run service in `asia-southeast1`.

## Folder layout
```
mclean-handover/
├── AGENTS.md              # always-on agent rules
├── .agents/rules/         # topic rules (Gemini, frontend, GCP)
├── .firebaserc            # Firebase project configuration (mclean-handover)
├── firebase.json          # Firebase Hosting config & /api/** Cloud Run rewrites
├── docs/                  # specs — read before building
├── src/
│   ├── server.js          # Express app, routes, listens on PORT
│   ├── gemini.js          # Gemini client + labelArea() + comparePhotos()
│   ├── prompts.js         # general cleaning checklist + prompts
│   ├── schemas.js         # Gemini responseSchemas + validators
│   ├── storage.js         # save/stream photos from the bucket
│   └── db.js              # Firestore read/write for jobs & pairs
├── public/
│   ├── index.html         # technician app (hash routes #/, #/jobs, #/job/:id, #/complaints)
│   ├── report.html        # client report page (before/after comparison & AI result)
│   ├── style.css          # shared mobile-first styles
│   ├── app.js             # technician app logic
│   └── report.js          # client report logic
├── scripts/
│   └── test-gemini.js     # Day 1 one-photo Gemini test
├── test-photos/           # local only, git-ignored
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Allowed dependencies
`express`, `multer`, `@google/genai`, `@google-cloud/firestore`, `@google-cloud/storage`, `dotenv`. Dev only: `nodemon`, `firebase-tools`. Ask before adding anything else.

## API
| Method | Path | Does |
|---|---|---|
| GET | `/api/health` | Returns `{ ok: true }` |
| GET | `/api/summary` | Lightweight summary: returns `{ openJobs: number, newComplaints: number }` for the Home dashboard tabs |
| POST | `/api/jobs` | JSON `{ jobName }` → creates job with status `in_progress` |
| GET | `/api/jobs` | Query `?status=in_progress` (optional) → lists jobs (id, jobName, status, createdAt, pairs count), newest first |
| GET | `/api/jobs/:id` | Full job with all photo pairs, check results, and complaints (used by job editor and complaint detail) |
| GET | `/api/reports/:id` | Public client report view: returns job WITHOUT the complaints array |
| POST | `/api/jobs/:id/pairs` | multipart `photo` → saves before photo, runs Gemini to get `areaLabel`, adds pair |
| POST | `/api/jobs/:id/pairs/:pairId/after` | multipart `photo` → saves after photo, compares before vs after via Gemini, saves check in English |
| DELETE | `/api/jobs/:id/pairs/:pairId` | Removes an area pair before job is completed |
| POST | `/api/jobs/:id/complete` | Marks job `status: "completed"`, sets `completedAt` |
| GET | `/api/photos/:jobId/:pairId/:kind` | Streams photo (`kind` = `before` or `after`) from bucket with `Cache-Control: private, max-age=86400` |
| GET | `/api/complaints` | Lightweight list: returns `[{ jobId, jobName, complaintId, text, finding, status, createdAt }]` with no photo data, newest first |
| POST | `/api/jobs/:id/complaints` | Client complaint submission (JSON `{ text }`, max 500 chars). Evaluates complaint with Gemini against all before/after photos and check results. Allowed on completed jobs. Limit 5 complaints per job. |
| PATCH | `/api/jobs/:id/complaints/:complaintId` | Marks complaint status (e.g. `{ status: "reviewed" }`) |

## Technician App Navigation (Hash Routes)
The technician app (`/`) uses lightweight client-side hash routing for speed and browser Back button compatibility:
- `#/`: Home dashboard — two large tab buttons: "Open Jobs" (count) and "Complaints" (new count). No photos, no heavy lists.
- `#/jobs`: List of open jobs (job name, date, area count, status) with "+ New Job" action. No photos.
- `#/job/:id`: Job editor — area slots, photo uploads, Gemini comparison. Photos load on-demand only here.
- `#/complaints`: List of complaints (job name, first line, AI finding badge, status, date). No photos.
- `#/complaint/:jobId/:complaintId`: Full complaint view — text, AI finding, explanation, suggested action, related before/after photos, and "Mark as reviewed" button.
- Every page except Home includes a clear "← Back" button (minimum 44px height). All text and Gemini output in English.

## Environment variables (`.env.example`)
| Name | Example |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | `mclean-handover` |
| `GOOGLE_CLOUD_LOCATION` | `global` (Gemini endpoint; change only if the model needs a region) |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `BUCKET_NAME` | `mclean-handover-photos` |
| `PORT` | `8080` |
