// public/report.js
// Client Cleaning Report page logic (read-only handover verification).

document.addEventListener('DOMContentLoaded', () => {
  initPdfDownload();
  loadCleaningReport();
});

async function loadCleaningReport() {
  const loadingEl = document.getElementById('reportLoading');
  const errorEl = document.getElementById('reportError');
  const contentEl = document.getElementById('reportContent');

  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('id');

  if (!jobId) {
    loadingEl.style.display = 'none';
    errorEl.textContent = 'No job ID provided in link. Please check the URL.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('Cleaning report not found. It may have expired or been removed.');
      throw new Error('Failed to load report from server.');
    }

    const job = await res.json();
    renderReport(job);

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  } catch (err) {
    console.error('Error loading report:', err);
    loadingEl.style.display = 'none';
    errorEl.textContent = err.message || 'Could not display cleaning report.';
    errorEl.style.display = 'block';
  }
}

function renderReport(job) {
  document.getElementById('reportJobName').textContent = job.jobName || 'Cleaning Job';
  document.getElementById('reportJobId').textContent = job.id;

  const dateStr = job.completedAt
    ? new Date(job.completedAt).toLocaleString()
    : job.createdAt
    ? new Date(job.createdAt).toLocaleString()
    : 'Recently';
  document.getElementById('reportCompletedAt').textContent = dateStr;

  const badge = document.getElementById('reportStatusBadge');
  if (job.status === 'completed') {
    badge.className = 'status-badge status-completed';
    badge.textContent = 'Completed';
  } else {
    badge.className = 'status-badge status-in-progress';
    badge.textContent = 'In Progress';
  }

  const grid = document.getElementById('reportPairsGrid');
  grid.innerHTML = '';

  const pairs = job.pairs || [];
  if (pairs.length === 0) {
    grid.innerHTML = `<p class="text-muted">No area photos recorded for this job.</p>`;
    return;
  }

  pairs.forEach((pair, idx) => {
    const card = document.createElement('div');
    card.className = 'pair-card';

    const check = pair.check || {};
    const verdictClass = check.result || 'unclear';
    const verdictLabel =
      check.result === 'cleaned'
        ? 'Cleaned'
        : check.result === 'issue_remaining'
        ? 'Issue Remaining'
        : 'Unclear';

    const beforeUrl = `/api/photos/${encodeURIComponent(job.id)}/${encodeURIComponent(pair.id)}/before`;
    const afterUrl = pair.after
      ? `/api/photos/${encodeURIComponent(job.id)}/${encodeURIComponent(pair.id)}/after`
      : '';

    card.innerHTML = `
      <div class="pair-card-header">
        <span class="pair-area-title">${escapeHtml(pair.areaLabel || `Area ${idx + 1}`)}</span>
      </div>

      <div class="photos-comparison-row">
        <div class="photo-cell">
          <span class="photo-cell-label">Before Cleaning</span>
          <img class="photo-display-img" src="${beforeUrl}" alt="${escapeHtml(pair.areaLabel)} Before" loading="lazy" />
          <span class="photo-source-tag">${pair.before && pair.before.source === 'gallery' ? 'From gallery' : 'Taken in app'}</span>
        </div>

        <div class="photo-cell">
          <span class="photo-cell-label">After Cleaning</span>
          ${
            afterUrl
              ? `
                <img class="photo-display-img" src="${afterUrl}" alt="${escapeHtml(pair.areaLabel)} After" loading="lazy" />
                <span class="photo-source-tag">${pair.after && pair.after.source === 'gallery' ? 'From gallery' : 'Taken in app'}</span>
              `
              : `<div class="empty-after-cell"><p class="text-muted">No after photo provided</p></div>`
          }
        </div>
      </div>

      ${
        check.result
          ? `
            <div class="ai-result-box ${verdictClass}">
              <span class="verdict-tag ${verdictClass}">${escapeHtml(verdictLabel)}</span>
              <div class="ai-reason-text"><strong>AI Verification:</strong> ${escapeHtml(check.reason || '')}</div>
            </div>
          `
          : ''
      }
    `;

    grid.appendChild(card);
  });

  initComplaintForm(job);
}

function initComplaintForm(job) {
  const form = document.getElementById('reportIssueForm');
  const textarea = document.getElementById('complaintTextInput');
  const charCount = document.getElementById('charCountLabel');
  const errorEl = document.getElementById('complaintFormError');
  const successBox = document.getElementById('complaintSuccessBox');
  const submitBtn = document.getElementById('submitComplaintBtn');

  if (!form || !textarea) return;

  // Check if limit is reached (either from complaintCount or complaints array if present)
  const count = typeof job.complaintCount === 'number' ? job.complaintCount : (job.complaints || []).length;
  if (count >= 5) {
    form.style.display = 'none';
    successBox.style.display = 'block';
    successBox.innerHTML = `
      <h4>Issue Reports Received</h4>
      <p>The maximum number of reports (5) has been submitted for this job. M Clean staff has received your feedback and will contact you directly.</p>
    `;
    return;
  }

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = `${len} / 500 characters`;
    if (len >= 500) {
      charCount.style.color = 'var(--error)';
    } else {
      charCount.style.color = 'var(--text-muted)';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) {
      errorEl.textContent = 'Please provide details about the issue.';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting report…';

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit issue report.');
      }

      // Hide the form and show the client-facing confirmation
      form.style.display = 'none';
      successBox.style.display = 'block';
    } catch (err) {
      console.error('Error submitting complaint:', err);
      errorEl.textContent = err.message || 'Failed to submit report. Please try again.';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Report';
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function initPdfDownload() {
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', async () => {
    const originalText = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Preparing PDF…';

    try {
      const images = Array.from(document.querySelectorAll('img.photo-display-img'));
      // Ensure all images are switched from lazy to eager
      images.forEach((img) => {
        img.loading = 'eager';
      });

      // Wait until every image has finished loading
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      );

      // Trigger browser print
      window.print();
    } catch (err) {
      console.error('Error preparing print PDF:', err);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalText;
    }
  });
}

