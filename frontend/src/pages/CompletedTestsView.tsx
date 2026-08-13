import React, { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle2, Download } from 'lucide-react';
import { collection, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { downloadCandidateResultCardPNG } from './ResultsView';
import { formatDateToDDMMYYYY } from '../utils/timeFormat';

export const CompletedTestsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [expiredItems, setExpiredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState<string>('');



  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    // Fetch canonical candidate profile from Firestore users collection
    getDoc(doc(db, 'users', currentUser.uid)).then((userDocSnap) => {
      let resolvedName = '';
      if (userDocSnap.exists()) {
        const uData = userDocSnap.data();
        resolvedName = uData.name || uData.fullName || uData.displayName || '';
      }
      if (!resolvedName || resolvedName.includes('@')) {
        resolvedName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Candidate Student');
      }
      setCandidateName(resolvedName);
    }).catch(() => {});

    let assignedTestsCache: any[] = [];
    let attemptsDocsCache: any[] = [];

    const processLists = () => {
      const currentNowMs = Date.now();
      const compList: any[] = [];
      const expList: any[] = [];
      const attMap = new Map<string, any>();

      attemptsDocsCache.forEach((att: any) => {
        const existing = attMap.get(att.testId);
        if (!existing || att.status === 'submitted' || att.status === 'auto_submitted') {
          attMap.set(att.testId, att);
        }

        if (att.status === 'submitted' || att.status === 'auto_submitted') {
          const pct = att.percentage ?? 0;
          const isPassed = pct >= 40;
          const dateStr = formatDateToDDMMYYYY(att.submittedAt || att.startedAtMs);

          const subReason = att.submissionReason
            ? (att.submissionReason === 'manual_submission'
              ? 'Manual Submission'
              : att.submissionReason === 'maximum_exit_limit'
                ? 'Auto - 3 Violations'
                : 'Auto - Time Expired')
            : (att.status === 'submitted' ? 'Manual Submission' : 'Auto Submitted');

          compList.push({
            id: att.id,
            type: 'completed',
            rawAttempt: att,
            title: att.testTitle || 'Assessment',
            date: dateStr,
            questions: att.totalQuestions || 0,
            totalMarks: att.totalMarks || 100,
            score: att.score ?? 0,
            percentage: pct,
            isPassed,
            subReason,
            exitCount: att.exitCount || 0,
            timestamp: att.submittedAt?.seconds ? att.submittedAt.seconds * 1000 : (att.startedAtMs || 0),
          });
        }
      });

      assignedTestsCache.forEach((test) => {
        const att = attMap.get(test.id);
        const hasCompleted = att && (att.status === 'submitted' || att.status === 'auto_submitted');

        let isExpired = false;
        if (test.availabilityType !== 'immediate') {
          const eDate = test.endDate || test.startDate || '';
          const eTime = test.endTime || '23:59';
          const eMs = new Date(`${eDate}T${eTime}:00`).getTime();
          if (!isNaN(eMs) && currentNowMs >= eMs) {
            isExpired = true;
          }
        }

        if (isExpired && !hasCompleted) {
          expList.push({
            id: `expired-${test.id}`,
            type: 'expired',
            rawTest: test,
            title: test.title || 'Assessment',
            date: formatDateToDDMMYYYY(test.endDate || test.startDate),
            questions: test.targetQuestions || 0,
            totalMarks: test.targetMarks || 0,
            score: 0,
            percentage: 0,
            isPassed: false,
            subReason: 'Test Window Closed',
            exitCount: 0,
            timestamp: 0,
          });
        }
      });

      compList.sort((a, b) => b.timestamp - a.timestamp);
      expList.sort((a, b) => a.title.localeCompare(b.title));

      setCompletedItems(compList);
      setExpiredItems(expList);
      setLoading(false);
    };

    // 1. Realtime listener for published tests
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
          assignedTestsCache = list;
          processLists();
        } catch (err) {
          console.error('Error processing real-time tests snapshot:', err);
        }
      },
      (err) => {
        console.error('Error in tests real-time listener:', err);
        setLoading(false);
      }
    );

    // 2. Realtime listener for candidate attempts
    const qAttempts = query(
      collection(db, 'testAttempts'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribeAttempts = onSnapshot(
      qAttempts,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        attemptsDocsCache = list;
        processLists();
      },
      (err) => {
        console.error('Error in attempts real-time listener:', err);
      }
    );

    return () => {
      unsubscribeTests();
      unsubscribeAttempts();
    };
  }, [currentUser]);

  const filteredCompleted = completedItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExpired = expiredItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Title & Description Header */}
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">Test History</h2>
        <p className="text-xs text-slate-500 font-medium">
          Logged in candidate: <strong className="text-slate-900">{candidateName}</strong> &bull; Review your completed assessments and view expired test records.
        </p>
      </div>

      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search completed or expired tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-xs text-slate-500 font-semibold shadow-xs">
          Loading your test history...
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* ========================================================
              TOP SECTION: COMPLETED TESTS
             ======================================================== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Completed Tests</h3>
                  <p className="text-xs text-slate-500 font-medium">Assessments you have completed and submitted.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold">
                Completed: {completedItems.length}
              </span>
            </div>

            {filteredCompleted.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-xs text-slate-500 font-semibold shadow-xs">
                No completed tests found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompleted.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-[#0952cc] p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-5"
                  >
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                            item.isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-red-50 text-red-700 border-red-100'
                          }`}
                        >
                          {item.isPassed ? 'PASSED' : 'FAILED'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.date}</span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 leading-snug">{item.title}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Submission: <span className="text-slate-600 font-semibold">{item.subReason}</span>
                      </p>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Score</span>
                        <span className="text-sm font-extrabold text-[#0952cc]">
                          {item.score} / {item.totalMarks}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Percentage</span>
                        <span className="text-sm font-extrabold text-indigo-600">{item.percentage}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Questions</span>
                        <span className="text-xs font-bold text-slate-700">{item.questions}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Violations</span>
                        <span className={`text-xs font-bold ${item.exitCount >= 3 ? 'text-red-600' : 'text-slate-700'}`}>
                          {item.exitCount} / 3
                        </span>
                      </div>
                    </div>

                    {/* Download PNG Button */}
                    <button
                      onClick={() => downloadCandidateResultCardPNG(item.rawAttempt, candidateName)}
                      className="w-full py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Result Card</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================
              BOTTOM SECTION: EXPIRED TESTS
             ======================================================== */}
          <div className="space-y-4 pt-6 border-t border-slate-200/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Expired Tests</h3>
                  <p className="text-xs text-slate-500 font-medium">Assessments whose scheduled test window has passed.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-extrabold">
                Expired: {expiredItems.length}
              </span>
            </div>

            {filteredExpired.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200/80 p-6 text-center text-xs text-slate-500 font-semibold shadow-xs">
                No expired tests recorded.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExpired.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-slate-400 p-6 shadow-xs flex flex-col justify-between space-y-5"
                  >
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase border bg-slate-100 text-slate-600 border-slate-200">
                          EXPIRED
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.date}</span>
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 leading-snug">{item.title}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Status: <span className="text-slate-600 font-semibold">{item.subReason}</span>
                      </p>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Score</span>
                        <span className="text-sm font-extrabold text-slate-400">N/A</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Percentage</span>
                        <span className="text-sm font-extrabold text-slate-400">N/A</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Questions</span>
                        <span className="text-xs font-bold text-slate-700">{item.questions}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Violations</span>
                        <span className="text-xs font-bold text-slate-700">0 / 3</span>
                      </div>
                    </div>

                    {/* Expired Action CTA */}
                    <div className="w-full py-2.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg uppercase tracking-wider text-center border border-slate-200 select-none">
                      Test Window Expired
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
export default CompletedTestsView;
