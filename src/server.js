// src/server.js
// Express web server providing API endpoints and static file hosting.

require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { Timestamp } = require('@google-cloud/firestore');

const { labelArea, comparePhotos, evaluateComplaint } = require('./gemini');
const { savePairPhoto, getPhotoBuffer, streamPhoto, deleteJobPhotos } = require('./storage');
const {
  createJob,
  listJobs,
  getJob,
  addPairTransaction,
  updatePairAfterTransaction,
  deletePairTransaction,
  completeJob,
  deleteJobDocument,
  addComplaintTransaction,
  updateComplaintStatusTransaction,
  listLightComplaints,
  getSummaryCounts,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure Multer for in-memory file uploads (max 5MB, images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only JPEG, PNG, and WebP images are allowed.`));
    }
  },
});

// --- API Routes ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Home dashboard summary counts (fast, light)
app.get('/api/summary', async (req, res) => {
  try {
    const summary = await getSummaryCounts();
    res.json(summary);
  } catch (err) {
    console.error('Error getting summary counts:', err);
    res.status(500).json({ error: 'Failed to get summary counts.' });
  }
});

// Lightweight complaints list (jobId, jobName, complaintId, text, finding, status, createdAt)
app.get('/api/complaints', async (req, res) => {
  try {
    const complaints = await listLightComplaints();
    res.json(complaints);
  } catch (err) {
    console.error('Error listing complaints:', err);
    res.status(500).json({ error: 'Failed to list complaints.' });
  }
});

// Create a new job in progress
app.post('/api/jobs', async (req, res) => {
  try {
    const { jobName } = req.body;
    const newJob = await createJob(jobName);
    res.status(201).json(newJob);
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Failed to create job.' });
  }
});

// List jobs (supports ?status=in_progress or ?status=completed)
app.get('/api/jobs', async (req, res) => {
  try {
    const { status } = req.query;
    const jobs = await listJobs(status);
    res.json(jobs);
  } catch (err) {
    console.error('Error listing jobs:', err);
    res.status(500).json({ error: 'Failed to list jobs.' });
  }
});

// Get single job by ID (full job for technician view, including complaints)
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    res.json(job);
  } catch (err) {
    console.error(`Error getting job ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to get job.' });
  }
});

// Public client report endpoint (returns job WITHOUT complaints array)
app.get('/api/reports/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Exclude complaints array completely from public response
    const { complaints, ...reportData } = job;
    reportData.complaintCount = (complaints || []).length;

    res.json(reportData);
  } catch (err) {
    console.error(`Error getting report ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to get report.' });
  }
});

// Upload a BEFORE photo to add an area pair
app.post('/api/jobs/:id/pairs', upload.single('photo'), async (req, res) => {
  try {
    const jobId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a photo to upload.' });
    }

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    if (job.status === 'completed') {
      return res.status(400).json({ error: 'This job is completed and cannot be modified.' });
    }

    const pairId = 'pair-' + crypto.randomUUID().slice(0, 8);

    // Save photo and get area label in parallel
    const [photoPath, areaLabel] = await Promise.all([
      savePairPhoto(jobId, pairId, 'before', req.file.buffer, req.file.mimetype),
      labelArea(req.file.buffer, req.file.mimetype),
    ]);

    const source = req.body && req.body.source === 'gallery' ? 'gallery' : 'camera';
    const newPair = {
      id: pairId,
      areaLabel: areaLabel || 'Area',
      before: {
        photoPath,
        uploadedAt: Timestamp.now(),
        source,
      },
      after: null,
      check: null,
    };

    const updatedJob = await addPairTransaction(jobId, newPair);
    res.status(201).json(updatedJob);
  } catch (err) {
    console.error('Error adding area pair:', err);
    res.status(500).json({ error: err.message || 'Failed to add area pair.' });
  }
});

// Upload an AFTER photo for an area pair and run comparative Gemini check
app.post('/api/jobs/:id/pairs/:pairId/after', upload.single('photo'), async (req, res) => {
  try {
    const { id: jobId, pairId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an after photo to upload.' });
    }

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    if (job.status === 'completed') {
      return res.status(400).json({ error: 'This job is completed and cannot be modified.' });
    }

    const pair = (job.pairs || []).find((p) => p.id === pairId);
    if (!pair || !pair.before) {
      return res.status(404).json({ error: 'Area pair or before photo not found.' });
    }

    // 1. Download before photo buffer & save after photo concurrently
    const [beforeBuffer, afterPhotoPath] = await Promise.all([
      getPhotoBuffer(pair.before.photoPath),
      savePairPhoto(jobId, pairId, 'after', req.file.buffer, req.file.mimetype),
    ]);

    // 2. Run Gemini comparative inspection (photo 1: before, photo 2: after) in English
    const checkResult = await comparePhotos(
      beforeBuffer,
      'image/jpeg',
      req.file.buffer,
      req.file.mimetype
    );

    // 3. Update pair via transaction
    const source = req.body && req.body.source === 'gallery' ? 'gallery' : 'camera';
    const updatedJob = await updatePairAfterTransaction(
      jobId,
      pairId,
      {
        photoPath: afterPhotoPath,
        uploadedAt: Timestamp.now(),
        source,
      },
      checkResult
    );

    res.json(updatedJob);
  } catch (err) {
    console.error('Error updating after photo:', err);
    res.status(500).json({ error: err.message || 'Failed to check after photo.' });
  }
});

// Delete an area pair before job completion
app.delete('/api/jobs/:id/pairs/:pairId', async (req, res) => {
  try {
    const { id: jobId, pairId } = req.params;
    const updatedJob = await deletePairTransaction(jobId, pairId);
    res.json(updatedJob);
  } catch (err) {
    console.error('Error deleting pair:', err);
    res.status(500).json({ error: err.message || 'Failed to delete pair.' });
  }
});

// Mark job completed
app.post('/api/jobs/:id/complete', async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const completed = await completeJob(jobId);
    res.json(completed);
  } catch (err) {
    console.error('Error completing job:', err);
    res.status(400).json({ error: err.message || 'Failed to complete job.' });
  }
});

// Delete an entire job and all its photos (refuses completed jobs with HTTP 409)
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    if (job.status === 'completed') {
      return res.status(409).json({ error: 'Completed jobs are locked evidence and cannot be deleted.' });
    }

    // 1. Delete all photo files in Cloud Storage under prefix jobs/<jobId>/
    await deleteJobPhotos(jobId);

    // 2. Delete Firestore job document
    await deleteJobDocument(jobId);

    res.json({ ok: true, message: 'Job and photos deleted successfully.' });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: err.message || 'Failed to delete job.' });
  }
});

// Stream photo from private bucket with caching
app.get('/api/photos/:jobId/:pairId/:kind', async (req, res) => {
  try {
    const { jobId, pairId, kind } = req.params;
    if (kind !== 'before' && kind !== 'after') {
      return res.status(400).json({ error: 'Kind must be before or after.' });
    }

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    const pair = (job.pairs || []).find((p) => p.id === pairId);
    if (!pair || !pair[kind]) {
      return res.status(404).json({ error: `Photo not found for ${kind}.` });
    }

    // Cache-Control: private, max-age=86400 (24 hours)
    res.set('Cache-Control', 'private, max-age=86400');

    await streamPhoto(pair[kind].photoPath, res);
  } catch (err) {
    console.error('Error streaming photo:', err);
    res.status(500).json({ error: 'Failed to load photo.' });
  }
});

// Client complaint submission (Allowed on completed jobs, max 500 chars, limit 5 complaints per job)
app.post('/api/jobs/:id/complaints', async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Complaint text is required.' });
    }
    const trimmedText = text.trim();
    if (trimmedText.length > 500) {
      return res.status(400).json({ error: 'Complaint text must not exceed 500 characters.' });
    }

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    if ((job.complaints || []).length >= 5) {
      return res.status(400).json({ error: 'Maximum limit of 5 complaints reached for this job.' });
    }

    // 1. Fetch photo buffers for all pairs in parallel
    const pairsWithBuffers = await Promise.all(
      (job.pairs || []).map(async (pair) => {
        let beforeBuffer = null;
        let afterBuffer = null;
        try {
          if (pair.before && pair.before.photoPath) {
            beforeBuffer = await getPhotoBuffer(pair.before.photoPath);
          }
        } catch (e) {
          console.warn(`Could not load before buffer for pair ${pair.id}:`, e.message);
        }
        try {
          if (pair.after && pair.after.photoPath) {
            afterBuffer = await getPhotoBuffer(pair.after.photoPath);
          }
        } catch (e) {
          console.warn(`Could not load after buffer for pair ${pair.id}:`, e.message);
        }

        return {
          areaLabel: pair.areaLabel,
          beforeBuffer,
          afterBuffer,
          checkResult: pair.check,
        };
      })
    );

    // 2. Evaluate complaint with Gemini
    const aiCheck = await evaluateComplaint(trimmedText, pairsWithBuffers);

    // 3. Save complaint into Firestore
    const complaintId = 'comp-' + crypto.randomUUID().slice(0, 8);
    const complaintData = {
      id: complaintId,
      text: trimmedText,
      createdAt: Timestamp.now(),
      status: 'new',
      check: aiCheck,
    };

    await addComplaintTransaction(jobId, complaintData);

    // Client only receives confirmation — NEVER the AI verdict
    res.status(201).json({
      ok: true,
      message: 'Thank you. M Clean will review your report and contact you.',
    });
  } catch (err) {
    console.error('Error submitting complaint:', err);
    res.status(500).json({ error: err.message || 'Failed to submit complaint.' });
  }
});

// Update complaint status (e.g. mark as reviewed by technician)
app.patch('/api/jobs/:id/complaints/:complaintId', async (req, res) => {
  try {
    const { id: jobId, complaintId } = req.params;
    const { status } = req.body || {};

    if (!status || !['new', 'reviewed'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'new' or 'reviewed'." });
    }

    const updatedJob = await updateComplaintStatusTransaction(jobId, complaintId, status);
    res.json(updatedJob);
  } catch (err) {
    console.error('Error updating complaint status:', err);
    res.status(500).json({ error: err.message || 'Failed to update complaint status.' });
  }
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Photo is too large. Maximum file size is 5 MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`M Clean Handover AI listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
