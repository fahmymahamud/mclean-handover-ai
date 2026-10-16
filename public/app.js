// public/app.js
// Technician application logic with lightweight hash routing.
// All UI text and Gemini reasons are in English.

let currentJob = null;
let desiredSlotCount = 3;
let jobsNoticeMessage = null;

document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  initRouter();
  initNewJobForm();
  initCompletionControls();
  initDeleteJobControls();
});

// -------------------------------------------------------------
// 1. Hash Router
// -------------------------------------------------------------
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  const views = [
    'viewHome',
    'viewJobs',
    'viewJobDetail',
    'viewComplaints',
    'viewComplaintDetail',
  ];
  views.forEach((v) => {
    const el = document.getElementById(v);
    if (el) el.style.display = 'none';
  });

  // Reset top scroll
  window.scrollTo(0, 0);

  if (hash === '#/' || hash === '#' || hash === '') {
    showView('viewHome');
    loadHomeSummary();
  } else if (hash === '#/jobs') {
    showView('viewJobs');
    loadOpenJobs();
  } else if (hash.startsWith('#/job/')) {
    const jobId = hash.replace('#/job/', '').trim();
    if (jobId) {
      showView('viewJobDetail');
      loadJobDetail(jobId);
    } else {
      window.location.hash = '#/jobs';
    }
  } else if (hash === '#/complaints') {
    showView('viewComplaints');
    loadComplaintsList();
  } else if (hash.startsWith('#/complaint/')) {
    const parts = hash.replace('#/complaint/', '').split('/');
    const jobId = parts[0];
    const complaintId = parts[1];
    if (jobId && complaintId) {
      showView('viewComplaintDetail');
      loadComplaintDetail(jobId, complaintId);
    } else {
      window.location.hash = '#/complaints';
    }
  } else {
    window.location.hash = '#/';
  }
}

function showView(viewId) {
  const el = document.getElementById(viewId);
  if (el) el.style.display = 'flex';
}

// -------------------------------------------------------------
// 1.1 Header Date
// -------------------------------------------------------------
function updateHeaderDate() {
  const dateEl = document.getElementById('headerDate');
  if (!dateEl) return;
  const now = new Date();
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  dateEl.textContent = now.toLocaleDateString('en-GB', options);
}

// -------------------------------------------------------------
// 2. Home Dashboard (#/)
// -------------------------------------------------------------
async function loadHomeSummary() {
  const openCountEl = document.getElementById('homeOpenJobsCount');
  const newComplaintsCountEl = document.getElementById('homeNewComplaintsCount');

  try {
    const startTime = performance.now();
    const res = await fetch('/api/summary');
    if (!res.ok) throw new Error('Failed to load summary');
    const data = await res.json();
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[Home] Summary counts loaded in ${elapsed}ms:`, data);

    if (openCountEl) openCountEl.textContent = data.openJobs ?? 0;
    if (newComplaintsCountEl) newComplaintsCountEl.textContent = data.newComplaints ?? 0;
  } catch (err) {
    console.error('Error loading summary counts:', err);
    if (openCountEl) openCountEl.textContent = '—';
    if (newComplaintsCountEl) newComplaintsCountEl.textContent = '—';
  }
}

// -------------------------------------------------------------
// 3. Open Jobs List (#/jobs)
// -------------------------------------------------------------
function initNewJobForm() {
  const openModalBtn = document.getElementById('openNewJobModalBtn');
  const homeNewJobBtn = document.getElementById('homeNewJobBtn');
  const newJobCard = document.getElementById('newJobCard');
  const cancelBtn = document.getElementById('cancelNewJobBtn');
  const form = document.getElementById('createJobForm');
  const nameInput = document.getElementById('newJobName');

  function openCreateForm() {
    newJobCard.style.display = 'block';
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
  }

  if (openModalBtn && newJobCard) {
    openModalBtn.addEventListener('click', openCreateForm);
  }

  if (homeNewJobBtn && newJobCard) {
    homeNewJobBtn.addEventListener('click', () => {
      window.location.hash = '#/jobs';
      setTimeout(() => {
        openCreateForm();
      }, 50);
    });
  }

  if (cancelBtn && newJobCard) {
    cancelBtn.addEventListener('click', () => {
      newJobCard.style.display = 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const jobName = (nameInput.value || '').trim();
      if (!jobName) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating…';
      }

      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobName }),
        });
        if (!res.ok) throw new Error('Failed to create job');
        const created = await res.json();
        newJobCard.style.display = 'none';
        window.location.hash = `#/job/${created.id}`;
      } catch (err) {
        console.error('Error creating job:', err);
        alert('Could not create job. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Start Job';
        }
      }
    });
  }
}

async function loadOpenJobs() {
  const noticeEl = document.getElementById('jobsNoticeBanner');
  if (noticeEl) {
    if (jobsNoticeMessage) {
      noticeEl.textContent = jobsNoticeMessage;
      noticeEl.style.display = 'block';
      jobsNoticeMessage = null;
    } else {
      noticeEl.style.display = 'none';
    }
  }

  const listEl = document.getElementById('openJobsList');
  if (!listEl) return;
  listEl.innerHTML = '<p class="loading-text">Loading active jobs…</p>';

  try {
    const res = await fetch('/api/jobs?status=in_progress');
    if (!res.ok) throw new Error('Failed to fetch open jobs');
    const jobs = await res.json();

    if (!jobs || jobs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-slot-box">
          <p>No open jobs right now.</p>
          <p class="text-muted">Click <strong>+ New Job</strong> above to start a handover.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    jobs.forEach((job) => {
      const card = document.createElement('div');
      card.className = 'job-item-card';
      const createdDate = job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '';
      const areaCount = typeof job.pairsCount === 'number' ? job.pairsCount : (job.pairs || []).length;

      card.innerHTML = `
        <div>
          <div class="job-item-name">${escapeHtml(job.jobName || 'Cleaning Job')}</div>
          <div class="job-item-sub">Started ${createdDate} • ${areaCount} area(s)</div>
        </div>
        <span class="status-badge status-in-progress">In Progress</span>
      `;
      card.addEventListener('click', () => {
        window.location.hash = `#/job/${job.id}`;
      });
      listEl.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading open jobs:', err);
    listEl.innerHTML = `<p class="error-banner">Could not load open jobs.</p>`;
  }
}

// -------------------------------------------------------------
// 4. Job Detail & Photo Pairs Editor (#/job/:id)
// -------------------------------------------------------------
async function loadJobDetail(jobId) {
  const titleEl = document.getElementById('activeJobTitle');
  const metaEl = document.getElementById('activeJobMeta');
  const badgeEl = document.getElementById('jobStatusBadge');
  const container = document.getElementById('pairsContainer');
  const warningBanner = document.getElementById('jobWarningBanner');
  const errorBanner = document.getElementById('jobErrorBanner');

  if (titleEl) titleEl.textContent = 'Loading job…';
  if (metaEl) metaEl.textContent = '';
  if (warningBanner) warningBanner.style.display = 'none';
  if (errorBanner) errorBanner.style.display = 'none';
  if (container) container.innerHTML = '<p class="loading-text">Loading area evidence…</p>';

  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('Job not found.');
      throw new Error('Failed to load job detail.');
    }
    const job = await res.json();
    currentJob = job;
    renderJobDetail(job);
  } catch (err) {
    console.error('Error loading job detail:', err);
    if (errorBanner) {
      errorBanner.textContent = err.message || 'Failed to load job details.';
      errorBanner.style.display = 'block';
    }
    if (container) container.innerHTML = '';
  }
}

function renderJobDetail(job) {
  const titleEl = document.getElementById('activeJobTitle');
  const metaEl = document.getElementById('activeJobMeta');
  const badgeEl = document.getElementById('jobStatusBadge');
  const pairsContainer = document.getElementById('pairsContainer');
  const addAreaBtn = document.getElementById('addAreaBtn');
  const areaCountLabel = document.getElementById('areaCountLabel');
  const completePrompt = document.getElementById('completeJobPrompt');
  const completedSuccessBox = document.getElementById('completedSuccessBox');
  const warningConfirmBox = document.getElementById('issuesWarningConfirm');

  if (titleEl) titleEl.textContent = job.jobName || 'Cleaning Job';

  const isCompleted = job.status === 'completed';
  if (badgeEl) {
    badgeEl.className = isCompleted ? 'status-badge status-completed' : 'status-badge status-in-progress';
    badgeEl.textContent = isCompleted ? 'Completed (Locked)' : 'In Progress';
  }

  const createdStr = job.createdAt ? new Date(job.createdAt).toLocaleString() : '';
  const completedStr = job.completedAt ? new Date(job.completedAt).toLocaleString() : '';
  if (metaEl) {
    metaEl.textContent = isCompleted
      ? `Completed on ${completedStr} • Job ID: ${job.id}`
      : `Started on ${createdStr} • Job ID: ${job.id}`;
  }

  const pairs = job.pairs || [];
  desiredSlotCount = Math.max(3, pairs.length);
  if (areaCountLabel) areaCountLabel.textContent = pairs.length;

  // Add Area button disabled/hidden if completed or reached 10
  if (addAreaBtn) {
    if (isCompleted || pairs.length >= 10 || desiredSlotCount >= 10) {
      addAreaBtn.disabled = true;
      addAreaBtn.style.display = isCompleted ? 'none' : 'inline-flex';
    } else {
      addAreaBtn.disabled = false;
      addAreaBtn.style.display = 'inline-flex';
    }
  }

  // Completion controls
  if (warningConfirmBox) warningConfirmBox.style.display = 'none';

  if (isCompleted) {
    if (completePrompt) completePrompt.style.display = 'none';
    if (completedSuccessBox) {
      completedSuccessBox.style.display = 'block';
      setupCompletedLinks(job);
    }
  } else {
    if (completePrompt) completePrompt.style.display = 'block';
    if (completedSuccessBox) completedSuccessBox.style.display = 'none';
    updateCompleteButtonState(job);
  }

  // Delete job section (only allowed on active jobs)
  const deleteSection = document.getElementById('deleteJobSection');
  const deleteConfirmBox = document.getElementById('deleteJobConfirmBox');
  if (deleteConfirmBox) deleteConfirmBox.style.display = 'none';
  if (deleteSection) {
    deleteSection.style.display = isCompleted ? 'none' : 'block';
  }

  renderPairs(job, pairsContainer, isCompleted);
}

function renderPairs(job, container, isCompleted) {
  if (!container) return;
  container.innerHTML = '';

  const pairs = job.pairs || [];
  const totalSlotsToRender = isCompleted ? pairs.length : Math.max(pairs.length, desiredSlotCount);

  for (let i = 0; i < totalSlotsToRender; i++) {
    const pair = pairs[i];
    const slotCard = document.createElement('div');
    slotCard.className = 'pair-card';

    if (pair) {
      // Populated pair
      const check = pair.check || {};
      const verdictClass = check.result || '';
      const verdictLabel =
        check.result === 'cleaned'
          ? 'Cleaned'
          : check.result === 'issue_remaining'
          ? 'Issue Remaining'
          : check.result === 'unclear'
          ? 'Unclear'
          : '';

      const beforeUrl = `/api/photos/${encodeURIComponent(job.id)}/${encodeURIComponent(pair.id)}/before`;
      const afterUrl = pair.after
        ? `/api/photos/${encodeURIComponent(job.id)}/${encodeURIComponent(pair.id)}/after`
        : '';

      slotCard.innerHTML = `
        <div class="pair-card-header">
          <span class="pair-area-title">${escapeHtml(pair.areaLabel || `Area ${i + 1}`)}</span>
          ${
            !isCompleted
              ? `<button type="button" class="link-btn danger-btn delete-pair-btn" data-pair-id="${escapeHtml(pair.id)}">Remove</button>`
              : ''
          }
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
                  ${
                    !isCompleted
                      ? `
                        <div class="photo-capture-actions" style="margin-top: 0.5rem;">
                          <label class="secondary-btn sm-btn file-capture-btn">
                            Take photo
                            <input type="file" accept="image/*" capture="environment" class="after-photo-input" data-pair-id="${escapeHtml(pair.id)}" data-source="camera" style="display: none;" />
                          </label>
                          <label class="secondary-btn sm-btn file-capture-btn">
                            From gallery
                            <input type="file" accept="image/*" class="after-photo-input" data-pair-id="${escapeHtml(pair.id)}" data-source="gallery" style="display: none;" />
                          </label>
                        </div>
                      `
                      : ''
                  }
                `
                : !isCompleted
                ? `
                  <div class="empty-after-cell">
                    <p class="text-muted" style="margin-bottom: 0.75rem; font-size: 0.9rem;">Cleaning finished? Take after photo.</p>
                    <div class="photo-capture-actions">
                      <label class="primary-btn sm-btn file-capture-btn">
                        Take photo
                        <input type="file" accept="image/*" capture="environment" class="after-photo-input" data-pair-id="${escapeHtml(pair.id)}" data-source="camera" style="display: none;" />
                      </label>
                      <label class="secondary-btn sm-btn file-capture-btn">
                        From gallery
                        <input type="file" accept="image/*" class="after-photo-input" data-pair-id="${escapeHtml(pair.id)}" data-source="gallery" style="display: none;" />
                      </label>
                    </div>
                  </div>
                `
                : `<div class="empty-after-cell"><p class="text-muted">No after photo uploaded</p></div>`
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
    } else {
      // Empty before slot (only when in progress)
      slotCard.innerHTML = `
        <div class="pair-card-header">
          <span class="pair-area-title">Area ${i + 1}</span>
          <span class="text-muted" style="font-size: 0.85rem;">Not started</span>
        </div>
        <div class="empty-slot-box">
          <p>Capture initial condition before cleaning starts.</p>
          <div class="photo-capture-actions">
            <label class="primary-btn sm-btn file-capture-btn">
              Take photo
              <input type="file" accept="image/*" capture="environment" class="before-photo-input" data-slot-index="${i}" data-source="camera" style="display: none;" />
            </label>
            <label class="secondary-btn sm-btn file-capture-btn">
              From gallery
              <input type="file" accept="image/*" class="before-photo-input" data-slot-index="${i}" data-source="gallery" style="display: none;" />
            </label>
          </div>
        </div>
      `;
    }

    container.appendChild(slotCard);
  }

  attachPairEvents(container, job);
}

function attachPairEvents(container, job) {
  // Before photo upload handler
  const beforeInputs = container.querySelectorAll('.before-photo-input');
  beforeInputs.forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const parentBox = input.closest('.empty-slot-box');
      if (parentBox) {
        parentBox.innerHTML = '<p class="loading-text">Resizing & saving to cloud…</p>';
      }

      try {
        const resized = await resizePhoto(file);
        const source = input.dataset.source || 'camera';
        const formData = new FormData();
        formData.append('photo', resized);
        formData.append('source', source);

        const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/pairs`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to upload before photo');
        }

        await loadJobDetail(job.id);
      } catch (err) {
        console.error('Error uploading before photo:', err);
        alert(err.message || 'Upload failed. Please try again.');
        await loadJobDetail(job.id);
      }
    });
  });

  // After photo upload handler
  const afterInputs = container.querySelectorAll('.after-photo-input');
  afterInputs.forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const pairId = input.dataset.pairId;
      if (!pairId) return;

      const photoCell = input.closest('.photo-cell');
      if (photoCell) {
        photoCell.innerHTML = '<p class="loading-text" style="padding: 2rem 0; text-align: center;">Comparing with Gemini…</p>';
      }

      try {
        const resized = await resizePhoto(file);
        const source = input.dataset.source || 'camera';
        const formData = new FormData();
        formData.append('photo', resized);
        formData.append('source', source);

        const res = await fetch(
          `/api/jobs/${encodeURIComponent(job.id)}/pairs/${encodeURIComponent(pairId)}/after`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to analyze after photo');
        }

        await loadJobDetail(job.id);
      } catch (err) {
        console.error('Error uploading after photo:', err);
        alert(err.message || 'Comparison failed. Please try again.');
        await loadJobDetail(job.id);
      }
    });
  });

  // Remove pair handler
  const deleteBtns = container.querySelectorAll('.delete-pair-btn');
  deleteBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pairId = btn.dataset.pairId;
      if (!pairId) return;

      if (!confirm('Are you sure you want to remove this area?')) return;

      try {
        const res = await fetch(
          `/api/jobs/${encodeURIComponent(job.id)}/pairs/${encodeURIComponent(pairId)}`,
          { method: 'DELETE' }
        );
        if (!res.ok) throw new Error('Failed to delete area pair');
        await loadJobDetail(job.id);
      } catch (err) {
        console.error('Error deleting area:', err);
        alert('Could not remove area. Please try again.');
      }
    });
  });
}

// -------------------------------------------------------------
// 5. Completion Controls & WhatsApp Sharing
// -------------------------------------------------------------
function initCompletionControls() {
  const addAreaBtn = document.getElementById('addAreaBtn');
  if (addAreaBtn) {
    addAreaBtn.addEventListener('click', () => {
      if (desiredSlotCount < 10) {
        desiredSlotCount++;
        if (currentJob) {
          renderPairs(currentJob, document.getElementById('pairsContainer'), currentJob.status === 'completed');
          if (desiredSlotCount >= 10) {
            addAreaBtn.disabled = true;
          }
        }
      }
    });
  }

  const completeBtn = document.getElementById('completeJobBtn');
  const confirmCompleteBtn = document.getElementById('confirmCompleteBtn');
  const cancelCompleteBtn = document.getElementById('cancelCompleteBtn');
  const warningConfirmBox = document.getElementById('issuesWarningConfirm');
  const warningText = document.getElementById('issuesWarningText');

  if (completeBtn) {
    completeBtn.addEventListener('click', () => {
      if (!currentJob) return;
      const pairs = currentJob.pairs || [];
      const issues = pairs.filter(
        (p) => p.check && (p.check.result === 'issue_remaining' || p.check.result === 'unclear')
      );

      if (issues.length > 0) {
        if (warningConfirmBox && warningText) {
          warningText.textContent = `⚠️ ${issues.length} area(s) still have issues flagged by AI – complete anyway?`;
          warningConfirmBox.style.display = 'block';
          warningConfirmBox.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        executeJobCompletion(currentJob.id);
      }
    });
  }

  if (confirmCompleteBtn) {
    confirmCompleteBtn.addEventListener('click', () => {
      if (!currentJob) return;
      executeJobCompletion(currentJob.id);
    });
  }

  if (cancelCompleteBtn) {
    cancelCompleteBtn.addEventListener('click', () => {
      if (warningConfirmBox) warningConfirmBox.style.display = 'none';
    });
  }
}

function updateCompleteButtonState(job) {
  const completeBtn = document.getElementById('completeJobBtn');
  const helperText = document.getElementById('completeHelperText');
  if (!completeBtn || !helperText) return;

  const pairs = job.pairs || [];
  if (pairs.length === 0) {
    completeBtn.disabled = true;
    helperText.textContent = 'Upload at least one before/after area photo to complete.';
    return;
  }

  const missingAfter = pairs.filter((p) => !p.after);
  if (missingAfter.length > 0) {
    completeBtn.disabled = true;
    helperText.textContent = `${missingAfter.length} area(s) still need an after photo before completing.`;
  } else {
    completeBtn.disabled = false;
    helperText.textContent = 'All areas have after photos. Ready to complete handover!';
  }
}

async function executeJobCompletion(jobId) {
  const completeBtn = document.getElementById('completeJobBtn');
  const confirmBtn = document.getElementById('confirmCompleteBtn');
  if (completeBtn) completeBtn.disabled = true;
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/complete`, {
      method: 'POST',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to complete job');
    }
    await loadJobDetail(jobId);
  } catch (err) {
    console.error('Error completing job:', err);
    alert(err.message || 'Could not complete job. Please try again.');
    if (completeBtn) completeBtn.disabled = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function setupCompletedLinks(job) {
  const reportUrl = `${window.location.origin}/report.html?id=${encodeURIComponent(job.id)}`;
  const waBtn = document.getElementById('whatsappShareBtn');
  const viewReportBtn = document.getElementById('viewReportBtn');
  const openReportLink = document.getElementById('openReportLink');

  if (viewReportBtn) {
    viewReportBtn.href = reportUrl;
  }

  if (openReportLink) {
    openReportLink.href = reportUrl;
  }

  if (waBtn) {
    const message = `Hello! Your cleaning handover report for ${job.jobName || 'your unit'} is ready: ${reportUrl}`;
    waBtn.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
}

function initDeleteJobControls() {
  const deleteBtn = document.getElementById('deleteJobBtn');
  const confirmBox = document.getElementById('deleteJobConfirmBox');
  const confirmBtn = document.getElementById('confirmDeleteJobBtn');
  const cancelBtn = document.getElementById('cancelDeleteJobBtn');

  if (deleteBtn && confirmBox) {
    deleteBtn.addEventListener('click', () => {
      confirmBox.style.display = 'block';
      confirmBox.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (cancelBtn && confirmBox) {
    cancelBtn.addEventListener('click', () => {
      confirmBox.style.display = 'none';
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!currentJob) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting…';

      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(currentJob.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to delete job');
        }

        jobsNoticeMessage = 'Job deleted';
        window.location.hash = '#/jobs';
      } catch (err) {
        console.error('Error deleting job:', err);
        alert(err.message || 'Could not delete job.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
      }
    });
  }
}

// -------------------------------------------------------------
// 6. Complaints List View (#/complaints)
// -------------------------------------------------------------
async function loadComplaintsList() {
  const container = document.getElementById('complaintsListContainer');
  if (!container) return;
  container.innerHTML = '<p class="loading-text">Loading complaints…</p>';

  try {
    const res = await fetch('/api/complaints');
    if (!res.ok) throw new Error('Failed to load complaints');
    const complaints = await res.json();

    if (!complaints || complaints.length === 0) {
      container.innerHTML = `
        <div class="empty-slot-box">
          <p>No client complaints recorded. All good!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    complaints.forEach((c) => {
      const card = document.createElement('a');
      card.className = 'complaint-card-link';
      card.href = `#/complaint/${encodeURIComponent(c.jobId)}/${encodeURIComponent(c.complaintId)}`;

      const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
      const firstLine = (c.text || '').split('\n')[0] || '(No text provided)';

      let findingBadgeClass = 'badge-unclear';
      let findingText = 'Unclear';
      if (c.finding === 'supported') {
        findingBadgeClass = 'badge-supported';
        findingText = 'Evidence Supports';
      } else if (c.finding === 'not_supported') {
        findingBadgeClass = 'badge-not-supported';
        findingText = 'Evidence Disproves';
      }

      const statusBadgeClass = c.status === 'reviewed' ? 'status-reviewed' : 'status-new';
      const statusText = c.status === 'reviewed' ? 'Reviewed' : 'New';

      card.innerHTML = `
        <div class="complaint-header-row">
          <span class="complaint-job-name">${escapeHtml(c.jobName || 'Cleaning Job')}</span>
          <span class="status-badge ${statusBadgeClass}">${statusText}</span>
        </div>
        <div class="complaint-first-line">"${escapeHtml(firstLine)}"</div>
        <div class="complaint-meta-row">
          <span class="status-badge ${findingBadgeClass}">${findingText}</span>
          <span>${dateStr}</span>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading complaints:', err);
    container.innerHTML = `<p class="error-banner">Could not load complaints list.</p>`;
  }
}

// -------------------------------------------------------------
// 7. Complaint Detail View (#/complaint/:jobId/:complaintId)
// -------------------------------------------------------------
async function loadComplaintDetail(jobId, complaintId) {
  const container = document.getElementById('complaintDetailContainer');
  const statusBadge = document.getElementById('detailComplaintStatusBadge');
  if (container) container.innerHTML = '<p class="loading-text">Loading complaint detail…</p>';

  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error('Failed to load job data for complaint');
    const job = await res.json();

    const complaint = (job.complaints || []).find((c) => c.id === complaintId);
    if (!complaint) throw new Error('Complaint not found in this job.');

    if (statusBadge) {
      statusBadge.className = complaint.status === 'reviewed' ? 'status-badge status-reviewed' : 'status-badge status-new';
      statusBadge.textContent = complaint.status === 'reviewed' ? 'Reviewed' : 'New';
    }

    renderComplaintDetail(job, complaint, container);
  } catch (err) {
    console.error('Error loading complaint detail:', err);
    if (container) {
      container.innerHTML = `<p class="error-banner">${escapeHtml(err.message || 'Could not display complaint.')}</p>`;
    }
  }
}

function renderComplaintDetail(job, complaint, container) {
  if (!container) return;

  const dateStr = complaint.createdAt ? new Date(complaint.createdAt).toLocaleString() : '';
  const check = complaint.check || complaint.ai_assessment || {};
  const finding = check.finding || complaint.finding || 'unclear';
  let badgeClass = 'badge-unclear';
  let badgeText = 'Unclear';
  if (finding === 'supported') {
    badgeClass = 'badge-supported';
    badgeText = 'Evidence Supports';
  } else if (finding === 'not_supported') {
    badgeClass = 'badge-not-supported';
    badgeText = 'Evidence Disproves';
  }

  const areaLabel = check.areaLabel || complaint.areaLabel || 'General';
  const explanation = check.explanation || complaint.explanation || 'No explanation provided.';
  const suggestedAction = check.suggested_action || complaint.suggested_action || 'Review area with technician.';

  // Related photos: filter pairs matching areaLabel if available, or all pairs
  const pairs = job.pairs || [];
  let relatedPairs = pairs.filter(
    (p) => (p.areaLabel || '').toLowerCase().includes(areaLabel.toLowerCase())
  );
  if (relatedPairs.length === 0) {
    relatedPairs = pairs;
  }

  let photosHtml = '';
  if (relatedPairs.length > 0) {
    photosHtml = `
      <div class="complaint-photos-section">
        <h4>Related Photo Evidence (${escapeHtml(areaLabel)})</h4>
        <div class="pairs-grid">
          ${relatedPairs
            .map((p) => {
              const beforeUrl = `/api/photos/${encodeURIComponent(job.id)}/${encodeURIComponent(p.id)}/before`;
              const afterUrl = p.after
                ? `/api/photos/${encodeURIComponent(job.id)}/${encodeURIComponent(p.id)}/after`
                : '';
              return `
                <div class="pair-card" style="padding: 0.85rem;">
                  <span class="pair-area-title" style="font-size: 1rem; display: block; margin-bottom: 0.5rem;">${escapeHtml(p.areaLabel || 'Area')}</span>
                  <div class="photos-comparison-row">
                    <div class="photo-cell">
                      <span class="photo-cell-label">Before Cleaning</span>
                      <img class="photo-display-img" src="${beforeUrl}" alt="${escapeHtml(p.areaLabel)} Before" loading="lazy" />
                    </div>
                    <div class="photo-cell">
                      <span class="photo-cell-label">After Cleaning</span>
                      ${
                        afterUrl
                          ? `<img class="photo-display-img" src="${afterUrl}" alt="${escapeHtml(p.areaLabel)} After" loading="lazy" />`
                          : `<div class="empty-after-cell"><p class="text-muted">No after photo</p></div>`
                      }
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  const isReviewed = complaint.status === 'reviewed';

  container.innerHTML = `
    <div class="complaint-detail-box">
      <div>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">
          <a href="#/job/${encodeURIComponent(job.id)}" style="color: var(--accent); text-decoration: none;">${escapeHtml(job.jobName || 'Cleaning Job')}</a>
        </h3>
        <p class="text-muted" style="font-size: 0.85rem;">Submitted on ${dateStr}</p>
      </div>

      <div class="complaint-quote-block">
        <div class="complaint-quote-label">Client Feedback</div>
        <div class="complaint-quote-text">${escapeHtml(complaint.text || '')}</div>
      </div>

      <div class="complaint-ai-section">
        <div class="complaint-ai-verdict-row">
          <span class="status-badge ${badgeClass}" style="font-size: 0.9rem; padding: 0.35rem 0.75rem;">${badgeText}</span>
          <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">Area: ${escapeHtml(areaLabel)}</span>
        </div>
        <div style="font-size: 0.95rem; line-height: 1.45;">
          <strong>Explanation:</strong> ${escapeHtml(explanation)}
        </div>
        <div style="font-size: 0.95rem; line-height: 1.45; color: var(--accent); font-weight: 500;">
          <strong>Suggested Action:</strong> ${escapeHtml(suggestedAction)}
        </div>
      </div>

      ${photosHtml}

      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
        <button
          type="button"
          id="markReviewedBtn"
          class="primary-btn"
          style="min-height: 44px; min-width: 160px;"
          ${isReviewed ? 'disabled' : ''}
        >
          ${isReviewed ? '✓ Reviewed' : 'Mark as reviewed'}
        </button>
      </div>
    </div>
  `;

  const markBtn = document.getElementById('markReviewedBtn');
  if (markBtn && !isReviewed) {
    markBtn.addEventListener('click', async () => {
      markBtn.disabled = true;
      markBtn.textContent = 'Updating…';

      try {
        const res = await fetch(
          `/api/jobs/${encodeURIComponent(job.id)}/complaints/${encodeURIComponent(complaint.id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'reviewed' }),
          }
        );
        if (!res.ok) throw new Error('Failed to update complaint status');

        markBtn.textContent = '✓ Reviewed';
        const badge = document.getElementById('detailComplaintStatusBadge');
        if (badge) {
          badge.className = 'status-badge status-reviewed';
          badge.textContent = 'Reviewed';
        }
      } catch (err) {
        console.error('Error reviewing complaint:', err);
        alert('Could not update status. Please try again.');
        markBtn.disabled = false;
        markBtn.textContent = 'Mark as reviewed';
      }
    });
  }
}

// -------------------------------------------------------------
// 8. Photo Resizing via Canvas (Max 1600px, JPEG 0.8)
// -------------------------------------------------------------
async function resizePhoto(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Canvas toBlob failed'));
          }
          const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };
    img.src = url;
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[tag] || tag));
}
