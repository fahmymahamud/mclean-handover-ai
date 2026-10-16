// src/db.js
// Firestore data management for jobs and pairs using transactions for concurrent safety.

const { Firestore, Timestamp } = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const jobsCollection = db.collection('jobs');

function toIso(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return null;
}

function formatJob(id, data) {
  const formattedPairs = (data.pairs || []).map((pair) => ({
    id: pair.id,
    areaLabel: pair.areaLabel || 'Area',
    before: pair.before
      ? {
          photoPath: pair.before.photoPath,
          uploadedAt: toIso(pair.before.uploadedAt),
          source: pair.before.source || 'camera',
        }
      : null,
    after: pair.after
      ? {
          photoPath: pair.after.photoPath,
          uploadedAt: toIso(pair.after.uploadedAt),
          source: pair.after.source || 'camera',
        }
      : null,
    check: pair.check || null,
  }));

  const formattedComplaints = (data.complaints || []).map((c) => ({
    ...c,
    createdAt: toIso(c.createdAt),
  }));

  return {
    id,
    jobName: data.jobName || 'Untitled Job',
    status: data.status || 'in_progress',
    createdAt: toIso(data.createdAt),
    completedAt: toIso(data.completedAt),
    pairs: formattedPairs,
    complaints: formattedComplaints,
  };
}

/**
 * Creates a new job with in_progress status.
 */
async function createJob(jobName) {
  const docRef = jobsCollection.doc();
  const now = Timestamp.now();
  const jobPayload = {
    jobName: (jobName || '').trim() || 'Untitled Job',
    status: 'in_progress',
    createdAt: now,
    completedAt: null,
    pairs: [],
    complaints: [],
  };

  await docRef.set(jobPayload);
  return formatJob(docRef.id, jobPayload);
}

/**
 * Lists jobs, optionally filtering by status. Newest first.
 */
async function listJobs(status) {
  let query = jobsCollection;
  if (status) {
    query = query.where('status', '==', status);
    const snapshot = await query.get();
    const jobs = snapshot.docs.map((doc) => formatJob(doc.id, doc.data()));
    return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const snapshot = await query.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => formatJob(doc.id, doc.data()));
}

/**
 * Gets a single job by ID.
 */
async function getJob(jobId) {
  const docRef = jobsCollection.doc(jobId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  return formatJob(doc.id, doc.data());
}

/**
 * Adds a new area pair to the job using a transaction (locking against race conditions).
 */
async function addPairTransaction(jobId, newPair) {
  const docRef = jobsCollection.doc(jobId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error('Job not found');
    }
    const data = doc.data();

    if (data.status === 'completed') {
      throw new Error('This job is completed and cannot be modified');
    }

    const pairs = data.pairs || [];
    if (pairs.length >= 10) {
      throw new Error('Maximum of 10 area pairs reached for this job');
    }

    pairs.push(newPair);
    transaction.update(docRef, { pairs });

    return formatJob(jobId, { ...data, pairs });
  });
}

/**
 * Updates a pair with its after-photo and inspection check using a transaction.
 */
async function updatePairAfterTransaction(jobId, pairId, afterData, checkData) {
  const docRef = jobsCollection.doc(jobId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error('Job not found');
    }
    const data = doc.data();

    if (data.status === 'completed') {
      throw new Error('This job is completed and cannot be modified');
    }

    const pairs = (data.pairs || []).map((p) => {
      if (p.id === pairId) {
        return {
          ...p,
          after: afterData,
          check: checkData,
        };
      }
      return p;
    });

    transaction.update(docRef, { pairs });
    return formatJob(jobId, { ...data, pairs });
  });
}

/**
 * Removes an area pair before the job is completed using a transaction.
 */
async function deletePairTransaction(jobId, pairId) {
  const docRef = jobsCollection.doc(jobId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error('Job not found');
    }
    const data = doc.data();

    if (data.status === 'completed') {
      throw new Error('This job is completed and cannot be modified');
    }

    const pairs = (data.pairs || []).filter((p) => p.id !== pairId);
    transaction.update(docRef, { pairs });
    return formatJob(jobId, { ...data, pairs });
  });
}

/**
 * Marks a job as completed.
 */
async function completeJob(jobId) {
  const docRef = jobsCollection.doc(jobId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error('Job not found');
    }
    const data = doc.data();

    if (data.status === 'completed') {
      return formatJob(jobId, data);
    }

    const pairs = data.pairs || [];
    if (pairs.length === 0) {
      throw new Error('Cannot complete a job with no area photos.');
    }

    const missingAfter = pairs.some((p) => !p.after);
    if (missingAfter) {
      throw new Error('All area pairs must have an after photo before completing the job.');
    }

    const completedAt = Timestamp.now();
    transaction.update(docRef, {
      status: 'completed',
      completedAt,
    });

    return formatJob(jobId, {
      ...data,
      status: 'completed',
      completedAt,
    });
  });
}

/**
 * Adds a new complaint to a job using a transaction (max 5 complaints).
 * Allowed even if job is completed.
 */
async function addComplaintTransaction(jobId, complaintData) {
  const docRef = jobsCollection.doc(jobId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error('Job not found');
    }
    const data = doc.data();
    const complaints = data.complaints || [];

    if (complaints.length >= 5) {
      throw new Error('Maximum limit of 5 complaints reached for this job.');
    }

    const updatedComplaints = [...complaints, complaintData];
    transaction.update(docRef, { complaints: updatedComplaints });

    return formatJob(jobId, { ...data, complaints: updatedComplaints });
  });
}

/**
 * Updates the status of an existing complaint (e.g. 'reviewed').
 */
async function updateComplaintStatusTransaction(jobId, complaintId, newStatus) {
  const docRef = jobsCollection.doc(jobId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      throw new Error('Job not found');
    }
    const data = doc.data();
    const complaints = (data.complaints || []).map((c) => {
      if (c.id === complaintId) {
        return { ...c, status: newStatus };
      }
      return c;
    });

    transaction.update(docRef, { complaints });
    return formatJob(jobId, { ...data, complaints });
  });
}

/**
 * Returns a lightweight list of complaints across all jobs:
 * [{ jobId, jobName, complaintId, text, finding, status, createdAt }]
 * Newest first. No photo data.
 */
async function listLightComplaints() {
  const snapshot = await jobsCollection.get();
  const allComplaints = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const jobId = doc.id;
    const jobName = data.jobName || 'Untitled Job';
    const complaints = data.complaints || [];

    complaints.forEach((c) => {
      const createdAtIso = c.createdAt && typeof c.createdAt.toDate === 'function'
        ? c.createdAt.toDate().toISOString()
        : typeof c.createdAt === 'string'
        ? c.createdAt
        : null;

      allComplaints.push({
        jobId,
        jobName,
        complaintId: c.id,
        text: c.text || '',
        finding: (c.check && c.check.finding) ? c.check.finding : 'unclear',
        status: c.status || 'new',
        createdAt: createdAtIso,
      });
    });
  });

  return allComplaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Returns summary counts for the technician home page:
 * { openJobs, newComplaints }
 */
async function getSummaryCounts() {
  const snapshot = await jobsCollection.get();
  let openJobs = 0;
  let newComplaints = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'in_progress') {
      openJobs++;
    }
    const complaints = data.complaints || [];
    complaints.forEach((c) => {
      if (c.status === 'new') {
        newComplaints++;
      }
    });
  });

  return { openJobs, newComplaints };
}

/**
 * Deletes a job document from Firestore.
 */
async function deleteJobDocument(jobId) {
  const docRef = jobsCollection.doc(jobId);
  await docRef.delete();
}

module.exports = {
  db,
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
};
