/**
 * Lightweight Census
 *
 * Fast follower-count-only census for boring/unknown accounts.
 * Skips tweet grabbing, replies tab, and bio extraction.
 * Takes ~1.5s per account instead of ~5s for full census.
 *
 * Used by the census worker when processing boring/unknown tier accounts
 * at scale. Full census (with tweets) is reserved for interesting/hot/explosive.
 */

import { getSupabaseClient } from '../../db';
import { brainGoto } from '../feeds/brainNavigator';
import { getFollowerRange } from '../types';
import type { Page } from 'playwright';

const LOG_PREFIX = '[observatory/lightweight-census]';

// Minimal extraction script — just follower count
const EXTRACT_FOLLOWERS_JS = `
(function() {
  var result = { followers: null, following: null };

  var links = document.querySelectorAll('a[href*="/followers"], a[href*="/following"], a[href*="/verified_followers"]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href') || '';
    var text = links[i].textContent || '';

    var match = text.match(/([\\d.,]+)\\s*([KMB])?/);
    if (!match) continue;

    var num = parseFloat(match[1].replace(/,/g, ''));
    var suffix = (match[2] || '').toUpperCase();
    if (suffix === 'K') num *= 1e3;
    else if (suffix === 'M') num *= 1e6;
    else if (suffix === 'B') num *= 1e9;
    num = Math.round(num);

    if (href.includes('/followers') || href.includes('/verified_followers')) {
      result.followers = num;
    } else if (href.includes('/following')) {
      result.following = num;
    }
  }

  if (result.followers === null) {
    var bodyText = document.body ? document.body.innerText : '';
    var fMatch = bodyText.match(/([\\d.,]+)\\s*([KMB])?\\s*Followers?/i);
    if (fMatch) {
      var fn = parseFloat(fMatch[1].replace(/,/g, ''));
      var fs = (fMatch[2] || '').toUpperCase();
      if (fs === 'K') fn *= 1e3;
      else if (fs === 'M') fn *= 1e6;
      else if (fs === 'B') fn *= 1e9;
      result.followers = Math.round(fn);
    }
  }

  return result;
})()
`;

export interface LightweightCensusResult {
  username: string;
  followers: number | null;
  following: number | null;
  success: boolean;
}

/**
 * Run a lightweight census check on a single account.
 * Page must be provided (managed by the caller/pool).
 */
export async function lightweightCensusCheck(
  page: Page,
  username: string,
): Promise<LightweightCensusResult> {
  const profileUrl = `https://x.com/${username}`;

  const nav = await brainGoto(page, profileUrl, 10000);
  if (!nav.success) {
    return { username, followers: null, following: null, success: false };
  }

  const metrics = await page.evaluate(EXTRACT_FOLLOWERS_JS);

  if (metrics.followers === null) {
    return { username, followers: null, following: null, success: false };
  }

  return {
    username,
    followers: metrics.followers,
    following: metrics.following,
    success: true,
  };
}

/**
 * Process a lightweight census result: store snapshot and update brain_accounts.
 */
export async function processLightweightResult(result: LightweightCensusResult): Promise<void> {
  if (!result.success || result.followers === null) return;

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // Insert snapshot
  await supabase.from('brain_account_snapshots').insert({
    username: result.username,
    followers_count: result.followers,
    following_count: result.following,
    checked_at: now,
  });

  // Get previous state
  const { data: existing } = await supabase
    .from('brain_accounts')
    .select('followers_count, first_snapshot_at, snapshot_count')
    .eq('username', result.username)
    .single();

  const isFirstSnapshot = !existing?.first_snapshot_at;
  const followerRange = getFollowerRange(result.followers);

  const updateData: Record<string, any> = {
    followers_count: result.followers,
    following_count: result.following,
    prev_followers_count: existing?.followers_count ?? null,
    follower_range: followerRange,
    latest_snapshot_at: now,
    last_census_at: now,
    census_queued_at: null, // Clear queue flag
    snapshot_count: (existing?.snapshot_count ?? 0) + 1,
    updated_at: now,
  };

  if (isFirstSnapshot) {
    updateData.first_snapshot_at = now;
    updateData.follower_range_at_first_snapshot = followerRange;
  }

  if (result.following && result.following > 0 && result.followers) {
    updateData.ff_ratio = Math.round((result.followers / result.following) * 100) / 100;
  }

  await supabase
    .from('brain_accounts')
    .update(updateData)
    .eq('username', result.username);
}
