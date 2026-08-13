import React, { useState, useEffect } from 'react';
import { Search, Download, Calendar, Users, Award, TrendingUp, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { formatTimeTo12Hour, formatTimeWindow, formatDateToDDMMYYYY } from '../utils/timeFormat';

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

export const AdminResultsView: React.FC = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [generatingTestId, setGeneratingTestId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // 1. Realtime listener for all tests
    const unsubTests = onSnapshot(
      collection(db, 'tests'),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setTests(list);
      },
      (err) => console.error('Error fetching tests for Admin Results:', err)
    );

    // 2. Realtime listener for test attempts
    const unsubAttempts = onSnapshot(
      collection(db, 'testAttempts'),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'submitted' || data.status === 'auto_submitted') {
            list.push({ id: docSnap.id, ...data });
          }
        });
        setAttempts(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching attempts for Admin Results:', err);
        setLoading(false);
      }
    );

    // 3. Realtime listener for users to resolve candidate names
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const uMap = new Map<string, any>();
        snapshot.forEach((docSnap) => {
          uMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        setUsersMap(uMap);
      },
      (err) => console.error('Error fetching users for Admin Results:', err)
    );

    return () => {
      unsubTests();
      unsubAttempts();
      unsubUsers();
    };
  }, []);

  // Listen to global clear-data event to immediately purge stale attempt records from memory
  useEffect(() => {
    const handleClearDataEvent = () => {
      setAttempts([]);
    };
    window.addEventListener('aptiguard:clear-data', handleClearDataEvent);
    return () => window.removeEventListener('aptiguard:clear-data', handleClearDataEvent);
  }, []);

  // Helper to format date header into strict DD/MM/YYYY format
  const formatDateHeader = (dateObj: Date): string => {
    return formatDateToDDMMYYYY(dateObj);
  };

  // Resolve test date object
  const getTestDateObject = (test: any, testAttemptsList: any[]): { dateObj: Date; dateFormatted: string; isToday: boolean; isThisWeek: boolean; isThisMonth: boolean } => {
    let rawDate: Date | null = null;

    if (test.startDate) {
      const parsed = new Date(test.startDate);
      if (!isNaN(parsed.getTime())) {
        rawDate = parsed;
      }
    }

    if (!rawDate && test.createdAt?.seconds) {
      rawDate = new Date(test.createdAt.seconds * 1000);
    }

    if (!rawDate && testAttemptsList.length > 0) {
      const firstAtt = testAttemptsList[0];
      if (firstAtt.submittedAt?.seconds) {
        rawDate = new Date(firstAtt.submittedAt.seconds * 1000);
      } else if (firstAtt.startedAtMs) {
        rawDate = new Date(firstAtt.startedAtMs);
      }
    }

    if (!rawDate) {
      rawDate = new Date();
    }

    const now = new Date();
    const isToday = rawDate.toDateString() === now.toDateString();

    const diffTime = Math.abs(now.getTime() - rawDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isThisWeek = diffDays <= 7;

    const isThisMonth =
      rawDate.getMonth() === now.getMonth() &&
      rawDate.getFullYear() === now.getFullYear();

    return {
      dateObj: rawDate,
      dateFormatted: formatDateHeader(rawDate),
      isToday,
      isThisWeek,
      isThisMonth,
    };
  };

  // Helper to resolve candidate student name from usersMap or attempt data
  const getResolvedCandidateName = (att: any): string => {
    const studentUid = att.userId || att.uid;
    let resolvedName = '';

    if (studentUid && usersMap.has(studentUid)) {
      const uData = usersMap.get(studentUid);
      resolvedName = uData.name || uData.fullName || uData.displayName || '';
    }

    if (!resolvedName || resolvedName.includes('@')) {
      resolvedName = att.resolvedCandidateName || att.userName || att.fullName || att.name || '';
    }

    if (!resolvedName || resolvedName.includes('@')) {
      resolvedName = att.email ? att.email.split('@')[0] : 'Candidate Student';
    }

    return resolvedName;
  };

  // Single Test PDF Download Handler
  const handleDownloadTestPDF = async (testObj: any, testAttemptsList: any[]) => {
    try {
      setGeneratingTestId(testObj.id);

      // Rank attempts by score descending
      const rankedAttempts = [...testAttemptsList].sort((a, b) => {
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        const pctA = a.percentage ?? 0;
        const pctB = b.percentage ?? 0;
        return pctB - pctA;
      });

      const testTitle = testObj.title || 'Assessment';
      const dateInfo = getTestDateObject(testObj, testAttemptsList);
      const scheduleText = testObj.startTime && testObj.endTime
        ? formatTimeWindow(testObj.startTime, testObj.endTime)
        : testObj.startDate
          ? `Date: ${testObj.startDate}`
          : 'Active Schedule';

      const totalStudents = rankedAttempts.length;
      const completedCount = rankedAttempts.filter((r) => r.status === 'submitted').length;
      const autoSubmittedCount = rankedAttempts.filter((r) => r.status === 'auto_submitted').length;
      const scores = rankedAttempts.map((r) => r.score ?? 0);
      const avgScore = totalStudents > 0 ? (scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(2) : '0.00';
      const highestScore = totalStudents > 0 ? Math.max(...scores, 0).toFixed(2) : '0.00';
      const avgPct = totalStudents > 0 ? (rankedAttempts.reduce((a, b) => a + (b.percentage ?? 0), 0) / totalStudents).toFixed(1) : '0.0';

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
      doc.text('ASSESSMENT RESULTS REPORT', 297 - 14, 14, { align: 'right' });

      // Document Meta Header
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Test Name: ${testTitle}`, 14, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Date: ${dateInfo.dateFormatted}  |  Time: ${scheduleText}  |  Participants: ${totalStudents}`, 14, 40);

      // Summary Statistics Bar Box
      const summaryY = 44;
      const summaryWidth = 269;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, summaryY, summaryWidth, 16, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, summaryY, summaryWidth, 16, 2, 2, 'S');

      const boxWidth = summaryWidth / 6;
      const items = [
        { label: 'Participants', val: `${totalStudents}` },
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
        const name = getResolvedCandidateName(r);
        const totalM = r.totalMarks || testObj.targetMarks || 100;
        const scoreVal = r.score ?? 0;
        const score = `${scoreVal} / ${totalM}`;
        const pct = `${r.percentage ?? Math.round((scoreVal / totalM) * 100)}%`;
        const correct = `${r.correctAnswers ?? 0}`;
        const wrong = `${r.wrongAnswers ?? 0}`;
        const unanswered = `${r.unanswered ?? 0}`;
        const violations = `${r.exitCount || 0} / 3`;
        const subType = r.submissionReason
          ? (r.submissionReason === 'manual_submission'
            ? 'Manual'
            : r.submissionReason === 'maximum_exit_limit'
              ? 'Auto - 3 Violations'
              : 'Auto - Time Expired')
          : (r.status === 'submitted' ? 'Manual' : 'Auto Submitted');
        const subTime = r.submittedAt?.seconds
          ? new Date(r.submittedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : (r.startedAtMs ? new Date(r.startedAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A');

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
          const totalPages = (doc as any).internal.getNumberOfPages();
          const currentPage = data.pageNumber;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${currentPage} of ${totalPages}`, 297 - 14, 210 - 8, { align: 'right' });
          doc.text('AptiGuard Official Test Assessment Record', 14, 210 - 8);
        },
      });

      const cleanFileName = testTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const fileDate = dateInfo.dateObj.toISOString().split('T')[0];
      doc.save(`AptiGuard_${cleanFileName}_Results_${fileDate}.pdf`);
    } catch (pdfErr) {
      console.error('Error generating PDF report:', pdfErr);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingTestId(null);
    }
  };

  // Group tests by Date String and calculate metrics
  const processedTests = tests.map((t) => {
    const testAttemptsList = attempts.filter((a) => a.testId === t.id);
    const dateMeta = getTestDateObject(t, testAttemptsList);
    const participantsCount = testAttemptsList.length;

    const scores = testAttemptsList.map((a) => a.score ?? 0);
    const pcts = testAttemptsList.map((a) => {
      if (a.percentage !== undefined) return a.percentage;
      const totalM = a.totalMarks || t.targetMarks || 100;
      return Math.round(((a.score ?? 0) / totalM) * 100);
    });

    const avgScorePct = participantsCount > 0
      ? Math.round(pcts.reduce((sum, val) => sum + val, 0) / participantsCount)
      : 0;

    const highestScorePct = participantsCount > 0
      ? Math.max(...pcts, 0)
      : 0;

    const timeWindowStr = t.startTime && t.endTime
      ? formatTimeWindow(t.startTime, t.endTime)
      : t.availabilityType === 'immediate'
        ? 'Immediate Access'
        : 'Scheduled Window';

    return {
      test: t,
      attemptsList: testAttemptsList,
      title: t.title || 'Untitled Assessment',
      category: t.category || 'General',
      difficulty: t.difficulty || 'Intermediate',
      participantsCount,
      avgScorePct,
      highestScorePct,
      timeWindowStr,
      dateMeta,
    };
  });

  // Filter processed tests by search query & date filter
  // Only show tests that have at least one candidate submission — tests with 0 participants
  // have no result records (e.g. after Clear Data) and must not appear as empty cards.
  const filteredTests = processedTests.filter((item) => {
    // Must have at least one candidate attempt
    if (item.participantsCount === 0) return false;

    // Search query match
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.dateMeta.dateFormatted.toLowerCase().includes(q);

    // Date filter match
    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = item.dateMeta.isToday;
    } else if (dateFilter === 'week') {
      matchesDate = item.dateMeta.isThisWeek;
    } else if (dateFilter === 'month') {
      matchesDate = item.dateMeta.isThisMonth;
    }

    return matchesSearch && matchesDate;
  });

  // Group filtered tests by dateFormatted String
  const dateGroupMap = new Map<string, { dateObj: Date; dateFormatted: string; items: typeof filteredTests }>();

  filteredTests.forEach((item) => {
    const key = item.dateMeta.dateFormatted;
    if (!dateGroupMap.has(key)) {
      dateGroupMap.set(key, {
        dateObj: item.dateMeta.dateObj,
        dateFormatted: key,
        items: [],
      });
    }
    dateGroupMap.get(key)!.items.push(item);
  });

  // Sort Date Groups in Descending Order (Newest → Oldest)
  const sortedDateGroups = Array.from(dateGroupMap.values()).sort((a, b) => {
    return b.dateObj.getTime() - a.dateObj.getTime();
  });

  // Sort tests within each date group by dateObj time descending
  sortedDateGroups.forEach((group) => {
    group.items.sort((a, b) => b.dateMeta.dateObj.getTime() - a.dateMeta.dateObj.getTime());
  });

  return (
    <div className="space-y-6">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">Admin Results</h2>
          <p className="text-xs text-slate-500 font-medium">View and download assessment results by test date and group.</p>
        </div>
      </div>

      {/* Search & Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search test results by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all font-semibold text-slate-800"
          />
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 select-none">
          {([
            { id: 'all', label: 'All Dates' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                dateFilter === tab.id
                  ? 'bg-white text-[#0952cc] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 font-semibold shadow-xs space-y-3">
          <div className="w-8 h-8 border-3 border-[#0952cc] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Loading assessment results history...</p>
        </div>
      ) : sortedDateGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-200">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No assessment results available yet.</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || dateFilter !== 'all'
              ? 'No test results matched your selected search criteria or date filter.'
              : 'As candidates complete assessments, test result summaries will appear here date-wise.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDateGroups.map((group) => (
            <div key={group.dateFormatted} className="space-y-4">
              
              {/* Date Header Badge */}
              <div className="flex items-center space-x-2 text-[#031b4e]">
                <Calendar className="w-4 h-4 text-[#0952cc]" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  {group.dateFormatted}
                </h3>
                <div className="h-px bg-slate-200 flex-1 ml-2" />
              </div>

              {/* Test Cards List */}
              <div className="space-y-3">
                {group.items.map((item) => {
                  const isGenerating = generatingTestId === item.test.id;
                  const hasParticipants = item.participantsCount > 0;

                  return (
                    <div
                      key={item.test.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      {/* Left Meta Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                            {item.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border bg-blue-50 text-[#0952cc] border-blue-100">
                            {item.category}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 font-semibold">
                          Schedule Window: <span className="text-slate-800 font-bold">{item.timeWindowStr}</span>
                        </p>
                      </div>

                      {/* Middle Stats Grid */}
                      <div className="grid grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100 min-w-[300px]">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Participants</span>
                          <span className="text-sm font-extrabold text-slate-900">{item.participantsCount}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Average Score</span>
                          <span className="text-sm font-extrabold text-[#0952cc]">{item.avgScorePct}%</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Highest Score</span>
                          <span className="text-sm font-extrabold text-emerald-600">{item.highestScorePct}%</span>
                        </div>
                      </div>

                      {/* Right Action Button */}
                      <div className="flex items-center justify-end flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadTestPDF(item.test, item.attemptsList)}
                          disabled={isGenerating || !hasParticipants}
                          title={!hasParticipants ? 'No participants have completed this test yet' : 'Download PDF Result'}
                          className="w-full md:w-auto px-5 py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white font-extrabold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                        >
                          <Download className="w-4 h-4" />
                          <span>{isGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
export default AdminResultsView;
