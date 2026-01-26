/**
 * Format a timestamp as relative time for display
 * @param timestamp - Unix timestamp in milliseconds
 * @param now - Current time in milliseconds (passed to keep function pure)
 * @returns A human-readable relative time string (e.g., "2d ago", "3h ago", "Just now")
 */
export function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor(diff / (60 * 1000));

  if (days > 0) {
    return `${String(days)}d ago`;
  }
  if (hours > 0) {
    return `${String(hours)}h ago`;
  }
  if (minutes > 0) {
    return `${String(minutes)}m ago`;
  }
  return 'Just now';
}
