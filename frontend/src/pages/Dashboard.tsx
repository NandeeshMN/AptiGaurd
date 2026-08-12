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
import { collection, getDocs, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  Download,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';

const checkIsTestCompleted = (t: any): boolean => {
  if (!t) return false;
  if (t.status === 'completed' || t.status === 'closed' || t.status === 'expired') {
    return true;
  }
  if (t.endDate && t.endTime) {
    const endMs = new Date(`${t.endDate}T${t.endTime}:00`).getTime();
    if (!isNaN(endMs) && Date.now() >= endMs) {
      return true;
    }
  }
  return false;
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Determine user role (Bypass based on email structure)
  const isAdmin = currentUser?.email?.toLowerCase() === 'nandeeshmn12@gmail.com';

  const [allTests, setAllTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [allAttempts, setAllAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [resultsTestFilter, setResultsTestFilter] = useState('all');

  // Edit Test modal state
  const [editingTest, setEditingTest] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('');
  const [editDuration, setEditDuration] = useState('');
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
    if (checkIsTestCompleted(t)) {
      setUiAlertMsg('This assessment is completed/closed and can no longer be edited.');
      return;
    }

    setEditingTest(t);
    setEditTitle(t.title || '');
    setEditDescription(t.description || '');
    setEditCategory(t.category || 'Quantitative Aptitude');
    setEditDifficulty(t.difficulty || 'Intermediate');
    setEditDuration(t.duration ? String(t.duration) : '30');
    setEditStartDate(t.startDate || '');
    setEditStartTime(t.startTime || '');
    setEditEndDate(t.endDate || '');
    setEditEndTime(t.endTime || '');
    setEditStatus(t.status || 'published');
  };

  const handleSaveTestUpdate = async () => {
    if (!editingTest || !currentUser) return;

    if (checkIsTestCompleted(editingTest)) {
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
      const token = await currentUser.getIdToken();
      
      const payload = {
        title: editTitle,
        description: editDescription,
        category: editCategory,
        difficulty: editDifficulty,
        duration: parseInt(editDuration) || 30,
        startDate: editStartDate,
        startTime: editStartTime,
        endDate: editEndDate,
        endTime: editEndTime,
        status: editStatus,
      };

      const res = await fetch(`http://localhost:5000/api/tests/${editingTest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUiAlertMsg(data.message || 'Failed to update test.');
        return;
      }

      setEditToastMsg('Test updated successfully! Email notifications are being processed.');
      setTimeout(() => {
        setEditToastMsg(null);
        setEditingTest(null);
      }, 1500);

      fetchAdminTests();
    } catch (err) {
      console.error('Error updating test:', err);
      setUiAlertMsg('Network error updating test. Please check your connection.');
    } finally {
      setSavingEdit(false);
    }
  };

  const fetchAdminTests = async () => {
    if (!isAdmin) return;
    try {
      setLoadingTests(true);
      const querySnap = await getDocs(collection(db, 'tests'));
      const list: any[] = [];
      querySnap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setAllTests(list);
    } catch (error) {
      console.error('Error fetching admin tests:', error);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || activeTab !== 'results') return;
    setLoadingAttempts(true);

    let userMap = new Map<string, any>();
    getDocs(collection(db, 'users')).then((usersSnap) => {
      usersSnap.forEach((docSnap) => {
        const u = docSnap.data();
        userMap.set(docSnap.id, u);
        if (u.uid) userMap.set(u.uid, u);
      });
    }).catch(() => {});

    const unsubscribe = onSnapshot(collection(db, 'testAttempts'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const att = docSnap.data();
        const uDoc = att.userId ? userMap.get(att.userId) : null;
        
        let candName = uDoc?.name || uDoc?.fullName || uDoc?.displayName;
        if (!candName || candName.includes('@')) {
          const attName = att.candidateName || att.userName || att.name || att.fullName;
          if (attName && !attName.includes('@') && attName !== att.userEmail?.split('@')[0]) {
            candName = attName;
          }
        }
        if (!candName || candName.includes('@')) {
          candName = uDoc?.name || uDoc?.fullName || 'Nandeesh M N';
        }

        list.push({
          id: docSnap.id,
          ...att,
          resolvedCandidateName: candName,
        });
      });
      list.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));
      setAllAttempts(list);
      setLoadingAttempts(false);
    }, (err) => {
      console.error('Error in admin attempts real-time listener:', err);
      setLoadingAttempts(false);
    });

    return () => unsubscribe();
  }, [isAdmin, activeTab]);

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
    if (isAdmin) {
      fetchAdminTests();
      if (activeTab === 'students') {
        fetchAdminStudents();
      }
    }
  }, [isAdmin, activeTab]);

  // Deterministic Ranking Calculation for Results
  const targetAttempts = resultsTestFilter === 'all'
    ? allAttempts
    : allAttempts.filter((a) => a.testId === resultsTestFilter);

  const rankedAttempts = [...targetAttempts].sort((a, b) => {
    // 1. Score DESC
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    // 2. Correct answers DESC
    if ((b.correctAnswers ?? 0) !== (a.correctAnswers ?? 0)) return (b.correctAnswers ?? 0) - (a.correctAnswers ?? 0);
    // 3. Submitted time ASC
    const timeA = a.submittedAt?.seconds ? a.submittedAt.seconds * 1000 : (a.startedAtMs || 0);
    const timeB = b.submittedAt?.seconds ? b.submittedAt.seconds * 1000 : (b.startedAtMs || 0);
    return timeA - timeB;
  });

  // Filtered Students list
  const filteredStudents = studentsList.filter((s) => {
    const q = studentsSearch.toLowerCase();
    const nameStr = (s.name || s.fullName || '').toLowerCase();
    const emailStr = (s.email || '').toLowerCase();
    return nameStr.includes(q) || emailStr.includes(q);
  });

  // Helper function to render Top 3 Emoji Symbols + Rank number to high-resolution PNG Data URL for jsPDF
  const generateMedalRankImage = (emoji: string, rankNum: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 140, 50);
      ctx.font = 'bold 26px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${emoji} ${rankNum}`, 70, 25);
    }
    return canvas.toDataURL('image/png');
  };

  // Professional Multi-Page Admin PDF Export Generator
  const handleDownloadAdminPDF = () => {
    if (rankedAttempts.length === 0) {
      alert('No candidate result data available to generate PDF.');
      return;
    }

    const selectedTestObj = allTests.find((t) => t.id === resultsTestFilter);
    const testTitle = selectedTestObj?.title || (resultsTestFilter === 'all' ? 'All Assessments' : 'Assessment');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Summary statistics
    const totalStudents = rankedAttempts.length;
    const completedCount = rankedAttempts.filter((r) => r.status === 'submitted').length;
    const autoSubmittedCount = rankedAttempts.filter((r) => r.status === 'auto_submitted').length;
    const scores = rankedAttempts.map((r) => r.score ?? 0);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / (totalStudents || 1)).toFixed(2);
    const highestScore = Math.max(...scores, 0).toFixed(2);
    const avgPct = (rankedAttempts.reduce((a, b) => a + (b.percentage ?? 0), 0) / (totalStudents || 1)).toFixed(2);

    // Create jsPDF document (Landscape A4: 297mm x 210mm)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Top Header Banner (297mm width)
    doc.setFillColor(9, 82, 204); // #0952cc
    doc.rect(0, 0, 297, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('APTIGUARD', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Online Aptitude Assessment & Proctoring System', 14, 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TEST RESULTS REPORT', 297 - 14, 14, { align: 'right' });

    // Document Meta Header
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Test: ${testTitle}`, 14, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exam Date: ${dateStr}  |  Generated by AptiGuard Admin System`, 14, 40);

    // Summary Statistics Bar Box (269mm printable width)
    const summaryY = 44;
    const summaryWidth = 269;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, summaryY, summaryWidth, 16, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, summaryY, summaryWidth, 16, 2, 2, 'S');

    const boxWidth = summaryWidth / 6;
    const items = [
      { label: 'Total Candidates', val: `${totalStudents}` },
      { label: 'Completed', val: `${completedCount}` },
      { label: 'Auto Submitted', val: `${autoSubmittedCount}` },
      { label: 'Average Score', val: `${avgScore}` },
      { label: 'Highest Score', val: `${highestScore}` },
      { label: 'Average Pct', val: `${avgPct}%` },
    ];

    items.forEach((item, idx) => {
      const xPos = 14 + idx * boxWidth + boxWidth / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(9, 82, 204);
      doc.text(item.val, xPos, summaryY + 6, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, xPos, summaryY + 12, { align: 'center' });
    });

    // Ranking Table Data
    const tableData = rankedAttempts.map((r, idx) => {
      const rank = idx + 1;
      const rankText = rank <= 3 ? '' : `${rank}`;

      const name = r.resolvedCandidateName || r.name || r.fullName || r.userName || 'Nandeesh M N';
      const score = `${r.score ?? 0}/${r.totalMarks || 100}`;
      const pct = `${r.percentage ?? 0}%`;
      const correct = `${r.correctAnswers ?? 0}`;
      const wrong = `${r.wrongAnswers ?? 0}`;
      const unanswered = `${r.unanswered ?? 0}`;
      const violations = `${r.exitCount || 0}`;
      const subType = r.submissionReason
        ? (r.submissionReason === 'manual_submission'
          ? 'Manual'
          : r.submissionReason === 'maximum_exit_limit'
            ? 'Auto - 3 Violations'
            : 'Auto - Time Expired')
        : (r.status === 'submitted' ? 'Manual' : 'Auto Submitted');
      const subTime = r.submittedAt?.seconds
        ? new Date(r.submittedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'N/A';

      return [rankText, name, score, pct, correct, wrong, unanswered, violations, subType, subTime];
    });

    autoTable(doc, {
      startY: 65,
      margin: { left: 14, right: 14 },
      head: [['Rank', 'Candidate Name', 'Score', 'Percentage', 'Correct', 'Wrong', 'Unanswered', 'Violations', 'Submission', 'Submitted At']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [9, 82, 204],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        valign: 'middle',
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }, // Rank
        1: { fontStyle: 'bold', cellWidth: 48 },                  // Candidate Name
        2: { halign: 'center', fontStyle: 'bold', textColor: [9, 82, 204], cellWidth: 24 }, // Score
        3: { halign: 'center', cellWidth: 24 },                   // Percentage
        4: { halign: 'center', textColor: [16, 185, 129], cellWidth: 20 }, // Correct
        5: { halign: 'center', textColor: [239, 68, 68], cellWidth: 20 },   // Wrong
        6: { halign: 'center', cellWidth: 25 },                   // Unanswered
        7: { halign: 'center', cellWidth: 22 },                   // Violations
        8: { halign: 'center', cellWidth: 34 },                   // Submission
        9: { halign: 'center', cellWidth: 30 },                   // Submitted At
      },
      didParseCell: (data) => {
        // Highlight top 3 rows
        if (data.section === 'body') {
          if (data.row.index === 0) {
            data.cell.styles.fillColor = [254, 243, 199]; // Gold Amber 100
          } else if (data.row.index === 1) {
            data.cell.styles.fillColor = [241, 245, 249]; // Silver Slate 100
          } else if (data.row.index === 2) {
            data.cell.styles.fillColor = [255, 237, 213]; // Bronze Orange 100
          }
        }
      },
      didDrawCell: (data) => {
        // Draw top 3 Unicode emoji rank badges (🥇 1, 🥈 2, 🥉 3) in Rank column
        if (data.section === 'body' && data.column.index === 0) {
          const rank = data.row.index + 1;
          if (rank <= 3) {
            const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
            const imgDataUrl = generateMedalRankImage(emoji, rank);
            const imgWidth = 14;
            const imgHeight = 5;
            const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
            const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;
            doc.addImage(imgDataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);
          }
        }
      },
      didDrawPage: (data) => {
        // Footer page numbers
        const totalPages = (doc as any).internal.getNumberOfPages();
        const currentPage = data.pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${currentPage} of ${totalPages}`, 297 - 14, 210 - 8, { align: 'right' });
        doc.text('AptiGuard Official Test Assessment Record', 14, 210 - 8);
      },
    });

    const cleanFileName = testTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const fileDate = new Date().toISOString().split('T')[0];
    doc.save(`AptiGuard_${cleanFileName}_Results_${fileDate}.pdf`);
  };

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

    // 1. Realtime listener for published tests assigned to current student
    const qTests = query(collection(db, 'tests'), where('status', '==', 'published'));
    const unsubscribeTests = onSnapshot(
      qTests,
      async (snapshot) => {
        try {
          const list: any[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.assignmentType === 'all') {
              list.push({ id: docSnap.id, ...data });
            } else {
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
  }, [currentUser, isAdmin, activeTab]);

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

                  </div>

                </div>
              </>
            ) : activeTab === 'profile' ? (
              <ProfileView />
            ) : activeTab === 'create-test' ? (
              <CreateTestView onBack={(tab) => setActiveTab(tab || 'dashboard')} />
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
                          const status = t.status || 'draft';
                          const dateVal = t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                          const isCompleted = checkIsTestCompleted(t);

                          return (
                            <tr key={testId} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 text-slate-900 font-bold">{title}</td>
                              <td className="py-3 px-4 text-slate-500">{cat}</td>
                              <td className="py-3 px-4 text-slate-900">{qCount}</td>
                              <td className="py-3 px-4 text-slate-900">{marks}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                  isCompleted
                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                    : status === 'published'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {isCompleted ? 'COMPLETED' : status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-400">{dateVal}</td>
                              <td className="py-3 px-4 text-right">
                                {isCompleted ? (
                                  <button
                                    disabled
                                    className="py-1 px-3 bg-slate-100 text-slate-400 text-[10px] font-extrabold rounded-md uppercase tracking-wider border border-slate-200 cursor-not-allowed opacity-75 select-none"
                                  >
                                    Test Closed
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
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Duration (Mins)</label>
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-xs text-slate-800 font-bold"
                      />
                    </div>
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
              {/* Left Column widgets (Stretched to col-span-3) */}
              <div className="lg:col-span-3 space-y-6">

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
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                              <button className="text-xs font-bold text-[#0952cc] hover:underline" onClick={() => setActiveTab('available')}>View All &rarr;</button>
                            </div>

                            {availableList.length === 0 ? (
                              <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-slate-400 text-xs font-semibold shadow-xs">
                                No tests available right now.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="hidden lg:block space-y-6">
                {/* Sidebar widgets removed for data-driven cleanliness */}
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
