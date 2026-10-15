# Cloud Setup & Deploy

Run in Cloud Shell or a terminal with `gcloud` logged in. Replace `PROJECT_ID` with your real project ID.

## 1. Project + APIs
```bash
gcloud config set project PROJECT_ID
gcloud config set run/region asia-southeast1

gcloud services enable run.googleapis.com aiplatform.googleapis.com \
  firestore.googleapis.com storage.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com
```
Also: Billing → Budgets & alerts → create a budget (e.g. $50) with email alerts.

## 2. Firestore + bucket
```bash
gcloud firestore databases create --location=asia-southeast1
gcloud storage buckets create gs://PROJECT_ID-photos \
  --location=asia-southeast1 --uniform-bucket-level-access
```
Use `PROJECT_ID-photos` as `BUCKET_NAME`.

## 3. Service account + roles
```bash
gcloud iam service-accounts create mclean-run --display-name="M Clean Cloud Run"

SA=mclean-run@PROJECT_ID.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding PROJECT_ID --member=serviceAccount:$SA --role=roles/aiplatform.user
gcloud projects add-iam-policy-binding PROJECT_ID --member=serviceAccount:$SA --role=roles/datastore.user
gcloud storage buckets add-iam-policy-binding gs://PROJECT_ID-photos \
  --member=serviceAccount:$SA --role=roles/storage.objectAdmin

# Required for deploying from source via Cloud Build
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.builder"
```

Local development login (once):
```bash
gcloud auth application-default login
```

## 4. Deploy (from the project folder)
```bash
gcloud run deploy mclean-handover \
  --source . \
  --region asia-southeast1 \
  --service-account mclean-run@PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash,BUCKET_NAME=PROJECT_ID-photos
```
`package.json` must have `"start": "node src/server.js"`.
First deploy may ask to create an Artifact Registry repo — answer yes.

## 5. If something fails
- **Permission denied on Vertex/Firestore/Storage** → check step 3 roles on `mclean-run`.
- **Model not found** → check the model name and location in Vertex AI → Model Garden.
- **Container failed to start** → server must listen on `process.env.PORT`; check logs: `gcloud run services logs read mclean-handover`.
