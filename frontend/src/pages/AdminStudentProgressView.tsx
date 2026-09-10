import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calculateStudentProgress } from '../services/studentProgressService';
import type { StudentProgressMetrics } from '../services/studentProgressService';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Award,
  BarChart3,
  ClipboardCheck,
  Clock,
  ChevronDown,
  AlertCircle,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Layers,
} from 'lucide-react';

interface StudentUser {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  uucmsNo?: string;
  year?: string;
  status?: string;
}

export const AdminStudentProgressView: React.FC = () => {
  // 1. Student search & selection state
  const [allStudents, setAllStudents] = useState<StudentUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);

  // 2. Real-time test attempts & metrics state
  const [metrics, setMetrics] = useState<StudentProgressMetrics | null>(null);
  const [loadingAttempts, setLoadingAttempts] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 3. Active trend tab: 'performance' | 'accuracy' | 'speed'
  const [activeChartTab, setActiveChartTab] = useState<'performance' | 'accuracy' | 'speed'>('performance');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch student roster from 'users' collection (where role == 'student')
  useEffect(() => {
    setLoadingStudents(true);
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: StudentUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            fullName: data.fullName || data.name || 'Student',
            name: data.fullName || data.name || 'Student',
            email: data.email || '',
            uucmsNo: data.uucmsNo || '',
            year: data.year || '1st Year',
            status: data.status || 'active',
          });
        });

        // Sort students alphabetically by name
        list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        setAllStudents(list);
        setLoadingStudents(false);

        // Auto-select first student if none selected yet
        if (list.length > 0 && !selectedStudent) {
          setSelectedStudent(list[0]);
        }
      },
      (err) => {
        console.error('Error fetching students:', err);
        setErrorMsg('Unable to load student directory. Please check network connection.');
        setLoadingStudents(false);
      }
    );

    return () => unsub();
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return allStudents.slice(0, 15);
    const qLower = studentSearchQuery.toLowerCase().trim();
    return allStudents
      .filter((s) => {
        const name = (s.fullName || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const uucms = (s.uucmsNo || '').toLowerCase();
        return name.includes(qLower) || email.includes(qLower) || uucms.includes(qLower);
      })
      .slice(0, 20);
  }, [allStudents, studentSearchQuery]);

  // REAL-TIME FIRESTORE LISTENER FOR SELECTED STUDENT'S ATTEMPTS
  useEffect(() => {
    if (!selectedStudent) {
      setMetrics(null);
      return;
    }

    setLoadingAttempts(true);
    setErrorMsg(null);

    // Query attempts strictly matching this student's UID
    const attemptsQuery = query(
      collection(db, 'testAttempts'),
      where('userId', '==', selectedStudent.id)
    );

    const unsubAttempts = onSnapshot(
      attemptsQuery,
      (snapshot) => {
        const rawAttempts: any[] = [];
        snapshot.forEach((docSnap) => {
          rawAttempts.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Derive metrics reactively
        const computed = calculateStudentProgress(rawAttempts);
        setMetrics(computed);
        setLastUpdated(new Date());
        setLoadingAttempts(false);
      },
      (err) => {
        console.error('Firestore real-time attempts listener error:', err);
        setErrorMsg('Failed to sync real-time test attempts. Please retry.');
        setLoadingAttempts(false);
      }
    );

    // Clean up previous student's listener before switching
    return () => {
      unsubAttempts();
    };
  }, [selectedStudent]);

  // Handler for student selection
  const handleSelectStudent = (student: StudentUser) => {
    setSelectedStudent(student);
    setIsDropdownOpen(false);
    setStudentSearchQuery('');
  };

  const studentInitials = useMemo(() => {
    if (!selectedStudent?.fullName) return 'S';
    return selectedStudent.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'S';
  }, [selectedStudent]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner with Live Real-time Status Indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Student Progress</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track individual student performance and improvement across all completed tests in real time.
          </p>
        </div>

        {lastUpdated && (
          <div className="text-right text-[11px] text-slate-400 font-medium flex items-center md:justify-end gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        )}
      </div>

      {/* Error Alert Banner if Firestore encounters network or permission error */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs font-semibold text-red-800">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setSelectedStudent(selectedStudent ? { ...selectedStudent } : null)}
            className="flex items-center space-x-1 text-red-700 hover:text-red-900 underline font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Student Search & Selector Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Active Student Info Header */}
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-[#031b4e] text-white flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0">
              {studentInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 truncate">
                  {selectedStudent?.fullName || 'Select a student'}
                </h3>
                {selectedStudent?.year && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#0952cc] border border-blue-100">
                    {selectedStudent.year}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 font-medium mt-0.5">
                {selectedStudent?.uucmsNo && <span>UUCMS: <strong className="text-slate-700 font-semibold">{selectedStudent.uucmsNo}</strong></span>}
                {selectedStudent?.email && <span>• {selectedStudent.email}</span>}
              </div>
            </div>
          </div>

          {/* Search Dropdown Input Field */}
          <div className="relative w-full lg:w-80" ref={dropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={studentSearchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                placeholder="Search student by name / ID / email..."
                className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0952cc]/20 focus:border-[#0952cc] transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu Options */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {loadingStudents ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">Loading student directory...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">No matching students found</div>
                ) : (
                  filteredStudents.map((student) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const initials = (student.fullName || 'S')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className={`w-full text-left p-3 flex items-center space-x-3 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/70 text-[#0952cc]' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{student.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {student.uucmsNo ? `${student.uucmsNo} • ` : ''}
                            {student.email}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#0952cc] flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Loading Skeleton State */}
      {loadingAttempts && !metrics && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 bg-white border border-slate-200 rounded-2xl p-5" />
            ))}
          </div>
          <div className="h-72 bg-white border border-slate-200 rounded-2xl p-6" />
          <div className="h-64 bg-white border border-slate-200 rounded-2xl p-6" />
        </div>
      )}

      {/* 4. Empty State: Student has 0 completed tests */}
      {metrics && metrics.totalTests === 0 && !loadingAttempts && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
          <div className="w-14 h-14 bg-blue-50 text-[#0952cc] rounded-2xl flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-extrabold text-slate-900">No completed tests yet</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Progress will appear here automatically after <strong>{selectedStudent?.fullName}</strong> completes an assessment.
            </p>
          </div>
          <div className="pt-2 text-[11px] text-slate-400">
            Active and incomplete test attempts are excluded until finalized.
          </div>
        </div>
      )}

      {/* 5. Main Dashboard Content (When student has completed tests) */}
      {metrics && metrics.totalTests > 0 && (
        <div className="space-y-6">
          {/* Summary Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tests Attempted */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tests Attempted</p>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0952cc] flex items-center justify-center">
                  <ClipboardCheck className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{metrics.totalTests}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Latest completed on <span className="font-semibold text-slate-700">{metrics.latestDate}</span>
              </p>
            </div>

            {/* Card 2: Average Score */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Score</p>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{metrics.averagePercentage}%</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Avg accuracy: <strong className="text-slate-700 font-semibold">{metrics.averageAccuracy}%</strong>
              </p>
            </div>

            {/* Card 3: Best Score */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Best Score</p>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Award className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{metrics.bestPercentage}%</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Latest test: <strong className="text-slate-700 font-semibold">{metrics.latestScore.percentage}%</strong> ({metrics.latestScore.score}/{metrics.latestScore.totalMarks})
              </p>
            </div>

            {/* Card 4: Overall Improvement */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overall Improvement</p>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    metrics.overallImprovementPts > 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : metrics.overallImprovementPts < 0
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {metrics.overallImprovementPts >= 0 ? (
                    <TrendingUp className="w-4.5 h-4.5" />
                  ) : (
                    <TrendingDown className="w-4.5 h-4.5" />
                  )}
                </div>
              </div>
              <p
                className={`text-3xl font-black mt-2 tracking-tight ${
                  metrics.overallImprovementPts > 0
                    ? 'text-emerald-600'
                    : metrics.overallImprovementPts < 0
                    ? 'text-rose-600'
                    : 'text-slate-900'
                }`}
              >
                {metrics.formattedImprovement}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                From {metrics.firstPercentage}% (Test 1) to {metrics.latestPercentage}%
              </p>
            </div>
          </div>

          {/* Performance Summary Callout Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-amber-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-white">Performance Summary</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                      metrics.trendStatus === 'Improving'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : metrics.trendStatus === 'Declining'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {metrics.trendStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Trajectory based on all {metrics.totalTests} completed tests.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-6 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score</p>
                <p className="font-extrabold text-white mt-0.5">
                  {metrics.firstPercentage}% &rarr; {metrics.latestPercentage}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Accuracy</p>
                <p className="font-extrabold text-white mt-0.5">
                  {metrics.history[0]?.accuracy}% &rarr; {metrics.history[metrics.history.length - 1]?.accuracy}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Avg Time / Q</p>
                <p className="font-extrabold text-white mt-0.5">
                  {metrics.history[0]?.averageTimePerQuestionSec > 0 ? `${metrics.history[0].averageTimePerQuestionSec}s` : '—'} &rarr;{' '}
                  {metrics.history[metrics.history.length - 1]?.averageTimePerQuestionSec > 0
                    ? `${metrics.history[metrics.history.length - 1].averageTimePerQuestionSec}s`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Completed</p>
                <p className="font-extrabold text-white mt-0.5">{metrics.totalTests} tests</p>
              </div>
            </div>
          </div>

          {/* 6. Performance Trend & Analytics Visualizations */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {activeChartTab === 'performance' && 'Performance Trend (Score %)'}
                  {activeChartTab === 'accuracy' && 'Accuracy Trend (%)'}
                  {activeChartTab === 'speed' && 'Speed Trend (Seconds / Question)'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {activeChartTab === 'performance' && 'Chronological test score percentage progression over time.'}
                  {activeChartTab === 'accuracy' && 'Ratio of correct answers over total attempted questions per test.'}
                  {activeChartTab === 'speed' && 'Average pace per question (lower is faster, displayed objectively).'}
                </p>
              </div>

              {/* Chart Mode Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveChartTab('performance')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'performance' ? 'bg-white text-[#0952cc] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Score Trend
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartTab('accuracy')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'accuracy' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Accuracy
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartTab('speed')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'speed' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Speed
                </button>
              </div>
            </div>

            {/* Responsive SVG Line Chart */}
            <div className="relative pt-2">
              <TrendLineChart
                data={
                  activeChartTab === 'performance'
                    ? metrics.performanceTrend.map((d) => ({
                        label: d.label,
                        title: d.testName,
                        value: d.percentage,
                        date: d.date,
                        unit: '%',
                      }))
                    : activeChartTab === 'accuracy'
                    ? metrics.accuracyTrend.map((d) => ({
                        label: d.label,
                        title: d.testName,
                        value: d.accuracy,
                        date: d.date,
                        unit: '%',
                      }))
                    : metrics.speedTrend.map((d) => ({
                        label: d.label,
                        title: d.testName,
                        value: d.secondsPerQuestion,
                        date: d.date,
                        unit: 's',
                      }))
                }
                themeColor={
                  activeChartTab === 'performance' ? '#0952cc' : activeChartTab === 'accuracy' ? '#059669' : '#4f46e5'
                }
                hoveredIndex={hoveredPointIndex}
                setHoveredIndex={setHoveredPointIndex}
              />
            </div>
          </div>

          {/* 7. Section Performance Analysis (Extensible structure) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Layers className="w-4.5 h-4.5 text-[#0952cc]" />
              <h3 className="text-base font-extrabold text-slate-900">Section Performance</h3>
            </div>

            {metrics.sectionPerformance.length === 0 ? (
              <div className="p-6 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center space-y-1.5">
                <p className="text-xs font-bold text-slate-700">Section-wise breakdown is not yet available for these tests</p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  When tests have individual category tagging (Quantitative Aptitude, Logical Reasoning, Verbal Ability), comparative section metrics will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3">First Test</th>
                      <th className="py-2.5 px-3">Latest Test</th>
                      <th className="py-2.5 px-3 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {metrics.sectionPerformance.map((sec, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{sec.sectionName}</td>
                        <td className="py-3 px-3">{sec.firstPercentage}%</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{sec.latestPercentage}%</td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-bold ${
                              sec.changePts > 0
                                ? 'text-emerald-600'
                                : sec.changePts < 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {sec.changePts > 0 ? `+${sec.changePts} pts` : `${sec.changePts} pts`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 8. Test-by-Test History Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="w-4.5 h-4.5 text-[#0952cc]" />
                <h3 className="text-base font-extrabold text-slate-900">Test-by-Test History</h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {metrics.history.length} {metrics.history.length === 1 ? 'assessment' : 'assessments'} completed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Test Title</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Percentage</th>
                    <th className="py-3 px-3">Accuracy</th>
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3 text-right">Improvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {metrics.history.map((item, idx) => (
                    <tr key={item.attemptId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span>{item.testTitle}</span>
                          {idx === metrics.history.length - 1 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-[#0952cc] uppercase">
                              Latest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{item.formattedDate}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {item.score} <span className="text-slate-400 font-normal">/ {item.totalMarks}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{item.percentage}%</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{item.accuracy}%</span>
                        <span className="text-[10px] text-slate-400 block">
                          ({item.correctAnswers} of {item.correctAnswers + item.wrongAnswers} attempted)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{item.formattedTime}</td>
                      <td className="py-3 px-3 text-right">
                        {item.improvementPts === null ? (
                          <span className="text-slate-400 font-medium italic">Baseline</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              item.improvementPts > 0
                                ? 'text-emerald-600'
                                : item.improvementPts < 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {item.improvementPts > 0 ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : item.improvementPts < 0 ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : null}
                            {item.improvementPts > 0
                              ? `+${item.improvementPts} pts`
                              : `${item.improvementPts} pts`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// LIGHTWEIGHT RESPONSIVE SVG TREND LINE CHART
// ============================================================================
interface ChartPoint {
  label: string;
  title: string;
  value: number;
  date: string;
  unit: string;
}

interface TrendLineChartProps {
  data: ChartPoint[];
  themeColor: string;
  hoveredIndex: number | null;
  setHoveredIndex: (idx: number | null) => void;
}

const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  themeColor,
  hoveredIndex,
  setHoveredIndex,
}) => {
  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-xs text-slate-400 font-medium">No trend data available</div>;
  }

  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;

  // Single test case: display flat indicator
  const isSingle = data.length === 1;

  // Calculate coordinates across width
  const svgWidth = 800; // Reference viewBox width
  const graphWidth = svgWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Determine Y bounds
  const isPercentage = data[0]?.unit === '%';
  let minY = 0;
  let maxY = isPercentage ? 100 : Math.max(60, Math.ceil((Math.max(...data.map((d) => d.value)) * 1.2) / 10) * 10);

  const getY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return paddingTop + graphHeight - ((clamped - minY) / (maxY - minY)) * graphHeight;
  };

  const getX = (idx: number) => {
    if (isSingle) return paddingLeft + graphWidth / 2;
    return paddingLeft + (idx / (data.length - 1)) * graphWidth;
  };

  // Generate SVG polyline path
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
  const areaPoints = isSingle
    ? ''
    : `${getX(0)},${paddingTop + graphHeight} ` +
      points +
      ` ${getX(data.length - 1)},${paddingTop + graphHeight}`;

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="w-full select-none">
      <svg
        viewBox={`0 0 ${svgWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
        style={{ minHeight: '200px' }}
      >
        <defs>
          <linearGradient id={`gradient-${themeColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={themeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={themeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines & Y-Axis Labels */}
        {yTicks.map((tick) => {
          const yPos = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={paddingLeft}
                y1={yPos}
                x2={svgWidth - paddingRight}
                y2={yPos}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={yPos + 3}
                fill="#94a3b8"
                fontSize="10"
                fontWeight="600"
                textAnchor="end"
              >
                {tick}
                {isPercentage ? '%' : 's'}
              </text>
            </g>
          );
        })}

        {/* Shaded Area Below Line */}
        {!isSingle && (
          <polygon points={areaPoints} fill={`url(#gradient-${themeColor})`} />
        )}

        {/* Primary Line */}
        {!isSingle && (
          <polyline
            points={points}
            fill="none"
            stroke={themeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data Points and Interactivity */}
        {data.map((point, idx) => {
          const cx = getX(idx);
          const cy = getY(point.value);
          const isHovered = hoveredIndex === idx;

          return (
            <g
              key={idx}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Highlight crosshair line on hover */}
              {isHovered && (
                <line
                  x1={cx}
                  y1={paddingTop}
                  x2={cx}
                  y2={paddingTop + graphHeight}
                  stroke={themeColor}
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}

              {/* Data Dot Circle */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 7 : 4.5}
                fill="#ffffff"
                stroke={themeColor}
                strokeWidth={isHovered ? 3.5 : 2.5}
                className="transition-all duration-150"
              />

              {/* X-Axis Label */}
              <text
                x={cx}
                y={chartHeight - 12}
                fill={isHovered ? '#0f172a' : '#64748b'}
                fontSize="11"
                fontWeight={isHovered ? 'bold' : '600'}
                textAnchor="middle"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div className="mt-3 p-3 bg-slate-900 text-white rounded-xl shadow-lg text-xs max-w-sm mx-auto flex items-center justify-between gap-4 animate-in fade-in duration-150">
          <div>
            <p className="font-extrabold text-white text-[13px]">{data[hoveredIndex].title}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {data[hoveredIndex].label} • {data[hoveredIndex].date}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span
              className="text-lg font-black"
              style={{ color: themeColor === '#0952cc' ? '#60a5fa' : themeColor }}
            >
              {data[hoveredIndex].value}
              {data[hoveredIndex].unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
