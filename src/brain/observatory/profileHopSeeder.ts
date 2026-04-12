/**
 * Profile Hop Seeder
 *
 * Discovers accounts in bulk by visiting the "Following" and "Followers" pages
 * of known accounts. This is the highest-throughput discovery mechanism:
 * one profile-hop can yield 50-100 categorized accounts in a single visit.
 *
 * Uses ANONYMOUS browsing — following/followers lists are public on Twitter.
 *
 * The logic: If we know @cryptoTrader123 is a crypto account, the accounts
 * they follow are likely also crypto accounts. Same for their followers.
 *
 * Each run:
 * 1. Picks up to 2 active campaigns
 * 2. For each campaign, picks a seed account whose following list we haven't hopped yet
 * 3. Visits their /following or /followers page
 * 4. Extracts profile cards (username, follower count, bio snippet)
 * 5. Filters by target follower range
 * 6. Inserts new accounts into brain_accounts
 */

import { getSupabaseClient } from '../../db';
import { getBrainPage, brainGoto } from '../feeds/brainNavigator';
import { getFollowerRange, FOLLOWER_RANGE_BOUNDS, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/profile-hop]';
const MAX_CAMPAIGNS_PER_RUN = 2;
const MAX_AUTO_HOPS_PER_RUN = 10; // Auto-hop from 10 accounts per run (every 5 min = 120 hops/hr)
const MAX_SCROLL_ROUNDS = 5;

export async function runProfileHopSeeder(): Promise<{
  campaigns_processed: number;
  accounts_discovered: number;
}> {
  const supabase = getSupabaseClient();
  let campaignsProcessed = 0;
  let accountsDiscovered = 0;

  // === RE-HOP RESET ===
  // If we've hopped all accounts, reset hops older than 7 days so we can rediscover
  // (people follow new accounts — their following lists change over time)
  try {
    const { count: unhopped } = await supabase
      .from('brain_accounts')
      .select('*', { count: 'exact', head: true })
      .gte('followers_count', 500)
      .is('last_hop_at', null);

    if ((unhopped ?? 0) < 20) {
      const resetCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: reset } = await supabase
        .from('brain_accounts')
        .update({ last_hop_at: null })
        .lt('last_hop_at', resetCutoff)
        .gte('followers_count', 500)
        .select('*', { count: 'exact', head: true });
      if ((reset ?? 0) > 0) {
        console.log(`${LOG_PREFIX} Re-hop reset: cleared ${reset} stale hops (>7d old)`);
      }
    }
  } catch {}

  // === AUTO-HOP MODE ===
  // Automatically discover from ANY account with 500+ followers we haven't hopped yet.
  const autoDiscovered = await runAutoHop(supabase);
  accountsDiscovered += autoDiscovered;

  // === CAMPAIGN MODE ===
  // Get active campaigns with seed accounts available
  const { data: campaigns } = await supabase
    .from('brain_seed_campaigns')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(MAX_CAMPAIGNS_PER_RUN);

  if (!campaigns || campaigns.length === 0) {
    return { campaigns_processed: campaignsProcessed, accounts_discovered: accountsDiscovered };
  }

  let page: any;
  try {
    page = await getBrainPage(); // Anonymous — following lists are public
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to get browser page: ${err.message}`);
    return { campaigns_processed: 0, accounts_discovered: 0 };
  }

  try {
    for (const campaign of campaigns) {
      try {
        const discovered = await processCampaignHop(supabase, page, campaign);
        accountsDiscovered += discovered;
        campaignsProcessed++;

        // Update campaign
        const newDiscoveredCount = (campaign.discovered_count ?? 0) + discovered;
        const updates: Record<string, any> = {
          discovered_count: newDiscoveredCount,
          updated_at: new Date().toISOString(),
        };

        if (newDiscoveredCount >= campaign.target_count) {
          updates.status = 'completed';
        }

        await supabase
          .from('brain_seed_campaigns')
          .update(updates)
          .eq('id', campaign.id);

      } catch (err: any) {
        console.error(`${LOG_PREFIX} Campaign ${campaign.niche}/${campaign.target_follower_range} error: ${err.message}`);
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  if (accountsDiscovered > 0) {
    console.log(`${LOG_PREFIX} Discovered ${accountsDiscovered} accounts from ${campaignsProcessed} campaigns via profile hops`);
  }

  return { campaigns_processed: campaignsProcessed, accounts_discovered: accountsDiscovered };
}

/**
 * Auto-hop: discover accounts from growing/high-engagement accounts we already track.
 * No campaigns needed — picks the best un-hopped accounts automatically.
 *
 * Prioritizes:
 * 1. Hot/explosive growth accounts (these attract interesting followers)
 * 2. Interesting growth accounts
 * 3. High-tier (S/A) accounts with diverse followers
 *
 * Tracks which accounts we've already hopped via a simple column on brain_accounts.
 */
async function runAutoHop(supabase: any): Promise<number> {
  // Find accounts worth hopping from — ANY account with 500+ followers we haven't hopped yet.
  // A boring 100K health account has a great following list full of other health accounts.
  // Growing accounts get priority (sorted first), but we don't ONLY hop from growing accounts.
  let candidates: any[] = [];

  try {
    // Priority 1: Growing accounts (most valuable following lists)
    const { data: growingCandidates } = await supabase
      .from('brain_accounts')
      .select('username, followers_count, growth_status, primary_domain, follower_range')
      .eq('is_active', true)
      .gte('followers_count', 200)
      .is('last_hop_at', null)
      .in('growth_status', ['interesting', 'hot', 'explosive'])
      .order('followers_count', { ascending: false })
      .limit(MAX_AUTO_HOPS_PER_RUN);
    candidates = growingCandidates ?? [];

    // Priority 2: Fill remaining slots with ANY unhopped account with 500+ followers
    if (candidates.length < MAX_AUTO_HOPS_PER_RUN) {
      const existingUsernames = new Set(candidates.map((c: any) => c.username));
      const { data: broadCandidates } = await supabase
        .from('brain_accounts')
        .select('username, followers_count, growth_status, primary_domain, follower_range')
        .eq('is_active', true)
        .gte('followers_count', 500)
        .is('last_hop_at', null)
        .order('followers_count', { ascending: false })
        .limit((MAX_AUTO_HOPS_PER_RUN - candidates.length) * 2);

      for (const c of broadCandidates ?? []) {
        if (candidates.length >= MAX_AUTO_HOPS_PER_RUN) break;
        if (!existingUsernames.has(c.username)) {
          candidates.push(c);
          existingUsernames.add(c.username);
        }
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Auto-hop query error: ${err.message}`);
    return 0;
  }

  if (candidates.length === 0) return 0;

  let page: any;
  try {
    page = await getBrainPage();
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Auto-hop: failed to get browser page: ${err.message}`);
    return 0;
  }

  let totalDiscovered = 0;
  let accountsHopped = 0;

  try {
    for (const candidate of candidates) {
      if (accountsHopped >= MAX_AUTO_HOPS_PER_RUN) break;

      try {
        // Alternate between following and followers lists
        const tab = accountsHopped % 2 === 0 ? 'following' : 'followers';
        const url = `https://x.com/${candidate.username}/${tab}`;

        const nav = await brainGoto(page, url, 15000);
        if (!nav.success) continue;

        // Wait for profile cards
        try {
          await page.waitForSelector('[data-testid="UserCell"]', { timeout: 8000 });
        } catch {
          // Mark as hopped to avoid retrying private/empty accounts
          await supabase
            .from('brain_accounts')
            .update({ last_hop_at: new Date().toISOString() })
            .eq('username', candidate.username);
          continue;
        }

        // Scroll to load more
        for (let i = 0; i < MAX_SCROLL_ROUNDS; i++) {
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await page.waitForTimeout(1500);
        }

        // Extract profile cards
        const profiles = await page.evaluate(`
          (function() {
            var cells = document.querySelectorAll('[data-testid="UserCell"]');
            var results = [];
            for (var i = 0; i < cells.length; i++) {
              var cell = cells[i];
              var result = { username: null, displayName: null, followers: null, bio: null };
              var links = cell.querySelectorAll('a[href^="/"]');
              for (var j = 0; j < links.length; j++) {
                var href = links[j].getAttribute('href') || '';
                var match = href.match(/^\\/([A-Za-z0-9_]+)$/);
                if (match && !['home', 'explore', 'notifications', 'messages', 'settings', 'i'].includes(match[1])) {
                  result.username = match[1];
                  break;
                }
              }
              if (!result.username) continue;
              var nameEl = cell.querySelector('span');
              if (nameEl) result.displayName = (nameEl.textContent || '').trim();
              var spans = cell.querySelectorAll('span');
              for (var k = 0; k < spans.length; k++) {
                var spanText = (spans[k].textContent || '').trim();
                if (spanText.length > 30 && spanText !== result.displayName) {
                  result.bio = spanText.substring(0, 300);
                  break;
                }
              }
              var cellText = cell.textContent || '';
              var fMatch = cellText.match(/(\\d[\\d.,]*)\\s*([KMB])?\\s*(?:followers?)/i);
              if (fMatch) {
                var num = parseFloat(fMatch[1].replace(/,/g, ''));
                var suffix = (fMatch[2] || '').toUpperCase();
                if (suffix === 'K') num *= 1e3;
                else if (suffix === 'M') num *= 1e6;
                else if (suffix === 'B') num *= 1e9;
                result.followers = Math.round(num);
              }
              results.push(result);
            }
            return results;
          })()
        `);

        if (!profiles || profiles.length === 0) {
          await supabase
            .from('brain_accounts')
            .update({ last_hop_at: new Date().toISOString() })
            .eq('username', candidate.username);
          continue;
        }

        // Batch check existing
        const usernames = profiles
          .filter((p: any) => p.username)
          .map((p: any) => p.username.toLowerCase());

        const { data: existingAccounts } = await supabase
          .from('brain_accounts')
          .select('username')
          .in('username', usernames);

        const existingSet = new Set((existingAccounts ?? []).map((a: any) => a.username.toLowerCase()));

        // Insert new accounts
        let discovered = 0;
        for (const profile of profiles) {
          if (!profile.username) continue;
          const username = profile.username.toLowerCase();
          if (existingSet.has(username)) continue;

          const followerRange = profile.followers !== null ? getFollowerRange(profile.followers) : null;

          await supabase.from('brain_accounts').upsert({
            username,
            display_name: profile.displayName || null,
            followers_count: profile.followers,
            bio_text: profile.bio || null,
            follower_range: followerRange,
            follower_range_at_first_snapshot: followerRange,
            primary_domain: candidate.primary_domain || null,
            discovery_method: 'seed',
            discovered_from_username: candidate.username,
            tier: 'C',
            scrape_priority: 0.3,
            is_active: true,
            next_census_at: new Date(Date.now() + Math.random() * 48 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'username' });

          existingSet.add(username);
          discovered++;
        }

        // Mark as hopped
        await supabase
          .from('brain_accounts')
          .update({ last_hop_at: new Date().toISOString() })
          .eq('username', candidate.username);

        totalDiscovered += discovered;
        accountsHopped++;

        console.log(
          `${LOG_PREFIX} Auto-hop @${candidate.username} (${tab}): ` +
          `${profiles.length} profiles seen, ${discovered} new accounts discovered`
        );

        // Delay between hops
        await page.waitForTimeout(2000);

      } catch (err: any) {
        console.error(`${LOG_PREFIX} Auto-hop error for @${candidate.username}: ${err.message}`);
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  if (totalDiscovered > 0) {
    console.log(`${LOG_PREFIX} Auto-hop total: ${totalDiscovered} accounts from ${accountsHopped} hops`);
  }

  return totalDiscovered;
}

async function processCampaignHop(
  supabase: any,
  page: any,
  campaign: any,
): Promise<number> {
  // Find a seed account to hop from
  // First try: accounts we already track in this niche that we haven't hopped yet
  const hopSources: string[] = campaign.hop_sources ?? [];
  const seedAccounts: string[] = campaign.seed_accounts ?? [];

  let sourceUsername: string | null = null;

  // Option 1: Use explicit seed accounts that haven't been hopped yet
  for (const seed of seedAccounts) {
    if (!hopSources.includes(seed)) {
      sourceUsername = seed;
      break;
    }
  }

  // Option 2: Find a tracked account in this niche with decent followers
  if (!sourceUsername) {
    const { data: nicheAccounts } = await supabase
      .from('brain_accounts')
      .select('username')
      .eq('is_active', true)
      .or(`primary_domain.eq.${campaign.niche},niche_cached.eq.${campaign.niche}`)
      .gte('followers_count', 1000)
      .order('followers_count', { ascending: false })
      .limit(50);

    if (nicheAccounts) {
      for (const acct of nicheAccounts) {
        if (!hopSources.includes(acct.username)) {
          sourceUsername = acct.username;
          break;
        }
      }
    }
  }

  if (!sourceUsername) {
    return 0; // No more accounts to hop from
  }

  // Alternate between /following and /followers for variety
  const tab = Math.random() > 0.5 ? 'following' : 'followers';
  const url = `https://x.com/${sourceUsername}/${tab}`;

  const nav = await brainGoto(page, url, 15000);
  if (!nav.success) return 0;

  // Wait for profile cards to load
  try {
    await page.waitForSelector('[data-testid="UserCell"]', { timeout: 8000 });
  } catch {
    // Might be a private account or empty list
    // Mark as hopped anyway to avoid retrying
    await markHopped(supabase, campaign.id, sourceUsername, hopSources);
    return 0;
  }

  // Scroll to load more profile cards
  for (let i = 0; i < MAX_SCROLL_ROUNDS; i++) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(1500);
  }

  // Extract profile cards from the page
  const profiles = await page.evaluate(`
    (function() {
      var cells = document.querySelectorAll('[data-testid="UserCell"]');
      var results = [];

      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var result = { username: null, displayName: null, followers: null, bio: null };

        // Username from link
        var links = cell.querySelectorAll('a[href^="/"]');
        for (var j = 0; j < links.length; j++) {
          var href = links[j].getAttribute('href') || '';
          var match = href.match(/^\\/([A-Za-z0-9_]+)$/);
          if (match && !['home', 'explore', 'notifications', 'messages', 'settings', 'i'].includes(match[1])) {
            result.username = match[1];
            break;
          }
        }

        if (!result.username) continue;

        // Display name
        var nameEl = cell.querySelector('span');
        if (nameEl) result.displayName = (nameEl.textContent || '').trim();

        // Bio text
        var spans = cell.querySelectorAll('span');
        for (var k = 0; k < spans.length; k++) {
          var spanText = (spans[k].textContent || '').trim();
          if (spanText.length > 30 && spanText !== result.displayName) {
            result.bio = spanText.substring(0, 300);
            break;
          }
        }

        // Follower count from cell text
        var cellText = cell.textContent || '';
        var fMatch = cellText.match(/(\\d[\\d.,]*)\\s*([KMB])?\\s*(?:followers?)/i);
        if (fMatch) {
          var num = parseFloat(fMatch[1].replace(/,/g, ''));
          var suffix = (fMatch[2] || '').toUpperCase();
          if (suffix === 'K') num *= 1e3;
          else if (suffix === 'M') num *= 1e6;
          else if (suffix === 'B') num *= 1e9;
          result.followers = Math.round(num);
        }

        results.push(result);
      }

      return results;
    })()
  `);

  if (!profiles || profiles.length === 0) {
    await markHopped(supabase, campaign.id, sourceUsername, hopSources);
    return 0;
  }

  // Filter by target follower range and insert
  const rangeBounds = FOLLOWER_RANGE_BOUNDS[campaign.target_follower_range as FollowerRange];
  let discovered = 0;

  // Batch check which accounts already exist
  const usernames = profiles
    .filter((p: any) => p.username)
    .map((p: any) => p.username.toLowerCase());

  const { data: existingAccounts } = await supabase
    .from('brain_accounts')
    .select('username')
    .in('username', usernames);

  const existingSet = new Set((existingAccounts ?? []).map((a: any) => a.username.toLowerCase()));

  for (const profile of profiles) {
    if (!profile.username) continue;
    const username = profile.username.toLowerCase();

    if (existingSet.has(username)) continue;

    // Filter by follower range if we have the data
    if (profile.followers !== null && rangeBounds) {
      if (profile.followers < rangeBounds.min || profile.followers >= rangeBounds.max) {
        // Outside target range — still insert into brain_accounts but don't count toward campaign
        // (they're still valuable data, just not what this campaign is looking for)
        await insertDiscoveredAccount(supabase, username, profile, campaign.niche, sourceUsername);
        existingSet.add(username);
        continue;
      }
    }

    await insertDiscoveredAccount(supabase, username, profile, campaign.niche, sourceUsername);
    existingSet.add(username);
    discovered++;
  }

  // Mark this source as hopped
  await markHopped(supabase, campaign.id, sourceUsername, hopSources);

  return discovered;
}

async function insertDiscoveredAccount(
  supabase: any,
  username: string,
  profile: any,
  niche: string,
  discoveredFrom: string,
): Promise<void> {
  const followerRange = profile.followers !== null ? getFollowerRange(profile.followers) : null;

  await supabase.from('brain_accounts').upsert({
    username,
    display_name: profile.displayName || null,
    followers_count: profile.followers,
    bio_text: profile.bio || null,
    follower_range: followerRange,
    follower_range_at_first_snapshot: followerRange,
    primary_domain: niche,
    niche_cached: niche,
    discovery_method: 'seed',
    discovered_from_username: discoveredFrom,
    tier: 'C',
    scrape_priority: 0.3,
    is_active: true,
    next_census_at: new Date(Date.now() + Math.random() * 72 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'username' });
}

async function markHopped(
  supabase: any,
  campaignId: string,
  sourceUsername: string,
  currentHopSources: string[],
): Promise<void> {
  const updated = [...currentHopSources, sourceUsername];
  await supabase
    .from('brain_seed_campaigns')
    .update({
      hop_sources: updated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
}
