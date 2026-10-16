// src/storage.js
// Cloud Storage helpers for saving and streaming photos from the private bucket.

const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

function getBucket() {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is not set');
  }
  return storage.bucket(bucketName);
}

function getExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Saves a photo buffer for a specific pair and kind (before or after).
 * Path: jobs/<jobId>/<pairId>-<kind>.<ext>
 */
async function savePairPhoto(jobId, pairId, kind, buffer, mimeType) {
  const bucket = getBucket();
  const ext = getExtension(mimeType);
  const photoPath = `jobs/${jobId}/${pairId}-${kind}.${ext}`;
  const file = bucket.file(photoPath);

  await file.save(buffer, {
    contentType: mimeType || 'image/jpeg',
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=86400',
    },
  });

  return photoPath;
}

/**
 * Downloads a photo buffer from the private bucket.
 */
async function getPhotoBuffer(photoPath) {
  const bucket = getBucket();
  const file = bucket.file(photoPath);
  const [buffer] = await file.download();
  return buffer;
}

/**
 * Streams a photo from the private bucket directly to Express response.
 */
async function streamPhoto(photoPath, res) {
  const bucket = getBucket();
  const file = bucket.file(photoPath);

  const [exists] = await file.exists();
  if (!exists) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const [metadata] = await file.getMetadata();
  res.setHeader('Content-Type', metadata.contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');

  file.createReadStream()
    .on('error', (err) => {
      console.error('Error streaming photo:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream photo' });
      }
    })
    .pipe(res);
}

/**
 * Deletes all photos stored for a job.
 * Exact prefix: jobs/<jobId>/
 */
async function deleteJobPhotos(jobId) {
  const bucket = getBucket();
  const prefix = `jobs/${jobId}/`;
  await bucket.deleteFiles({ prefix, force: true });
}

module.exports = {
  savePairPhoto,
  getPhotoBuffer,
  streamPhoto,
  deleteJobPhotos,
};
