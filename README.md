# M Clean Handover AI

**Photo proof for every cleaning job, checked by Gemini.**

![How it works](https://github.com/fahmymahamud/mclean-handover-ai/blob/main/how-it-works.gif)

Cleaning companies and clients often disagree about whether a job was done properly, and handover photos get lost in mixed-up WhatsApp chats. Handover AI gives technicians a fast, simple phone app to prove every job:

1. **Before photo** of each area (camera or gallery). Gemini names the area automatically.
2. **After photo** of the same spot. Gemini compares before vs after and returns **Cleaned**, **Issue remaining**, or **Photos don't match**, so missed spots are fixed before the technician leaves.
3. **Complete job.** Evidence is locked, and the admin downloads a **PDF cleaning report** for the client.
4. **Client feedback.** Complaints are checked by Gemini against the photo evidence (supported / not supported / unclear) and shown only to staff. *AI flags, humans decide.*

Built for accessibility: large buttons, almost no typing, and fast on low-end phones and slow mobile data.

## Google Cloud services
| Service | What it does here |
|---|---|
| **Gemini 2.5 Flash on Vertex AI** | Labels areas, compares before/after photos, checks complaints (structured JSON output) |
| **Cloud Run** | Node.js / Express API |
| **Firestore** | Jobs, photo pairs, AI findings and complaints (with transactions) |
| **Cloud Storage** | Private photo storage |
| **Firebase Hosting** | Serves the web app and routes `/api` calls to Cloud Run |

> AI flags visible issues only. Final decision is made by M Clean staff.
