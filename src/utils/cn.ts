/**
 * Utility function to concatenate class names conditionally
 * Filters out falsy values and joins the rest with spaces
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}