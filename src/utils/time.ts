/**
 * Time utilities for delays and scheduling
 */

/**
 * Sleep for a specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for a specified number of minutes
 */
export async function sleepMinutes(minutes: number): Promise<void> {
  return sleep(minutes * 60 * 1000);
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Get current timestamp in ISO string format
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Check if a timestamp is expired
 */
export function isExpired(timestamp: string): boolean {
  return new Date(timestamp) < new Date();
}

/**
 * Add minutes to current time and return ISO string
 */
export function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * Calculate remaining time in milliseconds until expiry
 */
export function timeUntilExpiry(expiryISO: string): number {
  const expiry = new Date(expiryISO).getTime();
  const remaining = expiry - Date.now();
  return Math.max(0, remaining);
}
