---
trigger: model_decision
description: Use when writing or changing any code that calls Gemini, builds prompts, or parses Gemini responses.
---

# Gemini rules

- SDK: `@google/genai`. Create the client once:
  `new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION })`
- Model name comes from `process.env.GEMINI_MODEL`. Never hardcode it.
- Always set `config.responseMimeType = "application/json"` and `config.responseSchema` matching `docs/DATA_MODEL.md`.
- Use low temperature (0.2) so results are consistent between runs.
- Send images as `inlineData` (base64 + mimeType) when the file is in memory, or `fileData` with a `gs://` URI when it is already in the bucket.
- Keep all prompt text in `src/prompts.js`, not scattered across routes.
- Photo-check prompt must tell Gemini to:
  - judge only what is visible in the photo,
  - return "flag" if the photo is blurry, too dark, or shows a different area than expected,
  - give a short, specific reason a cleaner can act on.
- Complaint-check prompt must tell Gemini to:
  - compare the complaint only against the saved photos and results,
  - return "unclear" when the photos cannot show the issue (e.g. smell, an area not photographed),
  - never accuse the client or the cleaner.
- Wrap every Gemini call in try/catch. On failure, return a friendly error to the UI and log the details on the server.
- Validate the parsed JSON (required fields, allowed enum values) before saving to Firestore.
