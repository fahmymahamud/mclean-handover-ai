// scripts/test-4-complaints.js
// Automated retest of the 4 complaints with the refined prompt.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
  const baseUrl = 'http://localhost:8080';
  const photoDir = path.join(__dirname, '..', 'test-photos');

  console.log('--- Step 1: Create a Job with All Test Areas (Toilet 1, Room 1, Room 2, Room 3) ---');
  const createRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobName: 'Retest 4 Complaints Job' }),
  });
  const job = await createRes.json();
  const jobId = job.id;
  console.log('Created Job:', jobId);

  const pairsToUpload = [
    { label: 'toilet 1', before: 'toilet 1 before.jpeg', after: 'toilet 1 after.jpeg' },
    { label: 'room 1', before: 'room 1 before.jpeg', after: 'room 1 after.jpeg' },
    { label: 'room 2', before: 'room 2 before.jpeg', after: 'room 2 after.jpeg' },
    { label: 'room 3', before: 'room 3 before.jpeg', after: 'room 3 after.jpeg' },
  ];

  for (const p of pairsToUpload) {
    const beforeBuf = fs.readFileSync(path.join(photoDir, p.before));
    const fdBefore = new FormData();
    fdBefore.append('photo', new Blob([beforeBuf], { type: 'image/jpeg' }), p.before);

    const pairRes = await fetch(`${baseUrl}/api/jobs/${jobId}/pairs`, {
      method: 'POST',
      body: fdBefore,
    });
    const updatedJob = await pairRes.json();
    const addedPair = updatedJob.pairs[updatedJob.pairs.length - 1];

    const afterBuf = fs.readFileSync(path.join(photoDir, p.after));
    const fdAfter = new FormData();
    fdAfter.append('photo', new Blob([afterBuf], { type: 'image/jpeg' }), p.after);

    await fetch(`${baseUrl}/api/jobs/${jobId}/pairs/${addedPair.id}/after`, {
      method: 'POST',
      body: fdAfter,
    });
    console.log(`Uploaded pair ${p.label}`);
  }

  // Complete job (lock it)
  await fetch(`${baseUrl}/api/jobs/${jobId}/complete`, { method: 'POST' });
  console.log('Job completed.');

  console.log('\n--- Step 2: Test 4 Complaints ---');
  const testComplaints = [
    {
      name: 'Complaint 1',
      text: 'The bedroom floor was still dirty and dusty.',
    },
    {
      name: 'Complaint 2',
      text: 'The wardrobe was left open and drawers were pulled out.',
    },
    {
      name: 'Complaint 3',
      text: 'The toilet still smells like sewage.',
    },
    {
      name: 'Complaint 4 (New)',
      text: 'the bedroom still has rubbish in the corner',
    },
  ];

  for (const tc of testComplaints) {
    console.log(`Submitting: "${tc.text}"...`);
    await fetch(`${baseUrl}/api/jobs/${jobId}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tc.text }),
    });
  }

  const jobWithComplaints = await (await fetch(`${baseUrl}/api/jobs/${jobId}`)).json();
  const storedComplaints = jobWithComplaints.complaints || [];

  const resultsTable = storedComplaints.map((c, i) => ({
    '#': i + 1,
    Complaint: c.text,
    Finding: c.check.finding,
    Area: c.check.areaLabel,
    Explanation: c.check.explanation,
    'Suggested Action': c.check.suggested_action,
  }));

  console.log('\n========================= 4 COMPLAINTS RETEST RESULTS =========================');
  console.table(resultsTable);
}

run().catch(console.error);

