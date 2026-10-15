// scripts/test-complaints-flow.js
// Automated verification of Day 3 "Report an issue" complaint check.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
  const baseUrl = 'http://localhost:8080';
  const photoDir = path.join(__dirname, '..', 'test-photos');

  console.log('--- Step 1: Create a Job and Upload Photos ---');
  const createRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobName: 'Day 3 Complaints Verification Job' }),
  });
  const job = await createRes.json();
  const jobId = job.id;
  console.log('Created Job:', jobId);

  // We will upload 3 pairs:
  // 1. Toilet 1 (Cleaned)
  // 2. Room 1 (Cleaned)
  // 3. Room 3 (Wardrobe left open - issue_remaining)
  const pairsToUpload = [
    { label: 'toilet 1', before: 'toilet 1 before.jpeg', after: 'toilet 1 after.jpeg' },
    { label: 'room 1', before: 'room 1 before.jpeg', after: 'room 1 after.jpeg' },
    { label: 'room 3', before: 'room 3 before.jpeg', after: 'room 3 after.jpeg' },
  ];

  for (const p of pairsToUpload) {
    const beforeBuf = fs.readFileSync(path.join(photoDir, p.before));
    const beforeBlob = new Blob([beforeBuf], { type: 'image/jpeg' });
    const fdBefore = new FormData();
    fdBefore.append('photo', beforeBlob, p.before);

    const pairRes = await fetch(`${baseUrl}/api/jobs/${jobId}/pairs`, {
      method: 'POST',
      body: fdBefore,
    });
    const updatedJob = await pairRes.json();
    const addedPair = updatedJob.pairs[updatedJob.pairs.length - 1];

    const afterBuf = fs.readFileSync(path.join(photoDir, p.after));
    const afterBlob = new Blob([afterBuf], { type: 'image/jpeg' });
    const fdAfter = new FormData();
    fdAfter.append('photo', afterBlob, p.after);

    await fetch(`${baseUrl}/api/jobs/${jobId}/pairs/${addedPair.id}/after`, {
      method: 'POST',
      body: fdAfter,
    });
    console.log(`Uploaded pair ${p.label}`);
  }

  // Complete job (lock it)
  const completeRes = await fetch(`${baseUrl}/api/jobs/${jobId}/complete`, { method: 'POST' });
  const completedJob = await completeRes.json();
  console.log(`Job completed (locked): status = ${completedJob.status}`);

  console.log('\n--- Step 2: Test 3 Complaint Scenarios Against Real Photos ---');
  const testComplaints = [
    {
      description: 'Photos disprove (Floor clean in Room 1)',
      text: 'The bedroom floor was still dirty and dusty.',
      expected: 'not_supported',
    },
    {
      description: 'Photos support (Wardrobe left open in Room 3)',
      text: 'The wardrobe was left open and drawers were pulled out.',
      expected: 'supported',
    },
    {
      description: 'Photos cannot show (Toilet odor/smell)',
      text: 'The toilet still smells like sewage.',
      expected: 'unclear',
    },
  ];

  const resultsTable = [];

  for (const tc of testComplaints) {
    console.log(`Submitting complaint: "${tc.text}"...`);
    const compRes = await fetch(`${baseUrl}/api/jobs/${jobId}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tc.text }),
    });
    const clientResponse = await compRes.json();

    // Verify client only sees standard confirmation message
    if (clientResponse.check || clientResponse.finding) {
      console.error('❌ LEAK: Client received AI verdict in response!');
    } else {
      console.log('✅ Client received clean acknowledgment message without AI verdict.');
    }
  }

  // Inspect the job document to see the stored complaints and AI checks
  const jobWithComplaints = await (await fetch(`${baseUrl}/api/jobs/${jobId}`)).json();
  const storedComplaints = jobWithComplaints.complaints || [];

  for (let i = 0; i < testComplaints.length; i++) {
    const tc = testComplaints[i];
    const stored = storedComplaints[i];
    const chk = stored ? stored.check : {};

    resultsTable.push({
      Complaint: tc.text,
      'Test Scenario': tc.description,
      'AI Finding': chk.finding || 'none',
      'Area Identified': chk.areaLabel || 'none',
      Explanation: chk.explanation || 'none',
      'Suggested Action': chk.suggested_action || 'none',
    });
  }

  console.log('\n========================= DAY 3 COMPLAINT TEST RESULTS =========================');
  console.table(resultsTable);

  console.log('\n--- Step 3: Test Review Status Update (Technician) ---');
  const firstComp = storedComplaints[0];
  const patchRes = await fetch(`${baseUrl}/api/jobs/${jobId}/complaints/${firstComp.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'reviewed' }),
  });
  const patchedJob = await patchRes.json();
  const patchedComp = patchedJob.complaints.find((c) => c.id === firstComp.id);
  console.log(`Updated complaint ${firstComp.id} status: ${patchedComp.status} (Expected: reviewed)`);
}

run().catch(console.error);

