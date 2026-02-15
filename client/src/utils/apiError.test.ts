import { describe, it, expect } from 'vitest';
import { getApiErrorMessage } from './apiError';

describe('getApiErrorMessage', () => {
  it('should extract message from response.data.error.message', () => {
    const err = { response: { data: { error: { message: 'Game not found' } } } };
    expect(getApiErrorMessage(err)).toBe('Game not found');
  });

  it('should fall back to response.data.message when error.message is absent', () => {
    const err = { response: { data: { message: 'Not authorized' } } };
    expect(getApiErrorMessage(err)).toBe('Not authorized');
  });

  it('should prefer response.data.error.message over response.data.message', () => {
    const err = {
      response: { data: { error: { message: 'Specific error' }, message: 'Generic error' } },
    };
    expect(getApiErrorMessage(err)).toBe('Specific error');
  });

  it('should return fallback for non-object error', () => {
    expect(getApiErrorMessage('string error', 'Fallback')).toBe('Fallback');
  });

  it('should return fallback for null', () => {
    expect(getApiErrorMessage(null, 'Fallback')).toBe('Fallback');
  });

  it('should return fallback for undefined', () => {
    expect(getApiErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });

  it('should return default fallback when none provided', () => {
    expect(getApiErrorMessage(null)).toBe('Something went wrong');
  });

  it('should use custom fallback string', () => {
    expect(getApiErrorMessage(null, 'Import failed')).toBe('Import failed');
  });

  it('should return fallback when response exists but data is undefined', () => {
    const err = { response: {} };
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Fallback');
  });

  it('should return fallback when response.data exists but has no messages', () => {
    const err = { response: { data: {} } };
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Fallback');
  });

  it('should return fallback when error.message is empty string', () => {
    const err = { response: { data: { error: { message: '' } } } };
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Fallback');
  });

  it('should handle object without response property', () => {
    const err = { code: 'NETWORK_ERROR' };
    expect(getApiErrorMessage(err, 'Network error')).toBe('Network error');
  });
});
