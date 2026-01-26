import { describe, it, expect } from 'vitest';

import { formatRelativeTime } from '../formatRelativeTime';

describe('formatRelativeTime', () => {
  const NOW = 1700000000000; // Fixed reference time for testing

  it('returns "Just now" for timestamps within the last minute', () => {
    expect(formatRelativeTime(NOW - 30 * 1000, NOW)).toBe('Just now');
    expect(formatRelativeTime(NOW - 59 * 1000, NOW)).toBe('Just now');
    expect(formatRelativeTime(NOW, NOW)).toBe('Just now');
  });

  it('returns minutes ago for timestamps within the last hour', () => {
    expect(formatRelativeTime(NOW - 60 * 1000, NOW)).toBe('1m ago');
    expect(formatRelativeTime(NOW - 5 * 60 * 1000, NOW)).toBe('5m ago');
    expect(formatRelativeTime(NOW - 59 * 60 * 1000, NOW)).toBe('59m ago');
  });

  it('returns hours ago for timestamps within the last day', () => {
    expect(formatRelativeTime(NOW - 60 * 60 * 1000, NOW)).toBe('1h ago');
    expect(formatRelativeTime(NOW - 3 * 60 * 60 * 1000, NOW)).toBe('3h ago');
    expect(formatRelativeTime(NOW - 23 * 60 * 60 * 1000, NOW)).toBe('23h ago');
  });

  it('returns days ago for timestamps older than a day', () => {
    expect(formatRelativeTime(NOW - 24 * 60 * 60 * 1000, NOW)).toBe('1d ago');
    expect(formatRelativeTime(NOW - 7 * 24 * 60 * 60 * 1000, NOW)).toBe('7d ago');
    expect(formatRelativeTime(NOW - 30 * 24 * 60 * 60 * 1000, NOW)).toBe('30d ago');
  });

  it('handles edge case at exactly 1 minute boundary', () => {
    // At exactly 60 seconds, should show 1m ago
    expect(formatRelativeTime(NOW - 60 * 1000, NOW)).toBe('1m ago');
  });

  it('handles edge case at exactly 1 hour boundary', () => {
    // At exactly 60 minutes, should show 1h ago
    expect(formatRelativeTime(NOW - 60 * 60 * 1000, NOW)).toBe('1h ago');
  });

  it('handles edge case at exactly 1 day boundary', () => {
    // At exactly 24 hours, should show 1d ago
    expect(formatRelativeTime(NOW - 24 * 60 * 60 * 1000, NOW)).toBe('1d ago');
  });
});
