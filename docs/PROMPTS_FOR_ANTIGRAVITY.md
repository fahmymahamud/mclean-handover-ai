# Prompts to paste into Antigravity (one per session)

Paste one at a time. Test before moving on.

## Day 1a
Read AGENTS.md and everything in docs/. Then set up Day 1 steps 2–3 from docs/BUILD_PLAN.md only: package.json (with start and dev scripts), the folder layout, .env loading, and src/server.js with /api/health and static public/. Explain each file in plain English and tell me how to run and test it locally.

## Day 1b
Create scripts/test-gemini.js following .agents/rules/gemini-ai.md and the photo-check schema in docs/DATA_MODEL.md. It should read one image path from the command line and print the JSON result. Tell me the exact command to run.

## Day 2a
Build Day 2 step 1 from docs/BUILD_PLAN.md: storage.js, db.js, gemini.js (checkPhoto), prompts.js, schemas.js. No routes yet. Explain how each one works.

## Day 2b
Build Day 2 steps 2–3: the API routes and the Cleaner view UI. Follow .agents/rules/frontend-style.md. Then tell me how to test the full upload on my phone.

## Day 3
Build Day 3 from docs/BUILD_PLAN.md: the view dropdown, Client view, checkComplaint() and the complaints route. Explain the complaint prompt in plain English.

## Day 4
Help me test with the cases in Day 4 step 1. For each failure, show me the result, suggest a prompt change in src/prompts.js, and explain why. Then add the error handling from step 3.

## Anytime: bug
This is broken: [describe what you did and what happened, paste the error]. Find the cause, explain it in plain English, then fix only that.
