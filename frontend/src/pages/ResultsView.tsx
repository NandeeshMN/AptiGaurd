import React, { useState, useEffect } from 'react';
import { Search, Trophy, CheckCircle, BarChart3, TrendingUp } from 'lucide-react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { formatDateToDDMMYYYY } from '../utils/timeFormat';

// Pure 2D Canvas PNG Result Card Generator
export const downloadCandidateResultCardPNG = (att: any, candidateName: string) => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 500);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 700, 500);

    // Outer Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 676, 476);

    // Top Header Banner (#0952cc)
    ctx.fillStyle = '#0952cc';
    ctx.fillRect(14, 14, 672, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('APTIGUARD', 35, 46);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('OFFICIAL CANDIDATE RESULT CARD', 35, 66);

    const dateStr = formatDateToDDMMYYYY(att.submittedAt || att.startedAtMs);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`DATE: ${dateStr.toUpperCase()}`, 665, 52);
    ctx.textAlign = 'left';

    // Candidate Info
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('CANDIDATE NAME', 40, 120);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(candidateName, 40, 146);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('ASSESSMENT TITLE', 40, 180);

    ctx.fillStyle = '#0952cc';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(att.testTitle || att.test || 'Assessment', 40, 204);

    // Metrics Grid Box (Score, Percentage, Correct, Wrong)
    const totalMarks = att.totalMarks || 100;
    const scoreVal = att.score ?? 0;
    const pctVal = att.percentage ?? Math.round((scoreVal / totalMarks) * 100);
    const correctVal = att.correctAnswers ?? 0;
    const wrongVal = att.wrongAnswers ?? 0;

    const drawStatBox = (x: number, label: string, val: string, color: string) => {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x, 230, 138, 76);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 230, 138, 76);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(label.toUpperCase(), x + 12, 252);

      ctx.fillStyle = color;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(val, x + 12, 286);
    };

    drawStatBox(40, 'SCORE OBTAINED', `${scoreVal} / ${totalMarks}`, '#0952cc');
    drawStatBox(194, 'PERCENTAGE', `${pctVal}%`, '#4f46e5');
    drawStatBox(348, 'CORRECT ANSWERS', `${correctVal}`, '#059669');
    drawStatBox(502, 'WRONG ANSWERS', `${wrongVal}`, '#dc2626');

    // Submission details
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    const subReason = att.submissionReason
      ? att.submissionReason.replace(/_/g, ' ').toUpperCase()
      : (att.status === 'auto_submitted' ? 'AUTO SUBMITTED' : 'MANUAL SUBMISSION');
    ctx.fillText(`SUBMISSION: ${subReason}`, 40, 350);

    const exits = att.exitCount || 0;
    ctx.fillStyle = exits >= 3 ? '#dc2626' : '#d97706';
    ctx.fillText(`PROCTORING VIOLATIONS: ${exits} / 3`, 40, 378);

    // Footer Divider & Copyright
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(40, 415);
    ctx.lineTo(660, 415);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('POWERED BY APTIGUARD PROCTORING ENGINE', 350, 445);

    // Download PNG file
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const cleanName = (candidateName || 'Candidate').replace(/\s+/g, '_');
    link.href = image;
    link.download = `AptiGuard_Result_Card_${cleanName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error generating canvas PNG result card:', err);
  }
};

export const ResultsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState<string>('');

  useEffect(() => {
    const fetchUserResults = async () => {
      if (!currentUser) return;
      try {
        setLoading(true);

        // Fetch tests to resolve passingScore dynamically
        const testsSnap = await getDocs(collection(db, 'tests'));
        const testsList: any[] = [];
        testsSnap.forEach(docSnap => {
          testsList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setTests(testsList);

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

        const q = query(
          collection(db, 'testAttempts'),
          where('userId', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === 'submitted' || data.status === 'auto_submitted') {
            list.push({ id: docSnap.id, ...data });
          }
        });

        list.sort((a, b) => {
          const timeA = a.submittedAt?.seconds ? a.submittedAt.seconds * 1000 : (a.startedAtMs || 0);
          const timeB = b.submittedAt?.seconds ? b.submittedAt.seconds * 1000 : (b.startedAtMs || 0);
          return timeB - timeA;
        });

        setAttempts(list);
      } catch (err) {
        console.error('Error fetching user results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserResults();
  }, [currentUser]);

  // Compute live statistics from attempts
  const completedCount = attempts.length;
  const percentages = attempts.map((a) => a.percentage ?? 0);
  const avgScore = completedCount > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / completedCount) : 0;
  const bestScore = completedCount > 0 ? Math.max(...percentages) : 0;
  const passedCount = attempts.filter((a) => {
    const test = tests.find(t => t.id === a.testId);
    const passing = typeof a.passingScore === 'number' ? a.passingScore : (test?.passingScore !== undefined ? test.passingScore : 40);
    return (a.percentage ?? 0) >= passing;
  }).length;
  const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;


  const stats = [
    {
      title: 'Average Score',
      value: `${avgScore}%`,
      subtitle: 'Across completed tests',
      icon: <BarChart3 className="w-5 h-5 text-[#0952cc]" />,
      progress: avgScore,
      progressColor: 'bg-[#0952cc]',
    },
    {
      title: 'Best Score',
      value: `${bestScore}%`,
      subtitle: 'Highest score achieved',
      icon: <Trophy className="w-5 h-5 text-[#0952cc]" />,
      progress: bestScore,
      progressColor: 'bg-emerald-600',
    },
    {
      title: 'Tests Completed',
      value: completedCount.toString().padStart(2, '0'),
      subtitle: `Candidate: ${candidateName}`,
      icon: <CheckCircle className="w-5 h-5 text-[#0952cc]" />,
      progress: 100,
      progressColor: 'bg-indigo-600',
    },
    {
      title: 'Pass Rate',
      value: `${passRate}%`,
      subtitle: 'Passed assessments',
      icon: <TrendingUp className="w-5 h-5 text-[#0952cc]" />,
      progress: passRate,
      progressColor: 'bg-[#0952cc]',
    }
  ];

  // Process rows
  const resultsData = attempts.map((att) => {
    const test = tests.find(t => t.id === att.testId);
    const passing = typeof att.passingScore === 'number' ? att.passingScore : (test?.passingScore !== undefined ? test.passingScore : 40);
    const pct = att.percentage ?? 0;
    const isPassed = pct >= passing;
    const dateStr = formatDateToDDMMYYYY(att.submittedAt || att.startedAtMs);

    return {
      id: att.id,
      rawAttempt: att,
      test: att.testTitle || 'Assessment',
      date: dateStr,
      questions: att.totalQuestions || 0,
      score: `${att.score ?? 0}/${att.totalMarks || 100}`,
      percentage: `${pct}%`,
      status: isPassed ? 'PASSED' : 'FAILED',
      statusColor: isPassed
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : 'bg-red-50 text-red-700 border-red-100',
      reason: att.submissionReason || 'manual_submission',
      exitCount: att.exitCount || 0,
    };
  });

  const filteredResults = resultsData.filter(item => {
    const matchesSearch = item.test.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return matchesSearch && item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      
      {/* Title Headers */}
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">My Results</h2>
        <p className="text-xs text-slate-500 font-medium">
          Logged in candidate: <strong className="text-slate-900">{candidateName}</strong> &bull; Review your completed assessment performance.
        </p>
      </div>



      {/* Results Log Table Section */}
      <div className="space-y-4">
        
        {/* Table Filters header */}
        <div className="bg-slate-50/60 p-3 rounded-t-xl border border-slate-200/80 border-b-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
            />
          </div>

          <div className="bg-white p-0.5 rounded-lg flex space-x-1 border border-slate-200">
            {(['all', 'passed', 'failed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold capitalize transition-all ${
                  filter === tab
                    ? 'bg-slate-100 text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tabular data log card */}
        {loading ? (
          <div className="bg-white rounded-b-xl border border-slate-200/80 p-8 text-center text-xs text-slate-500 font-semibold shadow-xs">
            Loading your test results...
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-white rounded-b-xl border border-slate-200/80 p-8 text-center text-xs text-slate-500 font-semibold shadow-xs">
            No test results recorded yet.
          </div>
        ) : (
          <div className="bg-white rounded-b-xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/20 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                    <th className="py-3.5 px-4">Test</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Questions</th>
                    <th className="py-3.5 px-4">Score</th>
                    <th className="py-3.5 px-4">%</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Proctoring Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {filteredResults.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30">
                      <td className="py-4 px-4 text-slate-800 font-bold">{item.test}</td>
                      <td className="py-4 px-4 text-slate-500">{item.date}</td>
                      <td className="py-4 px-4 text-slate-600">{item.questions}</td>
                      <td className="py-4 px-4 text-slate-900 font-extrabold">{item.score}</td>
                      <td className="py-4 px-4 text-[#0952cc] font-extrabold">{item.percentage}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-bold ${item.exitCount >= 3 ? 'text-red-600' : item.exitCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                          {item.exitCount} / 3
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
export default ResultsView;
