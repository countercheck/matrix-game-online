import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility function', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', true && 'bar')).toBe('foo bar');
    expect(cn('foo', false && 'bar')).toBe('foo');
  });

  it('should handle undefined and null values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle objects with boolean values', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('should merge conflicting Tailwind classes', () => {
    // twMerge should keep the last conflicting class
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle mixed inputs', () => {
    expect(cn('foo', { bar: true }, ['baz', 'qux'])).toBe('foo bar baz qux');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });

  it('should preserve non-conflicting Tailwind classes', () => {
    expect(cn('px-4 py-2', 'mt-4')).toBe('px-4 py-2 mt-4');
  });

  it('should handle responsive variants correctly', () => {
    expect(cn('hidden', 'sm:block')).toBe('hidden sm:block');
  });
});
