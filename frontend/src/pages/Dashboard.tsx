// Trigger Vercel Build
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/auth/Logo';
import { AvailableTestsView, getCandidateTestCardStatus } from './AvailableTestsView';
import { CompletedTestsView } from './CompletedTestsView';
import { ResultsView } from './ResultsView';
import { AdminResultsView } from './AdminResultsView';
import { AdminStudentsView } from './AdminStudentsView';
import { ProfileView } from './ProfileView';
import { CreateTestView } from './CreateTestView';
// import { Footer } from '../components/Footer';
import { useActionConfirmation } from '../context/ActionConfirmationContext';
import { API_BASE_URL } from '../config/api';
import { collection, getDocs, doc, getDoc, query, where, onSnapshot, updateDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatDateToDDMMYYYY, formatTimeTo12Hour } from '../utils/timeFormat';
import { Clock, Activity, CalendarDays } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  User,
  LogOut,
  HelpCircle,
  Menu,
  X,
  Plus,
  Users,
  CheckCheck,
  AlertTriangle,
  Trash2,
  FileEdit
} from 'lucide-react';

export function getAdminTestLifecycleStatus(t: any, nowMs: number = Date.now()): 'draft' | 'scheduled' | 'in_progress' | 'closed' {
  if (!t) return 'closed';
  if (t.status === 'draft') return 'draft';
  if (t.status === 'completed' || t.status === 'closed' || t.status === 'expired') {
    return 'closed';
  }

  const availabilityType = t.availabilityType || 'later';

  if (availabilityType === 'immediate') {
    const createdMs = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : (t.createdAtMs || nowMs);
    const durationMs = (t.duration || 30) * 60 * 1000;
    const endMs = createdMs + durationMs;
    if (nowMs < createdMs) return 'scheduled';
    if (nowMs >= endMs) return 'closed';
    return 'in_progress';
  }

  const sDate = t.startDate || '';
  const sTime = t.startTime || '00:00';
  const eDate = t.endDate || sDate;
  const eTime = t.endTime || '23:59';

  const startMs = new Date(`${sDate}T${sTime}:00`).getTime();
  const endMs = new Date(`${eDate}T${eTime}:00`).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    return 'closed';
  }

  if (nowMs < startMs) {
    return 'scheduled';
  }
  if (nowMs >= endMs) {
    return 'closed';
  }

  return 'in_progress';
}

const AdminTestOverviewCard: React.FC<{ test: any, onManage: (id: string) => void, onView: (id: string) => void, onMonitor: (id: string) => void }> = ({ test, onManage, onView, onMonitor }) => {
  const [assignedUids, setAssignedUids] = React.useState<Set<string>>(new Set());
  const [startedCount, setStartedCount] = React.useState<number>(0);
  const lifecycle = getAdminTestLifecycleStatus(test);

  // 1. Sync/listen to assigned students
  React.useEffect(() => {
    let active = true;
    let unsub: (() => void) | null = null;

    if (test.assignmentType === 'all') {
      getDocs(query(collection(db, 'users'), where('role', '==', 'student'))).then((usersSnap) => {
        const uids = new Set<string>();
        usersSnap.forEach((d) => {
          const uData = d.data();
          if (uData.status !== 'archived' && uData.status !== 'graduated') {
            uids.add(d.id);
          }
        });
        if (active) setAssignedUids(uids);
      });
    } else {
      unsub = onSnapshot(collection(db, 'tests', test.id, 'assignedStudents'), (snap) => {
        const uids = new Set<string>();
        snap.forEach((d) => {
          const uData = d.data();
          const uid = uData.uid || uData.userId || d.id;
          if (uid) uids.add(uid);
        });
        if (active) setAssignedUids(uids);
      });
    }

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [test.id, test.assignmentType]);

  // 2. Listen to attempts and count started students
  React.useEffect(() => {
    if (assignedUids.size === 0) {
      setStartedCount(0);
      return;
    }

    let active = true;
    const q = query(collection(db, 'testAttempts'), where('testId', '==', test.id));
    const unsub = onSnapshot(q, (snap) => {
      const userAttemptsMap = new Map<string, any>();
      snap.forEach((d) => {
        const att = d.data();
        const uid = att.userId;
        if (uid) {
          const existing = userAttemptsMap.get(uid);
          if (!existing) {
            userAttemptsMap.set(uid, att);
          } else {
            const existingTime = existing.startedAtMs || (existing.startedAt?.seconds ? existing.startedAt.seconds * 1000 : 0);
            const newTime = att.startedAtMs || (att.startedAt?.seconds ? att.startedAt.seconds * 1000 : 0);
            if (newTime > existingTime) {
              userAttemptsMap.set(uid, att);
            }
          }
        }
      });

      let started = 0;
      assignedUids.forEach((uid) => {
        const att = userAttemptsMap.get(uid);
        if (att) {
          const status = att.status;
          if (status === 'in_progress' || status === 'submitted' || status === 'auto_submitted') {
            started++;
          }
        }
      });

      if (active) setStartedCount(started);
    });

    return () => {
      active = false;
      unsub();
    };
  }, [test.id, assignedUids]);

  const sDate = test.startDate ? formatDateToDDMMYYYY(test.startDate) : 'Today';
  const sTime = test.startTime ? formatTimeTo12Hour(test.startTime) : '';
  const eTime = test.endTime ? formatTimeTo12Hour(test.endTime) : '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
            lifecycle === 'in_progress' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            {lifecycle === 'in_progress' ? 'LIVE NOW' : 'SCHEDULED'}
          </span>
          <h4 className="text-sm font-extrabold text-slate-900 mt-2">{test.title || 'Untitled Assessment'}</h4>
        </div>
        {lifecycle === 'in_progress' && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </div>

      <div className="text-xs font-semibold text-slate-500">
        <p>{test.targetQuestions || 0} Questions • {test.targetMarks || 0} Marks • {test.duration || 30} Minutes</p>
        <p className="mt-1">
          {sDate}{sTime ? `, ${sTime}` : ''}{eTime ? ` – ${eTime}` : ''}
        </p>
        <p className="mt-2 text-slate-700 font-bold">
          {test.assignmentType === 'all' ? (
            `${startedCount} started`
          ) : (
            lifecycle === 'in_progress' ? `${startedCount} / ${assignedUids.size} students started` : `${assignedUids.size} Students Assigned`
          )}
        </p>
      </div>

      <div className="flex items-center space-x-3 pt-2">
        {lifecycle === 'in_progress' ? (
          <button onClick={() => onMonitor(test.id)} className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-colors border border-red-200">
            Monitor
          </button>
        ) : (
          <button onClick={() => onView(test.id)} className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-colors border border-slate-200">
            View
          </button>
        )}
        <button onClick={() => onManage(test.id)} className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-colors border border-slate-200">
          Manage
        </button>
      </div>
    </div>
  );
}

interface DashboardProps {
  defaultTab?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ defaultTab }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { showConfirmation } = useActionConfirmation();

  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Determine user role (Bypass based on email structure or loaded profile)
  const adminEmails = ['nandeeshmn12@gmail.com', 'cbshubli75@gmail.com'];
  const isAdmin = adminEmails.includes(currentUser?.email?.toLowerCase() || '') || userProfile?.role === 'admin';

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState<boolean>(false);
  const [isClearingData, setIsClearingData] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>(() => defaultTab || 'dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [nowTimeMs, setNowTimeMs] = useState<number>(Date.now());

  const handleExecuteClearData = async () => {
    if (isClearingData || !currentUser) return;
    setIsClearingData(true);

    try {
      const token = await currentUser.getIdToken();
      const endpoint = isAdmin
        ? `${API_BASE_URL}/api/tests/clear-data/admin`
        : `${API_BASE_URL}/api/tests/clear-data/student`;

      if (token) {
        try {
          const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            console.warn('[ClearData] Backend status warning:', data?.message || res.status);
          }
        } catch (backendErr: any) {
          console.warn('[ClearData] Backend deletion API fetch error:', backendErr);
        }
      }

      try {
        if (isAdmin) {
          const attemptsSnap = await getDocs(collection(db, 'testAttempts'));
          if (!attemptsSnap.empty) {
            const batch = writeBatch(db);
            for (const dSnap of attemptsSnap.docs) {
              try {
                const answersSnap = await getDocs(collection(db, 'testAttempts', dSnap.id, 'answers'));
                answersSnap.forEach(aDoc => batch.delete(aDoc.ref));
              } catch (aErr) {}
              batch.delete(dSnap.ref);
            }
            await batch.commit();
          }
        } else {
          const qAtt = query(collection(db, 'testAttempts'), where('userId', '==', currentUser.uid));
          const attemptsSnap = await getDocs(qAtt);
          if (!attemptsSnap.empty) {
            const batch = writeBatch(db);
            for (const dSnap of attemptsSnap.docs) {
              try {
                const answersSnap = await getDocs(collection(db, 'testAttempts', dSnap.id, 'answers'));
                answersSnap.forEach(aDoc => batch.delete(aDoc.ref));
              } catch (aErr) {}
              batch.delete(dSnap.ref);
            }
            await batch.commit();
          }
        }
      } catch (clientErr) {
        console.warn('[ClearData] Client SDK direct deletion notice:', clientErr);
      }

      setShowClearDataModal(false);
      window.dispatchEvent(new CustomEvent('aptiguard:clear-data'));
      showConfirmation({ message: 'Data cleared successfully', type: 'success' });
    } catch (err: any) {
      console.error('Error clearing data:', err);
      showConfirmation({ message: err?.message || 'Failed to clear data.', type: 'warning' });
    } finally {
      setIsClearingData(false);
    }
  };

  // Listen to global clear-data event to immediately purge stale attempt records from memory
  useEffect(() => {
    const handleClearDataEvent = () => {
      if (isAdmin) {
        fetchAdminStudents();
      }
    };
    window.addEventListener('aptiguard:clear-data', handleClearDataEvent);
    return () => window.removeEventListener('aptiguard:clear-data', handleClearDataEvent);
  }, [isAdmin]);

  // Sync activeTab if defaultTab changes (e.g. via direct URL navigation)
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Dynamic Browser Tab Title Management based on Active Tab & Role
  useEffect(() => {
    if (isAdmin) {
      switch (activeTab) {
        case 'dashboard':
          document.title = 'AptiGuard | Admin Dashboard';
          break;
        case 'students':
          document.title = 'AptiGuard | Students';
          break;
        case 'tests':
          document.title = 'AptiGuard | Tests';
          break;
        case 'results':
          document.title = 'AptiGuard | Results';
          break;
        case 'profile':
          document.title = 'AptiGuard | Profile';
          break;
        default:
          document.title = 'AptiGuard | Admin Dashboard';
      }
    } else {
      switch (activeTab) {
        case 'dashboard':
          document.title = 'AptiGuard | Dashboard';
          break;
        case 'available':
          document.title = 'AptiGuard | Available Tests';
          break;
        case 'completed':
          document.title = 'AptiGuard | Completed Tests';
          break;
        case 'results':
          document.title = 'AptiGuard | Results';
          break;
        case 'profile':
          document.title = 'AptiGuard | Profile';
          break;
        default:
          document.title = 'AptiGuard | Dashboard';
      }
    }
  }, [activeTab, isAdmin]);

  // 10-second ticker to dynamically update test lifecycle status (SCHEDULED -> IN PROGRESS -> CLOSED)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimeMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
      setIsLoggingOut(false);
    }
  };

  const [allTests, setAllTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [loadingRecentResults, setLoadingRecentResults] = useState(false);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'dashboard') return;
    setLoadingRecentResults(true);
    // No orderBy/limit here to avoid composite index requirement — sort client-side
    const q = query(
      collection(db, 'testAttempts'),
      where('status', 'in', ['submitted', 'auto_submitted'])
    );
    const unsub = onSnapshot(q, async (snap) => {
      const results: any[] = [];
      const userUids = new Set<string>();

      snap.forEach(docSnap => {
        const data = docSnap.data();
        results.push({ id: docSnap.id, ...data });
        if (data.userId) userUids.add(data.userId);
      });

      // Sort by submittedAt descending client-side, take top 5
      results.sort((a, b) => {
        const aMs = a.submittedAt?.seconds ? a.submittedAt.seconds * 1000 : (a.submittedAt || 0);
        const bMs = b.submittedAt?.seconds ? b.submittedAt.seconds * 1000 : (b.submittedAt || 0);
        return bMs - aMs;
      });
      const top5 = results.slice(0, 5);

      // Resolve user names
      const userCache: Record<string, string> = {};
      if (userUids.size > 0) {
        for (const uid of Array.from(userUids)) {
          const s = studentsList.find(st => st.uid === uid);
          if (s) {
            userCache[uid] = s.fullName || 'Unknown Student';
          } else {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              userCache[uid] = uSnap.data().fullName || 'Unknown Student';
            }
          }
        }
      }

      const finalResults = top5.map(r => {
        const test = allTests.find(t => t.id === r.testId);
        const passing = typeof r.passingScore === 'number' ? r.passingScore : (test?.passingScore !== undefined ? test.passingScore : 40);
        return {
          ...r,
          passingScore: passing,
          studentName: r.candidateName || userCache[r.userId] || 'Unknown Student'
        };
      });

      setRecentResults(finalResults);
      setLoadingRecentResults(false);
    }, (err) => {
      console.error('Error fetching recent results:', err);
      setLoadingRecentResults(false);
    });

    return () => unsub();
  }, [isAdmin, activeTab, studentsList]);

  // Edit Test modal state (for published tests - metadata only)
  const [editingTest, setEditingTest] = useState<any | null>(null);
  // Edit Draft state — full edit via CreateTestView
  const [editingDraftTest, setEditingDraftTest] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('Intermediate');
  const [_editDuration, setEditDuration] = useState('30');
  const [editPassingScore, setEditPassingScore] = useState('40');
  const [editTargetMarks, setEditTargetMarks] = useState('100');
  const [editTargetQuestions, setEditTargetQuestions] = useState('30');
  const [editEnableNegative, setEditEnableNegative] = useState(false);
  const [editNegativeMarks, setEditNegativeMarks] = useState('0.25');
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editStatus, setEditStatus] = useState('published');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editToastMsg, setEditToastMsg] = useState<string | null>(null);
  const [uiAlertMsg, setUiAlertMsg] = useState<string | null>(null);

  // Draft deletion state
  const [deleteDraftId, setDeleteDraftId] = useState<string | null>(null);
  const [deleteDraftTitle, setDeleteDraftTitle] = useState<string>('');
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [deleteToastMsg, setDeleteToastMsg] = useState<string | null>(null);
  // IDs being deleted — used to hide them from UI immediately while Firestore listener catches up
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  const handleDeleteDraft = async () => {
    if (!deleteDraftId || isDeletingDraft) return;
    const idToDelete = deleteDraftId;
    setIsDeletingDraft(true);
    // Hide from UI immediately — the onSnapshot listener may take a moment to catch up
    setPendingDeleteIds(prev => new Set([...Array.from(prev), idToDelete]));
    setDeleteDraftId(null);
    setDeleteDraftTitle('');
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/tests/${idToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete draft.');
      }
      // Also directly remove from local state so UI is instant
      setAllTests(prev => prev.filter(t => t.id !== idToDelete));
      setDeleteToastMsg('Test deleted successfully.');
      setTimeout(() => setDeleteToastMsg(null), 3000);
    } catch (err: any) {
      // Deletion failed — restore the item in the UI
      setPendingDeleteIds(prev => {
        const next = new Set(Array.from(prev));
        next.delete(idToDelete);
        return next;
      });
      setUiAlertMsg(err.message || 'Failed to delete draft test. Please try again.');
    } finally {
      setIsDeletingDraft(false);
      // After Firestore confirms deletion via listener, clean up the pending set
      setTimeout(() => {
        setPendingDeleteIds(prev => {
          const next = new Set(Array.from(prev));
          next.delete(idToDelete);
          return next;
        });
      }, 5000);
    }
  };


  const todayMinDate = new Date().toISOString().split('T')[0];

  const handleOpenEditModal = (t: any) => {
    const lifecycleStatus = getAdminTestLifecycleStatus(t, Date.now());
    if (lifecycleStatus === 'in_progress') {
      setUiAlertMsg('Test is currently in progress and can no longer be edited after the scheduled start time.');
      return;
    }
    if (lifecycleStatus === 'closed') {
      setUiAlertMsg('This assessment is completed/closed and can no longer be edited.');
      return;
    }

    setEditingTest(t);
    setEditTitle(t.title || '');
    setEditDescription(t.description || '');
    setEditCategory(t.category || 'Quantitative Aptitude');
    setEditDifficulty(t.difficulty || 'Intermediate');
    setEditDuration(t.duration ? String(t.duration) : '30');
    setEditPassingScore(t.passingScore !== undefined ? String(t.passingScore) : '40');
    setEditTargetMarks(t.targetMarks !== undefined ? String(t.targetMarks) : (t.totalMarks !== undefined ? String(t.totalMarks) : '100'));
    setEditTargetQuestions(t.targetQuestions !== undefined ? String(t.targetQuestions) : (t.totalQuestions !== undefined ? String(t.totalQuestions) : '30'));
    setEditEnableNegative(Boolean(t.enableNegative));
    setEditNegativeMarks(t.negativeMarks !== undefined ? String(t.negativeMarks) : '0.25');
    setEditStartDate(t.startDate || '');
    setEditStartTime(t.startTime || '');
    setEditEndDate(t.endDate || '');
    setEditEndTime(t.endTime || '');
    setEditStatus(t.status || 'published');
  };

  const handleSaveTestUpdate = async () => {
    if (!editingTest || !currentUser) return;

    const lifecycleStatus = getAdminTestLifecycleStatus(editingTest, Date.now());
    if (lifecycleStatus === 'in_progress') {
      setUiAlertMsg('Test has already started and can no longer be edited after the scheduled start time.');
      setEditingTest(null);
      return;
    }
    if (lifecycleStatus === 'closed') {
      setUiAlertMsg('This assessment is completed/closed and can no longer be edited.');
      setEditingTest(null);
      return;
    }

    if (editStartDate && editStartDate < todayMinDate) {
      setUiAlertMsg('Start date cannot be before today.');
      return;
    }

    if (editEndDate && editEndDate < editStartDate) {
      setUiAlertMsg('End date cannot be before the start date.');
      return;
    }

    try {
      setSavingEdit(true);
      const token = await currentUser?.getIdToken().catch(() => null);
      
      let derivedDurationMins = 30;
      if (editStartDate && editStartTime && editEndDate && editEndTime) {
        const sMs = new Date(`${editStartDate}T${editStartTime}`).getTime();
        const eMs = new Date(`${editEndDate}T${editEndTime}`).getTime();
        if (!isNaN(sMs) && !isNaN(eMs) && eMs > sMs) {
          derivedDurationMins = Math.floor((eMs - sMs) / 60000);
        }
      }

      const payload: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        difficulty: editDifficulty,
        duration: derivedDurationMins,
        passingScore: parseFloat(editPassingScore) || 40,
        targetMarks: parseFloat(editTargetMarks) || 0,
        targetQuestions: parseInt(editTargetQuestions) || 0,
        totalMarks: parseFloat(editTargetMarks) || 0,
        totalQuestions: parseInt(editTargetQuestions) || 0,
        enableNegative: editEnableNegative,
        negativeMarks: editEnableNegative ? (parseFloat(editNegativeMarks) || 0) : 0,
        startDate: editStartDate,
        startTime: editStartTime,
        endDate: editEndDate,
        endTime: editEndTime,
        status: editStatus,
        assignmentType: editingTest.assignmentType || 'all',
        selectedStudentUids: editingTest.selectedStudentUids || [],
        updatedAt: serverTimestamp(),
      };

      // 1. Call backend UPDATE API first for authoritative server validation & email trigger
      let backendFailed = false;
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/tests/${editingTest.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setUiAlertMsg(data.message || 'Failed to update test on server.');
            backendFailed = true;
            return;
          }
        } catch (apiErr) {
          console.warn('[UpdateTest] Backend update API warning:', apiErr);
        }
      }

      if (backendFailed) return;

      // 2. Direct client-side Firestore sync fallback/reinforcement
      const testRef = doc(db, 'tests', editingTest.id);
      await updateDoc(testRef, payload).catch(async () => {
        await setDoc(testRef, payload, { merge: true });
      });

      // 3. Close modal & show confirmation card immediately
      setEditingTest(null);
      showConfirmation({ message: 'Test updated successfully', type: 'success' });
    } catch (err) {
      console.error('Error updating test:', err);
      setUiAlertMsg('Network error updating test. Please check your connection.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Real-time tests listener for Admin view (updates instantly in < 20ms!)
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingTests(true);

    const unsub = onSnapshot(collection(db, 'tests'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        // Skip tests that are currently being deleted
        if (pendingDeleteIds.has(docSnap.id)) return;
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setAllTests(list);
      setLoadingTests(false);
    }, (err) => {
      console.error('Error listening to admin tests:', err);
      setLoadingTests(false);
    });

    return () => unsub();
  }, [isAdmin, pendingDeleteIds]);



  const fetchAdminStudents = async () => {
    if (!isAdmin) return;
    try {
      // 1. Fetch from Firestore users collection
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap = new Map<string, any>();

      usersSnap.forEach((docSnap) => {
        const u = { id: docSnap.id, ...docSnap.data() } as any;
        if (u.role === 'student' || !u.role) {
          userMap.set(u.uid || docSnap.id, u);
        }
      });

      // 2. Query candidates from testAttempts collection to ensure every candidate appears
      const attemptsSnap = await getDocs(collection(db, 'testAttempts'));
      const attemptCounts: Record<string, number> = {};

      attemptsSnap.forEach((docSnap) => {
        const att = docSnap.data();
        const uid = att.userId;
        if (uid) {
          attemptCounts[uid] = (attemptCounts[uid] || 0) + 1;
          if (!userMap.has(uid)) {
            userMap.set(uid, {
              uid,
              name: att.userName || att.userEmail?.split('@')[0] || 'Candidate',
              fullName: att.userName || att.userEmail?.split('@')[0] || 'Candidate',
              email: att.userEmail || '',
              role: 'student',
              status: 'Active',
              createdAt: att.startedAt || null,
            });
          }
        }
      });

      const list: any[] = [];
      userMap.forEach((student, uid) => {
        list.push({
          ...student,
          testAttemptsCount: attemptCounts[uid] || 0,
        });
      });

      list.sort((a, b) => (a.name || a.fullName || '').localeCompare(b.name || b.fullName || ''));
      setStudentsList(list);
    } catch (err) {
      console.error('Error fetching admin students:', err);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'students') {
      fetchAdminStudents();
    }
  }, [isAdmin, activeTab]);



  useEffect(() => {
    if (currentUser) {
      getDoc(doc(db, 'users', currentUser.uid)).then((snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data());
        }
      }).catch(() => { });
    }
  }, [currentUser]);

  const studentName = currentUser?.displayName || userProfile?.name || userProfile?.fullName || currentUser?.email?.split('@')[0] || 'Candidate Student';
  const userEmail = currentUser?.email || 'student@example.com';
  const initials = isAdmin ? 'A' : studentName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Student tests & candidate attempts state
  const [studentTests, setStudentTests] = useState<any[]>([]);
  const [studentUserAttemptsMap, setStudentUserAttemptsMap] = useState<Map<string, any>>(new Map());
  const [loadingStudentTests, setLoadingStudentTests] = useState(false);
  const [studentNowMs, setStudentNowMs] = useState(Date.now());

  // Real-time 1-second ticker so student dashboard card buttons update dynamically
  useEffect(() => {
    if (isAdmin) return;
    const timer = setInterval(() => setStudentNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !currentUser) return;
    setLoadingStudentTests(true);

    // Query both 'published' (immediate/active) AND 'scheduled' (future window) tests.
    // The backend sets status='scheduled' when the test window hasn't opened yet, and
    // status='published' for immediate/in-window tests. getCandidateTestCardStatus() uses
    // actual timestamps to classify as UPCOMING / AVAILABLE / EXPIRED.
    const qTests = query(collection(db, 'tests'), where('status', 'in', ['published', 'scheduled']));
    const unsubscribeTests = onSnapshot(
      qTests,
      async (snapshot) => {
        try {
          const list: any[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            // Treat missing/unknown availabilityType as 'later' (scheduled)
            const aType = data.availabilityType || 'later';
            if (aType === 'all' || data.assignmentType === 'all') {
              list.push({ id: docSnap.id, ...data });
            } else {
              // Per-student assignment check
              const assignedRef = doc(db, 'tests', docSnap.id, 'assignedStudents', currentUser.uid);
              const assignedSnap = await getDoc(assignedRef);
              if (assignedSnap.exists()) {
                list.push({ id: docSnap.id, ...data });
              }
            }
          }
          setStudentTests(list);
        } catch (err) {
          console.error('Error processing student tests snapshot:', err);
        } finally {
          setLoadingStudentTests(false);
        }
      },
      (err) => {
        console.error('Error in student tests real-time listener:', err);
        setLoadingStudentTests(false);
      }
    );

    // 2. Realtime listener for candidate test attempts
    const qAttempts = query(collection(db, 'testAttempts'), where('userId', '==', currentUser.uid));
    const unsubscribeAttempts = onSnapshot(
      qAttempts,
      (snapshot) => {
        const attMap = new Map<string, any>();
        snapshot.forEach((docSnap) => {
          const att = { id: docSnap.id, ...docSnap.data() } as any;
          const existing = attMap.get(att.testId);
          if (!existing || att.status === 'submitted' || att.status === 'auto_submitted') {
            attMap.set(att.testId, att);
          }
        });
        setStudentUserAttemptsMap(attMap);
      },
      (err) => {
        console.error('Error in student attempts real-time listener:', err);
      }
    );

    return () => {
      unsubscribeTests();
      unsubscribeAttempts();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin]);

  /* ==========================================
     ADMIN DASHBOARD VIEW
     ========================================== */
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#f3f6fc] flex text-[#0f172a] font-sans">

        {/* 1. LEFT SIDEBAR (Desktop) */}
        <aside className="hidden md:flex w-[260px] bg-white border-r border-slate-200/80 flex-col justify-between flex-shrink-0 relative select-none">
          <div className="p-6">

            {/* Branding headers */}
            <div className="flex items-center space-x-3 mb-6">
              <Logo className="w-10 h-10 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">AptiGuard</h1>
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  Assessment Management
                </p>
              </div>
            </div>



            {/* Navigation links */}
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'dashboard'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'tests'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <ClipboardList className="w-4.5 h-4.5" />
                <span>Tests</span>
              </button>
              <button
                onClick={() => setActiveTab('drafts')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'drafts'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <FileEdit className="w-4.5 h-4.5" />
                <span>Drafts</span>
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'students'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>Students</span>
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'results'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <BarChart3 className="w-4.5 h-4.5" />
                <span>Results</span>
              </button>

              <div className="pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Account</p>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'profile'
                      ? 'bg-blue-50 text-[#0952cc]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  <User className="w-4.5 h-4.5" />
                  <span>Profile</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Bottom profile info block */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                A
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">AptiGuard Admin</p>
                <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 hover:bg-red-50 active:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </aside>

        {/* Mobile menu trigger */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
            <aside className="relative flex w-[260px] max-w-xs flex-col bg-white p-6 shadow-xl z-10">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3 mb-6">
                <Logo className="w-9 h-9 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
                <div>
                  <h1 className="text-base font-bold text-slate-900 leading-tight">AptiGuard</h1>
                  <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Assessment Management</p>
                </div>
              </div>
              <nav className="space-y-1.5 flex-1">
                <button
                  onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'dashboard' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                    }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => { setActiveTab('tests'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'tests' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                    }`}
                >
                  <ClipboardList className="w-4.5 h-4.5" />
                  <span>Tests</span>
                </button>
                <button
                  onClick={() => { setActiveTab('drafts'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'drafts' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                    }`}
                >
                  <FileEdit className="w-4.5 h-4.5" />
                  <span>Drafts</span>
                </button>
                <button
                  onClick={() => { setActiveTab('students'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'students' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                    }`}
                >
                  <Users className="w-4.5 h-4.5" />
                  <span>Students</span>
                </button>
                <button
                  onClick={() => { setActiveTab('results'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'results' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                    }`}
                >
                  <BarChart3 className="w-4.5 h-4.5" />
                  <span>Results</span>
                </button>

                <div className="pt-3 border-t border-slate-100 mt-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Account</p>
                  <button
                    onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === 'profile' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                      }`}
                  >
                    <User className="w-4.5 h-4.5" />
                    <span>Profile</span>
                  </button>
                </div>
              </nav>
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleLogoutClick}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 text-red-600 text-xs font-bold rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* 2. MAIN CONTENT WRAPPER */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

          {/* Mobile hamburger only */}
          <div className="md:hidden px-4 pt-4 flex-shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Inner Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">


            {/* Dynamic Admin Subview Router */}
            {activeTab === 'dashboard' ? (
              <div className="space-y-8">
                {/* Greeting — only shown on Dashboard tab */}
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">Welcome back, Admin 👋</h2>
                  <p className="text-sm text-slate-500 font-medium">Monitor and manage your college assessments.</p>
                </div>

                {/* Statistics Row */}
                {(() => {
                  const draftCount = allTests.filter(t => t.status === 'draft').length;
                  const scheduledCount = allTests.filter(t => getAdminTestLifecycleStatus(t, nowTimeMs) === 'scheduled' && t.status !== 'draft').length;
                  const liveCount = allTests.filter(t => getAdminTestLifecycleStatus(t, nowTimeMs) === 'in_progress' && t.status !== 'draft').length;
                  const completedCount = allTests.filter(t => getAdminTestLifecycleStatus(t, nowTimeMs) === 'closed' && t.status !== 'draft').length;

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                        <div className="flex items-center space-x-2 text-slate-500 mb-2">
                          <FileEdit className="w-4 h-4" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest">Draft Tests</h4>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{draftCount}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                        <div className="flex items-center space-x-2 text-amber-500 mb-2">
                          <CalendarDays className="w-4 h-4" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700">Scheduled</h4>
                        </div>
                        <p className="text-2xl font-black text-amber-700">{scheduledCount}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-red-100 p-5 shadow-xs bg-red-50/30">
                        <div className="flex items-center space-x-2 text-red-500 mb-2">
                          <Activity className="w-4 h-4" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">Live Now</h4>
                        </div>
                        <p className="text-2xl font-black text-red-700">{liveCount}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-xs bg-emerald-50/30">
                        <div className="flex items-center space-x-2 text-emerald-500 mb-2">
                          <CheckCheck className="w-4 h-4" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Completed</h4>
                        </div>
                        <p className="text-2xl font-black text-emerald-700">{completedCount}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Main 2-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* LEFT: Live & Upcoming Assessments */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                      <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Live &amp; Upcoming Assessments</h3>
                    </div>

                    {loadingTests ? (
                      <div className="text-center py-6 text-xs font-semibold text-slate-400">Loading assessments...</div>
                    ) : (() => {
                      const liveAndUpcoming = allTests.filter(t => {
                        const s = getAdminTestLifecycleStatus(t, nowTimeMs);
                        return (s === 'in_progress' || s === 'scheduled') && t.status !== 'draft';
                      }).sort((a, b) => {
                        const aLive = getAdminTestLifecycleStatus(a, nowTimeMs) === 'in_progress';
                        const bLive = getAdminTestLifecycleStatus(b, nowTimeMs) === 'in_progress';
                        if (aLive && !bLive) return -1;
                        if (!aLive && bLive) return 1;
                        const aDate = a.startDate ? new Date(`${a.startDate}T${a.startTime || '00:00'}:00`).getTime() : 0;
                        const bDate = b.startDate ? new Date(`${b.startDate}T${b.startTime || '00:00'}:00`).getTime() : 0;
                        return aDate - bDate;
                      });

                      if (liveAndUpcoming.length === 0) {
                        return (
                          <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
                            No live or upcoming assessments right now.
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 gap-4">
                          {liveAndUpcoming.map(t => (
                            <AdminTestOverviewCard 
                              key={t.id} 
                              test={t} 
                              onManage={() => {
                                handleOpenEditModal(t);
                              }}
                              onView={() => setActiveTab('tests')}
                              onMonitor={(id) => window.open(`/admin/tests/${id}/monitor`, '_blank', 'noopener,noreferrer')}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* RIGHT: Quick Actions & Activity */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                      <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Quick Actions</h3>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
                      <div className="space-y-2">
                        <button onClick={() => setActiveTab('create-test')} className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] border border-[#0952cc] transition-colors shadow-xs focus:outline-none uppercase tracking-wider">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create New Test</span>
                        </button>
                        <button onClick={() => setActiveTab('tests')} className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 border border-slate-100 flex items-center justify-between transition-colors">
                          <span>Manage Tests</span>
                        </button>
                        <button onClick={() => setActiveTab('students')} className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 border border-slate-100 flex items-center justify-between transition-colors">
                          <span>Manage Students</span>
                        </button>
                        <button onClick={() => setActiveTab('results')} className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 border border-slate-100 flex items-center justify-between transition-colors">
                          <span>View Results</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM: Recent Results */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                    <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Results</h3>
                  </div>

                  {loadingRecentResults ? (
                    <div className="text-center py-6 text-xs font-semibold text-slate-400">Loading recent results...</div>
                  ) : recentResults.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
                      No results available yet.
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-455 tracking-wider uppercase text-[10px]">
                            <th className="py-3 px-4">Student Name</th>
                            <th className="py-3 px-4">Test Name</th>
                            <th className="py-3 px-4 text-center">Score</th>
                            <th className="py-3 px-4 text-center">Percentage</th>
                            <th className="py-3 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentResults.map(r => {
                            const percent = r.totalMarks > 0 ? Math.round((r.score / r.totalMarks) * 100) : 0;
                            const isPass = percent >= (r.passingScore !== undefined ? r.passingScore : 40);
                            return (
                              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-4 text-slate-900 font-bold">{r.studentName}</td>
                                <td className="py-3 px-4 text-slate-500">{r.testTitle || 'Unknown Test'}</td>
                                <td className="py-3 px-4 text-center text-slate-900">{r.score} / {r.totalMarks}</td>
                                <td className="py-3 px-4 text-center text-slate-900">{percent}%</td>
                                <td className="py-3 px-4 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                    isPass ? 'bg-emerald-50 text-emerald-750 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                                  }`}>
                                    {isPass ? 'Passed' : 'Failed'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'profile' ? (
              <ProfileView />
            ) : activeTab === 'create-test' ? (
              <CreateTestView
                editTest={editingDraftTest}
                onBack={(tab, toastMsg) => {
                  setEditingDraftTest(null);
                  setActiveTab(tab || 'dashboard');
                  if (toastMsg) {
                    setEditToastMsg(toastMsg);
                  }
                }}
              />
            ) : (activeTab === 'tests' || activeTab === 'drafts') ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-[#031b4e] uppercase tracking-wide">
                    {activeTab === 'drafts' ? 'Manage Drafts' : 'Manage Tests'}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    {activeTab === 'drafts' ? 'View and edit your saved test drafts.' : 'Create, publish, and monitor your test assessments.'}
                  </p>
                </div>

                {(() => {
                  const filteredTests = allTests.filter(t => activeTab === 'drafts' ? t.status === 'draft' : t.status !== 'draft');
                  
                  if (loadingTests) {
                    return (
                      <div className="text-center py-12 text-xs text-slate-500 font-semibold">
                        Loading {activeTab}...
                      </div>
                    );
                  }
                  
                  if (filteredTests.length === 0) {
                    return (
                      <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
                        {activeTab === 'drafts' ? 'No drafts saved yet.' : 'No active tests created yet. Click "Create New Test" to get started.'}
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-455 tracking-wider uppercase text-[10px]">
                            <th className="py-3 px-4">Title</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Questions</th>
                            <th className="py-3 px-4">Marks</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Created At</th>
                            <th className="py-3 px-4">Timings</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTests.map((t) => {
                            const testId = t.id || 'N/A';
                            const title = t.title || 'Untitled Assessment';
                            const cat = t.category || 'General';
                          const qCount = t.targetQuestions || 0;
                          const marks = t.targetMarks || 0;
                          const dateVal = formatDateToDDMMYYYY(t.createdAt);
                          const lifecycle = getAdminTestLifecycleStatus(t, nowTimeMs);

                          const timingsVal = (() => {
                            if (t.availabilityType === 'immediate' || (!t.startTime && !t.endTime)) {
                              return 'Immediate Access';
                            }
                            const sTime = t.startTime ? formatTimeTo12Hour(t.startTime) : '';
                            const eTime = t.endTime ? formatTimeTo12Hour(t.endTime) : '';

                            if (sTime && eTime) {
                              return `${sTime} – ${eTime}`;
                            }
                            if (sTime) {
                              return `Starts at ${sTime}`;
                            }
                            if (eTime) {
                              return `Ends at ${eTime}`;
                            }
                            return 'Immediate Access';
                          })();
                            return (
                              <tr key={testId} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 text-slate-900 font-bold">{title}</td>
                                <td className="py-3 px-4 text-slate-500">{cat}</td>
                                <td className="py-3 px-4 text-slate-900">{qCount}</td>
                                <td className="py-3 px-4 text-slate-900">{marks}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                    lifecycle === 'closed'
                                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                                      : lifecycle === 'in_progress'
                                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                                      : lifecycle === 'draft'
                                      ? 'bg-slate-50 text-slate-700 border-slate-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-100'
                                  }`}>
                                    {lifecycle === 'closed' ? 'CLOSED' : lifecycle === 'in_progress' ? 'IN PROGRESS' : lifecycle === 'draft' ? 'DRAFT' : 'SCHEDULED'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-400">{dateVal}</td>
                                <td className="py-3 px-4 text-slate-600 font-semibold">{timingsVal}</td>
                                <td className="py-3 px-4 text-right">
                                  {lifecycle === 'closed' ? (
                                    <button
                                      disabled
                                      className="py-1 px-3 bg-purple-50 text-purple-700 text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-purple-200 cursor-not-allowed opacity-75 select-none"
                                    >
                                      Test Closed
                                    </button>
                                  ) : lifecycle === 'draft' ? (
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                      onClick={() => {
                                          setEditingDraftTest(t);
                                          setActiveTab('create-test');
                                        }}
                                        className="p-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-md transition-colors focus:outline-none"
                                        title="Edit Draft"
                                      >
                                        <FileEdit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setDeleteDraftId(testId);
                                          setDeleteDraftTitle(title);
                                        }}
                                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors focus:outline-none"
                                        title="Delete Draft"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : lifecycle === 'in_progress' ? (
                                    <button
                                      disabled
                                      className="py-1 px-3 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-amber-200 cursor-not-allowed opacity-75 select-none"
                                    >
                                      Test In Progress
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenEditModal(t)}
                                      className="py-1 px-3 bg-blue-50 hover:bg-blue-100 text-[#0952cc] text-[10px] font-extrabold rounded-md uppercase tracking-wider transition-colors border border-blue-200 cursor-pointer shadow-2xs"
                                    >
                                      Edit Test
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            ) : activeTab === 'results' ? (
              <AdminResultsView />
            ) : activeTab === 'students' ? (
              <AdminStudentsView />
            ) : activeTab === 'profile' ? (
              <ProfileView isAdmin={true} />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 font-medium">
                This admin dashboard section is currently under development.
              </div>
            )}

          </main>

          {/* Reusable Footer Component */}
          {/* <Footer /> */}
        </div>

        {/* Logout confirmation Dialog overlay card modal for Admin */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
            <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200/80 p-6 shadow-xl text-center space-y-5">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
                <LogOut className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Logout?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to log out of your AptiGuard admin account?
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={isLoggingOut}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  disabled={isLoggingOut}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE DRAFT CONFIRMATION MODAL */}
        {deleteDraftId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
            <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200/80 p-6 shadow-xl text-center space-y-5">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">Delete Test?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  This action will permanently delete<br />
                  <span className="font-bold text-slate-800">"{deleteDraftTitle}"</span><br />
                  and all its associated questions.
                </p>
                <p className="text-[11px] text-red-500 font-semibold">This action cannot be undone.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setDeleteDraftId(null); setDeleteDraftTitle(''); }}
                  disabled={isDeletingDraft}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDraft}
                  disabled={isDeletingDraft}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors disabled:opacity-60"
                >
                  {isDeletingDraft ? 'Deleting...' : 'Delete Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE DRAFT SUCCESS TOAST */}
        {deleteToastMsg && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {deleteToastMsg}
          </div>
        )}

        {/* EDIT TEST MODAL DIALOG */}
        {editingTest && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
            <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200/80 p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">Edit Assessment Details</h3>
                <button
                  onClick={() => setEditingTest(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editToastMsg ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl text-center">
                  {editToastMsg}
                </div>
              ) : (
                <div className="space-y-4 text-xs font-semibold text-slate-700">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Test Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 text-xs text-slate-900 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 text-xs text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Category</label>
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Difficulty</label>
                      <select
                        value={editDifficulty}
                        onChange={(e) => setEditDifficulty(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 bg-white"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Total Questions</label>
                      <input
                        type="number"
                        min="1"
                        value={editTargetQuestions}
                        onChange={(e) => setEditTargetQuestions(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Total Marks</label>
                      <input
                        type="number"
                        min="1"
                        value={editTargetMarks}
                        onChange={(e) => setEditTargetMarks(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Passing Score (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editPassingScore}
                        onChange={(e) => setEditPassingScore(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 font-bold"
                      />
                    </div>
                  </div>

                  {/* Negative Marking Configuration */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block">Enable Negative Marking</label>
                        <p className="text-[10px] text-slate-400 font-normal">Deduct marks for incorrect candidate answers.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditEnableNegative(!editEnableNegative)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          editEnableNegative ? 'bg-[#0952cc]' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            editEnableNegative ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {editEnableNegative && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Negative Penalty (Marks per wrong answer)</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={editNegativeMarks}
                          onChange={(e) => setEditNegativeMarks(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 font-bold"
                          placeholder="e.g. 0.25, 0.5, 1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Start Date</label>
                      <input
                        type="date"
                        min={todayMinDate}
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Start Time</label>
                      <input
                        type="time"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">End Date</label>
                      <input
                        type="date"
                        min={editStartDate || todayMinDate}
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">End Time</label>
                      <input
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Read-only Calculated Test Window Summary */}
                  {(() => {
                    if (!editStartDate || !editStartTime || !editEndDate || !editEndTime) return null;
                    const sObj = new Date(`${editStartDate}T${editStartTime}`);
                    const eObj = new Date(`${editEndDate}T${editEndTime}`);
                    const diffMs = eObj.getTime() - sObj.getTime();
                    if (isNaN(diffMs) || diffMs <= 0) return null;
                    const diffMins = Math.floor(diffMs / 60000);
                    const hours = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    const durText = hours > 0
                      ? `${hours} hour${hours > 1 ? 's' : ''} ${mins > 0 ? `${mins} min${mins > 1 ? 's' : ''}` : ''}`
                      : `${mins} min${mins > 1 ? 's' : ''}`;

                    return (
                      <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl flex items-center justify-between text-xs select-none">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-[#0952cc]" />
                          <span className="font-bold text-slate-700 font-sans">Calculated Test Window</span>
                        </div>
                        <span className="font-extrabold text-[#0952cc] font-sans bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-2xs">
                          {durText}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 font-bold bg-white"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingTest(null)}
                      disabled={savingEdit}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTestUpdate}
                      disabled={savingEdit}
                      className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-lg uppercase tracking-wider disabled:opacity-50"
                    >
                      {savingEdit ? 'Updating & Notifying...' : 'Save Updates'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clear Data Confirmation Card Modal (Admin) */}
        {showClearDataModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
            <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200/80 p-6 shadow-xl space-y-5 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">⚠ Clear Data</h3>
                  <p className="text-xs text-slate-500 font-medium">Are you sure you want to delete this data?</p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200/70 rounded-xl p-4 text-xs text-slate-600 font-medium leading-relaxed">
                <p className="font-bold text-slate-900">This action cannot be undone.</p>
                <p>This action will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Candidate test attempts &amp; submission history</li>
                  <li>Submitted answer keys &amp; proctoring violation logs</li>
                  <li>Student score cards &amp; evaluation result records</li>
                </ul>
                <p className="pt-1 text-[11px] text-slate-500 italic">
                  Note: Global assessments, questions, and registered user accounts will remain safe.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isClearingData}
                  onClick={() => setShowClearDataModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isClearingData}
                  onClick={handleExecuteClearData}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors cursor-pointer shadow-xs disabled:opacity-75"
                >
                  {isClearingData ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  /* ==========================================
     STUDENT DASHBOARD VIEW (Default)
     ========================================== */
  return (
    <div className="min-h-screen bg-[#f3f6fc] flex text-[#0f172a] font-sans">

      {/* LEFT SIDEBAR (Desktop) */}
      <aside className="hidden md:flex w-[260px] bg-white border-r border-slate-200/80 flex-col justify-between flex-shrink-0 relative select-none">

        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <Logo className="w-10 h-10 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">AptiGuard</h1>
              <p className="text-[9px] font-semibold text-[#0952cc] uppercase tracking-wider">
                Student Portal
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Main Menu</p>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'dashboard'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'available'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <ClipboardList className="w-4.5 h-4.5" />
              <span>Available Tests</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'completed'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <CheckCheck className="w-4.5 h-4.5" />
              <span>Completed Tests</span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'results'
                  ? 'bg-blue-50 text-[#0952cc]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <BarChart3 className="w-4.5 h-4.5" />
              <span>Results</span>
            </button>

            <div className="pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Account</p>
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${activeTab === 'profile'
                    ? 'bg-blue-50 text-[#0952cc]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <User className="w-4.5 h-4.5" />
                <span>Profile</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Profile details block */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{studentName}</p>
              <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogoutClick}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 hover:bg-red-50 active:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer trigger */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative flex w-[260px] max-w-xs flex-col bg-white p-6 shadow-xl z-10">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-8">
              <Logo className="w-9 h-9 shadow-none border-none p-0 flex items-center justify-center bg-transparent" />
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">AptiGuard</h1>
                <p className="text-[8px] font-semibold text-[#0952cc] uppercase tracking-wider">Student Portal</p>
              </div>
            </div>
            <nav className="space-y-1.5 flex-1">
              <button
                onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'dashboard' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                  }`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => { setActiveTab('available'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'available' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                  }`}
              >
                <ClipboardList className="w-4.5 h-4.5" />
                <span>Available Tests</span>
              </button>
              <button
                onClick={() => { setActiveTab('completed'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'completed' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                  }`}
              >
                <CheckCheck className="w-4.5 h-4.5" />
                <span>Completed Tests</span>
              </button>
              <button
                onClick={() => { setActiveTab('results'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${activeTab === 'results' ? 'bg-blue-50 text-[#0952cc]' : 'text-slate-600'
                  }`}
              >
                <BarChart3 className="w-4.5 h-4.5" />
                <span>Results</span>
              </button>
            </nav>
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{studentName}</p>
                </div>
              </div>
              <button
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-red-200/60 bg-red-50/40 text-red-600 text-xs font-bold rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Mobile Header Bar */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-slate-900 text-sm">AptiGuard</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 relative focus:outline-none"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Inner Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-[1200px] w-full mx-auto">



          {/* Dynamic Subview Router */}
          {activeTab === 'dashboard' ? (
            <div className="space-y-6">
              {/* Header Greeting */}
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
                  Welcome back, {studentName} 👋
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  Stay updated with your aptitude assessments.
                </p>
              </div>

              {loadingStudentTests ? (
                <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-400 text-xs font-semibold shadow-xs">
                  Loading your assessments...
                </div>
              ) : (() => {
                const processed = studentTests.map((t) => {
                  const att = studentUserAttemptsMap.get(t.id);
                  const cardStatus = getCandidateTestCardStatus(t, att, studentNowMs);
                  let startTimeMs = 0;
                  if (t.availabilityType === 'immediate') {
                    const createdMs = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : (t.createdAtMs || Date.now());
                    startTimeMs = createdMs;
                  } else {
                    const sDate = t.startDate || '';
                    const sTime = t.startTime || '00:00';
                    const startMs = new Date(`${sDate}T${sTime}:00`).getTime();
                    startTimeMs = isNaN(startMs) ? 0 : startMs;
                  }
                  return { ...t, cardStatus, startTimeMs };
                });

                // Find Next Assessment (AVAILABLE or UPCOMING)
                const nextAssessment = processed
                  .filter(p => p.cardStatus.statusLabel === 'AVAILABLE' || p.cardStatus.statusLabel === 'UPCOMING')
                  .sort((a, b) => {
                    if (a.cardStatus.statusLabel === 'AVAILABLE' && b.cardStatus.statusLabel === 'UPCOMING') return -1;
                    if (a.cardStatus.statusLabel === 'UPCOMING' && b.cardStatus.statusLabel === 'AVAILABLE') return 1;
                    return a.startTimeMs - b.startTimeMs;
                  })[0];

                // Upcoming Assessments (excluding nextAssessment, showing max 3)
                const upcomingAssessmentsList = processed
                  .filter(p => p.cardStatus.statusLabel === 'UPCOMING' && p.id !== nextAssessment?.id)
                  .sort((a, b) => a.startTimeMs - b.startTimeMs)
                  .slice(0, 3);

                // Recent Results (max 3 completed attempts)
                const completedAttempts = Array.from(studentUserAttemptsMap.values())
                  .filter(att => att.status === 'submitted' || att.status === 'auto_submitted')
                  .sort((a, b) => {
                    const aTime = a.submittedAt?.seconds || 0;
                    const bTime = b.submittedAt?.seconds || 0;
                    return bTime - aTime;
                  })
                  .slice(0, 3);

                // Recent Activity Feed logic
                const activities: { id: string; text: string; timeMs: number }[] = [];
                studentTests.forEach(test => {
                  const createdMs = test.createdAt?.seconds 
                    ? test.createdAt.seconds * 1000 
                    : (test.createdAtMs || (test.startDate ? new Date(`${test.startDate}T${test.startTime || '00:00'}:00`).getTime() : 0));
                  
                  if (createdMs && createdMs < Date.now()) {
                    activities.push({
                      id: `assigned-${test.id}`,
                      text: `✓ ${test.title || 'Assessment'} assigned`,
                      timeMs: createdMs
                    });
                  }

                  const att = studentUserAttemptsMap.get(test.id);
                  if (att) {
                    if (att.startedAt) {
                      const startedMs = att.startedAt.seconds ? att.startedAt.seconds * 1000 : att.startedAt;
                      if (startedMs) {
                        activities.push({
                          id: `started-${test.id}`,
                          text: `✓ ${test.title || 'Assessment'} started`,
                          timeMs: startedMs
                        });
                      }
                    }
                    if (att.status === 'submitted' || att.status === 'auto_submitted') {
                      const submittedMs = att.submittedAt?.seconds ? att.submittedAt.seconds * 1000 : (att.submittedAt || 0);
                      if (submittedMs) {
                        activities.push({
                          id: `completed-${test.id}`,
                          text: `✓ ${test.title || 'Assessment'} completed`,
                          timeMs: submittedMs
                        });
                        activities.push({
                          id: `published-${test.id}`,
                          text: `✓ Result published for ${test.title || 'Assessment'}`,
                          timeMs: submittedMs + 1000
                        });
                      }
                    }
                  }
                });

                const sortedActivities = activities
                  .sort((a, b) => b.timeMs - a.timeMs)
                  .slice(0, 5);

                const getRelativeTime = (timestampMs: number) => {
                  const diff = Date.now() - timestampMs;
                  const mins = Math.floor(diff / 60000);
                  if (mins < 1) return 'Just now';
                  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
                  const hours = Math.floor(mins / 60);
                  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                  const days = Math.floor(hours / 24);
                  if (days === 1) return 'Yesterday';
                  return `${days} days ago`;
                };

                return (
                  <div className="space-y-6">
                    {/* Prominent NEXT ASSESSMENT Section */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Next Assessment</h3>
                      {nextAssessment ? (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${nextAssessment.cardStatus.badgeColor}`}>
                                  {nextAssessment.cardStatus.statusLabel}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {nextAssessment.category || 'General'}
                                </span>
                                <span className="text-slate-300 font-normal">&bull;</span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {nextAssessment.difficulty || 'Intermediate'}
                                </span>
                              </div>
                              <h4 className="text-lg font-black text-slate-900 leading-snug">
                                {nextAssessment.title || 'Untitled Assessment'}
                              </h4>
                            </div>

                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {nextAssessment.duration || 0} mins</span>
                              <span className="text-slate-300 font-normal">&bull;</span>
                              <span>{nextAssessment.targetQuestions || 0} Qs</span>
                              <span className="text-slate-300 font-normal">&bull;</span>
                              <span>{nextAssessment.targetMarks || 0} Marks</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              <span>
                                {nextAssessment.availabilityType === 'immediate'
                                  ? 'Available Immediately'
                                  : `${nextAssessment.startDate ? formatDateToDDMMYYYY(nextAssessment.startDate) : ''} at ${nextAssessment.startTime ? formatTimeTo12Hour(nextAssessment.startTime) : '00:00'}`}
                              </span>
                            </div>
                            <button
                              disabled={!nextAssessment.cardStatus.isEnabled}
                              onClick={() => nextAssessment.cardStatus.isEnabled && navigate('/test/' + nextAssessment.id)}
                              className={`py-2.5 px-6 text-xs font-bold rounded-xl uppercase tracking-wider transition-all focus:outline-none ${nextAssessment.cardStatus.buttonStyle}`}
                            >
                              {nextAssessment.cardStatus.actionText}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-500 shadow-xs">
                          <h4 className="text-xs font-bold text-slate-800 mb-1">No upcoming assessments</h4>
                          <p className="text-[11px] text-slate-400 font-semibold">New assessments assigned to you will appear here.</p>
                        </div>
                      )}
                    </div>

                    {/* Two-column section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* LEFT: Upcoming Assessments */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Upcoming Assessments</h3>
                        </div>

                        <div className="space-y-3">
                          {upcomingAssessmentsList.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs font-semibold shadow-xs">
                              No upcoming assessments.
                            </div>
                          ) : (
                            upcomingAssessmentsList.map(test => (
                              <div key={test.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4">
                                <div className="space-y-1.5">
                                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{test.title}</h4>
                                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                                    <span>{test.startDate ? formatDateToDDMMYYYY(test.startDate) : ''}</span>
                                    <span>&bull;</span>
                                    <span>{test.startTime ? formatTimeTo12Hour(test.startTime) : '00:00'}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setActiveTab('available')}
                                  className="py-1.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wider focus:outline-none transition-colors"
                                >
                                  View
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* RIGHT: Recent Results */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Recent Results</h3>
                        </div>

                        <div className="space-y-3">
                          {completedAttempts.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs font-semibold shadow-xs">
                              No results available yet.
                            </div>
                          ) : (
                            completedAttempts.map(att => {
                              const test = studentTests.find(t => t.id === att.testId);
                              const title = test?.title || att.testTitle || 'Untitled Assessment';
                              const percent = att.totalMarks > 0 ? Math.round((att.score / att.totalMarks) * 100) : 0;
                              const passing = typeof att.passingScore === 'number' ? att.passingScore : (test?.passingScore !== undefined ? test.passingScore : 40);
                              const isPass = percent >= passing;

                              return (
                                <div key={att.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4">
                                  <div className="space-y-1">
                                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{title}</h4>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                      <span>{att.score} / {att.totalMarks} Marks</span>
                                      <span>&bull;</span>
                                      <span>{percent}%</span>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                    isPass ? 'bg-emerald-50 text-emerald-750 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                                  }`}>
                                    {isPass ? 'Passed' : 'Failed'}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Recent Activity */}
                    <div className="space-y-4">
                      <div className="border-b border-slate-200/80 pb-2.5">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Recent Activity</h3>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                        {sortedActivities.length === 0 ? (
                          <div className="text-center text-slate-400 py-4 text-xs font-semibold">
                            No recent activity.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sortedActivities.map(act => (
                              <div key={act.id} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span>{act.text}</span>
                                <span className="text-[10px] text-slate-400">{getRelativeTime(act.timeMs)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          ) : activeTab === 'available' ? (
            <AvailableTestsView />
          ) : activeTab === 'completed' ? (
            <CompletedTestsView />
          ) : activeTab === 'results' ? (
            <ResultsView />
          ) : activeTab === 'profile' ? (
            <ProfileView isAdmin={false} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 font-medium">
              This page section is currently under development.
            </div>
          )}

        </main>

        {/* Reusable Footer Component */}
        {/* <Footer /> */}
      </div>

      {/* Logout confirmation Dialog overlay card modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200/80 p-6 shadow-xl text-center space-y-5">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Logout?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Are you sure you want to log out of your AptiGuard account?
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                disabled={isLoggingOut}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Card Modal */}
      {showClearDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200/80 p-6 shadow-xl space-y-5 text-left">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">⚠ Clear Data</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {isAdmin ? 'Are you sure you want to delete this data?' : 'Are you sure you want to delete your data?'}
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 border border-slate-200/70 rounded-xl p-4 text-xs text-slate-600 font-medium leading-relaxed">
              <p className="font-bold text-slate-900">This action cannot be undone.</p>
              <p>This action will permanently delete:</p>
              {isAdmin ? (
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Candidate test attempts &amp; submission history</li>
                  <li>Submitted answer keys &amp; proctoring violation logs</li>
                  <li>Student score cards &amp; evaluation result records</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Your personal assessment attempt history</li>
                  <li>Your submitted test answers and violation logs</li>
                  <li>Your score cards and result records</li>
                </ul>
              )}
              <p className="pt-1 text-[11px] text-slate-500 italic">
                {isAdmin
                  ? 'Note: Global assessments, questions, and registered user accounts will remain safe.'
                  : 'Note: Global assessments, questions, and your login account will remain safe.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isClearingData}
                onClick={() => setShowClearDataModal(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingData}
                onClick={handleExecuteClearData}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors cursor-pointer shadow-xs disabled:opacity-75"
              >
                {isClearingData ? 'Deleting...' : (isAdmin ? 'Delete Permanently' : 'Delete Data')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help & Guidelines Overlay Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200/80 p-6 shadow-xl relative flex flex-col max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-650 focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-5">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                <HelpCircle className="w-5 h-5 text-[#0952cc]" />
                <h3 className="text-base font-extrabold text-slate-900">Help & Guidelines</h3>
              </div>

              {/* Guidelines categories */}
              <div className="space-y-4 text-xs">

                {/* Category 1 */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-[#031b4e] uppercase tracking-wide text-[10px] text-slate-400">Before Your Test</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 font-semibold pl-1">
                    <li>Use a stable internet connection</li>
                    <li>Allow fullscreen mode</li>
                    <li>Keep your device plugged in</li>
                    <li>Close unnecessary applications</li>
                  </ul>
                </div>

                {/* Category 2 */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-[#031b4e] uppercase tracking-wide text-[10px] text-slate-400">During Your Test</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 font-semibold pl-1">
                    <li>Do not switch tabs</li>
                    <li>Do not exit fullscreen</li>
                    <li>Do not copy/paste</li>
                    <li>Do not use external resources</li>
                  </ul>
                </div>

                {/* Category 3 */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-red-650 uppercase tracking-wide text-[10px] text-red-400">Violations</h4>
                  <ul className="list-disc list-inside space-y-1 text-red-600 font-semibold pl-1">
                    <li>1st violation &rarr; Warning</li>
                    <li>2nd violation &rarr; Warning</li>
                    <li>3rd violation &rarr; Test automatically submitted</li>
                  </ul>
                </div>

              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-full py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Error Modal Dialog */}
      {uiAlertMsg && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200/80 p-6 shadow-xl text-center space-y-5">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-md font-bold text-slate-900 font-sans">Attention</h3>
              <p className="text-xs text-slate-500 font-medium font-sans leading-relaxed">{uiAlertMsg}</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setUiAlertMsg(null)}
                className="w-full py-2 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-lg uppercase tracking-wide focus:outline-none transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default Dashboard;
