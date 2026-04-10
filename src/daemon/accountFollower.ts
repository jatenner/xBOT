import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const FOLLOWS_PER_SESSION = 3; // Follow 3 per daemon tick (human-like pace)
const FOLLOWED_TRACKER_FILE = 'followed_accounts.json';

interface FollowedTracker {
  accounts: string[];
  last_updated: string;
}

function loadTracker(profileDir: string): FollowedTracker {
  const filePath = path.join(profileDir, FOLLOWED_TRACKER_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return { accounts: [], last_updated: new Date().toISOString() };
}

function saveTracker(profileDir: string, tracker: FollowedTracker) {
  const filePath = path.join(profileDir, FOLLOWED_TRACKER_FILE);
  try {
    fs.writeFileSync(filePath, JSON.stringify(tracker, null, 2));
  } catch {}
}

/**
 * Follow a few accounts each session. Continuous — never "done."
 * Tracks who we've already followed to avoid re-visiting profiles.
 * New accounts added to curated_accounts by the scraper's discovery
 * will automatically get followed on future ticks.
 */
export async function followNewAccounts(page: Page, profileDir: string): Promise<number> {
  const tracker = loadTracker(profileDir);
  const alreadyFollowed = new Set(tracker.accounts);

  // Get accounts from DB
  let accounts: string[] = [];
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('curated_accounts')
      .select('username')
      .eq('enabled', true)
      .limit(200);
    accounts = (data || []).map((a: any) => a.username).filter(Boolean);
  } catch (e: any) {
    console.warn(`[FOLLOW] DB query failed: ${e.message}`);
    const handles = process.env.REPLY_CURATED_HANDLES || '';
    accounts = handles.split(',').map(h => h.trim()).filter(Boolean);
  }

  // Find accounts we haven't followed yet
  const unfollowed = accounts.filter(a => !alreadyFollowed.has(a));

  if (unfollowed.length === 0) {
    console.log(`[FOLLOW] All ${accounts.length} accounts already followed`);
    return 0;
  }

  console.log(`[FOLLOW] ${unfollowed.length} accounts to follow (${alreadyFollowed.size} already done)`);

  // Follow a batch this session
  let followed = 0;
  for (const username of unfollowed.slice(0, FOLLOWS_PER_SESSION)) {
    try {
      await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500 + Math.random() * 2000);

      // Check if already following
      const followingBtn = page.locator('[data-testid$="-unfollow"]').first();
      if (await followingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[FOLLOW] Already following @${username}`);
        tracker.accounts.push(username);
        continue;
      }

      // Click follow
      const followBtn = page.locator('[data-testid$="-follow"]').first();
      if (await followBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await followBtn.click({ delay: 50 + Math.random() * 100 });
        followed++;
        tracker.accounts.push(username);
        console.log(`[FOLLOW] ✅ Followed @${username} (${followed}/${FOLLOWS_PER_SESSION})`);
        await page.waitForTimeout(3000 + Math.random() * 5000);
      } else {
        // Button not found — mark as attempted anyway
        tracker.accounts.push(username);
      }
    } catch (err: any) {
      console.warn(`[FOLLOW] ⚠️ Failed @${username}: ${err.message}`);
      tracker.accounts.push(username); // Don't retry forever
    }
  }

  tracker.last_updated = new Date().toISOString();
  saveTracker(profileDir, tracker);

  if (followed > 0) {
    console.log(`[FOLLOW] Followed ${followed} new accounts this session (${tracker.accounts.length}/${accounts.length} total)`);
  }
  return followed;
}
