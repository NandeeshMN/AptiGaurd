import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';
import { adminDb } from '../config/firebase';
import * as admin from 'firebase-admin';

// Helper: 503 if adminDb not available
const requireDb = (res: Response): boolean => {
  if (!adminDb) {
    res.status(503).json({ success: false, message: 'Firebase Admin not initialized. Set GOOGLE_APPLICATION_CREDENTIALS.' });
    return false;
  }
  return true;
};

const router = Router();

// GET /api/tests/admin -> Retrieve tests created by logged-in admin (or all tests for NANDESH email check)
router.get('/admin', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  try {
    const testsRef = adminDb!.collection('tests');
    const snapshot = await testsRef.get();
    const testsList: any[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      testsList.push({
        id: doc.id,
        ...data,
      });
    });

    res.json({ success: true, tests: testsList });
  } catch (error: any) {
    console.error('Fetch admin tests error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tests.' });
  }
});

// GET /api/tests/available -> Retrieve tests eligible for students
router.get('/available', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const studentUid = req.user?.uid;
  if (!studentUid) {
    res.status(400).json({ success: false, message: 'Invalid student uid' });
    return;
  }

  try {
    const testsRef = adminDb!.collection('tests');
    const snapshot = await testsRef.get();
    const eligibleTests: any[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Expose only scheduled or published status tests. (Filter drafts)
      if (data.status !== 'published' && data.status !== 'scheduled' && data.status !== 'expired') {
        continue;
      }

      let isAssigned = false;
      if (data.assignmentType === 'all') {
        isAssigned = true;
      } else if (data.assignmentType === 'selected') {
        const assignmentDoc = await testsRef.doc(doc.id).collection('assignedStudents').doc(studentUid).get();
        if (assignmentDoc.exists) {
          isAssigned = true;
        }
      }

      if (isAssigned) {
        eligibleTests.push({
          id: doc.id,
          ...data,
        });
      }
    }

    res.json({ success: true, tests: eligibleTests });
  } catch (error) {
    console.error('Fetch available tests error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve eligible tests.' });
  }
});

import { sendBatchTestUpdateEmails } from '../services/brevoService';

const maskEmailForLogs = (email: string): string => {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user.charAt(0)}*@${domain}`;
  return `${user.slice(0, 2)}****@${domain}`;
};

// Helper to resolve accurate total questions and total marks from Firestore
const resolveTestQuestionsAndMarks = async (
  testDocRef: admin.firestore.DocumentReference,
  fallbackData: any = {}
): Promise<{ totalQuestions: number; totalMarks: number }> => {
  let totalQuestions = 0;
  let totalMarks = 0;

  try {
    const questionsSnap = await testDocRef.collection('questions').get();
    if (!questionsSnap.empty) {
      totalQuestions = questionsSnap.size;
      questionsSnap.forEach((qDoc) => {
        const q = qDoc.data() || {};
        totalMarks += Number(q.marks || 1);
      });
    }
  } catch (err) {
    console.warn(`[ResolveQuestions] Warning querying questions subcollection for ${testDocRef.id}:`, err);
  }

  // If subcollection was empty or not populated, use explicit fallback fields
  if (totalQuestions === 0) {
    totalQuestions = Number(fallbackData.totalQuestions) || Number(fallbackData.targetQuestions) || (Array.isArray(fallbackData.questions) ? fallbackData.questions.length : 0);
  }

  if (totalMarks === 0) {
    if (Array.isArray(fallbackData.questions) && fallbackData.questions.length > 0) {
      fallbackData.questions.forEach((q: any) => {
        totalMarks += Number(q.marks || 1);
      });
    } else {
      totalMarks = Number(fallbackData.totalMarks) || Number(fallbackData.targetMarks) || 0;
    }
  }

  return { totalQuestions, totalMarks };
};

// Helper to resolve eligible student recipients without duplicate emails or admin accounts
const resolveTestRecipients = async (
  testDocRef: admin.firestore.DocumentReference,
  assignmentType: string,
  selectedStudentUids: string[] = []
): Promise<Array<{ email: string; name: string }>> => {
  const recipientsMap = new Map<string, { email: string; name: string }>();
  if (!adminDb) return [];

  const addStudentUser = (u: any) => {
    const rawEmail = u.email ? String(u.email).trim().toLowerCase() : '';
    const role = (u.role || '').toLowerCase();

    // Strictly students only — never email admins
    if (rawEmail && role === 'student') {
      let rawName = u.name || u.fullName || u.displayName || '';
      if (!rawName || rawName.includes('@')) {
        const prefix = rawEmail.split('@')[0];
        rawName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
      recipientsMap.set(rawEmail, { email: rawEmail, name: rawName });
    }
  };

  if (assignmentType === 'all') {
    const usersSnap = await adminDb.collection('users').where('role', '==', 'student').get();
    usersSnap.forEach((uDoc) => addStudentUser(uDoc.data()));
  } else if (assignmentType === '1st Year' || assignmentType === '2nd Year') {
    // 1. Fetch from users collection by matching year and role
    const usersSnap = await adminDb.collection('users')
      .where('role', '==', 'student')
      .where('year', '==', assignmentType)
      .get();
    usersSnap.forEach((uDoc) => addStudentUser(uDoc.data()));

    // 2. Also check assignedStudents subcollection as fallback
    const assignedSubSnap = await testDocRef.collection('assignedStudents').get();
    for (const aDoc of assignedSubSnap.docs) {
      const aData = aDoc.data();
      const uid = aData.uid || aDoc.id;
      if (uid) {
        const uSnap = await adminDb.collection('users').doc(uid).get();
        if (uSnap.exists) addStudentUser(uSnap.data());
      }
    }
  } else {
    // assignmentType === 'selected'
    const assignedUids = new Set<string>(
      Array.isArray(selectedStudentUids) ? selectedStudentUids : []
    );

    const assignedSubSnap = await testDocRef.collection('assignedStudents').get();
    assignedSubSnap.forEach((aDoc) => {
      const aData = aDoc.data();
      const uid = aData.uid || aDoc.id;
      if (uid) assignedUids.add(uid);
    });

    for (const uid of Array.from(assignedUids)) {
      const uSnap = await adminDb.collection('users').doc(uid).get();
      if (uSnap.exists) {
        addStudentUser(uSnap.data());
      }
    }
  }

  return Array.from(recipientsMap.values());
};

const triggerTestUpdateEmailsAsync = async (
  testId: string,
  testTitle: string,
  changedDetails: string[],
  testData: any
) => {
  try {
    if (!adminDb) return;

    const testDocRef = adminDb.collection('tests').doc(testId);
    const testSnap = await testDocRef.get();
    const currentData = testSnap.exists ? { ...testSnap.data(), ...testData } : testData;

    const testStatus = currentData.status || 'published';

    // Do NOT send update emails for draft tests
    if (testStatus === 'draft') {
      console.log(`[Test Update Email] Test ${testId} is in DRAFT status. Skipping student email dispatch.`);
      return;
    }

    // Do NOT send update emails if there are no student-visible changes (CASE 7)
    if (!changedDetails || changedDetails.length === 0) {
      console.log(`[Test Update Email] No student-visible changes detected for test ${testId}. Email dispatch skipped.`);
      return;
    }

    // Calculate source-of-truth total questions and total marks
    const { totalQuestions, totalMarks } = await resolveTestQuestionsAndMarks(testDocRef, currentData);

    const passingScore = typeof currentData.passingScore === 'number'
      ? currentData.passingScore
      : (typeof currentData.passingMarks === 'number' ? currentData.passingMarks : 40);

    const duration = Number(currentData.duration) || 30;

    // Synchronize resolved counts back to root Firestore document
    try {
      await testDocRef.set({ totalQuestions, totalMarks }, { merge: true });
    } catch (syncErr) {
      console.warn('[Test Update Email] Notice syncing totalQuestions/totalMarks:', syncErr);
    }

    const assignmentType = currentData.assignmentType || 'all';
    const selectedUids = currentData.selectedStudentUids || [];
    const recipients = await resolveTestRecipients(testDocRef, assignmentType, selectedUids);

    const maskedRecipients = recipients.map(r => maskEmailForLogs(r.email));

    console.log(`[Test Update Email] Test ID: ${testId}`);
    console.log(`[Test Update Email] Changed fields (${changedDetails.length}):\n  - ${changedDetails.join('\n  - ')}`);
    console.log(`[Test Update Email] Total Questions: ${totalQuestions} | Total Marks: ${totalMarks} | Passing Score: ${passingScore}% | Duration: ${duration} mins`);
    console.log(`[Test Update Email] Assigned student count: ${recipients.length}`);
    console.log(`[Test Update Email] Recipient emails: ${maskedRecipients.join(', ') || 'None'}`);

    if (recipients.length === 0) {
      console.log(`[Test Update Email] Notice: No eligible student recipients found for test ${testId}`);
      return;
    }

    console.log(`[Test Update Email] Dispatching emails to ${recipients.length} students...`);

    const batchStats = await sendBatchTestUpdateEmails(recipients, {
      testId: testId,
      testTitle: currentData.title || testTitle || 'Assessment',
      description: currentData.description || '',
      category: currentData.category || 'General',
      difficulty: currentData.difficulty || 'Intermediate',
      totalQuestions: totalQuestions,
      totalMarks: totalMarks,
      passingScore: passingScore,
      testStatus: testStatus,
      changedDetails: changedDetails,
      startDate: currentData.startDate || null,
      startTime: currentData.startTime || null,
      endDate: currentData.endDate || null,
      endTime: currentData.endTime || null,
      duration: duration,
    });

    console.log(`[Test Update Email] Dispatch completed. Sent: ${batchStats.sentCount}, Failed: ${batchStats.failedCount}`);
  } catch (err: any) {
    console.error(`[Test Update Email] Dispatch error:`, err?.message || err);
    throw err;
  }
};

// PUT /api/tests/:testId -> Update existing test details, update Firestore, and trigger Brevo emails
router.put('/:testId', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const { testId } = req.params;

  try {
    const testDocRef = adminDb!.collection('tests').doc(testId);
    const existingSnap = await testDocRef.get();

    if (!existingSnap.exists) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    const oldData = existingSnap.data() || {};
    const body = req.body || {};

    // Get current question stats before update
    const { totalQuestions: oldQCount, totalMarks: oldTotalMarks } = await resolveTestQuestionsAndMarks(testDocRef, oldData);

    const changedDetails: string[] = [];

    // 1. Title / Name
    if (body.title !== undefined && body.title.trim() !== (oldData.title || '').trim()) {
      changedDetails.push(`Test Title: "${oldData.title || 'Untitled'}" → "${body.title.trim()}"`);
    }

    // 2. Description
    if (body.description !== undefined && body.description.trim() !== (oldData.description || '').trim()) {
      changedDetails.push(`Description updated`);
    }

    // 3. Category
    if (body.category !== undefined && body.category.trim() !== (oldData.category || '').trim()) {
      changedDetails.push(`Category: "${oldData.category || 'General'}" → "${body.category.trim()}"`);
    }

    // 4. Difficulty
    if (body.difficulty !== undefined && body.difficulty.trim() !== (oldData.difficulty || '').trim()) {
      changedDetails.push(`Difficulty: "${oldData.difficulty || 'Intermediate'}" → "${body.difficulty.trim()}"`);
    }

    // 5. Duration
    if (body.duration !== undefined && Number(body.duration) !== Number(oldData.duration)) {
      changedDetails.push(`Duration: ${oldData.duration || 30} mins → ${body.duration} mins`);
    }

    // 6. Start Date
    if (body.startDate !== undefined && body.startDate !== (oldData.startDate || '')) {
      changedDetails.push(`Start Date: ${oldData.startDate || 'Immediate'} → ${body.startDate || 'Immediate'}`);
    }

    // 7. Start Time
    if (body.startTime !== undefined && body.startTime !== (oldData.startTime || '')) {
      changedDetails.push(`Start Time: ${oldData.startTime || 'Immediate'} → ${body.startTime || 'Immediate'}`);
    }

    // 8. End Date
    if (body.endDate !== undefined && body.endDate !== (oldData.endDate || '')) {
      changedDetails.push(`End Date: ${oldData.endDate || 'Flexible'} → ${body.endDate || 'Flexible'}`);
    }

    // 9. End Time
    if (body.endTime !== undefined && body.endTime !== (oldData.endTime || '')) {
      changedDetails.push(`End Time: ${oldData.endTime || 'Flexible'} → ${body.endTime || 'Flexible'}`);
    }

    // 10. Total / Target Questions
    const newTargetQuestions = body.totalQuestions !== undefined
      ? Number(body.totalQuestions)
      : (body.targetQuestions !== undefined ? Number(body.targetQuestions) : oldQCount);
    if ((body.totalQuestions !== undefined || body.targetQuestions !== undefined) && newTargetQuestions !== oldQCount) {
      changedDetails.push(`Total Questions: ${oldQCount} → ${newTargetQuestions}`);
    }

    // 11. Total / Target Marks
    const newTargetMarks = body.totalMarks !== undefined
      ? Number(body.totalMarks)
      : (body.targetMarks !== undefined ? Number(body.targetMarks) : oldTotalMarks);
    if ((body.totalMarks !== undefined || body.targetMarks !== undefined) && newTargetMarks !== oldTotalMarks) {
      changedDetails.push(`Total Marks: ${oldTotalMarks} → ${newTargetMarks}`);
    }

    // 12. Passing Score
    const oldPassing = typeof oldData.passingScore === 'number' ? oldData.passingScore : (typeof oldData.passingMarks === 'number' ? oldData.passingMarks : 40);
    const newPassing = body.passingScore !== undefined ? Number(body.passingScore) : (body.passingMarks !== undefined ? Number(body.passingMarks) : oldPassing);
    if ((body.passingScore !== undefined || body.passingMarks !== undefined) && newPassing !== oldPassing) {
      changedDetails.push(`Passing Score: ${oldPassing}% → ${newPassing}%`);
    }

    // 13. Negative Marking
    if (body.enableNegative !== undefined && Boolean(body.enableNegative) !== Boolean(oldData.enableNegative)) {
      changedDetails.push(`Negative Marking: ${oldData.enableNegative ? `Enabled (${oldData.negativeMarks || 0})` : 'Disabled'} → ${body.enableNegative ? `Enabled (${body.negativeMarks || 0})` : 'Disabled'}`);
    } else if (body.enableNegative && body.negativeMarks !== undefined && Number(body.negativeMarks) !== Number(oldData.negativeMarks)) {
      changedDetails.push(`Negative Penalty: ${oldData.negativeMarks || 0} marks → ${body.negativeMarks} marks`);
    }

    // 14. Assignment Type & Selected Students
    if (body.assignmentType !== undefined && body.assignmentType !== (oldData.assignmentType || 'all')) {
      changedDetails.push(`Assignment Type: "${oldData.assignmentType || 'all'}" → "${body.assignmentType}"`);
    } else if (body.assignmentType === 'selected' && Array.isArray(body.selectedStudentUids)) {
      const oldSelected = Array.isArray(oldData.selectedStudentUids) ? oldData.selectedStudentUids.slice().sort().join(',') : '';
      const newSelected = body.selectedStudentUids.slice().sort().join(',');
      if (oldSelected !== newSelected) {
        changedDetails.push(`Assigned Candidate List updated (${body.selectedStudentUids.length} students)`);
      }
    }

    // 15. Status
    if (body.status !== undefined && body.status !== oldData.status) {
      changedDetails.push(`Status: ${oldData.status || 'draft'} → ${body.status}`);
    }

    // 16. Questions array update (if passed in request body)
    if (Array.isArray(body.questions)) {
      const incomingQCount = body.questions.length;
      if (incomingQCount !== oldQCount && !changedDetails.some(d => d.startsWith('Total Questions:'))) {
        changedDetails.push(`Total Questions: ${oldQCount} → ${incomingQCount}`);
      } else if (!changedDetails.some(d => d.startsWith('Total Questions:'))) {
        changedDetails.push(`Assessment questions updated (${incomingQCount} questions)`);
      }
    }

    // Prepare cleaned update payload for tests document (strip questions array if separate)
    const { questions: incomingQuestions, ...docPayload } = body;

    const updatePayload: any = {
      ...docPayload,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    // Save test doc to Firestore first
    await testDocRef.set(updatePayload, { merge: true });

    // If questions were provided, save them into questions subcollection
    if (Array.isArray(incomingQuestions)) {
      const existingQSnap = await testDocRef.collection('questions').get();
      const existingQIds = new Set(existingQSnap.docs.map(d => d.id));
      const incomingQIds = new Set(incomingQuestions.map((q: any) => q.id || ''));

      const batch = adminDb!.batch();

      // Delete questions no longer present
      existingQSnap.docs.forEach(docSnap => {
        if (!incomingQIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
        }
      });

      // Write updated/new questions
      incomingQuestions.forEach((q: any) => {
        const qId = q.id || testDocRef.collection('questions').doc().id;
        const qRef = testDocRef.collection('questions').doc(qId);
        batch.set(qRef, {
          id: qId,
          questionText: q.questionText || '',
          options: q.options || {},
          correctAnswer: q.correctAnswer || '',
          marks: Number(q.marks) || 1,
          negativeMarks: Number(q.negativeMarks) || 0,
          explanation: q.explanation || '',
        });
      });

      await batch.commit();
    }

    // Handle student assignments update if provided
    if (body.assignmentType === 'selected' && Array.isArray(body.selectedStudentUids)) {
      const oldAssigned = await testDocRef.collection('assignedStudents').get();
      const batch = adminDb!.batch();
      oldAssigned.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();

      for (const uid of body.selectedStudentUids) {
        const uSnap = await adminDb!.collection('users').doc(uid).get();
        const uData = uSnap.exists ? uSnap.data() || {} : {};
        await testDocRef.collection('assignedStudents').doc(uid).set({
          uid,
          fullName: uData.name || uData.fullName || uData.displayName || 'Student',
          email: uData.email || '',
          assignedAt: admin.firestore.Timestamp.now(),
        });
      }
    }

    // Authoritative resolution of updated question count & marks
    const { totalQuestions: finalQCount, totalMarks: finalTotalMarks } = await resolveTestQuestionsAndMarks(testDocRef, updatePayload);
    await testDocRef.set({ totalQuestions: finalQCount, totalMarks: finalTotalMarks }, { merge: true });

    // Trigger Brevo emails if there are student-visible changes on a published/scheduled test
    const finalTitle = body.title || oldData.title || 'Assessment';
    try {
      await triggerTestUpdateEmailsAsync(testId, finalTitle, changedDetails, {
        ...updatePayload,
        totalQuestions: finalQCount,
        totalMarks: finalTotalMarks,
      });
    } catch (emailErr: any) {
      console.error('Email dispatch failed:', emailErr);
      res.status(500).json({
        success: false,
        message: 'Test updated in database, but failed to send update emails: ' + emailErr.message,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test updated successfully and emails dispatched.',
      changedDetails,
      totalQuestions: finalQCount,
      totalMarks: finalTotalMarks,
    });
  } catch (error: any) {
    console.error('Update test error:', error);
    res.status(500).json({ success: false, message: 'Failed to update test: ' + (error?.message || error) });
  }
});

// PATCH /api/tests/:testId/publish -> Validate and update status of existing test to published or scheduled
router.patch('/:testId/publish', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const { testId } = req.params;
  try {
    const testDocRef = adminDb!.collection('tests').doc(testId);
    const testSnap = await testDocRef.get();

    if (!testSnap.exists) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    const testData = testSnap.data() || {};

    // Validate that questions exist in subcollection or root
    const { totalQuestions, totalMarks } = await resolveTestQuestionsAndMarks(testDocRef, testData);
    if (totalQuestions === 0) {
      res.status(400).json({ success: false, message: 'Cannot publish a test with zero questions. Please add questions first.' });
      return;
    }

    // Check if immediate or scheduled availability window details
    const availabilityType = testData.availabilityType || 'immediate';
    let targetStatus: 'published' | 'scheduled' | 'expired' = 'published';

    if (availabilityType === 'scheduled' || availabilityType === 'later') {
      const startDate = testData.startDate;
      const startTime = testData.startTime;
      const endDate = testData.endDate;
      const endTime = testData.endTime;

      if (!startDate || !startTime || !endDate || !endTime) {
        res.status(400).json({ success: false, message: 'Scheduled tests must specify start and end dates/times.' });
        return;
      }

      const now = new Date();
      const schedStart = new Date(`${startDate}T${startTime}:00+05:30`);
      const schedEnd = new Date(`${endDate}T${endTime}:00+05:30`);

      if (schedEnd <= now) {
        targetStatus = 'expired';
      } else if (schedStart > now) {
        targetStatus = 'scheduled';
      } else {
        targetStatus = 'published';
      }
    }

    // Update document in Firestore
    const publishedAt = admin.firestore.Timestamp.now();
    const updatePayload = {
      status: targetStatus,
      totalQuestions,
      totalMarks,
      publishedAt,
      updatedAt: publishedAt,
    };

    await testDocRef.update(updatePayload);

    // Async trigger Brevo emails for publication
    try {
      await triggerTestUpdateEmailsAsync(
        testId,
        testData.title || 'Assessment',
        [`Assessment published and made available (Status: ${targetStatus.toUpperCase()})`],
        { ...testData, status: targetStatus, totalQuestions, totalMarks }
      );
    } catch (emailErr: any) {
      console.warn('Publish email dispatch warning:', emailErr);
      // We still return success since the test was successfully published
    }

    res.json({
      success: true,
      message: 'Test published successfully',
      test: {
        id: testId,
        title: testData.title || '',
        status: targetStatus,
        totalQuestions,
        totalMarks,
      }
    });
  } catch (error: any) {
    console.error('Publish test error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while publishing test.' });
  }
});

// Helper function to calculate server-side schedule bounds
const getTestScheduleBoundsServer = (testData: any) => {
  if (!testData || testData.availabilityType === 'immediate') {
    const createdMs = testData?.createdAt?.toDate ? testData.createdAt.toDate().getTime() : Date.now();
    return {
      startTimeMs: createdMs,
      endTimeMs: createdMs + 365 * 24 * 60 * 60 * 1000,
    };
  }
  const sDate = testData.startDate || '';
  const sTime = testData.startTime || '00:00';
  const eDate = testData.endDate || sDate;
  const eTime = testData.endTime || '23:59';

  // Force parse as IST (+05:30) to match the Indian local time selected by users in the UI
  const startMs = new Date(`${sDate}T${sTime}:00+05:30`).getTime();
  const endMs = new Date(`${eDate}T${eTime}:00+05:30`).getTime();

  return {
    startTimeMs: isNaN(startMs) ? 0 : startMs,
    endTimeMs: isNaN(endMs) ? Date.now() + 365 * 24 * 60 * 60 * 1000 : endMs,
  };
};

// POST /api/tests/:testId/start -> Validates test schedule, assignment, and existing completions before allowing start
router.post('/:testId/start', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const { testId } = req.params;
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const testDocRef = adminDb!.collection('tests').doc(testId);
    const testSnap = await testDocRef.get();

    if (!testSnap.exists) {
      res.status(404).json({ success: false, message: 'Test not found.' });
      return;
    }

    const testData = testSnap.data() || {};
    const nowMs = Date.now();

    // Defense-in-depth Mobile / Tablet device restriction safeguard
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const mobileUARegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|samsungbrowser|silk|kindle/i;

    if (mobileUARegex.test(userAgent)) {
      res.status(403).json({
        success: false,
        message: 'Proctored assessments can only be taken on a desktop or laptop computer.',
      });
      return;
    }

    // Check assignment for selected assignmentType
    if (testData.assignmentType === 'selected') {
      const assignedDoc = await testDocRef.collection('assignedStudents').doc(userId).get();
      if (!assignedDoc.exists && req.user?.role !== 'admin') {
        res.status(403).json({ success: false, message: 'You are not assigned to this test.' });
        return;
      }
    }

    // Check existing attempts for this user & test safely (prevents missing index errors)
    let activeAttempt: any = null;
    let isCompleted = false;

    try {
      const attemptsSnap = await adminDb!.collection('testAttempts')
        .where('userId', '==', userId)
        .get();

      attemptsSnap.forEach(aDoc => {
        const a = aDoc.data();
        if (a.testId === testId) {
          if (a.status === 'submitted' || a.status === 'auto_submitted') {
            isCompleted = true;
          } else if (a.status === 'in_progress') {
            activeAttempt = { id: aDoc.id, ...a };
          }
        }
      });
    } catch (attemptsErr) {
      console.warn('[Start Test] Safe attempts fetch fallback:', attemptsErr);
    }

    if (isCompleted) {
      res.status(400).json({ success: false, message: 'Test has already been completed.' });
      return;
    }

    // Validate test schedule bounds
    const { startTimeMs, endTimeMs } = getTestScheduleBoundsServer(testData);

    if (nowMs < startTimeMs) {
      res.status(400).json({ success: false, message: 'Test has not started yet.' });
      return;
    }

    if (nowMs >= endTimeMs) {
      res.status(400).json({ success: false, message: 'Test window has ended.' });
      return;
    }

    if (activeAttempt) {
      const durationMs = (testData.duration || 30) * 60 * 1000;
      const startedMs = activeAttempt.startedAtMs || nowMs;
      const resumeExpiresAtMs = Math.min(startedMs + durationMs, endTimeMs);

      res.json({
        success: true,
        isResume: true,
        attempt: {
          ...activeAttempt,
          expiresAtMs: resumeExpiresAtMs,
        },
      });
      return;
    }

    // Compute expiresAtMs (never exceed scheduled endTimeMs!)
    const durationMs = (testData.duration || 30) * 60 * 1000;
    const expiresAtMs = Math.min(nowMs + durationMs, endTimeMs);

    res.json({
      success: true,
      isResume: false,
      startedAtMs: nowMs,
      expiresAtMs,
    });
  } catch (error: any) {
    console.error('Start test error:', error);
    res.status(500).json({ success: false, message: 'Internal server error validating test start.' });
  }
});

// POST /api/tests/attempts/:attemptId/submit -> Validates, calculates score server-side, and submits attempt
router.post('/attempts/:attemptId/submit', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const { attemptId } = req.params;
  const { submissionReason, exitCount } = req.body;
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const attemptDocRef = adminDb!.collection('testAttempts').doc(attemptId);
    const attemptSnap = await attemptDocRef.get();

    if (!attemptSnap.exists) {
      res.status(404).json({ success: false, message: 'Test attempt not found.' });
      return;
    }

    const attemptData = attemptSnap.data() || {};

    // Ownership check
    if (attemptData.userId !== userId && req.user?.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: You do not own this test attempt.' });
      return;
    }

    // Idempotency check: If already submitted or auto-submitted, return existing result without re-calculation
    if (attemptData.status !== 'in_progress') {
      res.json({
        success: true,
        message: 'Test attempt already submitted.',
        attempt: {
          id: attemptId,
          ...attemptData,
        },
      });
      return;
    }

    const testId = attemptData.testId;
    const testDocRef = adminDb!.collection('tests').doc(testId);
    const testSnap = await testDocRef.get();
    const testData = testSnap.exists ? testSnap.data() || {} : {};

    // Fetch questions from tests/{testId}/questions
    const questionsSnap = await testDocRef.collection('questions').get();
    const questionsMap = new Map<string, any>();
    let testTotalMarks = 0;

    questionsSnap.forEach(qDoc => {
      const q = qDoc.data();
      questionsMap.set(qDoc.id, q);
      testTotalMarks += (q.marks || 0);
    });

    // Fetch submitted answers from testAttempts/{attemptId}/answers
    const answersSnap = await attemptDocRef.collection('answers').get();
    const answersMap = new Map<string, string>();
    answersSnap.forEach(aDoc => {
      const a = aDoc.data();
      if (a.selectedOption) {
        answersMap.set(aDoc.id, a.selectedOption);
      }
    });

    // Calculate score & statistics server-side
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unanswered = 0;
    let totalScore = 0;

    questionsMap.forEach((q, qId) => {
      const selected = answersMap.get(qId);
      if (!selected) {
        unanswered++;
      } else {
        const isCorrect = (selected.trim().toUpperCase() === String(q.correctAnswer || '').trim().toUpperCase());
        if (isCorrect) {
          correctAnswers++;
          totalScore += (q.marks || 0);
        } else {
          wrongAnswers++;
          const neg = Math.abs(q.negativeMarks || 0);
          totalScore -= neg;
        }
      }
    });

    const finalScore = Math.max(0, Math.round(totalScore * 100) / 100);
    const totalPossibleMarks = testTotalMarks || attemptData.totalMarks || 100;
    const percentage = Math.min(100, Math.max(0, Math.round((finalScore / totalPossibleMarks) * 100 * 100) / 100));

    // Calculate pass/fail status using test passingScore (defaults to 40%)
    const passingScore = typeof testData.passingScore === 'number' ? testData.passingScore : 40;
    const passStatus = percentage >= passingScore ? 'PASSED' : 'FAILED';

    const finalReason = submissionReason || 'manual_submission';
    const finalStatus = (finalReason === 'manual_submission') ? 'submitted' : 'auto_submitted';
    const finalExitCount = typeof exitCount === 'number' ? exitCount : (attemptData.exitCount || 0);
    const submittedAt = admin.firestore.Timestamp.now();

    const updatePayload = {
      status: finalStatus,
      submissionReason: finalReason,
      submittedAt,
      exitCount: finalExitCount,
      score: finalScore,
      correctAnswers,
      wrongAnswers,
      unanswered,
      totalMarks: totalPossibleMarks,
      percentage,
      passingScore,
      passStatus,
      updatedAt: submittedAt,
    };

    await attemptDocRef.update(updatePayload);

    const updatedAttempt = {
      id: attemptId,
      ...attemptData,
      ...updatePayload,
    };

    console.log(`[TestSubmit] Attempt ${attemptId} submitted successfully. Status: ${finalStatus}, Score: ${finalScore}/${totalPossibleMarks}`);

    res.json({
      success: true,
      message: 'Test submitted successfully.',
      attempt: updatedAttempt,
    });
  } catch (error: any) {
    console.error('Submit test attempt error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while submitting test.' });
  }
});

// GET /api/tests/attempts/:attemptId -> Fetch single attempt details
router.get('/attempts/:attemptId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const { attemptId } = req.params;

  try {
    const attemptDocRef = adminDb!.collection('testAttempts').doc(attemptId);
    const attemptSnap = await attemptDocRef.get();

    if (!attemptSnap.exists) {
      res.status(404).json({ success: false, message: 'Attempt not found.' });
      return;
    }

    const attemptData = attemptSnap.data() || {};
    res.json({ success: true, attempt: { id: attemptId, ...attemptData } });
  } catch (error: any) {
    console.error('Fetch attempt error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attempt.' });
  }
});

// DELETE /api/tests/clear-data/student -> Deletes authenticated student's attempt history & answers
router.delete('/clear-data/student', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const attemptsSnap = await adminDb!.collection('testAttempts').where('userId', '==', userId).get();
    if (attemptsSnap.empty) {
      res.json({ success: true, message: 'Data cleared successfully', deletedCount: 0 });
      return;
    }

    const deletePromises = attemptsSnap.docs.map(async (docSnap) => {
      try {
        const answersSnap = await docSnap.ref.collection('answers').get();
        const batch = adminDb!.batch();
        answersSnap.forEach(aDoc => batch.delete(aDoc.ref));
        batch.delete(docSnap.ref);
        await batch.commit();
      } catch (err) {
        await docSnap.ref.delete().catch(() => {});
      }
    });

    await Promise.all(deletePromises);

    console.log(`[Clear Data] Student assessment data cleared for UID: ${userId} (${attemptsSnap.docs.length} attempts deleted)`);
    res.json({ success: true, message: 'Data cleared successfully' });
  } catch (error: any) {
    console.error('Clear student data error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear student assessment data.' });
  }
});

// DELETE /api/tests/clear-data/admin -> Deletes all candidate attempts & submission records
router.delete('/clear-data/admin', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireDb(res)) return;

  try {
    const attemptsSnap = await adminDb!.collection('testAttempts').get();
    if (attemptsSnap.empty) {
      res.json({ success: true, message: 'Data cleared successfully', deletedCount: 0 });
      return;
    }

    const deletePromises = attemptsSnap.docs.map(async (docSnap) => {
      try {
        const answersSnap = await docSnap.ref.collection('answers').get();
        const batch = adminDb!.batch();
        answersSnap.forEach(aDoc => batch.delete(aDoc.ref));
        batch.delete(docSnap.ref);
        await batch.commit();
      } catch (err) {
        console.warn(`[Clear Data Admin] Single attempt delete error on ${docSnap.id}:`, err);
        await docSnap.ref.delete().catch(() => {});
      }
    });

    await Promise.all(deletePromises);

    console.log(`[Clear Data] All candidate test attempts (${attemptsSnap.docs.length}) cleared by Admin: ${req.user?.uid}`);
    res.json({ success: true, message: 'Data cleared successfully', deletedCount: attemptsSnap.docs.length });
  } catch (error: any) {
    console.error('Clear admin data error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear candidate assessment data.' });
  }
});

export default router;

