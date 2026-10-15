// scripts/test-pairs-flow.js
// Automated verification script for the new technician pairs workflow and concurrency.

const fs = require('fs');
const path = require('path');

async function run() {
  const baseUrl = 'http://localhost:8080';

  console.log('--- Step 1: Create a New Job ---');
  const createRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobName: 'M Clean Handover Test Unit' }),
  });
  const job = await createRes.json();
  const jobId = job.id;
  console.log(`Created Job ID: ${jobId} (status: ${job.status})`);

  console.log('\n--- Step 2: Test Concurrency (Upload 3 before photos quickly in parallel) ---');
  const rapidBeforePhotos = [
    { label: 'Toilet 1', file: 'test-photos/toilet 1 before.jpeg' },
    { label: 'Room 1', file: 'test-photos/room 1 before.jpeg' },
    { label: 'Room 2', file: 'test-photos/room 2 before.jpeg' },
  ];

  const uploadBefore = async (photoPath) => {
    const fileBuf = fs.readFileSync(path.join(__dirname, '..', photoPath));
    const blob = new Blob([fileBuf], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('photo', blob, path.basename(photoPath));
    const res = await fetch(`${baseUrl}/api/jobs/${jobId}/pairs`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  };

  const parallelResults = await Promise.all(
    rapidBeforePhotos.map((p) => uploadBefore(p.file))
  );

  // Fetch job to inspect pairs
  const jobAfterRapid = await (await fetch(`${baseUrl}/api/jobs/${jobId}`)).json();
  console.log(`Job pairs count after 3 parallel uploads: ${jobAfterRapid.pairs.length} (Expected: 3)`);
  if (jobAfterRapid.pairs.length === 3) {
    console.log('✅ Firestore transaction concurrency test PASSED! No overwrites.');
  } else {
    console.error('❌ Concurrency test failed! Missing pairs.');
  }

  console.log('\n--- Step 3: Upload Remaining Before Photos (Toilet 2, Room 3, and Mismatch Test) ---');
  await uploadBefore('test-photos/toilet 2 before.jpeg');
  await uploadBefore('test-photos/room 3 before.jpeg');
  await uploadBefore('test-photos/toilet 1 before.jpeg'); // For mismatched pair test

  const jobWith6Pairs = await (await fetch(`${baseUrl}/api/jobs/${jobId}`)).json();
  console.log(`Total pairs registered: ${jobWith6Pairs.pairs.length}`);

  console.log('\n--- Step 4: Upload After Photos & Run Gemini Comparative Checks ---');

  const afterMap = [
    { name: 'toilet 1', afterFile: 'test-photos/toilet 1 after.jpeg' },
    { name: 'room 1', afterFile: 'test-photos/room 1 after.jpeg' },
    { name: 'room 2', afterFile: 'test-photos/room 2 after.jpeg' },
    { name: 'toilet 2', afterFile: 'test-photos/toilet 2 after.jpeg' },
    { name: 'room 3', afterFile: 'test-photos/room 3 after.jpeg' },
    { name: 'MISMATCH (Toilet before + Room after)', afterFile: 'test-photos/room 1 after.jpeg' },
  ];

  const resultsTable = [];

  for (let i = 0; i < jobWith6Pairs.pairs.length; i++) {
    const pair = jobWith6Pairs.pairs[i];
    const testCase = afterMap[i];

    console.log(`Evaluating Pair ${i + 1} (${pair.areaLabel}) with ${testCase.afterFile}...`);
    const fileBuf = fs.readFileSync(path.join(__dirname, '..', testCase.afterFile));
    const blob = new Blob([fileBuf], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('photo', blob, path.basename(testCase.afterFile));

    const res = await fetch(`${baseUrl}/api/jobs/${jobId}/pairs/${pair.id}/after`, {
      method: 'POST',
      body: formData,
    });
    const updated = await res.json();
    const updatedPair = updated.pairs.find((p) => p.id === pair.id);

    resultsTable.push({
      Pair: `Pair ${i + 1}`,
      'Test Case': testCase.name,
      'Area Label': updatedPair.areaLabel,
      'Same Location': updatedPair.check ? updatedPair.check.same_location : false,
      Result: updatedPair.check ? updatedPair.check.result : 'none',
      Reason: updatedPair.check ? updatedPair.check.reason : 'none',
    });
  }

  console.log('\n========================= TEST RESULTS TABLE =========================');
  console.table(resultsTable);

  console.log('\n--- Step 5: Test Job Completion & Lock ---');
  const completeRes = await fetch(`${baseUrl}/api/jobs/${jobId}/complete`, { method: 'POST' });
  const completedJob = await completeRes.json();
  console.log(`Job completion status: ${completedJob.status}, completedAt: ${completedJob.completedAt}`);

  // Test locking: Attempt to add another pair to completed job (must be rejected)
  const lockedAttemptRes = await uploadBefore('test-photos/toilet 1 before.jpeg');
  if (lockedAttemptRes.error) {
    console.log(`✅ Lock enforcement PASSED: API rejected modification: "${lockedAttemptRes.error}"`);
  } else {
    console.error('❌ Lock enforcement FAILED: Completed job was modified!');
  }

  console.log(`\nClient report URL: ${baseUrl}/report.html?id=${jobId}`);
}

run().catch(console.error);
