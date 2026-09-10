import { formatDateToDDMMYYYY } from '../utils/timeFormat';

export interface RawAttempt {
  id?: string;
  testId?: string;
  testTitle?: string;
  title?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  candidateName?: string;
  status?: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unanswered?: number;
  totalQuestions?: number;
  startedAt?: any;
  startedAtMs?: number;
  submittedAt?: any;
  timeTakenSec?: number;
  sections?: Record<string, { score: number; totalMarks: number; percentage?: number }>;
}

export interface ProgressTestItem {
  attemptId: string;
  testId: string;
  testTitle: string;
  submittedAt: Date | null;
  submittedAtMs: number;
  formattedDate: string;
  score: number;
  totalMarks: number;
  percentage: number;
  accuracy: number;
  timeTakenSec: number;
  formattedTime: string;
  averageTimePerQuestionSec: number;
  improvementPts: number | null; // null for first test, then currentPercentage - previousPercentage
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  totalQuestions: number;
  status: string;
}

export interface SectionPerformanceItem {
  sectionName: string;
  firstPercentage: number;
  latestPercentage: number;
  changePts: number;
}

export interface StudentProgressMetrics {
  totalTests: number;
  averagePercentage: number;
  bestPercentage: number;
  firstPercentage: number;
  latestPercentage: number;
  overallImprovementPts: number;
  formattedImprovement: string;
  averageAccuracy: number;
  averageTimePerQuestionSec: number;
  latestScore: {
    score: number;
    totalMarks: number;
    percentage: number;
  };
  latestDate: string;
  trendStatus: 'Improving' | 'Stable' | 'Declining';
  history: ProgressTestItem[];
  performanceTrend: {
    label: string;
    testNumber: number;
    testName: string;
    percentage: number;
    date: string;
  }[];
  accuracyTrend: {
    label: string;
    testNumber: number;
    testName: string;
    accuracy: number;
    date: string;
  }[];
  speedTrend: {
    label: string;
    testNumber: number;
    testName: string;
    secondsPerQuestion: number;
    date: string;
  }[];
  sectionPerformance: SectionPerformanceItem[];
}

/**
 * Extracts a numeric timestamp in milliseconds from Firestore Timestamp, Date, or numeric fields.
 */
export const resolveTimestampMs = (rawTimestamp: any, fallbackMs: number = 0): number => {
  if (!rawTimestamp) return fallbackMs;
  if (typeof rawTimestamp === 'number') return rawTimestamp;
  if (rawTimestamp.toMillis && typeof rawTimestamp.toMillis === 'function') {
    return rawTimestamp.toMillis();
  }
  if (rawTimestamp.seconds) {
    return rawTimestamp.seconds * 1000 + Math.round((rawTimestamp.nanoseconds || 0) / 1000000);
  }
  if (rawTimestamp instanceof Date) {
    return rawTimestamp.getTime();
  }
  const parsed = new Date(rawTimestamp).getTime();
  return isNaN(parsed) ? fallbackMs : parsed;
};

/**
 * Formats seconds into a human-readable duration (e.g. "42 min 15 sec" or "45 sec").
 */
export const formatDurationSeconds = (totalSec: number): string => {
  if (!totalSec || totalSec <= 0) return '—';
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);

  if (mins === 0) return `${secs} sec`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
};

/**
 * Pure calculation engine deriving real-time performance metrics, trends, and history
 * from raw completed test attempts.
 */
export const calculateStudentProgress = (rawAttempts: RawAttempt[]): StudentProgressMetrics => {
  // 1. Filter only valid completed / submitted test results
  const completedAttempts = rawAttempts.filter((att) => {
    const s = att.status;
    return s === 'submitted' || s === 'auto_submitted';
  });

  if (completedAttempts.length === 0) {
    return {
      totalTests: 0,
      averagePercentage: 0,
      bestPercentage: 0,
      firstPercentage: 0,
      latestPercentage: 0,
      overallImprovementPts: 0,
      formattedImprovement: '0 pts',
      averageAccuracy: 0,
      averageTimePerQuestionSec: 0,
      latestScore: { score: 0, totalMarks: 100, percentage: 0 },
      latestDate: '—',
      trendStatus: 'Stable',
      history: [],
      performanceTrend: [],
      accuracyTrend: [],
      speedTrend: [],
      sectionPerformance: [],
    };
  }

  // 2. Sort chronologically (oldest to newest) by actual submission timestamp
  const sorted = [...completedAttempts].sort((a, b) => {
    const aTime = resolveTimestampMs(a.submittedAt, a.startedAtMs || 0);
    const bTime = resolveTimestampMs(b.submittedAt, b.startedAtMs || 0);
    return aTime - bTime;
  });

  // 3. Process test-by-test history with sequential improvement
  let sumPercentage = 0;
  let bestPercentage = 0;
  let sumAccuracy = 0;
  let sumTimePerQ = 0;
  let validTimePerQCount = 0;

  const history: ProgressTestItem[] = [];

  sorted.forEach((att, idx) => {
    const submittedMs = resolveTimestampMs(att.submittedAt, att.startedAtMs || 0);
    const startedMs = att.startedAtMs || resolveTimestampMs(att.startedAt, submittedMs);

    // Compute elapsed time taken in seconds
    let timeTakenSec = 0;
    if (typeof att.timeTakenSec === 'number' && att.timeTakenSec > 0) {
      timeTakenSec = att.timeTakenSec;
    } else if (submittedMs > startedMs && startedMs > 0) {
      timeTakenSec = Math.max(1, Math.round((submittedMs - startedMs) / 1000));
    }

    const score = typeof att.score === 'number' ? att.score : 0;
    const totalMarks = typeof att.totalMarks === 'number' && att.totalMarks > 0 ? att.totalMarks : 100;
    let percentage = typeof att.percentage === 'number'
      ? att.percentage
      : Math.round((score / totalMarks) * 1000) / 10;
    percentage = Math.min(100, Math.max(0, Math.round(percentage * 10) / 10));

    sumPercentage += percentage;
    if (percentage > bestPercentage) {
      bestPercentage = percentage;
    }

    const correctAnswers = typeof att.correctAnswers === 'number' ? att.correctAnswers : 0;
    const wrongAnswers = typeof att.wrongAnswers === 'number' ? att.wrongAnswers : 0;
    const totalQuestions = typeof att.totalQuestions === 'number' && att.totalQuestions > 0
      ? att.totalQuestions
      : (correctAnswers + wrongAnswers + (att.unanswered || 0)) || 1;
    const unanswered = typeof att.unanswered === 'number' ? att.unanswered : Math.max(0, totalQuestions - correctAnswers - wrongAnswers);

    const attemptedQuestions = correctAnswers + wrongAnswers;

    // Accuracy = (Correct / Attempted) * 100.
    // If no questions were attempted, fallback to 0.
    let accuracy = 0;
    if (attemptedQuestions > 0) {
      accuracy = Math.round((correctAnswers / attemptedQuestions) * 1000) / 10;
    } else if (totalQuestions > 0 && correctAnswers > 0) {
      accuracy = Math.round((correctAnswers / totalQuestions) * 1000) / 10;
    }
    accuracy = Math.min(100, Math.max(0, accuracy));
    sumAccuracy += accuracy;

    // Average time per question
    const qCountForSpeed = attemptedQuestions > 0 ? attemptedQuestions : totalQuestions;
    const avgTimePerQ = timeTakenSec > 0 && qCountForSpeed > 0 ? Math.round(timeTakenSec / qCountForSpeed) : 0;
    if (avgTimePerQ > 0) {
      sumTimePerQ += avgTimePerQ;
      validTimePerQCount++;
    }

    // Sequential improvement from previous test
    let improvementPts: number | null = null;
    if (idx > 0) {
      const prevPercentage = history[idx - 1].percentage;
      improvementPts = Math.round((percentage - prevPercentage) * 10) / 10;
    }

    history.push({
      attemptId: att.id || `att-${idx}`,
      testId: att.testId || '',
      testTitle: att.testTitle || att.title || `Assessment ${idx + 1}`,
      submittedAt: submittedMs > 0 ? new Date(submittedMs) : null,
      submittedAtMs: submittedMs,
      formattedDate: submittedMs > 0 ? formatDateToDDMMYYYY(submittedMs) : '—',
      score,
      totalMarks,
      percentage,
      accuracy,
      timeTakenSec,
      formattedTime: formatDurationSeconds(timeTakenSec),
      averageTimePerQuestionSec: avgTimePerQ,
      improvementPts,
      correctAnswers,
      wrongAnswers,
      unanswered,
      totalQuestions,
      status: att.status || 'submitted',
    });
  });

  const totalTests = history.length;
  const averagePercentage = Math.round((sumPercentage / totalTests) * 10) / 10;
  const averageAccuracy = Math.round((sumAccuracy / totalTests) * 10) / 10;
  const averageTimePerQuestionSec = validTimePerQCount > 0 ? Math.round(sumTimePerQ / validTimePerQCount) : 0;

  const firstTest = history[0];
  const latestTest = history[history.length - 1];

  const firstPercentage = firstTest.percentage;
  const latestPercentage = latestTest.percentage;

  // Overall Improvement = Latest Test % - First Test %
  const overallImprovementPts = Math.round((latestPercentage - firstPercentage) * 10) / 10;

  let formattedImprovement = `${overallImprovementPts > 0 ? '+' : ''}${overallImprovementPts} pts`;
  if (totalTests === 1) {
    formattedImprovement = 'Baseline';
  } else if (overallImprovementPts === 0) {
    formattedImprovement = '0 pts';
  }

  // Trend Status determination
  let trendStatus: 'Improving' | 'Stable' | 'Declining' = 'Stable';
  if (totalTests > 1) {
    if (overallImprovementPts >= 2) {
      trendStatus = 'Improving';
    } else if (overallImprovementPts <= -2) {
      trendStatus = 'Declining';
    } else {
      trendStatus = 'Stable';
    }
  }

  // Trend chart datasets
  const performanceTrend = history.map((item, idx) => ({
    label: `Test ${idx + 1}`,
    testNumber: idx + 1,
    testName: item.testTitle,
    percentage: item.percentage,
    date: item.formattedDate,
  }));

  const accuracyTrend = history.map((item, idx) => ({
    label: `Test ${idx + 1}`,
    testNumber: idx + 1,
    testName: item.testTitle,
    accuracy: item.accuracy,
    date: item.formattedDate,
  }));

  const speedTrend = history.map((item, idx) => ({
    label: `Test ${idx + 1}`,
    testNumber: idx + 1,
    testName: item.testTitle,
    secondsPerQuestion: item.averageTimePerQuestionSec,
    date: item.formattedDate,
  }));

  // Section-wise analysis (extensible structure for future question tagging)
  const sectionPerformance: SectionPerformanceItem[] = [];
  const firstSections = (sorted[0] as any)?.sections || (sorted[0] as any)?.sectionScores;
  const latestSections = (sorted[sorted.length - 1] as any)?.sections || (sorted[sorted.length - 1] as any)?.sectionScores;

  if (firstSections && latestSections && typeof firstSections === 'object' && typeof latestSections === 'object') {
    Object.keys(latestSections).forEach((secKey) => {
      const firstSec = firstSections[secKey];
      const latestSec = latestSections[secKey];
      if (firstSec && latestSec) {
        const firstP = typeof firstSec.percentage === 'number'
          ? firstSec.percentage
          : Math.round(((firstSec.score || 0) / (firstSec.totalMarks || 1)) * 100);
        const latestP = typeof latestSec.percentage === 'number'
          ? latestSec.percentage
          : Math.round(((latestSec.score || 0) / (latestSec.totalMarks || 1)) * 100);
        sectionPerformance.push({
          sectionName: secKey,
          firstPercentage: firstP,
          latestPercentage: latestP,
          changePts: latestP - firstP,
        });
      }
    });
  }

  return {
    totalTests,
    averagePercentage,
    bestPercentage,
    firstPercentage,
    latestPercentage,
    overallImprovementPts,
    formattedImprovement,
    averageAccuracy,
    averageTimePerQuestionSec,
    latestScore: {
      score: latestTest.score,
      totalMarks: latestTest.totalMarks,
      percentage: latestTest.percentage,
    },
    latestDate: latestTest.formattedDate,
    trendStatus,
    history,
    performanceTrend,
    accuracyTrend,
    speedTrend,
    sectionPerformance,
  };
};
