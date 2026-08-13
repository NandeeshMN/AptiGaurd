// Trigger Vercel Build
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/auth/Logo';
import { AvailableTestsView, getCandidateTestCardStatus } from './AvailableTestsView';
import { CompletedTestsView } from './CompletedTestsView';
import { ResultsView } from './ResultsView';
import { AdminResultsView } from './AdminResultsView';
import { ProfileView } from './ProfileView';
import { CreateTestView } from './CreateTestView';
import { Footer } from '../components/Footer';
import { useActionConfirmation } from '../context/ActionConfirmationContext';
import { collection, getDocs, doc, getDoc, query, where, onSnapshot, updateDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatDateToDDMMYYYY, formatTimeTo12Hour } from '../utils/timeFormat';
import { Clock } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  User,
  LogOut,
  Bell,
  HelpCircle,
  Menu,
  X,
  Plus,
  Users,
  Search,
  CheckCheck,
  AlertTriangle,
  Trash2
} from 'lucide-react';

export function getAdminTestLifecycleStatus(t: any, nowMs: number = Date.now()): 'scheduled' | 'in_progress' | 'closed' {
  if (!t) return 'closed';
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


interface DashboardProps {
  defaultTab?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ defaultTab }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { showConfirmation } = useActionConfirmation();

  // Determine user role (Bypass based on email structure)
  const isAdmin = currentUser?.email?.toLowerCase() === 'nandeeshmn12@gmail.com';

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
        ? `${import.meta.env.VITE_API_URL}/api/tests/clear-data/admin`
        : `${import.meta.env.VITE_API_URL}/api/tests/clear-data/student`;

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
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsSearch, setStudentsSearch] = useState('');

  // Edit Test modal state
  const [editingTest, setEditingTest] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('');
  const [_editDuration, setEditDuration] = useState('');
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
        title: editTitle,
        description: editDescription,
        category: editCategory,
        difficulty: editDifficulty,
        duration: derivedDurationMins,
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
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tests/${editingTest.id}`, {
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
  }, [isAdmin]);



  const fetchAdminStudents = async () => {
    if (!isAdmin) return;
    try {
      setLoadingStudents(true);

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
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'students') {
      fetchAdminStudents();
    }
  }, [isAdmin, activeTab]);

  // Filtered Students list
  const filteredStudents = studentsList.filter((s) => {
    const q = studentsSearch.toLowerCase();
    const nameStr = (s.name || s.fullName || '').toLowerCase();
    const emailStr = (s.email || '').toLowerCase();
    return nameStr.includes(q) || emailStr.includes(q);
  });


  const [userProfile, setUserProfile] = useState<any>(null);

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

            {/* Sidebar prominent Create Button */}
            <button
              onClick={() => setActiveTab('create-test')}
              className="w-full mb-6 py-2.5 px-4 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-2 transition-colors duration-255 shadow-xs focus:outline-none uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Test</span>
            </button>

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

          {/* Header row (Desktop Search & actions) */}
          <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between flex-shrink-0 z-35 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Search bar widget */}
              <div className="relative w-64 md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 relative focus:outline-none">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
                A
              </div>
            </div>
          </header>

          {/* Inner Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">

            {/* Greeting */}
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">Welcome back, Admin 👋</h2>
              <p className="text-xs text-slate-500 font-medium">Ready to monitor and manage college assessments?</p>
            </div>

            {/* Dynamic Admin Subview Router */}
            {activeTab === 'dashboard' ? (
              <>
                {/* Quick Actions Buttons Row */}
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-[#0952cc] hover:bg-[#0747a6] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none" onClick={() => setActiveTab('create-test')}>
                    Create Test
                  </button>
                  <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none" onClick={() => setActiveTab('tests')}>
                    Manage Tests
                  </button>
                  <button className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-xs focus:outline-none" onClick={() => setActiveTab('results')}>
                    View Results
                  </button>
                </div>

                {/* Content Splits */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left 2 columns: Tests table log */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Tests</h3>
                    </div>

                    {loadingTests ? (
                      <div className="text-center py-6 text-xs font-semibold text-slate-400">Loading recent tests...</div>
                    ) : allTests.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
                        No tests created yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allTests.slice(0, 5).map((t) => (
                          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{t.title || 'Untitled Assessment'}</h4>
                              <p className="text-[10px] text-slate-500 font-semibold mt-1">
                                {t.category || 'General'} &middot; {t.difficulty || 'Intermediate'} &middot; {t.duration || 0} mins
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${t.status === 'published'
                                ? 'bg-emerald-50 text-emerald-750 border-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                              {t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right column sidebar widgets */}
                  <div className="space-y-6">

                    {/* Activity Feed log stream */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                      <h4 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Activity</h4>

                      {/* Empty state placeholder ready for real Firestore activity */}
                      <div className="text-center text-slate-400 py-6 text-xs font-semibold">
                        No recent activity.
                      </div>
                    </div>

                    {/* Clear Data Action Card */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Clear Data</h4>
                          <p className="text-[10px] text-slate-500 font-medium">Delete candidate submissions &amp; attempt logs</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClearDataModal(true)}
                        className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors border border-red-200 focus:outline-none cursor-pointer"
                      >
                        Clear Data
                      </button>
                    </div>

                  </div>

                </div>
              </>
            ) : activeTab === 'profile' ? (
              <ProfileView />
            ) : activeTab === 'create-test' ? (
              <CreateTestView onBack={(tab, toastMsg) => {
                setActiveTab(tab || 'dashboard');
                if (toastMsg) {
                  setEditToastMsg(toastMsg);
                }
              }} />
            ) : activeTab === 'tests' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Manage Tests</h3>
                    <p className="text-xs text-slate-500 font-medium">Create, publish, and monitor your test assessments.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('create-test')}
                    className="py-2 px-4 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white font-semibold text-xs rounded-lg flex items-center space-x-2 transition-colors focus:outline-none uppercase tracking-wider"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Test</span>
                  </button>
                </div>

                {loadingTests ? (
                  <div className="text-center py-12 text-xs text-slate-500 font-semibold">
                    Loading tests...
                  </div>
                ) : allTests.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
                    No tests created yet. Click "Create New Test" to get started.
                  </div>
                ) : (
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
                        {allTests.map((t) => {
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
                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                  {lifecycle === 'closed' ? 'CLOSED' : lifecycle === 'in_progress' ? 'IN PROGRESS' : 'SCHEDULED'}
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
                )}
              </div>
            ) : activeTab === 'results' ? (
              <AdminResultsView />
            ) : activeTab === 'students' ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Registered Student Candidates</h3>
                    <p className="text-xs text-slate-500 font-medium">Manage all registered candidates and track their exam participation.</p>
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search student by name or email..."
                      value={studentsSearch}
                      onChange={(e) => setStudentsSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
                    />
                  </div>
                </div>

                {loadingStudents ? (
                  <div className="text-center py-12 text-xs text-slate-500 font-semibold">
                    Loading registered students...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
                    No registered students found matching your search.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs font-semibold">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 tracking-wider uppercase text-[10px]">
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Registered On</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Test Attempts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((st) => {
                          const name = st.name || st.fullName || st.email?.split('@')[0] || 'Candidate Student';
                          const email = st.email || 'N/A';
                          const dateVal = st.createdAt?.seconds
                            ? new Date(st.createdAt.seconds * 1000).toLocaleDateString()
                            : (st.createdAt ? new Date(st.createdAt).toLocaleDateString() : 'Active');
                          const status = st.status || 'Active';
                          const attemptsCount = st.testAttemptsCount || 0;

                          return (
                            <tr key={st.uid || st.id || email} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 text-slate-900 font-bold">{name}</td>
                              <td className="py-3 px-4 text-slate-500 font-medium">{email}</td>
                              <td className="py-3 px-4 text-slate-400">{dateVal}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border bg-emerald-50 text-emerald-700 border-emerald-100">
                                  {status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[#0952cc] font-bold">
                                {attemptsCount} Attempt{attemptsCount !== 1 ? 's' : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'profile' ? (
              <ProfileView isAdmin={true} />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 font-medium">
                This admin dashboard section is currently under development.
              </div>
            )}

          </main>

          {/* Reusable Footer Component */}
          <Footer />
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

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Category</label>
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800"
                    />
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
            <Bell className="w-5 h-5 text-slate-400 cursor-pointer" />
            <div className="w-8 h-8 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Inner Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-[1200px] w-full mx-auto">

          {/* Top Header Row (Desktop Layout) */}
          <div className="hidden md:flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                Good evening, {studentName.split(' ')[0]} 👋
              </h2>
              <p className="text-xs text-slate-500 font-medium">Ready for your next aptitude challenge?</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm relative focus:outline-none">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
              <button
                onClick={() => setShowHelpModal(true)}
                className="p-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 shadow-sm focus:outline-none"
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {initials}
              </div>
            </div>
          </div>

          {/* Dynamic Subview Router */}
          {activeTab === 'dashboard' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column widgets */}
              <div className="lg:col-span-2 space-y-6">

                {loadingStudentTests ? (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-400 text-xs font-semibold shadow-xs">
                    Loading your assessments...
                  </div>
                ) : (
                  <>
                    {/* Process student tests with 5-tier priority system */}
                    {(() => {
                      const processed = studentTests.map((t) => {
                        const att = studentUserAttemptsMap.get(t.id);
                        const cardStatus = getCandidateTestCardStatus(t, att, studentNowMs);
                        return {
                          ...t,
                          cardStatus,
                        };
                      });

                      const upcomingList = processed.filter((p) => p.cardStatus.statusLabel === 'UPCOMING');
                      const availableList = processed.filter((p) => p.cardStatus.statusLabel === 'AVAILABLE');
                      const completedList = processed.filter((p) => p.cardStatus.statusLabel === 'COMPLETED' || p.cardStatus.statusLabel === 'EXPIRED');

                      return (
                        <>
                          {/* Upcoming Tests */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Upcoming Tests</h3>

                            {upcomingList.length === 0 ? (
                              <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs font-semibold shadow-xs">
                                No upcoming assessments.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {upcomingList.map((test) => (
                                  <div key={test.id} className="bg-white rounded-xl border border-t-4 border-slate-200/80 border-t-amber-500 shadow-xs hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="text-xs font-bold text-slate-900 leading-snug flex-1">{test.title || 'Untitled'}</h4>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border flex-shrink-0 ${test.cardStatus.badgeColor}`}>
                                        {test.cardStatus.statusLabel}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{test.duration || 0} mins</span>
                                      <span>&bull; {test.targetQuestions || 0} Qs</span>
                                      <span>&bull; {test.targetMarks || 0} marks</span>
                                    </div>
                                    <p className="text-[10px] text-amber-700 font-bold truncate">{test.cardStatus.scheduledText}</p>
                                    <button
                                      disabled={!test.cardStatus.isEnabled}
                                      onClick={() => test.cardStatus.isEnabled && navigate('/test/' + test.id)}
                                      className={`w-full py-2 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none ${test.cardStatus.buttonStyle}`}
                                    >
                                      {test.cardStatus.actionText}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Available Tests */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Available Tests</h3>
                              <button className="text-xs font-bold text-[#0952cc] hover:underline cursor-pointer" onClick={() => setActiveTab('available')}>View All &rarr;</button>
                            </div>

                            {availableList.length === 0 ? (
                              <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs font-semibold shadow-xs">
                                No tests available right now.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {availableList.map((test) => (
                                  <div key={test.id} className="bg-white rounded-xl border border-t-4 border-slate-200/80 border-t-[#0952cc] shadow-xs hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="text-xs font-bold text-slate-900 leading-snug flex-1">{test.title || 'Untitled'}</h4>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border flex-shrink-0 ${test.cardStatus.badgeColor}`}>
                                        {test.cardStatus.statusLabel}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{test.duration || 0} mins</span>
                                      <span>&bull; {test.targetQuestions || 0} Qs</span>
                                      <span>&bull; {test.targetMarks || 0} marks</span>
                                    </div>
                                    <button
                                      disabled={!test.cardStatus.isEnabled}
                                      onClick={() => test.cardStatus.isEnabled && navigate('/test/' + test.id)}
                                      className={`w-full py-2 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none ${test.cardStatus.buttonStyle}`}
                                    >
                                      {test.cardStatus.actionText}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Completed / Past Tests */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">Completed / Past Tests</h3>

                            {completedList.length === 0 ? (
                              <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs font-semibold shadow-xs">
                                No completed assessments yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {completedList.map((test) => (
                                  <div key={test.id} className="bg-white rounded-xl border border-t-4 border-slate-200/80 border-t-slate-400 shadow-xs hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3 opacity-80">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="text-xs font-bold text-slate-900 leading-snug flex-1">{test.title || 'Untitled'}</h4>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border flex-shrink-0 ${test.cardStatus.badgeColor}`}>
                                        {test.cardStatus.statusLabel}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{test.duration || 0} mins</span>
                                      <span>&bull; {test.targetQuestions || 0} Qs</span>
                                      <span>&bull; {test.targetMarks || 0} marks</span>
                                    </div>
                                    <button
                                      disabled={!test.cardStatus.isEnabled}
                                      onClick={() => test.cardStatus.isEnabled && navigate('/test/' + test.id)}
                                      className={`w-full py-2 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors focus:outline-none ${test.cardStatus.buttonStyle}`}
                                    >
                                      {test.cardStatus.actionText}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

              </div>

              {/* Right Column widgets */}
              <div className="space-y-6">
                {/* Recent Activity card */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <h4 className="text-xs font-extrabold text-[#031b4e] uppercase tracking-wide">Recent Activity</h4>
                  <div className="text-center text-slate-400 py-6 text-xs font-semibold">
                    No recent activity.
                  </div>
                </div>

                {/* Clear Data Action Card */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Clear Data</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Delete your personal attempt history</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowClearDataModal(true)}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors border border-red-200 focus:outline-none cursor-pointer"
                  >
                    Clear Data
                  </button>
                </div>
              </div>

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
        <Footer />
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
