/**
 * Truth Repair Script
 * 
 * Auto-repairs SALVAGEABLE rows (tweet IDs exist but status=failed/retry)
 * ONLY runs when ENABLE_TRUTH_AUTO_REPAIR=true (default false)
 * 
 * Optionally verifies tweets exist on X before flipping status
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ENABLE_AUTO_REPAIR = process.env.ENABLE_TRUTH_AUTO_REPAIR === 'true';
const VERIFY_ON_X = process.env.TRUTH_REPAIR_VERIFY_X === 'true';
const TIME_WINDOW_HOURS = parseInt(process.env.TRUTH_VERIFY_HOURS || '24', 10);

interface SalvageableDecision {
  decision_id: string;
  tweet_id: string;
  thread_tweet_ids: string | null;
  status: string;
}

/**
 * Find salvageable decisions
 */
async function findSalvageable(): Promise<SalvageableDecision[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  
  const supabase = createClient(url, key);
  const cutoffTime = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, thread_tweet_ids, status')
    .gte('updated_at', cutoffTime)
    .or('status.eq.failed,status.ilike.%retry%')
    .not('tweet_id', 'is', null);
  
  if (error) {
    throw new Error(`Failed to query salvageable: ${error.message}`);
  }
  
  return data as SalvageableDecision[];
}

/**
 * Verify tweet exists on X (optional)
 */
async function verifyTweetExists(tweetId: string): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    // Load session if available
    const sessionB64 = process.env.TWITTER_SESSION_B64;
    if (sessionB64) {
      const sessionJson = Buffer.from(sessionB64, 'base64').toString('utf-8');
      const session = JSON.parse(sessionJson);
      await context.addCookies(session.cookies || []);
    }
    
    const page = await context.newPage();
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
    
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const bodyText = await page.textContent('body').catch(() => '');
    const exists = !bodyText.includes('unavailable') && 
                   !bodyText.includes('not found') &&
                   !bodyText.includes('doesn\'t exist');
    
    await browser.close();
    return exists;
  } catch (err: any) {
    console.warn(`[TRUTH_REPAIR] ⚠️ Failed to verify ${tweetId}: ${err.message}`);
    return false; // If verification fails, don't repair
  }
}

/**
 * Repair salvageable decision
 */
async function repairDecision(d: SalvageableDecision, verifyFirst: boolean): Promise<{ success: boolean; reason: string }> {
  // Verify on X if requested
  if (verifyFirst) {
    const exists = await verifyTweetExists(d.tweet_id);
    if (!exists) {
      return { success: false, reason: 'tweet_not_found_on_x' };
    }
  }
  
  // Update status to 'posted' and mark as reconciled
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return { success: false, reason: 'missing_credentials' };
  }
  
  const supabase = createClient(url, key);
  
  const { error } = await supabase
    .from('content_metadata')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      reconciled_at: new Date().toISOString(),
      reconciled_from: 'truth_repair_auto',
      updated_at: new Date().toISOString()
    })
    .eq('decision_id', d.decision_id);
  
  if (error) {
    return { success: false, reason: error.message };
  }
  
  return { success: true, reason: 'repaired' };
}

/**
 * Main repair function
 */
async function repairTruthViolations(): Promise<void> {
  console.log('[TRUTH_REPAIR] Starting truth violation repair...');
  console.log(`[TRUTH_REPAIR] Auto-repair enabled: ${ENABLE_AUTO_REPAIR}`);
  console.log(`[TRUTH_REPAIR] X verification: ${VERIFY_ON_X}`);
  console.log(`[TRUTH_REPAIR] Time window: last ${TIME_WINDOW_HOURS} hours`);
  
  if (!ENABLE_AUTO_REPAIR) {
    console.error('[TRUTH_REPAIR] ❌ Auto-repair is DISABLED');
    console.error('[TRUTH_REPAIR] Set ENABLE_TRUTH_AUTO_REPAIR=true to enable');
    process.exit(1);
  }
  
  // Find salvageable decisions
  const salvageable = await findSalvageable();
  console.log(`[TRUTH_REPAIR] Found ${salvageable.length} salvageable decisions`);
  
  if (salvageable.length === 0) {
    console.log('[TRUTH_REPAIR] ✅ No salvageable decisions found');
    return;
  }
  
  // Repair each decision
  let repaired = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const d of salvageable) {
    console.log(`[TRUTH_REPAIR] Processing ${d.decision_id.substring(0, 8)}... (tweet_id=${d.tweet_id})`);
    
    const result = await repairDecision(d, VERIFY_ON_X);
    
    if (result.success) {
      repaired++;
      console.log(`[TRUTH_REPAIR] ✅ Repaired ${d.decision_id.substring(0, 8)}...`);
    } else if (result.reason === 'tweet_not_found_on_x') {
      skipped++;
      console.log(`[TRUTH_REPAIR] ⏭️ Skipped ${d.decision_id.substring(0, 8)}... (tweet not found on X)`);
    } else {
      failed++;
      console.error(`[TRUTH_REPAIR] ❌ Failed ${d.decision_id.substring(0, 8)}...: ${result.reason}`);
    }
  }
  
  console.log('');
  console.log('='.repeat(70));
  console.log('[TRUTH_REPAIR] REPAIR COMPLETE');
  console.log(`  Repaired: ${repaired}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log('='.repeat(70));
}

// Run if called directly
if (require.main === module) {
  repairTruthViolations()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('[TRUTH_REPAIR] Fatal error:', err);
      process.exit(1);
    });
}

export { repairTruthViolations };

