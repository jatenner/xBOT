/**
 * Brain Feed: Google-Based Account Discovery
 *
 * Discovers Twitter/X accounts by searching Google for "site:x.com [niche keywords]".
 * Google indexes millions of Twitter profiles — no Twitter login needed.
 *
 * Each run:
 * 1. Pick next batch of niche search queries from rotation
 * 2. Search Google for each query
 * 3. Extract x.com/username URLs from results
 * 4. Deduplicate against existing brain_accounts
 * 5. Insert new accounts
 *
 * This is the primary mass-discovery mechanism for anonymous operation.
 * Expected: 50-200 new accounts per run, 12 runs/hr = 600-2,400/day.
 */

import { getSupabaseClient } from '../../db';
import { upsertBrainAccounts } from '../db';
import { getBrainPage, brainGoto } from './brainNavigator';

const LOG_PREFIX = '[brain/feed/google-discovery]';

// Rotating search queries across many niches and sub-niches
// Each query finds ~10-20 Twitter accounts via Google
const DISCOVERY_QUERIES = [
  // Health sub-niches
  'site:x.com nutrition expert',
  'site:x.com fitness coach tips',
  'site:x.com longevity biohacking',
  'site:x.com mental health therapist',
  'site:x.com sleep science',
  'site:x.com supplements health',
  'site:x.com gut health microbiome',
  'site:x.com hormone optimization',
  'site:x.com neuroscience brain',
  'site:x.com weight loss diet',
  'site:x.com yoga meditation mindfulness',
  'site:x.com skincare dermatology',

  // Tech sub-niches
  'site:x.com AI machine learning engineer',
  'site:x.com startup founder SaaS',
  'site:x.com web developer programming',
  'site:x.com cybersecurity hacker',
  'site:x.com data science analytics',
  'site:x.com product manager tech',
  'site:x.com devops cloud engineer',
  'site:x.com indie hacker builder',

  // Finance sub-niches
  'site:x.com investing stocks portfolio',
  'site:x.com real estate investor',
  'site:x.com personal finance budget',
  'site:x.com crypto trading analysis',
  'site:x.com wealth building millionaire',
  'site:x.com day trading options',

  // Business sub-niches
  'site:x.com entrepreneur business owner',
  'site:x.com marketing growth hacking',
  'site:x.com copywriting content creator',
  'site:x.com ecommerce dropshipping',
  'site:x.com sales prospecting B2B',
  'site:x.com freelancer consultant',
  'site:x.com branding social media',

  // Personal development
  'site:x.com productivity habits morning routine',
  'site:x.com self improvement mindset',
  'site:x.com stoicism philosophy',
  'site:x.com career advice job',
  'site:x.com public speaking communication',
  'site:x.com book recommendations reading',

  // Science
  'site:x.com physics researcher professor',
  'site:x.com biology genetics CRISPR',
  'site:x.com climate change environment',
  'site:x.com space astronomy NASA',

  // Culture / Lifestyle
  'site:x.com food cooking chef',
  'site:x.com travel photography',
  'site:x.com parenting family',
  'site:x.com fashion style',

  // Politics / News
  'site:x.com political analyst commentary',
  'site:x.com journalist reporter breaking',

  // Sports
  'site:x.com sports analytics stats',
  'site:x.com MMA UFC fighter',
  'site:x.com basketball NBA analysis',

  // Humor / Entertainment
  'site:x.com comedian funny tweets',
  'site:x.com memes humor viral',
];

let queryRotationIndex = 0;
const QUERIES_PER_RUN = 5;
const DELAY_BETWEEN_QUERIES_MS = 3000; // Be polite to Google

export async function runGoogleDiscovery(): Promise<{
  accounts_discovered: number;
  queries_searched: number;
}> {
  const supabase = getSupabaseClient();
  let totalDiscovered = 0;
  let queriesSearched = 0;

  // Pick next batch of queries from rotation
  const queries: string[] = [];
  for (let i = 0; i < QUERIES_PER_RUN; i++) {
    queries.push(DISCOVERY_QUERIES[queryRotationIndex % DISCOVERY_QUERIES.length]);
    queryRotationIndex++;
  }

  let page: any;
  try {
    page = await getBrainPage(); // Anonymous browser — Google doesn't need auth
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to get browser page: ${err.message}`);
    return { accounts_discovered: 0, queries_searched: 0 };
  }

  try {
    for (const query of queries) {
      try {
        // Search Google
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
        const nav = await brainGoto(page, googleUrl, 15000);
        if (!nav.success) {
          console.warn(`${LOG_PREFIX} Google navigation failed for: ${query}`);
          continue;
        }

        // Wait for results to load
        try {
          await page.waitForSelector('#search', { timeout: 8000 });
        } catch {
          // Google might use different selectors or show captcha
          console.warn(`${LOG_PREFIX} No search results found for: ${query}`);
          continue;
        }

        // Extract x.com and twitter.com URLs from search results
        const usernames: string[] = await page.evaluate(`
          (function() {
            var results = [];
            var links = document.querySelectorAll('a[href]');
            for (var i = 0; i < links.length; i++) {
              var href = links[i].getAttribute('href') || '';
              // Match x.com/username or twitter.com/username
              var match = href.match(/(?:x\\.com|twitter\\.com)\\/([a-zA-Z0-9_]{1,15})(?:\\/|$|\\?)/);
              if (match) {
                var username = match[1].toLowerCase();
                // Skip Twitter system pages
                if (['home', 'explore', 'search', 'notifications', 'messages', 'settings', 'i', 'login',
                     'signup', 'tos', 'privacy', 'about', 'help', 'status', 'intent'].indexOf(username) === -1) {
                  results.push(username);
                }
              }
            }
            // Deduplicate
            return Array.from(new Set(results));
          })()
        `);

        if (usernames.length === 0) {
          console.log(`${LOG_PREFIX} "${query}": 0 usernames found`);
          queriesSearched++;
          continue;
        }

        // Batch check which accounts already exist
        const { data: existing } = await supabase
          .from('brain_accounts')
          .select('username')
          .in('username', usernames);

        const existingSet = new Set((existing ?? []).map((a: any) => a.username));
        const newUsernames = usernames.filter(u => !existingSet.has(u));

        if (newUsernames.length > 0) {
          // Extract niche hint from the query
          const nicheHint = query
            .replace('site:x.com', '')
            .replace(/"/g, '')
            .trim()
            .split(' ')[0] || null;

          const newAccounts = newUsernames.map(username => ({
            username,
            discovery_method: 'seed' as const,
            discovered_from_username: null,
            tier: 'C' as const,
            is_active: true,
            scrape_priority: 0.3,
            growth_status: 'unknown',
            next_census_at: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          }));

          const added = await upsertBrainAccounts(newAccounts);
          totalDiscovered += added;
          console.log(`${LOG_PREFIX} "${query}": ${usernames.length} found, ${added} NEW accounts added`);
        } else {
          console.log(`${LOG_PREFIX} "${query}": ${usernames.length} found, all already tracked`);
        }

        queriesSearched++;

        // Delay between queries to avoid Google rate limiting
        await page.waitForTimeout(DELAY_BETWEEN_QUERIES_MS);

      } catch (err: any) {
        console.error(`${LOG_PREFIX} Query error for "${query}": ${err.message}`);
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  if (totalDiscovered > 0) {
    console.log(`${LOG_PREFIX} Total: ${totalDiscovered} new accounts from ${queriesSearched} Google searches`);
  }

  return { accounts_discovered: totalDiscovered, queries_searched: queriesSearched };
}
