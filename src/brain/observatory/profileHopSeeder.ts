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
const MAX_SCROLL_ROUNDS = 5;

export async function runProfileHopSeeder(): Promise<{
  campaigns_processed: number;
  accounts_discovered: number;
}> {
  const supabase = getSupabaseClient();
  let campaignsProcessed = 0;
  let accountsDiscovered = 0;

  // Get active campaigns with seed accounts available
  const { data: campaigns } = await supabase
    .from('brain_seed_campaigns')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(MAX_CAMPAIGNS_PER_RUN);

  if (!campaigns || campaigns.length === 0) {
    return { campaigns_processed: 0, accounts_discovered: 0 };
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
