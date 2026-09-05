import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Activity,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Circle,
  RefreshCw,
  Shield,
  Calendar,
  Timer,
  BookOpen,
  Camera,
} from 'lucide-react';
import { formatTimeTo12Hour, formatDateToDDMMYYYY } from '../utils/timeFormat';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted';

interface StudentRow {
  uid: string;
  name: string;
  uucmsNo: string;
  status: AttemptStatus;
  startedAtMs: number | null;
  submittedAtMs: number | null;
  exitCount: number;
  submissionReason: string | null;
  cameraStatus: 'active' | 'inactive' | 'stopped' | null;
  violationBreakdown: {
    camera?: number;
    fullscreen?: number;
    tab?: number;
    blur?: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMs = (ms: number | null): string => {
  if (!ms) return '—';
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const statusLabel: Record<AttemptStatus, string> = {
  not_started: 'NOT STARTED',
  in_progress: 'IN PROGRESS',
  submitted: 'SUBMITTED',
  auto_submitted: 'AUTO-SUBMITTED',
};

const statusColors: Record<AttemptStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  auto_submitted: 'bg-amber-50 text-amber-700 border-amber-200',
};

const statusDot: Record<AttemptStatus, string> = {
  not_started: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  submitted: 'bg-emerald-500',
  auto_submitted: 'bg-amber-500',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdminMonitorView: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const [test, setTest] = useState<any>(null);
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<Map<string, any>>(new Map());
  const [attempts, setAttempts] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 1. Load test details in real-time
  useEffect(() => {
    if (!testId) return;
    const unsub = onSnapshot(doc(db, 'tests', testId), (snap) => {
      if (snap.exists()) {
        setTest({ id: snap.id, ...snap.data() });
      }
    });
    return unsub;
  }, [testId]);

  // 2. Load all users (to resolve names + uucmsNo)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const m = new Map<string, any>();
      snap.forEach((d) => m.set(d.id, { id: d.id, ...d.data() }));
      setAllUsers(m);
    });
    return unsub;
  }, []);

  // 3. Load assigned students in real-time
  useEffect(() => {
    if (!testId) return;
    const unsub = onSnapshot(collection(db, 'tests', testId, 'assignedStudents'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAssignedStudents(list);
    }, () => setAssignedStudents([]));
    return unsub;
  }, [testId]);

  // 4. Real-time listener for testAttempts for this specific test
  useEffect(() => {
    if (!testId) return;
    const q = query(collection(db, 'testAttempts'), where('testId', '==', testId));
    const unsub = onSnapshot(q, (snap) => {
      const m = new Map<string, any>();
      snap.forEach((d) => {
        const att = d.data();
        const uid = att.userId;
        if (uid) {
          const existing = m.get(uid);
          if (!existing) {
            m.set(uid, { id: d.id, ...att });
          } else {
            const existingTime = existing.startedAtMs || (existing.startedAt?.seconds ? existing.startedAt.seconds * 1000 : 0);
            const newTime = att.startedAtMs || (att.startedAt?.seconds ? att.startedAt.seconds * 1000 : 0);
            if (newTime > existingTime) {
              m.set(uid, { id: d.id, ...att });
            }
          }
        }
      });
      setAttempts(m);
      setLastUpdated(new Date());
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [testId]);

  // ─── Compute student rows ──────────────────────────────────────────────────

  const buildRows = (): StudentRow[] => {
    const rows: StudentRow[] = [];

    const resolveUserInfo = (uid: string, att?: any) => {
      const user = allUsers.get(uid);
      const name =
        user?.name || user?.fullName || user?.displayName ||
        att?.userName || att?.candidateName || att?.name ||
        att?.userEmail?.split('@')[0] || 'Student';
      const uucmsNo = user?.uucmsNo || '—';
      return { name, uucmsNo };
    };

    const resolveStatus = (att: any): AttemptStatus => {
      const s = att?.status;
      if (s === 'submitted') return 'submitted';
      if (s === 'auto_submitted') return 'auto_submitted';
      if (s === 'in_progress') return 'in_progress';
      return 'not_started';
    };

    // 1. Determine assigned student UIDs
    const assignedUids = new Set<string>();
    if (test?.assignmentType === 'all') {
      allUsers.forEach((user, uid) => {
        if (user.role === 'student' && user.status !== 'archived' && user.status !== 'graduated') {
          assignedUids.add(uid);
        }
      });
    } else {
      assignedStudents.forEach((assigned) => {
        const uid = assigned.uid || assigned.userId || assigned.id;
        if (uid) assignedUids.add(uid);
      });
    }

    // 2. Iterate assigned students
    assignedUids.forEach((uid) => {
      const att = attempts.get(uid);
      const { name, uucmsNo } = resolveUserInfo(uid, att);
      rows.push({
        uid,
        name,
        uucmsNo,
        status: resolveStatus(att),
        startedAtMs: att?.startedAtMs ?? null,
        submittedAtMs: att?.submittedAt?.seconds
          ? att.submittedAt.seconds * 1000
          : (att?.submittedAtMs ?? null),
        exitCount: att?.exitCount ?? 0,
        submissionReason: att?.submissionReason ?? null,
        cameraStatus: att?.cameraStatus ?? (att?.status === 'in_progress' ? 'active' : null),
        violationBreakdown: att?.violationBreakdown ?? null,
      });
    });

    // Sort: in_progress first, then not_started, then submitted, then auto_submitted
    const order: AttemptStatus[] = ['in_progress', 'not_started', 'submitted', 'auto_submitted'];
    rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

    return rows;
  };

  const rows = buildRows();

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalAssigned = rows.length;
  const notStarted = rows.filter((r) => r.status === 'not_started').length;
  const inProgress = rows.filter((r) => r.status === 'in_progress').length;
  const submitted = rows.filter((r) => r.status === 'submitted').length;
  const autoSubmitted = rows.filter((r) => r.status === 'auto_submitted').length;
  const started = inProgress + submitted + autoSubmitted;
  const activeCameras = rows.filter((r) => r.status === 'in_progress' && r.cameraStatus !== 'inactive').length;

  // ─── Test schedule info ────────────────────────────────────────────────────

  const sDateFmt = test?.startDate ? formatDateToDDMMYYYY(test.startDate) : '—';
  const sTimeFmt = test?.startTime ? formatTimeTo12Hour(test.startTime) : '—';
  const eTimeFmt = test?.endTime ? formatTimeTo12Hour(test.endTime) : '—';

  return (
    <div className="min-h-screen bg-[#f3f6fc] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 border border-red-200">
              <Activity className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-[15px] font-extrabold text-[#031b4e] leading-tight">
                Live Monitor
              </h1>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                {test?.title || 'Loading assessment…'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
            <span className="inline-flex items-center ml-3">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              LIVE
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Test Info Card */}
        {test && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Test Name
                </span>
                <span className="text-sm font-bold text-slate-900 leading-tight">{test.title || 'Untitled'}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Test ID
                </span>
                <span className="text-xs font-mono font-semibold text-slate-600 break-all">{testId}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date
                </span>
                <span className="text-sm font-semibold text-slate-700">{sDateFmt}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Start Time
                </span>
                <span className="text-sm font-semibold text-slate-700">{sTimeFmt}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" /> End Time
                </span>
                <span className="text-sm font-semibold text-slate-700">{eTimeFmt}</span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Timer className="w-3 h-3" /> Duration
                </span>
                <span className="text-sm font-semibold text-slate-700">{test.duration || 30} min</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Assigned', value: totalAssigned, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Started', value: started, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Cameras Active', value: `${activeCameras} / ${inProgress}`, icon: Camera, color: inProgress > 0 && activeCameras < inProgress ? 'text-amber-600' : 'text-emerald-700', bg: inProgress > 0 && activeCameras < inProgress ? 'bg-amber-50' : 'bg-emerald-50', border: inProgress > 0 && activeCameras < inProgress ? 'border-amber-200' : 'border-emerald-200' },
            { label: 'Submitted', value: submitted, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Auto-Submitted', value: autoSubmitted, icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={`rounded-xl border ${border} ${bg} px-4 py-3 flex items-center space-x-3`}>
              <div className={`${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-extrabold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Not Started Badge */}
        {notStarted > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center space-x-2 text-sm text-slate-600 font-semibold">
            <Circle className="w-4 h-4 text-slate-400" />
            <span>{notStarted} student{notStarted !== 1 ? 's' : ''} have not started yet</span>
          </div>
        )}

        {/* Student Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#031b4e] uppercase tracking-wide">
              Student Status
            </h2>
            <span className="text-xs text-slate-400 font-medium">{rows.length} student{rows.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-[#0952cc] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-semibold">No students assigned to this test yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Student Name</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">UUCMS No.</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Camera</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Start Time</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Submit Time</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr
                      key={row.uid}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{row.name}</td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-slate-600">{row.uucmsNo}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-extrabold uppercase tracking-wide ${statusColors[row.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[row.status]} ${row.status === 'in_progress' ? 'animate-pulse' : ''}`}></span>
                          {statusLabel[row.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {row.status === 'in_progress' ? (
                          row.cameraStatus === 'inactive' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-extrabold bg-red-50 text-red-700 border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              INTERRUPTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ACTIVE
                            </span>
                          )
                        ) : row.status === 'submitted' || row.status === 'auto_submitted' ? (
                          <span className="text-xs text-slate-400 font-medium">Off</span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {row.startedAtMs ? formatMs(row.startedAtMs) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {row.submittedAtMs ? formatMs(row.submittedAtMs) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.status === 'not_started' ? (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        ) : row.exitCount === 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">0 / 3</span>
                            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                              ✓ Clean
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${row.exitCount >= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                                {row.exitCount} / 3
                              </span>
                              {row.submissionReason === 'maximum_exit_limit' && (
                                <span className="text-[10px] text-red-500 font-semibold">(auto)</span>
                              )}
                            </div>
                            {row.violationBreakdown && (
                              <div className="flex flex-wrap items-center gap-1">
                                {(row.violationBreakdown.camera ?? 0) > 0 && (
                                  <span className="inline-flex items-center text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                                    📷 Camera: {row.violationBreakdown.camera}
                                  </span>
                                )}
                                {(row.violationBreakdown.fullscreen ?? 0) > 0 && (
                                  <span className="inline-flex items-center text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                                    🖥️ Screen: {row.violationBreakdown.fullscreen}
                                  </span>
                                )}
                                {(row.violationBreakdown.tab ?? 0) > 0 && (
                                  <span className="inline-flex items-center text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">
                                    📑 Tab: {row.violationBreakdown.tab}
                                  </span>
                                )}
                                {(row.violationBreakdown.blur ?? 0) > 0 && (
                                  <span className="inline-flex items-center text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                    🔲 Focus: {row.violationBreakdown.blur}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminMonitorView;
