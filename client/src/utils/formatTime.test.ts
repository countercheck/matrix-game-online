import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, formatShortTimestamp, formatFullTimestamp } from './formatTime';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock the current time to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for times less than 60 seconds ago', () => {
    const date = new Date('2024-01-15T11:59:30Z').toISOString();
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('should return minutes for times less than 60 minutes ago', () => {
    const date = new Date('2024-01-15T11:30:00Z').toISOString();
    expect(formatRelativeTime(date)).toBe('30m ago');
  });

  it('should return hours for times less than 24 hours ago', () => {
    const date = new Date('2024-01-15T08:00:00Z').toISOString();
    expect(formatRelativeTime(date)).toBe('4h ago');
  });

  it('should return days for times less than 7 days ago', () => {
    const date = new Date('2024-01-12T12:00:00Z').toISOString();
    expect(formatRelativeTime(date)).toBe('3d ago');
  });

  it('should return formatted date for times 7 days or more ago', () => {
    const date = new Date('2024-01-01T12:00:00Z').toISOString();
    const result = formatRelativeTime(date);
    expect(result).toBe('Jan 1');
  });

  it('should handle invalid date strings', () => {
    expect(formatRelativeTime('')).toBe('Invalid date');
    expect(formatRelativeTime('invalid-date')).toBe('Invalid date');
    expect(formatRelativeTime('not a date')).toBe('Invalid date');
  });

  it('should handle future dates by returning "just now"', () => {
    const futureDate = new Date('2024-01-15T13:00:00Z').toISOString();
    expect(formatRelativeTime(futureDate)).toBe('just now');
  });

  it('should handle dates far in the future', () => {
    const futureDate = new Date('2025-01-15T12:00:00Z').toISOString();
    expect(formatRelativeTime(futureDate)).toBe('just now');
  });

  it('should handle dates exactly 1 minute ago', () => {
    const date = new Date('2024-01-15T11:59:00Z').toISOString();
    expect(formatRelativeTime(date)).toBe('1m ago');
  });

  it('should handle dates exactly 1 hour ago', () => {
    const date = new Date('2024-01-15T11:00:00Z').toISOString();
    expect(formatRelativeTime(date)).toBe('1h ago');
  });

  it('should handle dates exactly 1 day ago', () => {
    const date = new Date('2024-01-14T12:00:00Z').toISOString();
    expect(formatRelativeTime(date)).toBe('1d ago');
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

  it('should return time only for today', () => {
    const date = new Date('2024-01-15T08:30:00Z').toISOString();
    const result = formatShortTimestamp(date);
    // Result will vary based on locale/timezone, just check it contains time
    expect(result).toMatch(/\d+:\d+/);
  });

  it('should return date and time for other days', () => {
    const date = new Date('2024-01-10T08:30:00Z').toISOString();
    const result = formatShortTimestamp(date);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/\d+:\d+/);
  });

  it('should handle invalid date strings', () => {
    expect(formatShortTimestamp('')).toBe('Invalid date');
    expect(formatShortTimestamp('invalid-date')).toBe('Invalid date');
  });
});

describe('formatFullTimestamp', () => {
  it('should return full formatted timestamp', () => {
    const date = new Date('2024-01-15T12:30:00Z').toISOString();
    const result = formatFullTimestamp(date);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/\d+:\d+/);
  });

  it('should handle invalid date strings', () => {
    expect(formatFullTimestamp('')).toBe('Invalid date');
    expect(formatFullTimestamp('invalid-date')).toBe('Invalid date');
  });

  it('should format dates from different years', () => {
    const date = new Date('2023-12-25T18:45:00Z').toISOString();
    const result = formatFullTimestamp(date);
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/25/);
    expect(result).toMatch(/2023/);
  });
});
