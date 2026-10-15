# Project Brief — M Clean Handover AI

## Problem
Cleaning clients sometimes say a job was not done properly. Today there is no clear proof either way, so disputes cost M Clean time, re-cleans, and trust. Furthermore, cleaners work in the field for hours, so evidence must be captured safely as work happens without risk of data loss.

## Solution
A technician-first mobile web app:
1. **Technician** creates a job (job name only). The job shows 3 empty "Before photo" slots by default, with "+ Add area" up to 10. Areas are generic.
2. **Instant Upload**: Each before photo is saved to the server immediately when taken so nothing is lost if the phone refreshes. Gemini automatically assigns a concise area label (e.g. "Toilet", "Bedroom", "Kitchen").
3. **Before & After Comparison**: After cleaning, the technician uploads an after-photo for each exact spot. Gemini compares before vs after:
   - Verifies if both photos are of the same location.
   - Evaluates if the area is `cleaned`, has an `issue_remaining`, or is `unclear`.
   - Results are shown immediately to the technician so they can fix any remaining issues before leaving.
4. **Completion & WhatsApp Share**: Once every pair has an after-photo, the technician completes the job and gets a shareable link with a "Share on WhatsApp" button (`wa.me` link).
5. **Client Report**: Read-only page at `/report.html?id=<jobId>` showing job name, completion timestamp, and each before/after pair side by side with the AI verification.

## Users (No Login)
| Role | Interface | Capabilities |
|---|---|---|
| Technician | `/` | View open jobs, create new job, upload before/after photos with instant saving, view AI check, complete job, share on WhatsApp |
| Client | `/report.html?id=<jobId>` | View completed handover report with before/after comparison and AI findings |

## General Cleaning Checklist
Standard evaluation applied across all generic areas:
- Surfaces clean, wiped, and free of visible dust, dirt, grease, and stains
- Floors swept, vacuumed, and mopped with no visible dirt or debris
- Rubbish, hair, and trash completely cleared
- Bed and furniture arranged neatly and tidy
- No cleaning tools, equipment, or personal items left behind
- *Note: Permanent fixtures, architectural elements, and property maintenance tape/stickers are ignored by AI.*

## Competition Requirements
- Theme: **Future of Work & Enterprise Productivity**
- Uses Google AI (Gemini on Vertex AI) — built with Antigravity
- Deployed on **Cloud Run** (with Firestore + Cloud Storage)
- Deliverables: working prototype URL, PDF deck, public 3-minute video, all in English
- Deadline: **Sun 18 Oct 2026** (aim to submit by noon)

## Out of Scope (Do NOT Build)
Login/roles, payments, scheduling, notifications, multiple companies, admin dashboard, editing/deleting completed jobs.

## Honest Limits (For Deck / Submission)
AI checks visible photo evidence only. It can miss things (smell, hidden areas) and a human makes the final call. Photos used in the demo were approved by M Clean and show no faces, names or addresses.
