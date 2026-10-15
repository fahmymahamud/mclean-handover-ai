---
trigger: model_decision
description: Use when working with Cloud Run, Firestore, Cloud Storage, IAM, gcloud commands, or deployment.
---

# Google Cloud rules

- Region for everything: `asia-southeast1`.
- Follow `docs/DEPLOY.md` for commands. Ask Fahmy before running any deploy, IAM change or delete.
- Cloud Run: the server must listen on `process.env.PORT` (default 8080).
- Use the dedicated service account `mclean-run@<PROJECT_ID>.iam.gserviceaccount.com`, not the default compute account.
- Bucket stays private. Do NOT make objects public and do NOT use signed URLs. Serve photos through a backend route (`GET /api/photos/:jobId/:area`) that streams from the bucket.
- Firestore: Native mode, collection `jobs` (schema in `docs/DATA_MODEL.md`).
- Uploads: use `multer` memory storage, max 3 files, max 5 MB each, images only (jpeg/png/webp).
- Local development uses Application Default Credentials (`gcloud auth application-default login`) and a local `.env` file.
