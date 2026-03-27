/**
 * Census Worker
 *
 * Browser-based job that processes the census queue. For each account:
 * 1. Navigate to profile (anonymous)
 * 2. Extract follower count
 * 3. Store snapshot in brain_account_snapshots
 * 4. Update brain_accounts with latest data
 *
 * Uses the BrainBrowserPool for parallel scraping.
 * Each census check takes ~3 seconds.
 */

import { getSupabaseClient } from '../../db';
import { submitTask, submitBatch } from '../feeds/brainBrowserPool';
import { brainGoto } from '../feeds/brainNavigator';
import { censusQueue } from './censusScheduler';

const LOG_PREFIX = '[observatory/census-worker]';
const BATCH_SIZE = 10; // Process 10 accounts per cycle

export async function runCensusWorker(): Promise<{ checked: number; errors: number }> {
  if (censusQueue.length === 0) {
    return { checked: 0, errors: 0 };
  }

  // Take a batch from the queue
  const batch = censusQueue.splice(0, BATCH_SIZE);
  let checked = 0;
  let errors = 0;

  const supabase = getSupabaseClient();

  // Create tasks for parallel execution
  const tasks = batch.map(username => async (page: any) => {
    try {
      const profileUrl = `https://x.com/${username}`;
      const nav = await brainGoto(page, profileUrl, 15000);

      if (!nav.success) {
        errors++;
        return;
      }

      // Extract follower and following counts
      const metrics = await page.evaluate(`
        (function() {
          var result = { followers: null, following: null, bio: null };

          // Get all link elements that might contain follower/following counts
          var links = document.querySelectorAll('a[href*="/followers"], a[href*="/following"], a[href*="/verified_followers"]');

          for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            var text = links[i].textContent || '';

            // Parse the number
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

          // Fallback: check body text for "X Followers" pattern
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

          // Bio text
          var bioEl = document.querySelector('[data-testid="UserDescription"]');
          if (bioEl) {
            result.bio = (bioEl.textContent || '').trim().substring(0, 500);
          }

          return result;
        })()
      `);

      if (metrics.followers === null) {
        // Profile might be private, suspended, or doesn't exist
        errors++;
        return;
      }

      // Get previous follower count for delta
      const { data: existing } = await supabase
        .from('brain_accounts')
        .select('followers_count, first_snapshot_at')
        .eq('username', username)
        .single();

      const prevFollowers = existing?.followers_count ?? null;
      const isFirstSnapshot = !existing?.first_snapshot_at;

      // Insert snapshot
      await supabase.from('brain_account_snapshots').insert({
        username,
        followers_count: metrics.followers,
        following_count: metrics.following,
        bio_text: metrics.bio,
        checked_at: new Date().toISOString(),
      });

      // Update brain_accounts
      const updateData: Record<string, any> = {
        followers_count: metrics.followers,
        following_count: metrics.following,
        prev_followers_count: prevFollowers,
        latest_snapshot_at: new Date().toISOString(),
        last_census_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isFirstSnapshot) {
        updateData.first_snapshot_at = new Date().toISOString();
      }

      if (metrics.bio) {
        updateData.bio_text = metrics.bio;
      }

      // Compute FF ratio
      if (metrics.followers && metrics.following && metrics.following > 0) {
        updateData.ff_ratio = Math.round((metrics.followers / metrics.following) * 100) / 100;
      }

      await supabase
        .from('brain_accounts')
        .update(updateData)
        .eq('username', username);

      // Increment snapshot count
      try {
        await supabase.rpc('increment_brain_account_snapshot_count', { p_username: username });
      } catch {
        // RPC may not exist — just increment manually
        const { data: acct } = await supabase
          .from('brain_accounts')
          .select('snapshot_count')
          .eq('username', username)
          .single();

        if (acct) {
          await supabase
            .from('brain_accounts')
            .update({ snapshot_count: (acct.snapshot_count ?? 0) + 1 })
            .eq('username', username);
        }
      }

      checked++;
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error checking @${username}: ${err.message}`);
      errors++;
    }
  });

  // Execute all tasks through the browser pool
  const result = await submitBatch('high', tasks);

  if (checked > 0 || errors > 0) {
    console.log(`${LOG_PREFIX} Census: ${checked} checked, ${errors} errors, ${censusQueue.length} remaining in queue`);
  }

  return { checked: result.completed, errors: result.errors };
}
