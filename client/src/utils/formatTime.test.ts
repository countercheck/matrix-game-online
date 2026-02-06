import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { formatRelativeTime, formatShortTimestamp, formatFullTimestamp } from './formatTime';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock current time to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic time ranges', () => {
    it('should return "just now" for times less than 60 seconds ago', () => {
      const date = new Date('2024-01-15T11:59:30Z').toISOString();
      expect(formatRelativeTime(date)).toBe('just now');
    });

    it('should return "just now" for current time', () => {
      const date = new Date('2024-01-15T12:00:00Z').toISOString();
      expect(formatRelativeTime(date)).toBe('just now');
    });

    it('should format minutes correctly (1-59 minutes ago)', () => {
      const oneMinuteAgo = new Date('2024-01-15T11:59:00Z').toISOString();
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago');

      const thirtyMinutesAgo = new Date('2024-01-15T11:30:00Z').toISOString();
      expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago');

      const fiftyNineMinutesAgo = new Date('2024-01-15T11:01:00Z').toISOString();
      expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m ago');
    });

    it('should format hours correctly (1-23 hours ago)', () => {
      const oneHourAgo = new Date('2024-01-15T11:00:00Z').toISOString();
      expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');

      const twelveHoursAgo = new Date('2024-01-15T00:00:00Z').toISOString();
      expect(formatRelativeTime(twelveHoursAgo)).toBe('12h ago');

      const twentyThreeHoursAgo = new Date('2024-01-14T13:00:00Z').toISOString();
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
    });

    it('should format days correctly (1-6 days ago)', () => {
      const oneDayAgo = new Date('2024-01-14T12:00:00Z').toISOString();
      expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');

      const threeDaysAgo = new Date('2024-01-12T12:00:00Z').toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');

      const sixDaysAgo = new Date('2024-01-09T12:00:00Z').toISOString();
      expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
    });

    it('should format dates older than 7 days with locale date string', () => {
      const sevenDaysAgo = new Date('2024-01-08T12:00:00Z').toISOString();
      expect(formatRelativeTime(sevenDaysAgo)).toBe('Jan 8');

      const thirtyDaysAgo = new Date('2023-12-16T12:00:00Z').toISOString();
      expect(formatRelativeTime(thirtyDaysAgo)).toBe('Dec 16');
    });
  });

  describe('edge cases', () => {
    it('should handle invalid date strings', () => {
      const result = formatRelativeTime('invalid-date');
      // Invalid date produces "Invalid Date" from toLocaleDateString
      expect(result).toBe('Invalid Date');
    });

    it('should handle empty string', () => {
      const result = formatRelativeTime('');
      // Empty string produces "Invalid Date" from toLocaleDateString
      expect(result).toBe('Invalid Date');
    });

    it('should handle future dates', () => {
      const futureDate = new Date('2024-01-15T13:00:00Z').toISOString();
      const result = formatRelativeTime(futureDate);
      // Future dates will have negative time difference, which is < 60 seconds
      expect(result).toBe('just now');
    });

    it('should handle dates far in the future', () => {
      const farFuture = new Date('2025-01-15T12:00:00Z').toISOString();
      const result = formatRelativeTime(farFuture);
      // Far future dates will have negative time difference, which is < 60 seconds
      expect(result).toBe('just now');
    });

    it('should handle dates far in the past', () => {
      const farPast = new Date('2020-01-15T12:00:00Z').toISOString();
      const result = formatRelativeTime(farPast);
      expect(result).toBe('Jan 15');
    });
  });

  describe('boundary conditions', () => {
    it('should handle exactly 60 seconds (1 minute boundary)', () => {
      const exactlyOneMinute = new Date('2024-01-15T11:59:00Z').toISOString();
      expect(formatRelativeTime(exactlyOneMinute)).toBe('1m ago');
    });

    it('should handle exactly 60 minutes (1 hour boundary)', () => {
      const exactlyOneHour = new Date('2024-01-15T11:00:00Z').toISOString();
      expect(formatRelativeTime(exactlyOneHour)).toBe('1h ago');
    });

    it('should handle exactly 24 hours (1 day boundary)', () => {
      const exactlyOneDay = new Date('2024-01-14T12:00:00Z').toISOString();
      expect(formatRelativeTime(exactlyOneDay)).toBe('1d ago');
    });

    it('should handle exactly 7 days (week boundary)', () => {
      const exactlySevenDays = new Date('2024-01-08T12:00:00Z').toISOString();
      expect(formatRelativeTime(exactlySevenDays)).toBe('Jan 8');
    });
  });
});

describe('formatShortTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic formatting', () => {
    it('should format time only for today', () => {
      const todayMorning = new Date('2024-01-15T09:30:00Z').toISOString();
      const result = formatShortTimestamp(todayMorning);
      // The exact format depends on locale, but should include time
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should contain time
      expect(result).not.toMatch(/Jan/); // Should not contain month for today
    });

    it('should format with date for other days', () => {
      const yesterday = new Date('2024-01-14T09:30:00Z').toISOString();
      const result = formatShortTimestamp(yesterday);
      // Should include month and time
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format dates in the past with month and time', () => {
      const lastWeek = new Date('2024-01-08T14:45:00Z').toISOString();
      const result = formatShortTimestamp(lastWeek);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid date strings', () => {
      const result = formatShortTimestamp('invalid-date');
      // Invalid date produces "Invalid Date" from toLocaleDateString
      expect(result).toBe('Invalid Date');
    });

    it('should handle empty string', () => {
      const result = formatShortTimestamp('');
      // Empty string produces "Invalid Date" from toLocaleDateString
      expect(result).toBe('Invalid Date');
    });

    it('should handle future dates', () => {
      const tomorrow = new Date('2024-01-16T12:00:00Z').toISOString();
      const result = formatShortTimestamp(tomorrow);
      expect(result).toMatch(/Jan/); // Future dates should show date
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should include time
    });

    it('should handle midnight boundary', () => {
      const justBeforeMidnight = new Date('2024-01-15T23:59:59Z').toISOString();
      const result = formatShortTimestamp(justBeforeMidnight);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('locale-specific formatting', () => {
    it('should use 12-hour format with AM/PM', () => {
      const morningTime = new Date('2024-01-15T09:30:00Z').toISOString();
      const result = formatShortTimestamp(morningTime);
      expect(result).toMatch(/AM|PM/);
    });

    it('should format minutes with 2 digits', () => {
      const timeWithSingleDigitMinute = new Date('2024-01-15T09:05:00Z').toISOString();
      const result = formatShortTimestamp(timeWithSingleDigitMinute);
      expect(result).toMatch(/\d{1,2}:05/); // Minutes should be 05, not 5
    });
  });
});

describe('formatFullTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic formatting', () => {
    it('should format with full date including year', () => {
      const date = new Date('2024-01-15T09:30:00Z').toISOString();
      const result = formatFullTimestamp(date);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format dates from different years', () => {
      const lastYear = new Date('2023-12-25T10:00:00Z').toISOString();
      const result = formatFullTimestamp(lastYear);
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/25/);
      expect(result).toMatch(/2023/);
    });

    it('should format future dates', () => {
      const nextYear = new Date('2025-03-20T15:45:00Z').toISOString();
      const result = formatFullTimestamp(nextYear);
      expect(result).toMatch(/Mar/);
      expect(result).toMatch(/20/);
      expect(result).toMatch(/2025/);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid date strings', () => {
      const result = formatFullTimestamp('invalid-date');
      // Invalid date produces "Invalid Date" from toLocaleDateString
      expect(result).toBe('Invalid Date');
    });

    it('should handle empty string', () => {
      const result = formatFullTimestamp('');
      // Empty string produces "Invalid Date" from toLocaleDateString
      expect(result).toBe('Invalid Date');
    });

    it('should handle dates far in the past', () => {
      const oldDate = new Date('2000-01-01T00:00:00Z').toISOString();
      const result = formatFullTimestamp(oldDate);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/1/);
      expect(result).toMatch(/2000/);
    });

    it('should handle dates far in the future', () => {
      const futureDate = new Date('2099-12-31T23:59:59Z').toISOString();
      const result = formatFullTimestamp(futureDate);
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/31/);
      expect(result).toMatch(/2099/);
    });
  });

  describe('locale-specific formatting', () => {
    it('should use 12-hour format with AM/PM', () => {
      const date = new Date('2024-01-15T14:30:00Z').toISOString();
      const result = formatFullTimestamp(date);
      expect(result).toMatch(/AM|PM/);
    });

    it('should format minutes with 2 digits', () => {
      const date = new Date('2024-01-15T09:05:00Z').toISOString();
      const result = formatFullTimestamp(date);
      expect(result).toMatch(/\d{1,2}:05/);
    });

    it('should use short month names', () => {
      const januaryDate = new Date('2024-01-15T12:00:00Z').toISOString();
      expect(formatFullTimestamp(januaryDate)).toMatch(/Jan/);

      const decemberDate = new Date('2024-12-15T12:00:00Z').toISOString();
      expect(formatFullTimestamp(decemberDate)).toMatch(/Dec/);
    });
  });
});
