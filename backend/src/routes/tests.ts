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

const triggerTestUpdateEmailsAsync = async (testId: string, testTitle: string, changedDetails: string[], testData: any) => {
  try {
    if (!adminDb) return;

    console.log(`[Test Update]\nTest updated successfully: ${testId}`);

    const testDocRef = adminDb.collection('tests').doc(testId);
    const testSnap = await testDocRef.get();
    const currentData = testSnap.exists ? { ...testSnap.data(), ...testData } : testData;

    const assignmentType = currentData.assignmentType || 'all';
    const recipientsMap = new Map<string, { email: string; name: string }>();

    if (assignmentType === 'all') {
      const usersSnap = await adminDb.collection('users').get();
      usersSnap.forEach((uDoc) => {
        const u = uDoc.data();
        const rawEmail = u.email ? String(u.email).trim().toLowerCase() : '';
        const role = (u.role || '').toLowerCase();

        if (rawEmail && role !== 'admin' && rawEmail !== 'nandeeshmn12@gmail.com') {
          let rawName = u.name || u.fullName || u.displayName || '';
          if (!rawName || rawName.includes('@')) {
            const prefix = rawEmail.split('@')[0];
            rawName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
          }
          recipientsMap.set(rawEmail, { email: rawEmail, name: rawName });
        }
      });
    } else {
      const assignedUids = new Set<string>(
        Array.isArray(currentData.selectedStudentUids) ? currentData.selectedStudentUids : []
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
          const u = uSnap.data() || {};
          const rawEmail = u.email ? String(u.email).trim().toLowerCase() : '';
          if (rawEmail) {
            let rawName = u.name || u.fullName || u.displayName || '';
            if (!rawName || rawName.includes('@')) {
              const prefix = rawEmail.split('@')[0];
              rawName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            }
            recipientsMap.set(rawEmail, { email: rawEmail, name: rawName });
          }
        }
      }
    }

    const recipients = Array.from(recipientsMap.values());
    console.log(`[Test Update Email]\nEligible recipients: ${recipients.length}`);

    if (recipients.length > 0) {
      console.log(`[Test Update Email]\nDispatch started`);

      const effectiveChanges = changedDetails && changedDetails.length > 0
        ? changedDetails
        : ['Assessment configuration or schedule has been updated.'];

      const batchStats = await sendBatchTestUpdateEmails(recipients, {
        testTitle: testTitle || currentData.title || 'Assessment',
        changedDetails: effectiveChanges,
        startDate: currentData.startDate,
        startTime: currentData.startTime,
        endDate: currentData.endDate,
        endTime: currentData.endTime,
        duration: currentData.duration,
      });

      console.log(`[Test Update Email]\nCompleted: ${batchStats.sentCount}\nFailed: ${batchStats.failedCount}`);
    } else {
      console.log(`[Test Update Email]\nNotice: No eligible recipients found for test ${testId}`);
    }
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
    const nowMs = Date.now();

    // SERVER-TIME AUTHORITATIVE EDIT LOCK ENFORCEMENT
    // Once scheduled start time has been reached, editing is permanently locked on backend.
    const availabilityType = oldData.availabilityType || 'later';
    let startMs = 0;

    if (availabilityType === 'immediate') {
      startMs = oldData.createdAt?.toDate ? oldData.createdAt.toDate().getTime() : 0;
    } else {
      const sDate = oldData.startDate || '';
      const sTime = oldData.startTime || '00:00';
      startMs = new Date(`${sDate}T${sTime}:00+05:30`).getTime();
    }

    if (startMs > 0 && nowMs >= startMs) {
      res.status(403).json({
        success: false,
        message: 'Test has already started and can no longer be edited after the scheduled start time.',
      });
      return;
    }

    const body = req.body || {};

    const changedDetails: string[] = [];

    if (body.title && body.title.trim() !== oldData.title) {
      changedDetails.push(`Test Title: "${oldData.title || 'Untitled'}" → "${body.title.trim()}"`);
    }
    if (body.description !== undefined && body.description.trim() !== oldData.description) {
      changedDetails.push(`Description updated`);
    }
    if (body.duration !== undefined && Number(body.duration) !== Number(oldData.duration)) {
      changedDetails.push(`Duration: ${oldData.duration || 0} mins → ${body.duration} mins`);
    }
    if (body.startDate && body.startDate !== oldData.startDate) {
      changedDetails.push(`Start Date: ${oldData.startDate || 'N/A'} → ${body.startDate}`);
    }
    if (body.startTime && body.startTime !== oldData.startTime) {
      changedDetails.push(`Start Time: ${oldData.startTime || 'N/A'} → ${body.startTime}`);
    }
    if (body.endDate && body.endDate !== oldData.endDate) {
      changedDetails.push(`End Date: ${oldData.endDate || 'N/A'} → ${body.endDate}`);
    }
    if (body.endTime && body.endTime !== oldData.endTime) {
      changedDetails.push(`End Time: ${oldData.endTime || 'N/A'} → ${body.endTime}`);
    }
    if (body.targetQuestions !== undefined && Number(body.targetQuestions) !== Number(oldData.targetQuestions)) {
      changedDetails.push(`Total Questions: ${oldData.targetQuestions || 0} → ${body.targetQuestions}`);
    }
    if (body.targetMarks !== undefined && Number(body.targetMarks) !== Number(oldData.targetMarks)) {
      changedDetails.push(`Total Marks: ${oldData.targetMarks || 0} → ${body.targetMarks}`);
    }
    if (body.enableNegative !== undefined && Boolean(body.enableNegative) !== Boolean(oldData.enableNegative)) {
      changedDetails.push(`Negative Marking: ${oldData.enableNegative ? `Enabled (${oldData.negativeMarks || 0})` : 'Disabled'} → ${body.enableNegative ? `Enabled (${body.negativeMarks || 0})` : 'Disabled'}`);
    } else if (body.enableNegative && body.negativeMarks !== undefined && Number(body.negativeMarks) !== Number(oldData.negativeMarks)) {
      changedDetails.push(`Negative Penalty: ${oldData.negativeMarks || 0} marks → ${body.negativeMarks} marks`);
    }
    if (body.status && body.status !== oldData.status) {
      changedDetails.push(`Status: ${oldData.status || 'draft'} → ${body.status}`);
    }

    const updatePayload: any = {
      ...body,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await testDocRef.set(updatePayload, { merge: true });

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

    // Trigger async Brevo emails if there are meaningful change details
    const finalTitle = body.title || oldData.title || 'Assessment';
    try {
      await triggerTestUpdateEmailsAsync(testId, finalTitle, changedDetails, updatePayload);
    } catch (emailErr: any) {
      console.error('Email dispatch failed:', emailErr);
      res.status(500).json({ success: false, message: 'Test updated in database, but failed to send update emails: ' + emailErr.message });
      return;
    }

    // Respond to Admin UI after email finishes
    res.json({
      success: true,
      message: 'Test updated successfully and emails dispatched.',
      changedDetails,
    });
  } catch (error: any) {
    console.error('Update test error:', error);
    res.status(500).json({ success: false, message: 'Failed to update test.' });
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

    // Validate that questions exist in subcollection
    const questionsSnap = await testDocRef.collection('questions').get();
    if (questionsSnap.empty) {
      res.status(400).json({ success: false, message: 'Cannot publish a test with zero questions. Please add questions first.' });
      return;
    }

    // Determine counts and marks sum to update test doc
    let totalQuestions = 0;
    let totalMarks = 0;
    questionsSnap.forEach(qDoc => {
      const q = qDoc.data();
      totalQuestions++;
      totalMarks += (q.marks || 0);
    });

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

    // Async trigger Brevo emails for publication
    triggerTestUpdateEmailsAsync(
      testId,
      testData.title || 'Assessment',
      [`Assessment published and made available (Status: ${targetStatus.toUpperCase()})`],
      { ...testData, status: targetStatus }
    );
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

