export type QuotaPeriodType = 'day' | 'month';

export interface LocalDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number;
  minute: number;
  second: number;
}

export interface ComputedQuotaPeriod {
  period: QuotaPeriodType;
  periodKey: string;
  cycleStartAt: Date;
  resetAt: Date;
  resetAtIso: string;
  retryAfterSeconds: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

export function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = parseInt(p.value, 10);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Computes the UTC offset in minutes for `date` in `timeZone` (e.g. +420 for Asia/Ho_Chi_Minh).
 */
export function getOffsetMinutes(date: Date, timeZone: string): number {
  const local = getLocalDateParts(date, timeZone);
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  const utcFloorSec = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((localAsUtc - utcFloorSec) / 60_000);
}

/**
 * Converts local wall-clock midnight (YYYY-MM-DD 00:00:00) in `timeZone` to exact UTC Date.
 */
export function localMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  const guessUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset1 = getOffsetMinutes(new Date(guessUtcMs), timeZone);
  const refinedUtcMs = guessUtcMs - offset1 * 60_000;
  const offset2 = getOffsetMinutes(new Date(refinedUtcMs), timeZone);
  return new Date(guessUtcMs - offset2 * 60_000);
}

/**
 * Formats an instant as ISO-8601 string in `timeZone` (e.g. `2026-11-24T00:00:00+07:00`).
 */
export function formatIsoInTimeZone(date: Date, timeZone: string): string {
  const p = getLocalDateParts(date, timeZone);
  const offsetMin = getOffsetMinutes(date, timeZone);
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const offH = pad2(Math.floor(absMin / 60));
  const offM = pad2(absMin % 60);
  return `${formatYmd(p.year, p.month, p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}${sign}${offH}:${offM}`;
}

function addCalendarDay(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
} {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function shiftMonth(year: number, month: number, deltaMonths: number): {
  year: number;
  month: number;
} {
  const zeroBased = (year * 12 + (month - 1)) + deltaMonths;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

/**
 * Daily period in configured timezone (resets at 00:00 local time, e.g. Asia/Ho_Chi_Minh).
 */
export function computeDailyPeriod(now: Date, timeZone: string): ComputedQuotaPeriod {
  const local = getLocalDateParts(now, timeZone);
  const nextDay = addCalendarDay(local.year, local.month, local.day);
  const cycleStartAt = localMidnightToUtc(local.year, local.month, local.day, timeZone);
  const resetAt = localMidnightToUtc(nextDay.year, nextDay.month, nextDay.day, timeZone);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));

  return {
    period: 'day',
    periodKey: formatYmd(local.year, local.month, local.day),
    cycleStartAt,
    resetAt,
    resetAtIso: formatIsoInTimeZone(resetAt, timeZone),
    retryAfterSeconds,
  };
}

/**
 * Monthly billing period anchored on `subscriptionStartedAt`'s local day-of-month
 * (with automatic month-end clamping for 28/29/30/31 and leap years).
 */
export function computeSubscriptionMonthlyPeriod(
  now: Date,
  subscriptionStartedAt: Date,
  timeZone: string
): ComputedQuotaPeriod {
  const startLocal = getLocalDateParts(subscriptionStartedAt, timeZone);
  const nowLocal = getLocalDateParts(now, timeZone);
  const anchorDay = startLocal.day;

  const curAnchorDay = Math.min(anchorDay, daysInMonth(nowLocal.year, nowLocal.month));

  let cycleYear: number;
  let cycleMonth: number;
  let cycleDay: number;
  let nextYear: number;
  let nextMonth: number;
  let nextDay: number;

  if (nowLocal.day >= curAnchorDay) {
    cycleYear = nowLocal.year;
    cycleMonth = nowLocal.month;
    cycleDay = curAnchorDay;

    const nextYM = shiftMonth(nowLocal.year, nowLocal.month, 1);
    nextYear = nextYM.year;
    nextMonth = nextYM.month;
    nextDay = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));
  } else {
    const prevYM = shiftMonth(nowLocal.year, nowLocal.month, -1);
    cycleYear = prevYM.year;
    cycleMonth = prevYM.month;
    cycleDay = Math.min(anchorDay, daysInMonth(cycleYear, cycleMonth));

    nextYear = nowLocal.year;
    nextMonth = nowLocal.month;
    nextDay = curAnchorDay;
  }

  const cycleStartAt = localMidnightToUtc(cycleYear, cycleMonth, cycleDay, timeZone);
  const resetAt = localMidnightToUtc(nextYear, nextMonth, nextDay, timeZone);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));

  return {
    period: 'month',
    periodKey: `sub:${formatYmd(cycleYear, cycleMonth, cycleDay)}`,
    cycleStartAt,
    resetAt,
    resetAtIso: formatIsoInTimeZone(resetAt, timeZone),
    retryAfterSeconds,
  };
}

export function computeQuotaPeriod(
  period: QuotaPeriodType,
  now: Date,
  subscriptionStartedAt: Date,
  timeZone: string
): ComputedQuotaPeriod {
  if (period === 'day') {
    return computeDailyPeriod(now, timeZone);
  }
  return computeSubscriptionMonthlyPeriod(now, subscriptionStartedAt, timeZone);
}
