# M Clean Handover AI — Agent Instructions

## Always
- Start every response with "Fahmy".
- Fahmy learns hands-on. Work in small steps, one feature at a time. After each step, explain in plain English what you did and why, and tell him exactly how to test it himself.
- Do not build ahead of the current day in `docs/BUILD_PLAN.md`. Finish and test one step before starting the next.
- Ask before: deploying, deleting cloud resources, changing IAM roles, or installing new dependencies not listed in `docs/ARCHITECTURE.md`.
- If unsure about a Google Cloud API or SDK detail, check the official docs. Do not guess.

## What we are building
A web app for M Clean (a cleaning company) that proves cleaning jobs were done:
1. Technician creates a job and uploads before-photos immediately upon arrival (Gemini labels each area automatically).
2. After cleaning, technician uploads after-photos for each spot. Gemini compares before vs after: verifies same location, checks if cleaned or issues remain.
3. Once all pairs have after-photos, technician completes the job and gets a shareable client report link with a "Share on WhatsApp" button.
4. Client opens read-only report at `/report.html?id=<jobId>` showing before/after pairs side by side with AI results.

Competition entry. Theme: **Future of Work & Enterprise Productivity**. Deadline: **18 Oct 2026**.

Full details: `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/BUILD_PLAN.md`, `docs/DEPLOY.md`.

## Hard rules
- Stack is fixed: Node.js 22 + Express, plain HTML/CSS/JS (no React, no build step), Gemini via Vertex AI with `@google/genai`, Firestore, Cloud Storage, one Cloud Run service. Do not add other frameworks.
- No API keys in code or in the browser. The backend calls Vertex AI using the Cloud Run service account (locally: Application Default Credentials).
- All config comes from environment variables (see `.env.example`). Never hardcode the project ID, bucket or model name.
- No login or user accounts. Main technician app at `/` with hash routes (`#/`, `#/jobs`, `#/job/:id`, `#/complaints`, `#/complaint/:jobId/:complaintId`); client report page at `/report.html?id=<jobId>`. No Cleaner/Client dropdown.
- UI: white background, dark text, large readable fonts, mobile-friendly (cleaners use phones). Back buttons and interactive controls at least 44px tall. No dark mode.
- Gemini output must be structured JSON using `responseSchema`. Always validate it before saving. All Gemini reasons, explanations, and UI text are English only.
- The AI never "certifies" a room is clean. Wording: "photo evidence matches checklist" / "visible issue flagged". A human makes the final call.
- Never commit photos, `.env` or credentials. Real photos must not show faces, names or addresses.
- All code, comments and UI text in English.
- Before every commit or deploy, run node --check on every changed .js file, and open the page to confirm there are no console errors.
