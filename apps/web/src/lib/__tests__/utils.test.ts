import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDailyCount,
  formatDate,
  formatDateTime,
  formatVND,
  getDailyCount,
  loadJSON,
  saveJSON,
  todayKey,
} from '../utils';

describe('Utility Functions (utils.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('formats currency in VND correctly', () => {
    expect(formatVND(100000)).toMatch(/100\.000\s*[đ₫]/);
    expect(formatVND(0)).toMatch(/0\s*[đ₫]/);
  });

  it('formats dates and datetimes properly', () => {
    const formattedDate = formatDate('2026-11-20T10:00:00Z');
    expect(formattedDate).toBeTruthy();

    const formattedDateTimeStr = formatDateTime('2026-11-20T10:30:00Z');
    expect(formattedDateTimeStr).toContain(':');
  });

  it('tracks daily quota in localStorage with todayKey', () => {
    const today = todayKey();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(getDailyCount('test-quota')).toBe(0);

    const updated = addDailyCount('test-quota', 5);
    expect(updated).toBe(5);
    expect(getDailyCount('test-quota')).toBe(5);

    const updatedMore = addDailyCount('test-quota', 3);
    expect(updatedMore).toBe(8);
    expect(getDailyCount('test-quota')).toBe(8);
  });

  it('saves and loads JSON with fallback', () => {
    expect(loadJSON('unknown-key', { defaultVal: 123 })).toEqual({ defaultVal: 123 });

    saveJSON('my-data', { name: 'DevStudy', stars: 5 });
    expect(loadJSON('my-data', {})).toEqual({ name: 'DevStudy', stars: 5 });
  });
});
