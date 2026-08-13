import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/auth/Logo';
import { downloadCandidateResultCardPNG } from './ResultsView';
import { useActionConfirmation } from '../context/ActionConfirmationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  Maximize,
  ShieldAlert,
  CheckSquare,
  Square,
  XCircle,
  HelpCircle,
  Download,
  MonitorX
} from 'lucide-react';
import { checkIsMobileDevice } from '../utils/deviceDetection';
/**
 * Calculates candidate's authoritative effective test expiration timestamp in milliseconds.
 * Caps personal candidate duration by absolute scheduled test end time (for late joiners).
 */
export const getEffectiveTestEndTimeMs = (testData: any, startedAtMs: number): number => {
  if (!testData) return startedAtMs + 30 * 60 * 1000;

  const durationMins = Number(testData.duration) || 30;
  const durationExpiryMs = startedAtMs + durationMins * 60 * 1000;

  if (testData.availabilityType === 'immediate') {
    return durationExpiryMs;
  }

  const sDate = testData.startDate || '';
  const eDate = testData.endDate || sDate;
  const eTime = testData.endTime || '23:59';

  if (!eDate || !eTime) {
    return durationExpiryMs;
  }

  const scheduledEndMs = new Date(`${eDate}T${eTime}:00`).getTime();

  if (isNaN(scheduledEndMs)) {
    return durationExpiryMs;
  }

  // Effective end time is whichever comes EARLIER: candidate duration expiry OR scheduled test window end time!
  return Math.min(durationExpiryMs, scheduledEndMs);
};

export const TestExecutionView: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showConfirmation } = useActionConfirmation();

  // Mode: 'instructions' | 'active' | 'result'
  const [viewMode, setViewMode] = useState<'instructions' | 'active' | 'result'>('instructions');

  // Test & Questions data
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Browser Tab Title Management for Active Test Assessment
  useEffect(() => {
    if (testData?.title) {
      document.title = `AptiGuard | ${testData.title}`;
    } else {
      document.title = 'AptiGuard | Test';
    }
  }, [testData]);
  const [agreedInstructions, setAgreedInstructions] = useState(false);

  const [attemptId, setAttemptId] = useState<string>('');
  const [expiresAtMs, setExpiresAtMs] = useState<number>(0);
  const [exitCount, setExitCount] = useState<number>(0);
  const [_submitToastInfo, setSubmitToastInfo] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // Question Navigation State
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  // Proctoring & Modals State
  const [warningModal, setWarningModal] = useState<{ show: boolean; level: number; message: string }>({
    show: false,
    level: 0,
    message: '',
  });
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Submission Result State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [candidateName, setCandidateName] = useState<string>('');
  const [isMobileBlocked, setIsMobileBlocked] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasSubmittedRef = useRef<boolean>(false);

  // Download Purpose-Built PNG Result Card using Canvas 2D engine
  const handleDownloadResultCardPNG = () => {
    const candName = candidateName || resultData?.userName || resultData?.candidateName || currentUser?.displayName || 'Candidate';
    downloadCandidateResultCardPNG(resultData || {}, candName);
  };

  // Timer state (seconds remaining)
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Debounce ref for proctoring violations
  const lastViolationTime = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------
  // 1. FETCH TEST & RESTORE EXISTING ATTEMPT ON MOUNT
  // -------------------------------------------------------------
  useEffect(() => {
    const fetchTestAndAttempt = async () => {
      if (!testId || !currentUser) return;

      // Mobile / Tablet Direct URL Protection Safeguard
      if (checkIsMobileDevice()) {
        setIsMobileBlocked(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch canonical candidate profile from Firestore users collection
        const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
        let resolvedName = '';
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          resolvedName = uData.name || uData.fullName || uData.displayName || '';
        }
        if (!resolvedName || resolvedName.includes('@')) {
          resolvedName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Candidate Student');
        }
        setCandidateName(resolvedName);

        // Fetch Test Document
        const testRef = doc(db, 'tests', testId);
        const testSnap = await getDoc(testRef);

        if (!testSnap.exists()) {
          alert('Test not found.');
          navigate('/dashboard');
          return;
        }

        const tData = { id: testSnap.id, ...testSnap.data() };
        setTestData(tData);

        // Fetch Questions
        const qSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
        const qList: any[] = [];
        qSnap.forEach((qDoc) => {
          qList.push({ id: qDoc.id, ...qDoc.data() });
        });

        if (qList.length === 0) {
          alert('This assessment has no questions configured.');
          navigate('/dashboard');
          return;
        }

        setQuestions(qList);

        // Check existing attempts for this candidate & test (single fast query)
        const attemptsSnap = await getDocs(
          query(
            collection(db, 'testAttempts'),
            where('userId', '==', currentUser.uid),
            where('testId', '==', testId)
          )
        );

        if (!attemptsSnap.empty) {
          let activeDocSnap: any = null;
          let completedDocSnap: any = null;

          attemptsSnap.forEach((d) => {
            const data = d.data();
            if (data.status === 'submitted' || data.status === 'auto_submitted') {
              completedDocSnap = { id: d.id, ...data };
            } else if (data.status === 'in_progress') {
              activeDocSnap = { id: d.id, ...data };
            }
          });

          if (completedDocSnap) {
            // Already completed — show result directly, prevent re-taking
            setResultData(completedDocSnap);
            setViewMode('result');
            setLoading(false);
            return;
          }

          if (activeDocSnap) {
            // Active attempt exists — restore seamlessly upon reload!
            const attId = activeDocSnap.id;
            const nowMs = Date.now();
            const attStartedMs = activeDocSnap.startedAtMs || nowMs;
            const effectiveExpMs = activeDocSnap.expiresAtMs || getEffectiveTestEndTimeMs(tData, attStartedMs);

            if (nowMs >= effectiveExpMs) {
              // Attempt expired while away/reloading — auto-submit
              setAttemptId(attId);
              handleAutoSubmit(attId, 'time_expired', activeDocSnap.exitCount || 0, qList, tData);
              setLoading(false);
              return;
            }

            setAttemptId(attId);
            setExpiresAtMs(effectiveExpMs);
            setExitCount(activeDocSnap.exitCount || 0);
            setCurrentIndex(activeDocSnap.currentQuestion || 0);
            if (activeDocSnap.markedQuestions) setMarked(activeDocSnap.markedQuestions);

            // Restore saved answers from both root answers object and subcollection
            const restoredAnswers: Record<string, string> = { ...(activeDocSnap.answers || {}) };
            try {
              const answersSnap = await getDocs(collection(db, 'testAttempts', attId, 'answers'));
              answersSnap.forEach((ansDoc) => {
                const data = ansDoc.data();
                if (data.selectedOption) {
                  restoredAnswers[ansDoc.id] = data.selectedOption;
                }
              });
            } catch (ansErr) {
              console.warn('[RestoreAnswers] Notice fetching answers subcollection:', ansErr);
            }

            setAnswers(restoredAnswers);
            setViewMode('active');
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error initializing test execution:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTestAndAttempt();
  }, [testId, currentUser]);

  // -------------------------------------------------------------
  // 2. START NEW TEST ATTEMPT WITH BACKEND AUTHORITATIVE VALIDATION
  // -------------------------------------------------------------
  const handleStartTest = async () => {
    if (!agreedInstructions || !testData || !currentUser || !testId) return;

    try {
      // Call Backend Validation Endpoint first
      const idToken = await currentUser.getIdToken();
      let startRes: any = null;
      try {
        const res = await fetch(`\${import.meta.env.VITE_API_URL}/api/tests/${testId}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });
        startRes = await res.json();
      } catch (apiErr) {
        console.warn('[StartTest] API start endpoint call failed, using client fallback:', apiErr);
      }

      if (startRes && !startRes.success) {
        if (startRes.message && !startRes.message.includes('Internal server error')) {
          alert(`Cannot start test: ${startRes.message}`);
          navigate('/dashboard');
          return;
        }
        console.warn('[StartTest] Server validation returned 500, falling back to client-side test start:', startRes);
      }

      const nowMs = startRes?.startedAtMs || startRes?.attempt?.startedAtMs || Date.now();
      const effectiveExpMs = startRes?.expiresAtMs || startRes?.attempt?.expiresAtMs || getEffectiveTestEndTimeMs(testData, nowMs);

      if (startRes && startRes.isResume && startRes.attempt) {
        // Resume active attempt
        setAttemptId(startRes.attempt.id);
        setExpiresAtMs(effectiveExpMs);
        setExitCount(startRes.attempt.exitCount || 0);
        setCurrentIndex(startRes.attempt.currentQuestion || 0);
        setViewMode('active');
        return;
      }

      // Request browser Fullscreen mode
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      // Generate unique attempt doc ID
      const newAttemptRef = doc(collection(db, 'testAttempts'));
      const newAttemptId = newAttemptRef.id;

      const attemptPayload = {
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        userName: candidateName || currentUser.displayName || 'Candidate Student',
        candidateName: candidateName || currentUser.displayName || 'Candidate Student',
        name: candidateName || currentUser.displayName || 'Candidate Student',
        testId: testId,
        testTitle: testData.title || 'Assessment',
        startedAt: serverTimestamp(),
        startedAtMs: nowMs,
        expiresAtMs: effectiveExpMs,
        submittedAt: null,
        status: 'in_progress',
        currentQuestion: 0,
        exitCount: 0,
        totalQuestions: questions.length,
        totalMarks: testData.targetMarks || 100,
        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        unanswered: questions.length,
        percentage: 0,
        submissionReason: null,
        markedQuestions: {},
      };

      // Open exam session immediately (< 30ms response!)
      setAttemptId(newAttemptId);
      setExpiresAtMs(effectiveExpMs);
      setExitCount(0);
      setCurrentIndex(0);
      setAnswers({});
      setMarked({});
      setViewMode('active');

      // Persist attempt record in Firestore asynchronously
      setDoc(newAttemptRef, attemptPayload).catch((err) => {
        console.warn('[StartTest] Background attempt persist notice:', err);
      });
    } catch (err) {
      console.error('Error starting test attempt:', err);
      alert('Failed to start test attempt. Please check connection.');
    }
  };

  // -------------------------------------------------------------
  // 3. TIMER COUNTDOWN & EXPIRY
  // -------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== 'active' || !expiresAtMs) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        handleAutoSubmit(attemptId, 'time_expired', exitCount, questions, testData);
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [viewMode, expiresAtMs, attemptId, exitCount, questions, testData]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------------------------
  // 4. ANSWER SELECTION & INSTANT AUTO-SAVE
  // -------------------------------------------------------------
  const handleSelectOption = (optionKey: string) => {
    if (viewMode !== 'active' || !questions[currentIndex]) return;

    const qId = questions[currentIndex].id;

    // Instant local state update (< 1ms)
    setAnswers((prev) => ({ ...prev, [qId]: optionKey }));

    // Non-blocking background persistence to both subcollection and attempt root doc
    if (attemptId) {
      const answerDocRef = doc(db, 'testAttempts', attemptId, 'answers', qId);
      setDoc(answerDocRef, {
        questionId: qId,
        selectedOption: optionKey,
        answeredAt: serverTimestamp(),
      }).catch((err) => console.warn('[AutoSaveAnswer] Subcollection write notice:', err));

      updateDoc(doc(db, 'testAttempts', attemptId), {
        [`answers.${qId}`]: optionKey,
        currentQuestion: currentIndex,
      }).catch((err) => console.warn('[AutoSaveAnswer] Root doc write notice:', err));
    }
  };

  // Toggle Mark for Review
  const handleToggleMark = async () => {
    if (viewMode !== 'active' || !questions[currentIndex]) return;
    const qId = questions[currentIndex].id;
    const nextMarked = { ...marked, [qId]: !marked[qId] };
    setMarked(nextMarked);

    if (attemptId) {
      try {
        await updateDoc(doc(db, 'testAttempts', attemptId), {
          markedQuestions: nextMarked,
          currentQuestion: currentIndex,
        });
      } catch (err) {
        console.error('Error updating marked status:', err);
      }
    }
  };

  // Navigate Questions
  const handleNavigateQuestion = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= questions.length) return;
    setCurrentIndex(newIdx);
    if (attemptId) {
      updateDoc(doc(db, 'testAttempts', attemptId), { currentQuestion: newIdx }).catch(() => {});
    }
  };

  // -------------------------------------------------------------
  // 5. PROCTORING & VIOLATION DETECTION (FULLSCREEN / VISIBILITY)
  // -------------------------------------------------------------
  const recordViolation = useCallback(
    async (type: 'fullscreen_exit' | 'tab_switch' | 'window_blur') => {
      if (viewMode !== 'active' || !attemptId || isSubmitting) return;

      const now = Date.now();
      // Debounce duplicate events within 1200ms
      if (now - lastViolationTime.current < 1200) return;
      lastViolationTime.current = now;

      const newExitCount = exitCount + 1;
      setExitCount(newExitCount);

      // Log proctoring event to subcollection
      try {
        await addDoc(collection(db, 'testAttempts', attemptId, 'proctoringEvents'), {
          type,
          timestamp: serverTimestamp(),
          violationNumber: newExitCount,
        });
        await updateDoc(doc(db, 'testAttempts', attemptId), { exitCount: newExitCount });
      } catch (err) {
        console.error('Error logging proctoring event:', err);
      }

      // Handle 3-exit rule warnings & auto-submission
      if (newExitCount === 1) {
        setWarningModal({
          show: true,
          level: 1,
          message: '⚠️ Fullscreen Exit / Tab Switch Detected\n\nThis is Warning 1 of 3.\nPlease return to fullscreen mode to continue the test.',
        });
      } else if (newExitCount === 2) {
        setWarningModal({
          show: true,
          level: 2,
          message: '⚠️ Second Violation Detected\n\nThis is Warning 2 of 3.\nOne more violation will automatically submit your test!',
        });
      } else if (newExitCount >= 3) {
        setWarningModal({
          show: true,
          level: 3,
          message: '🚨 Maximum Violations Reached\n\nYou have exited fullscreen 3 times. Your test is being automatically submitted now.',
        });
        setTimeout(() => {
          handleAutoSubmit(attemptId, 'maximum_exit_limit', newExitCount, questions, testData);
        }, 1500);
      }
    },
    [viewMode, attemptId, exitCount, isSubmitting, questions, testData]
  );

  useEffect(() => {
    if (viewMode !== 'active') return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      recordViolation('window_blur');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [viewMode, recordViolation]);

  // Prevent Navigation / Tab Close
  useEffect(() => {
    if (viewMode !== 'active') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your test assessment is currently in progress. Navigating away will record a proctoring violation.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [viewMode]);

  // -------------------------------------------------------------
  // 6. TEST SUBMISSION (MANUAL & AUTOMATIC)
  // -------------------------------------------------------------
  const handleAutoSubmit = async (
    attId: string,
    reason: 'time_expired' | 'maximum_exit_limit',
    finalExits: number,
    qList: any[],
    tData: any
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await submitTestAttempt(attId, reason, finalExits, qList, tData);
  };

  const handleManualSubmit = async () => {
    setShowSubmitConfirm(false);
    if (isSubmitting || !attemptId) return;
    setIsSubmitting(true);
    await submitTestAttempt(attemptId, 'manual_submission', exitCount, questions, testData);
  };

  const submitTestAttempt = async (
    attId: string,
    reason: 'manual_submission' | 'time_expired' | 'maximum_exit_limit',
    finalExits: number,
    qList: any[],
    tData: any
  ) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    try {
      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      const toastMsg = reason === 'maximum_exit_limit'
        ? 'Test automatically submitted'
        : 'Test submitted successfully';
      const toastType: 'warning' | 'success' = reason === 'maximum_exit_limit' ? 'warning' : 'success';

      // Try Backend Submission Endpoint first (Server-Validated Score Calculation)
      const idToken = await currentUser?.getIdToken();
      if (idToken) {
        try {
          const res = await fetch(`\${import.meta.env.VITE_API_URL}/api/tests/attempts/${attId}/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              submissionReason: reason,
              exitCount: finalExits,
            }),
          });
          const data = await res.json();
          if (data.success && data.attempt) {
            showConfirmation({ message: toastMsg, type: toastType });
            setSubmitToastInfo({ message: toastMsg, type: toastType });
            setResultData(data.attempt);
            setViewMode('result');
            setIsSubmitting(false);
            return;
          }
        } catch (apiErr) {
          console.warn('[Submit] Backend API call failed. Using client-side Firestore fallback:', apiErr);
        }
      }

      // Client-side Firestore fallback submit logic
      let correctAnswers = 0;
      let wrongAnswers = 0;
      let unanswered = 0;
      let score = 0;

      qList.forEach((q) => {
        const selected = answers[q.id];
        if (!selected) {
          unanswered++;
        } else {
          const isCorrect = String(selected).trim().toUpperCase() === String(q.correctAnswer || '').trim().toUpperCase();
          if (isCorrect) {
            correctAnswers++;
            score += q.marks || 0;
          } else {
            wrongAnswers++;
            score -= Math.abs(q.negativeMarks || 0);
          }
        }
      });

      const finalScore = Math.max(0, Math.round(score * 100) / 100);
      const totalPossibleMarks = tData?.targetMarks || 100;
      const percentage = Math.min(100, Math.max(0, Math.round((finalScore / totalPossibleMarks) * 100 * 100) / 100));
      const finalStatus = reason === 'manual_submission' ? 'submitted' : 'auto_submitted';

      const updatePayload = {
        status: finalStatus,
        submissionReason: reason,
        submittedAt: serverTimestamp(),
        exitCount: finalExits,
        score: finalScore,
        correctAnswers,
        wrongAnswers,
        unanswered,
        totalMarks: totalPossibleMarks,
        percentage,
      };

      // Display result view & success confirmation card immediately (< 30ms response!)
      showConfirmation({ message: toastMsg, type: toastType });
      setSubmitToastInfo({ message: toastMsg, type: toastType });
      setResultData({
        id: attId,
        ...updatePayload,
        testTitle: tData?.title || 'Assessment',
      });
      setViewMode('result');

      // Update Firestore attempt record in parallel
      updateDoc(doc(db, 'testAttempts', attId), updatePayload).catch((err) => {
        console.warn('[Submit] Background updateDoc notice:', err);
      });
    } catch (err) {
      console.error('Error completing test submission:', err);
      alert('Error submitting test attempt. Please check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for Question Navigator state colors
  const getQuestionBadgeStyle = (qId: string, idx: number) => {
    const isCurrent = idx === currentIndex;
    const isAnswered = Boolean(answers[qId]);
    const isMarked = Boolean(marked[qId]);

    if (isCurrent) {
      return 'bg-[#0952cc] text-white ring-4 ring-[#0952cc]/30 font-extrabold';
    }
    if (isAnswered && isMarked) {
      return 'bg-purple-600 text-white border-2 border-amber-300 font-bold';
    }
    if (isMarked) {
      return 'bg-amber-400 text-slate-900 font-bold';
    }
    if (isAnswered) {
      return 'bg-emerald-500 text-white font-bold';
    }
    return 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold';
  };

  // Re-enter Fullscreen Helper
  const handleReturnToFullscreen = () => {
    setWarningModal({ show: false, level: 0, message: '' });
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  if (isMobileBlocked) {
    return (
      <div className="min-h-screen bg-[#f3f6fc] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200/80 p-8 shadow-xl space-y-5">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <MonitorX className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 leading-tight mb-2">Test Not Available on Mobile</h2>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Please use a desktop or laptop to take this proctored assessment.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-extrabold rounded-xl uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f6fc] flex flex-col items-center justify-center p-6 text-slate-600 font-sans">
        <Logo className="w-12 h-12 mb-4 animate-pulse" />
        <p className="text-sm font-bold text-slate-700">Loading AptiGuard Assessment Environment...</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: TEST INSTRUCTIONS PAGE / MODAL
  // -------------------------------------------------------------
  if (viewMode === 'instructions') {
    return (
      <div className="min-h-screen bg-[#f3f6fc] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans text-slate-900">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
          
          {/* Header */}
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <Logo className="w-10 h-10 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{testData?.title || 'Assessment'}</h1>
              <p className="text-xs text-[#0952cc] font-bold uppercase tracking-wider">Candidate Test Instructions</p>
            </div>
          </div>

          {/* Test Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Questions</span>
              <span className="text-sm font-extrabold text-slate-900">{questions.length} Qs</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Duration</span>
              <span className="text-sm font-extrabold text-slate-900">{testData?.duration || 30} Mins</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Marks</span>
              <span className="text-sm font-extrabold text-slate-900">{testData?.targetMarks || 100} Marks</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Allowed Violations</span>
              <span className="text-sm font-extrabold text-amber-600">3 Max</span>
            </div>
          </div>

          {/* Rules & Proctoring Warnings */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Important Test Rules:</h3>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0952cc] mt-1.5 flex-shrink-0" />
                <span>The test must be taken in <strong>Fullscreen Mode</strong>. Exiting fullscreen is recorded as a violation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0952cc] mt-1.5 flex-shrink-0" />
                <span>Switching tabs or windows will be detected by AptiGuard Proctoring.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span>After the <strong>3rd violation</strong>, your assessment will be <strong>automatically submitted</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span>Selected answers are <strong>automatically saved</strong> to the server instantly.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span>Refreshing or closing the browser will <strong>not restart</strong> the test or reset the timer.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                <span>Once submitted, the test cannot be reopened or resumed.</span>
              </li>
            </ul>
          </div>

          {/* Agreement Checkbox */}
          <div
            onClick={() => setAgreedInstructions(!agreedInstructions)}
            className="flex items-center gap-3 p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors select-none"
          >
            {agreedInstructions ? (
              <CheckSquare className="w-5 h-5 text-[#0952cc] flex-shrink-0" />
            ) : (
              <Square className="w-5 h-5 text-slate-400 flex-shrink-0" />
            )}
            <span className="text-xs font-bold text-slate-800">
              I have read, understood, and agree to the test instructions and proctoring rules.
            </span>
          </div>

          {/* Action Button */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartTest}
              disabled={!agreedInstructions}
              className="flex-1 py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Maximize className="w-4 h-4" /> Start Test Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: ACTIVE TEST EXECUTION INTERFACE
  // -------------------------------------------------------------
  if (viewMode === 'active') {
    const currentQ = questions[currentIndex];
    const currentQId = currentQ?.id;
    const selectedOpt = currentQId ? answers[currentQId] : '';
    const isQMarked = currentQId ? Boolean(marked[currentQId]) : false;

    const answeredCount = Object.keys(answers).length;
    const markedCount = Object.values(marked).filter(Boolean).length;
    const unansweredCount = questions.length - answeredCount;

    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900 select-none">
        
        {/* Top Assessment Header */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <Logo className="w-8 h-8" />
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight truncate max-w-[200px] sm:max-w-xs">
                {testData?.title || 'AptiGuard Assessment'}
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold">Candidate: {currentUser?.displayName || currentUser?.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live Proctoring Violations Indicator */}
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 ${
              exitCount === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Violations: {exitCount} / 3</span>
            </div>

            {/* Timer */}
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-mono font-bold shadow-xs ${
              timeRemaining < 300 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-50 text-[#031b4e] border-slate-200'
            }`}>
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Time Left: {formatTime(timeRemaining)}</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors shadow-xs"
            >
              Submit Test
            </button>
          </div>
        </header>

        {/* Main Body Grid Layout */}
        <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Left Column: Question Viewer (col-span-3) */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 flex flex-col justify-between min-h-[500px]">
            
            <div>
              {/* Question Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <span className="text-xs font-extrabold text-[#0952cc] uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500">
                  <span>Marks: <strong className="text-slate-800">+{currentQ?.marks || 1}</strong></span>
                  {currentQ?.negativeMarks > 0 && (
                    <span className="text-red-500">Negative: <strong>-{currentQ.negativeMarks}</strong></span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed mb-6">
                {currentQ?.questionText || 'Question'}
              </div>

              {/* Options List */}
              <div className="space-y-3 mb-8">
                {['A', 'B', 'C', 'D'].map((optKey) => {
                  const optionText = currentQ?.options?.[optKey] || currentQ?.options?.[['A', 'B', 'C', 'D'].indexOf(optKey)];
                  if (!optionText) return null;
                  const isSelected = selectedOpt === optKey;

                  return (
                    <div
                      key={optKey}
                      onClick={() => handleSelectOption(optKey)}
                      className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
                        isSelected
                          ? 'bg-blue-50/80 border-[#0952cc] shadow-xs'
                          : 'bg-[#f8fafc] border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                          isSelected ? 'bg-[#0952cc] text-white' : 'bg-white text-slate-600 border border-slate-200'
                        }`}>
                          {optKey}
                        </span>
                        <span className={`text-xs sm:text-sm font-semibold truncate ${isSelected ? 'text-[#0952cc]' : 'text-slate-700'}`}>
                          {optionText}
                        </span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-[#0952cc] bg-[#0952cc]' : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => handleNavigateQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  onClick={handleToggleMark}
                  className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 border ${
                    isQMarked
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  {isQMarked ? 'Marked for Review' : 'Mark for Review'}
                </button>
              </div>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => handleNavigateQuestion(currentIndex + 1)}
                  className="px-5 py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                >
                  <Send className="w-4 h-4" /> Final Submit
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Question Navigator Palette */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Question Navigator ({answeredCount}/{questions.length} Answered)
            </h3>

            {/* Grid Palette */}
            <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => handleNavigateQuestion(idx)}
                  className={`h-9 rounded-lg text-xs flex items-center justify-center transition-all ${getQuestionBadgeStyle(q.id, idx)}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {/* Legend Palette */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-[10px] font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#0952cc] ring-2 ring-[#0952cc]/30" />
                <span>Current Question</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400" />
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-600 border border-amber-300" />
                <span>Answered & Marked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-100" />
                <span>Not Visited</span>
              </div>
            </div>
          </div>
        </div>

        {/* PROCTORING WARNING MODAL */}
        <AnimatePresence>
          {warningModal.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-slate-100"
              >
                <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                  warningModal.level >= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {warningModal.level >= 3 ? 'Maximum Violations Reached' : `Proctoring Warning (${warningModal.level} / 3)`}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {warningModal.message}
                </p>
                {warningModal.level < 3 && (
                  <button
                    onClick={handleReturnToFullscreen}
                    className="w-full py-2.5 bg-[#0952cc] hover:bg-[#0747a6] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors focus:outline-none"
                  >
                    Return to Fullscreen
                  </button>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MANUAL SUBMIT CONFIRMATION MODAL */}
        <AnimatePresence>
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 text-center space-y-5 shadow-2xl border border-slate-100"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0952cc] mx-auto flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Submit Assessment?</h3>

                {/* Summary Box */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Answered</span>
                    <span className="font-extrabold text-emerald-600">{answeredCount}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Unanswered</span>
                    <span className="font-extrabold text-slate-600">{unansweredCount}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Marked</span>
                    <span className="font-extrabold text-amber-600">{markedCount}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Once submitted, your responses will be locked and you cannot resume this assessment.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-[#0952cc] hover:bg-[#0747a6] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Confirm Submit'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: SUBMISSION RESULT COMPLETION VIEW
  // -------------------------------------------------------------
  if (viewMode === 'result') {
    const isAutoSubmitted = resultData?.status === 'auto_submitted';
    const reason = resultData?.submissionReason;
    const candName = candidateName || resultData?.resolvedCandidateName || resultData?.userName || resultData?.candidateName || currentUser?.displayName || 'Candidate Student';
    const testTitle = resultData?.testTitle || testData?.title || 'Assessment';
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    return (
      <div className="min-h-screen bg-[#f3f6fc] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans text-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-6 text-center"
        >
          {/* Header Icon */}
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
            isAutoSubmitted
              ? reason === 'maximum_exit_limit' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          }`}>
            {isAutoSubmitted ? (
              reason === 'maximum_exit_limit' ? <XCircle className="w-8 h-8" /> : <Clock className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
              {isAutoSubmitted ? 'Test Automatically Submitted' : 'Test Submitted Successfully'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Candidate: <strong className="text-slate-900">{candName}</strong>
            </p>
          </div>

          {/* DEDICATED PNG RESULT CARD (Targeted by cardRef) */}
          <div ref={cardRef} className="bg-gradient-to-b from-slate-50 to-white p-6 rounded-2xl border border-slate-200 text-left space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Logo className="w-6 h-6" />
                <span className="font-extrabold text-slate-900 text-sm">AptiGuard Official Result Card</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{dateStr}</span>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Candidate Name</p>
              <h3 className="text-base font-extrabold text-slate-900">{candName}</h3>
              <p className="text-xs font-semibold text-[#0952cc] mt-0.5">{testTitle}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Score</span>
                <span className="text-sm font-extrabold text-[#0952cc]">
                  {resultData?.score ?? 0} / {resultData?.totalMarks ?? 100}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Percentage</span>
                <span className="text-sm font-extrabold text-indigo-600">{resultData?.percentage ?? 0}%</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Correct</span>
                <span className="text-sm font-extrabold text-emerald-600">{resultData?.correctAnswers ?? 0}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Wrong</span>
                <span className="text-sm font-extrabold text-red-500">{resultData?.wrongAnswers ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-600 pt-1">
              <span>Submission: <strong className="text-slate-900 capitalize">{reason ? reason.replace(/_/g, ' ') : 'Manual Submission'}</strong></span>
              <span>Violations: <strong className="text-amber-700">{resultData?.exitCount ?? 0} / 3</strong></span>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Powered by AptiGuard Proctoring Engine</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownloadResultCardPNG}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-sm focus:outline-none flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download Result Card (PNG)
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-sm focus:outline-none cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>

      </div>
    );
  }

  return null;
};

export default TestExecutionView;
