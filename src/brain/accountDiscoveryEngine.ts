/**
 * Brain: Account Discovery Engine
 *
 * Autonomously discovers new accounts to track from:
 * 1. Viral tweet authors — any author whose tweet crosses viral threshold
 * 2. Mentioned accounts — @mentions in high-engagement tweets
 * 3. High-engagement reply authors — people whose replies get lots of likes
 *
 * Runs every 30 minutes, processes recent brain_tweets.
 */

import { getSupabaseClient } from '../db';
import { upsertBrainAccounts } from './db';
import { submitTask } from './feeds/brainBrowserPool';
import { brainGoto } from './feeds/brainNavigator';
import type { AccountDiscoveryMethod } from './types';

const LOG_PREFIX = '[brain/account-discovery]';

const VIRAL_LIKES_THRESHOLD = 50;  // Lower threshold to discover more accounts
const HIGH_ENGAGEMENT_REPLY_LIKES = 20;
const BATCH_SIZE = 50;
const MAX_IMMEDIATE_CENSUS = 20; // Max accounts to census immediately on discovery

interface DiscoveredAccount {
  username: string;
  followers_count: number | null;
  discovery_method: AccountDiscoveryMethod;
  discovered_from_username: string | null;
}

export async function runAccountDiscovery(): Promise<{ accounts_discovered: number }> {
  const supabase = getSupabaseClient();
  const discovered: DiscoveredAccount[] = [];
  const seenUsernames = new Set<string>();

  // 1. Viral author capture — authors of high-engagement tweets not yet in brain_accounts
  try {
    const { data: viralTweets } = await supabase
      .from('brain_tweets')
      .select('author_username, author_followers')
      .gte('likes', VIRAL_LIKES_THRESHOLD)
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (viralTweets) {
      for (const tweet of viralTweets) {
        const username = tweet.author_username?.toLowerCase();
        if (!username || seenUsernames.has(username)) continue;
        seenUsernames.add(username);

        discovered.push({
          username,
          followers_count: tweet.author_followers,
          discovery_method: 'viral_author',
          discovered_from_username: null,
        });
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Viral author capture error:`, err.message);
  }

  // 2. Mentioned accounts — extract @mentions from high-engagement tweets
  try {
    const { data: mentionTweets } = await supabase
      .from('brain_tweets')
      .select('content, author_username')
      .gte('likes', 50)
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    if (mentionTweets) {
      for (const tweet of mentionTweets) {
        const mentions = (tweet.content || '').match(/@([a-zA-Z0-9_]{1,15})/g) || [];
        for (const mention of mentions) {
          const username = mention.replace('@', '').toLowerCase();
          if (seenUsernames.has(username)) continue;
          seenUsernames.add(username);

          discovered.push({
            username,
            followers_count: null, // Will be populated on first scrape
            discovery_method: 'mention',
            discovered_from_username: tweet.author_username,
          });
        }
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Mention extraction error:`, err.message);
  }

  // 3. Accounts that appear frequently in brain_tweets (prolific posters)
  try {
    const { data: frequentAuthors } = await supabase
      .from('brain_tweets')
      .select('author_username, author_followers')
      .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('likes', { ascending: false })
      .limit(200);

    if (frequentAuthors) {
      // Count appearances
      const counts: Record<string, { count: number; followers: number | null }> = {};
      for (const tweet of frequentAuthors) {
        const u = tweet.author_username?.toLowerCase();
        if (!u) continue;
        if (!counts[u]) counts[u] = { count: 0, followers: tweet.author_followers };
        counts[u].count++;
      }

      // Add accounts that appear 3+ times
      for (const [username, { count, followers }] of Object.entries(counts)) {
        if (count >= 3 && !seenUsernames.has(username)) {
          seenUsernames.add(username);
          discovered.push({
            username,
            followers_count: followers,
            discovery_method: 'viral_author',
            discovered_from_username: null,
          });
        }
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Frequent author extraction error:`, err.message);
  }

  // Filter out accounts already in brain_accounts
  if (discovered.length > 0) {
    const usernames = discovered.map(d => d.username);
    const { data: existing } = await supabase
      .from('brain_accounts')
      .select('username')
      .in('username', usernames);

    const existingSet = new Set((existing ?? []).map(e => e.username));
    const newAccounts = discovered.filter(d => !existingSet.has(d.username));

    if (newAccounts.length > 0) {
      // Batch upsert
      let totalAdded = 0;
      for (let i = 0; i < newAccounts.length; i += BATCH_SIZE) {
        const chunk = newAccounts.slice(i, i + BATCH_SIZE).map(a => ({
          username: a.username,
          followers_count: a.followers_count,
          discovery_method: a.discovery_method,
          discovered_from_username: a.discovered_from_username,
          tier: 'C' as const,
          is_active: true,
          scrape_priority: 0.3,
          growth_status: 'unknown',
          next_census_at: new Date().toISOString(), // Census immediately
        }));
        totalAdded += await upsertBrainAccounts(chunk);
      }

      console.log(`${LOG_PREFIX} Discovered ${totalAdded} new accounts (${discovered.length} candidates, ${existingSet.size} already tracked)`);

      // IMMEDIATE CENSUS: Visit profiles of new accounts that don't have follower counts
      // Every account needs a baseline follower count from day one.
      const needsBaseline = newAccounts
        .filter(a => !a.followers_count)
        .slice(0, MAX_IMMEDIATE_CENSUS);

      if (needsBaseline.length > 0) {
        let baselined = 0;
        for (const account of needsBaseline) {
          try {
            await submitTask('high', async (page) => {
              const nav = await brainGoto(page, `https://x.com/${account.username}`, 15000);
              if (!nav.success) return;

              const metrics = await page.evaluate(`
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
              `);

              const m = metrics as { followers: number | null; following: number | null };
              if (m.followers !== null) {
                // Update account with baseline
                await supabase
                  .from('brain_accounts')
                  .update({
                    followers_count: m.followers,
                    following_count: m.following,
                    ff_ratio: m.following && m.following > 0 ? Math.round((m.followers! / m.following) * 100) / 100 : null,
                    first_snapshot_at: new Date().toISOString(),
                    latest_snapshot_at: new Date().toISOString(),
                    last_census_at: new Date().toISOString(),
                    snapshot_count: 1,
                  })
                  .eq('username', account.username);

                // Store first snapshot
                await supabase.from('brain_account_snapshots').insert({
                  username: account.username,
                  followers_count: m.followers,
                  following_count: m.following,
                  checked_at: new Date().toISOString(),
                });

                baselined++;
              }
            });
          } catch {
            // Non-fatal — census will catch it later
          }
        }

        if (baselined > 0) {
          console.log(`${LOG_PREFIX} Baselined ${baselined}/${needsBaseline.length} new accounts with follower counts`);
        }
      }

      return { accounts_discovered: totalAdded };
    }
  }

  console.log(`${LOG_PREFIX} No new accounts discovered this run`);
  return { accounts_discovered: 0 };
}
