import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatRelativeTime,
  formatShortTimestamp,
  formatFullTimestamp,
} from './formatTime';

describe('formatTime utilities', () => {
  beforeEach(() => {
    // Mock the current time to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for times less than 60 seconds ago', () => {
      const date = new Date('2024-01-15T11:59:30Z').toISOString();
      expect(formatRelativeTime(date)).toBe('just now');
    });

    it('should return minutes ago for times less than 60 minutes ago', () => {
      const date = new Date('2024-01-15T11:45:00Z').toISOString();
      expect(formatRelativeTime(date)).toBe('15m ago');
    });

    it('should return hours ago for times less than 24 hours ago', () => {
      const date = new Date('2024-01-15T09:00:00Z').toISOString();
      expect(formatRelativeTime(date)).toBe('3h ago');
    });

    it('should return days ago for times less than 7 days ago', () => {
      const date = new Date('2024-01-13T12:00:00Z').toISOString();
      expect(formatRelativeTime(date)).toBe('2d ago');
    });

    it('should return formatted date for times more than 7 days ago', () => {
      const date = new Date('2024-01-01T12:00:00Z').toISOString();
      const result = formatRelativeTime(date);
      expect(result).toMatch(/Jan 1/);
    });

    it('should return "Invalid date" for invalid date strings', () => {
      expect(formatRelativeTime('not a date')).toBe('Invalid date');
      expect(formatRelativeTime('')).toBe('Invalid date');
      expect(formatRelativeTime('2024-13-45')).toBe('Invalid date');
    });
  });

  describe('formatShortTimestamp', () => {
    it('should return time only for today', () => {
      const date = new Date('2024-01-15T09:30:00Z').toISOString();
      const result = formatShortTimestamp(date);
      // Result will vary by timezone, but should contain time
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('should return date and time for other days', () => {
      const date = new Date('2024-01-10T14:30:00Z').toISOString();
      const result = formatShortTimestamp(date);
      // Should contain month, day, and time
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/10/);
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('should return "Invalid date" for invalid date strings', () => {
      expect(formatShortTimestamp('invalid')).toBe('Invalid date');
      expect(formatShortTimestamp('')).toBe('Invalid date');
      expect(formatShortTimestamp('not-a-date')).toBe('Invalid date');
    });
  });

  describe('formatFullTimestamp', () => {
    it('should return full timestamp with year', () => {
      const date = new Date('2024-01-15T14:30:00Z').toISOString();
      const result = formatFullTimestamp(date);
      // Should contain month, day, year, and time
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('should handle different dates correctly', () => {
      const date = new Date('2023-12-25T09:00:00Z').toISOString();
      const result = formatFullTimestamp(date);
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/25/);
      expect(result).toMatch(/2023/);
    });

    it('should return "Invalid date" for invalid date strings', () => {
      expect(formatFullTimestamp('invalid')).toBe('Invalid date');
      expect(formatFullTimestamp('')).toBe('Invalid date');
      expect(formatFullTimestamp('2024-99-99')).toBe('Invalid date');
      expect(formatFullTimestamp('abc123')).toBe('Invalid date');
    });
  });
});
