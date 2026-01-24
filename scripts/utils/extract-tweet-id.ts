#!/usr/bin/env tsx
/**
 * Extract Tweet ID from URL or validate raw numeric ID
 * 
 * Usage:
 *   pnpm run tweet:id -- "https://x.com/username/status/1234567890123456789"
 *   pnpm run tweet:id -- "1234567890123456789"
 * 
 * Output: Prints ONLY the tweet ID to stdout (no other output)
 * Exit: 0 on success, 1 on failure
 */

// Handle pnpm run script -- arg format (-- is passed as argv[2], actual arg is argv[3])
let input = process.argv[2];
if (input === '--' && process.argv[3]) {
  input = process.argv[3];
}

if (!input || input === '--') {
  console.error('Usage: pnpm run tweet:id -- "<url_or_id>"');
  console.error('Example: pnpm run tweet:id -- "https://x.com/username/status/1234567890123456789"');
  process.exit(1);
}

let tweetId: string;

// Check if input is a URL
if (input.includes('/status/')) {
  // Extract ID from URL: https://x.com/username/status/1234567890123456789
  const match = input.match(/\/status\/(\d+)/);
  if (!match || !match[1]) {
    console.error('Error: Could not extract tweet ID from URL');
    console.error('Expected format: https://x.com/username/status/1234567890123456789');
    process.exit(1);
  }
  tweetId = match[1];
} else {
  // Assume it's a raw numeric ID
  tweetId = input.trim();
}

// Validate: must be numeric and >= 15 digits
if (!/^\d+$/.test(tweetId)) {
  console.error(`Error: Tweet ID must be numeric`);
  console.error(`Provided: ${tweetId}`);
  process.exit(1);
}

if (tweetId.length < 15) {
  console.error(`Error: Tweet ID must be >= 15 digits`);
  console.error(`Provided: ${tweetId} (${tweetId.length} digits)`);
  process.exit(1);
}

// Print ONLY the tweet ID (no other output)
console.log(tweetId);
process.exit(0);
