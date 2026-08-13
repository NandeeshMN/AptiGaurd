import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, MoreVertical } from 'lucide-react';
import { collection, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useIsMobileDevice } from '../utils/deviceDetection';
import { formatTimeTo12Hour, formatTimeWindow, formatDateToDDMMYYYY } from '../utils/timeFormat';

/**
 * 5-Tier Priority System Helper for Candidate Test Card Status & Button
 */
export const getCandidateTestCardStatus = (test: any, userAttempt: any, nowMs: number) => {
  let startTimeMs = 0;
  let endTimeMs = Infinity;

  if (test.availabilityType === 'immediate') {
    const createdMs = test.createdAt?.seconds ? test.createdAt.seconds * 1000 : (test.createdAtMs || Date.now());
    startTimeMs = createdMs;
    endTimeMs = createdMs + 365 * 24 * 60 * 60 * 1000;
  } else {
    const sDate = test.startDate || '';
    const sTime = test.startTime || '00:00';
    const eDate = test.endDate || sDate;
    const eTime = test.endTime || '23:59';
    
    const startMs = new Date(`${sDate}T${sTime}:00`).getTime();
    const endMs = new Date(`${eDate}T${eTime}:00`).getTime();

    startTimeMs = isNaN(startMs) ? 0 : startMs;
    endTimeMs = isNaN(endMs) ? Infinity : endMs;
  }

  // 1. Submitted / Completed Attempt Check
  if (userAttempt && (userAttempt.status === 'submitted' || userAttempt.status === 'auto_submitted')) {
    const isProctoringExit = userAttempt.submissionReason === 'maximum_exit_limit';
    const subText = isProctoringExit
      ? 'PROCTORING SUBMISSION: Automatically submitted due to 3 violations.'
      : 'TEST SUBMITTED: Assessment completed.';

    return {
      statusLabel: 'COMPLETED',
      actionText: 'Test Completed',
      isEnabled: false,
      badgeColor: isProctoringExit ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200',
      buttonStyle: 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75 select-none',
      scheduledText: subText,
      borderColor: isProctoringExit ? 'border-t-amber-500' : 'border-t-slate-400',
    };
  }

  // 2. Active in-progress attempt check
  if (userAttempt && userAttempt.status === 'in_progress' && nowMs < userAttempt.expiresAtMs) {
    return {
      statusLabel: 'AVAILABLE',
      actionText: 'Resume Test',
      isEnabled: true,
      badgeColor: 'bg-[#eff6ff] text-[#0952cc] border-[#dbeafe]',
      buttonStyle: 'bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white cursor-pointer shadow-xs',
      scheduledText: test.endTime ? `Ends at ${formatTimeTo12Hour(test.endTime)}` : 'In Progress',
      borderColor: 'border-t-[#0952cc]',
    };
  }

  // 3. Before start time check
  if (nowMs < startTimeMs) {
    const displayStart = test.startTime ? formatTimeTo12Hour(test.startTime) : 'scheduled time';
    const formattedStartDate = test.startDate ? formatDateToDDMMYYYY(test.startDate) : '';
    return {
      statusLabel: 'UPCOMING',
      actionText: `Starts at ${displayStart}`,
      isEnabled: false,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-100',
      buttonStyle: 'bg-amber-100/70 border border-amber-200 text-amber-800 cursor-not-allowed opacity-90',
      scheduledText: `Starts at ${formattedStartDate ? formattedStartDate + ' ' : ''}${displayStart}`,
      borderColor: 'border-t-amber-500',
    };
  }

  // 4. After end time check
  if (nowMs >= endTimeMs) {
    return {
      statusLabel: 'EXPIRED',
      actionText: 'Test Window Closed',
      isEnabled: false,
      badgeColor: 'bg-slate-100 text-slate-500 border-slate-200',
      buttonStyle: 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75',
      scheduledText: 'Test Window Closed',
      borderColor: 'border-t-slate-350',
    };
  }

  // 5. Start Test (Available now inside schedule window)
  return {
    statusLabel: 'AVAILABLE',
    actionText: 'Start Test',
    isEnabled: true,
    badgeColor: 'bg-[#eff6ff] text-[#0952cc] border-[#dbeafe]',
    buttonStyle: 'bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white cursor-pointer shadow-xs',
    scheduledText: test.availabilityType === 'immediate' ? 'Available Now' : `Window: ${formatTimeWindow(test.startTime, test.endTime)}`,
    borderColor: 'border-t-[#0952cc]',
  };
};

export const AvailableTestsView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isMobile = useIsMobileDevice();
  const [filter, setFilter] = useState<'all' | 'available' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [tests, setTests] = useState<any[]>([]);
  const [userAttemptsMap, setUserAttemptsMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

  // Real-time 1-second ticker so card buttons update dynamically at start/end times
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClearDataEvent = () => {
      setUserAttemptsMap(new Map());
    };
    window.addEventListener('aptiguard:clear-data', handleClearDataEvent);
    return () => window.removeEventListener('aptiguard:clear-data', handleClearDataEvent);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    // Query both 'published' (immediate/active) AND 'scheduled' (future window) tests.
    // The backend sets status='scheduled' when the test window hasn't opened yet, and
    // status='published' for immediate tests. getCandidateTestCardStatus() uses the
    // actual startDate/startTime/endDate/endTime timestamps to determine the correct
    // visual state (UPCOMING vs AVAILABLE vs EXPIRED) so we must include both statuses.
    const qTests = query(collection(db, 'tests'), where('status', 'in', ['published', 'scheduled']));
    const unsubscribeTests = onSnapshot(
      qTests,
      async (snapshot) => {
        try {
          const list: any[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            // Treat missing availabilityType as 'later'; 'all' assignmentType means every student
            const aType = data.availabilityType || 'later';
            if (aType === 'all' || data.assignmentType === 'all') {
              list.push({ id: docSnap.id, ...data });
            } else {
              const assignedRef = doc(db, 'tests', docSnap.id, 'assignedStudents', currentUser.uid);
              const assignedSnap = await getDoc(assignedRef);
              if (assignedSnap.exists()) {
                list.push({ id: docSnap.id, ...data });
              }
            }
          }
          setTests(list);
        } catch (err) {
          console.error('Error processing real-time tests snapshot:', err);
        } finally {
          setLoading(false);
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
        const attMap = new Map<string, any>();
        snapshot.forEach((docSnap) => {
          const att = { id: docSnap.id, ...docSnap.data() } as any;
          const existing = attMap.get(att.testId);
          if (!existing || att.status === 'submitted' || att.status === 'auto_submitted') {
            attMap.set(att.testId, att);
          }
        });
        setUserAttemptsMap(attMap);
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

  // Map processed assessment cards with 5-tier status priority
  const processedAssessments = tests.map(test => {
    const userAttempt = userAttemptsMap.get(test.id);
    const cardStatus = getCandidateTestCardStatus(test, userAttempt, nowMs);

    let isEnabled = cardStatus.isEnabled;
    let actionText = cardStatus.actionText;
    let buttonStyle = cardStatus.buttonStyle;
    let scheduledText = cardStatus.scheduledText;

    // Apply mobile device restriction to active/startable tests
    if (isMobile && cardStatus.isEnabled) {
      isEnabled = false;
      actionText = 'Desktop or Laptop Required';
      buttonStyle = 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75 select-none';
      scheduledText = 'Desktop or Laptop Required: Proctored assessments can only be taken on a desktop or laptop.';
    }

    return {
      id: test.id,
      title: test.title || 'Untitled Assessment',
      difficulty: test.difficulty || 'Intermediate',
      status: cardStatus.statusLabel,
      questions: test.targetQuestions || 0,
      duration: test.duration ? `${test.duration} Mins` : 'N/A',
      marks: test.targetMarks || 0,
      scheduled: scheduledText,
      borderColor: cardStatus.borderColor,
      actionText,
      isEnabled,
      buttonStyle,
      badgeColor: cardStatus.badgeColor,
      createdAt: test.createdAt,
    };
  });

  // Only active AVAILABLE assessments display under Available Tests menu.
  // Once a test is completed or its time is expired, it displays under Completed Tests menu.
  const activeAssessments = processedAssessments.filter(item => item.status === 'AVAILABLE');

  // Priority sorting: AVAILABLE tests first, then COMPLETED (within active schedule window)
  const statusOrder: Record<string, number> = {
    AVAILABLE: 1,
    COMPLETED: 2,
    EXPIRED: 3,
  };

  const sortedAssessments = [...activeAssessments].sort((a, b) => {
    const priorityA = statusOrder[a.status] || 99;
    const priorityB = statusOrder[b.status] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (sortBy === 'questions') {
      return b.questions - a.questions;
    }
    if (sortBy === 'duration') {
      const getMin = (d: string) => parseInt(d) || 0;
      return getMin(b.duration) - getMin(a.duration);
    }
    return b.id.localeCompare(a.id);
  });

  // Filtering logic
  const filteredAssessments = sortedAssessments.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return matchesSearch && item.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      
      {/* Title & Description Headers */}
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-900 leading-tight">Available Tests</h2>
        <p className="text-xs text-slate-500 font-medium">Explore active assessments assigned to you.</p>
      </div>

      {/* Filters row section */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search bar input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30 transition-all"
          />
        </div>

        {/* Tab pills & Sort dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100/80 p-0.5 rounded-lg flex space-x-1 border border-slate-200/50">
            {(['all', 'available'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all ${
                  filter === tab
                    ? 'bg-white text-[#0952cc] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer"
          >
            <option value="date">Sort by: Date</option>
            <option value="questions">Sort by: Questions</option>
            <option value="duration">Sort by: Duration</option>
          </select>
        </div>

      </div>

      {/* Grid listing assessment cards */}
      {loading ? (
        <div className="text-center py-12 text-xs font-semibold text-slate-500">
          Loading assigned assessments...
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 font-semibold shadow-xs">
          No assessments found matching the filter/search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredAssessments.map((test) => (
            <div
              key={test.id}
              className={`bg-white rounded-xl border border-slate-200/80 border-t-4 ${test.borderColor} shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-h-[380px]`}
            >
              {/* Header detail */}
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${test.badgeColor}`}>
                    {test.status}
                  </span>
                  <button className="p-1 rounded hover:bg-slate-100 text-slate-400 focus:outline-none">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 leading-snug mb-1">
                  {test.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mb-5">
                  &bull; {test.difficulty}
                </p>

                {/* Grid properties */}
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Questions</span>
                    <span className="text-xs font-bold text-slate-800">{test.questions}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Duration</span>
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{test.duration}</span>
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">Marks</span>
                    <span className="text-xs font-bold text-slate-800">{test.marks}</span>
                  </div>
                </div>

                {/* Full-Width Schedule / Notice Info Box */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Schedule Info</span>
                  <p className="text-xs font-bold text-[#0952cc] leading-relaxed break-words">
                    {test.scheduled}
                  </p>
                </div>
              </div>

              {/* Bottom Actions CTA */}
              <div className="px-5 pb-5 pt-2">
                <button
                  disabled={!test.isEnabled}
                  onClick={() => test.isEnabled && navigate('/test/' + test.id)}
                  className={`w-full py-2.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors duration-250 ${test.buttonStyle}`}
                >
                  {test.actionText}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
export default AvailableTestsView;
