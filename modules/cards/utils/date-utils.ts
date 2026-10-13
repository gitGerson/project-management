/**
 * Pure date utility functions for card start and due dates.
 * Strictly adheres to docs/UIUX.md (calm interface, WCAG AA contrast).
 */

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function isSameDay(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isBetween(target: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const min = Math.min(s, e);
  const max = Math.max(s, e);
  return t >= min && t <= max;
}

export function isToday(d: Date | null): boolean {
  if (!d) return false;
  return isSameDay(d, new Date());
}

export function isPastDay(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const checkDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return checkDay < startOfToday;
}

/**
 * Format a single date into concise readable form: "14 Oct" or "14 Oct 2026"
 */
export function formatCompactDate(value: string | Date | null): string {
  const d = parseDate(value);
  if (!d) return '';
  const now = new Date();
  const isCurrentYear = d.getFullYear() === now.getFullYear();

  const day = d.getDate();
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = monthNames[d.getMonth()];

  return isCurrentYear ? `${day} ${month}` : `${day} ${month} ${d.getFullYear()}`;
}

/**
 * Format full date range for field display:
 * - Both: "14 Oct – 18 Oct 2026"
 * - Due only: "Due 18 Oct"
 * - Start only: "Starts 14 Oct"
 */
export function formatDateRange(
  startDateVal: string | Date | null,
  dueDateVal: string | Date | null
): string {
  const start = parseDate(startDateVal);
  const due = parseDate(dueDateVal);

  if (start && due) {
    if (isSameDay(start, due)) {
      return formatCompactDate(start);
    }
    const startStr = formatCompactDate(start);
    const dueStr = formatCompactDate(due);
    return `${startStr} – ${dueStr}`;
  }

  if (due) {
    return `Due ${formatCompactDate(due)}`;
  }

  if (start) {
    return `Starts ${formatCompactDate(start)}`;
  }

  return '';
}

export type DueDateStatus = 'overdue' | 'due-today' | 'due-soon' | 'upcoming';

export interface DueDateStatusInfo {
  status: DueDateStatus | null;
  label: string;
  badgeClass: string;
}

/**
 * Get visual cues for due date based on current time
 */
export function getDueDateStatus(dueDateVal: string | Date | null): DueDateStatusInfo {
  const due = parseDate(dueDateVal);
  if (!due) {
    return { status: null, label: '', badgeClass: '' };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'overdue',
      label: 'Overdue',
      badgeClass: 'bg-red-50 text-red-700 border-red-200/90 font-bold',
    };
  }

  if (diffDays === 0) {
    return {
      status: 'due-today',
      label: 'Due today',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/90 font-bold',
    };
  }

  if (diffDays === 1) {
    return {
      status: 'due-soon',
      label: 'Tomorrow',
      badgeClass: 'bg-amber-50/80 text-amber-800 border-amber-200/80 font-medium',
    };
  }

  return {
    status: 'upcoming',
    label: `${diffDays} days left`,
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200/80 font-medium',
  };
}

