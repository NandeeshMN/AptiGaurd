/**
 * Helper utility functions for AptiGuard test lifecycles and attempt expiration.
 */

export type TestLifecycleStatus = 'draft' | 'scheduled' | 'in_progress' | 'closed';

/**
 * Computes authoritative lifecycle status for an assessment based on schedule or immediate availability.
 */
export function getAdminTestLifecycleStatus(
  t: any,
  nowMs: number = Date.now()
): TestLifecycleStatus {
  if (!t) return 'closed';
  if (t.status === 'draft') return 'draft';
  if (t.status === 'completed' || t.status === 'closed' || t.status === 'expired') {
    return 'closed';
  }

  const availabilityType = t.availabilityType || 'later';

  if (availabilityType === 'immediate') {
    const createdMs = t.createdAt?.seconds
      ? t.createdAt.seconds * 1000
      : (t.createdAtMs || nowMs);
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

/**
 * Returns true if test is closed or completed.
 */
export function isTestClosedOrCompleted(t: any, nowMs: number = Date.now()): boolean {
  return getAdminTestLifecycleStatus(t, nowMs) === 'closed';
}

/**
 * Returns true if a test attempt is expired (based on expiresAtMs or test duration).
 */
export function isAttemptExpired(att: any, nowMs: number = Date.now()): boolean {
  if (!att) return true;
  if (att.status === 'submitted' || att.status === 'auto_submitted') return true;
  if (att.expiresAtMs && att.expiresAtMs <= nowMs) return true;
  // If started over 4 hours ago, treat as expired
  if (att.startedAtMs && nowMs - att.startedAtMs > 4 * 3600 * 1000) return true;
  return false;
}
