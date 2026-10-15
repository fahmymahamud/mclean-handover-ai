---
trigger: glob
globs: public/**
---

# Frontend rules

- Plain HTML, CSS and vanilla JS only. No frameworks, no build step.
  Files: `public/index.html`, `public/report.html`, `public/style.css`, `public/app.js`, `public/report.js`.
- White background (#FFFFFF), dark text (#16231F), one accent colour (#0F766E). No dark mode, no gradients.
- Mobile first: works at 375px wide. Buttons at least 44px tall. Base font 16px.
- Technician app (`public/index.html`):
  - Home view: "Open jobs" (in progress) list to easily resume ongoing jobs, plus a prominent "+ New Job" button.
  - Job screen: shows 3 generic before-photo slots by default, with "+ Add area" up to a maximum of 10.
  - Immediate upload: every photo is sent and saved to the server immediately upon capture (`accept="image/*" capture="environment"`) with loading indicator.
  - Each saved before photo displays its AI-detected area label (e.g. "Toilet", "Bedroom") and an "Add after photo" button.
  - After-photo upload triggers instant before-vs-after comparison with visual verdict: green "Cleaned", amber "Issue remaining", or gray "Unclear" + reason.
  - Allow retaking an after photo, or removing an area pair before the job is completed.
  - "Complete job" button is disabled until every area pair has an after photo.
  - On completion: displays client report URL with a one-click "Share on WhatsApp" button (`https://wa.me/?text=...`).
- Client report page (`public/report.html`):
  - Clean, read-only layout displaying job name, completion date/time, and each area pair with before and after photos side by side, along with the AI inspection result.
  - No login or edit controls.
- Show clear error messages in plain English. Never show raw stack traces.
- Use real `<label>` for every input. Images need `alt` text.
- Small footer line: "AI flags visible issues only. Final decision is made by M Clean staff."
