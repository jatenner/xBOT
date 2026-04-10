/**
 * Short-lived cooldown for reply targets that returned X CreateTweet error 226
 * (automation/spam block). Delegates to x226Cooldown service for persistence and author/account cooldowns.
 */

import { isTargetBlockedBy226 as isTargetBlockedBy226Service, setTargetCooldown as setTargetCooldownService } from '../services/x226Cooldown';

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

/** Set target cooldown (memory + used by service). Call when 226 detected. */
export function addCreateTweet226Cooldown(targetTweetId: string): void {
  setTargetCooldownService(targetTweetId);
  console.log(`[CREATE_TWEET_226_COOLDOWN] target=${targetTweetId} blocked for ${COOLDOWN_MS / 60000}min`);
}

/** Check if target is in 226 cooldown (async: checks DB + memory). */
export async function isTargetBlockedBy226(targetTweetId: string): Promise<boolean> {
  return isTargetBlockedBy226Service(targetTweetId);
}

export async function get226CooldownStatus(targetTweetId: string): Promise<{ blocked: boolean; remainingMinutes?: number }> {
  const blocked = await isTargetBlockedBy226Service(targetTweetId);
  if (!blocked) return { blocked: false };
  return { blocked: true, remainingMinutes: Math.ceil(COOLDOWN_MS / 60000) };
}
