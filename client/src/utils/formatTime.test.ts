import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, formatShortTimestamp, formatFullTimestamp } from './formatTime';

describe('formatTime', () => {
  let mockNow: Date;

  beforeEach(() => {
    // Set a consistent "now" time for testing: Jan 15, 2026, 12:00:00 PM
    mockNow = new Date('2026-01-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for times less than 60 seconds ago', () => {
      const thirtySecondsAgo = new Date(mockNow.getTime() - 30 * 1000).toISOString();
      expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
    });

    it('should return minutes ago for times less than 60 minutes ago', () => {
      const fiveMinutesAgo = new Date(mockNow.getTime() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');

      const fiftyNineMinutesAgo = new Date(mockNow.getTime() - 59 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m ago');
    });

    it('should return hours ago for times less than 24 hours ago', () => {
      const twoHoursAgo = new Date(mockNow.getTime() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');

      const twentyThreeHoursAgo = new Date(mockNow.getTime() - 23 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
    });

    it('should return days ago for times less than 7 days ago', () => {
      const oneDayAgo = new Date(mockNow.getTime() - 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');

      const sixDaysAgo = new Date(mockNow.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
    });

    it('should return month and day (without year) for dates older than 7 days but in the current year', () => {
      // Jan 5, 2026 (10 days ago, same year as mockNow which is Jan 15, 2026)
      const tenDaysAgo = new Date('2026-01-05T12:00:00Z').toISOString();
      expect(formatRelativeTime(tenDaysAgo)).toBe('Jan 5');
    });

    it('should return month, day, and year for dates in previous years', () => {
      // Dec 20, 2025 (different year from mockNow which is 2026)
      const lastYear = new Date('2025-12-20T12:00:00Z').toISOString();
      expect(formatRelativeTime(lastYear)).toBe('Dec 20, 2025');

      // Jun 15, 2024 (two years ago)
      const twoYearsAgo = new Date('2024-06-15T12:00:00Z').toISOString();
      expect(formatRelativeTime(twoYearsAgo)).toBe('Jun 15, 2024');
    });

    it('should return month, day, and year for dates many years ago', () => {
      // Jun 15, 2020 (six years ago from mockNow which is 2026)
      const manyYearsAgo = new Date('2020-06-15T12:00:00Z').toISOString();
      expect(formatRelativeTime(manyYearsAgo)).toBe('Jun 15, 2020');
    });

    it('should handle edge case: exactly 7 days ago in current year', () => {
      // Jan 8, 2026 (exactly 7 days ago)
      const sevenDaysAgo = new Date('2026-01-08T12:00:00Z').toISOString();
      expect(formatRelativeTime(sevenDaysAgo)).toBe('Jan 8');
    });

    it('should handle edge case: date at year boundary in previous year', () => {
      // Dec 31, 2025 (just 15 days ago, but different year)
      const yearBoundary = new Date('2025-12-31T12:00:00Z').toISOString();
      expect(formatRelativeTime(yearBoundary)).toBe('Dec 31, 2025');
    });
  });

  describe('formatShortTimestamp', () => {
    it('should return time only for today', () => {
      const today = new Date('2026-01-15T14:30:00Z').toISOString();
      const result = formatShortTimestamp(today);
      expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    });

    it('should return date and time for other days', () => {
      const yesterday = new Date('2026-01-14T14:30:00Z').toISOString();
      const result = formatShortTimestamp(yesterday);
      expect(result).toContain('Jan 14');
      expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    });
  });

  describe('formatFullTimestamp', () => {
    it('should return full date and time with year', () => {
      const date = new Date('2026-01-15T14:30:00Z').toISOString();
      const result = formatFullTimestamp(date);
      expect(result).toContain('Jan 15');
      expect(result).toContain('2026');
      expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    });

    it('should format dates from different years correctly', () => {
      const date = new Date('2025-06-20T09:45:00Z').toISOString();
      const result = formatFullTimestamp(date);
      expect(result).toContain('Jun 20');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
    });
  });
});
