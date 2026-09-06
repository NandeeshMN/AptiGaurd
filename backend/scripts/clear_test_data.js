const { adminDb } = require('../dist/config/firebase');

async function deleteSubcollection(parentRef, subcollectionName) {
  try {
    const subSnap = await parentRef.collection(subcollectionName).get();
    for (const d of subSnap.docs) {
      await d.ref.delete();
    }
  } catch (err) {
    console.warn(`Notice deleting ${subcollectionName} for ${parentRef.id}:`, err.message);
  }
}

async function clearTestData() {
  console.log('=== Clearing All Test Data from AptiGuard Firestore ===\n');

  // 1. Delete all testAttempts and subcollections
  console.log('1. Querying testAttempts collection...');
  const attemptsSnap = await adminDb.collection('testAttempts').get();
  console.log(`Found ${attemptsSnap.docs.length} testAttempts documents.`);

  for (const d of attemptsSnap.docs) {
    const attId = d.id;
    console.log(`Deleting attempt ${attId}...`);
    await deleteSubcollection(d.ref, 'answers');
    await deleteSubcollection(d.ref, 'proctoringEvents');
    await d.ref.delete();
  }
  console.log('✓ All testAttempts and subcollections deleted.\n');

  // 2. Delete all tests and subcollections
  console.log('2. Querying tests collection...');
  const testsSnap = await adminDb.collection('tests').get();
  console.log(`Found ${testsSnap.docs.length} tests documents.`);

  for (const d of testsSnap.docs) {
    const testId = d.id;
    console.log(`Deleting test ${testId}...`);
    await deleteSubcollection(d.ref, 'questions');
    await deleteSubcollection(d.ref, 'assignedStudents');
    await d.ref.delete();
  }
  console.log('✓ All tests and subcollections deleted.\n');

  console.log('=== SUCCESS: All test data has been cleared from both dashboards! ===');
  process.exit(0);
}

clearTestData().catch((err) => {
  console.error('Error clearing test data:', err);
  process.exit(1);
});
