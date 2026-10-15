# Build Plan (13–18 Oct 2026)

Build in order. Do not start a step until the previous one's ✅ check passes.

## Day 1 — Tue 13: Setup + first Gemini call
1. Cloud setup from `docs/DEPLOY.md` sections 1–3 (Fahmy runs these).
2. `npm init`, install allowed dependencies, create folder layout from `docs/ARCHITECTURE.md`.
3. `src/server.js` with `/api/health` and static `public/`.
4. `scripts/test-gemini.js`: send one photo from `test-photos/` to Gemini with the photo-check schema, print the JSON.
5. Deploy hello-world to Cloud Run (`docs/DEPLOY.md` section 4).

✅ Live Cloud Run URL returns `{ ok: true }` AND the test script prints a valid photo-check JSON.

## Day 2 — Wed 14: Technician App & Client Report Page
1. `src/prompts.js` (general cleaning checklist, area labeling prompt, before-vs-after comparison prompt), `src/schemas.js`, `src/gemini.js` (`labelArea`, `comparePhotos`), `src/storage.js`, `src/db.js`.
2. REST API:
   - `POST /api/jobs` (create in-progress job)
   - `GET /api/jobs?status=in_progress` (list open jobs)
   - `GET /api/jobs/:id` (full job with pairs)
   - `POST /api/jobs/:id/pairs` (instant before photo upload + auto area label)
   - `POST /api/jobs/:id/pairs/:pairId/after` (after photo upload + live Gemini comparison)
   - `DELETE /api/jobs/:id/pairs/:pairId` (remove uncompleted pair)
   - `POST /api/jobs/:id/complete` (complete job)
   - `GET /api/photos/:jobId/:pairId/:kind` (stream private photos)
3. Technician UI (`public/index.html`, `public/app.js`, `public/style.css`):
   - Open jobs list & "+ New Job" creation
   - 3 default empty before-photo slots, expandable to 10
   - Instant saving upon photo capture
   - After-photo upload per spot with live comparison verdict & reason
   - "Complete job" enabled once all pairs have after-photos
   - "Share on WhatsApp" button (`wa.me` link)
4. Client Report Page (`public/report.html`, `public/report.js`):
   - Read-only before/after side-by-side comparison with AI result

✅ Verify locally with before/after test pairs + mismatched pair → valid results and working report page.

## Day 3 — Thu 15: Client flow polish & Complaint Check
1. Report page polish & mobile optimization.
2. "Report an issue" complaint box on `public/report.html`.
3. `checkComplaint()` comparing complaint against all before/after evidence → `POST /api/jobs/:id/complaints`.

✅ File a complaint and get a finding referencing what the before/after photos actually show.

## Day 4 — Fri 16: Test, tune, freeze
1. Test with real edge cases: mismatched rooms, dirty before/after, dark photos.
2. Tune prompts in `src/prompts.js` for consistency across runs.
3. Error handling: upload limits, invalid types, Gemini fallback.
4. Redeploy to Cloud Run. **Feature freeze at end of day.**

## Day 5 — Sat 17: Deck + video (see `docs/SUBMISSION.md`)
## Day 6 — Sun 18: Check every link in incognito, submit before noon.
