#!/usr/bin/env tsx
/**
 * 💬 REPLY CANARY POST - Post One Approved Draft
 * 
 * Posts one approved reply draft from content_metadata (status='draft').
 * Requires REPLIES_ENABLED=true and REPLIES_DRY_RUN=false.
 * 
 * Usage:
 *   REPLIES_ENABLED=true REPLIES_DRY_RUN=false \
 *   pnpm tsx scripts/ops/run-reply-post-once.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { UltimateTwitterPoster, createPostingGuard } from '../../src/posting/UltimateTwitterPoster';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import * as path from 'path';
import * as fs from 'fs';

const REPLIES_ENABLED = process.env.REPLIES_ENABLED === 'true';
const REPLIES_DRY_RUN = process.env.REPLIES_DRY_RUN !== 'false'; // Default true
const CANARY_MODE = process.env.CANARY_MODE !== 'false'; // Default true for this script

interface CanaryPostResult {
  mode: 'canary_post';
  draft_loaded: boolean;
  draft_id: string | null;
  posted: boolean;
  tweet_id: string | null;
  tweet_url: string | null;
  error: string | null;
  screenshot_path: string | null;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        💬 REPLY CANARY POST - SINGLE POST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!REPLIES_ENABLED) {
    console.log('⚠️  REPLIES_ENABLED=false, skipping reply posting');
    process.exit(0);
  }
  
  if (REPLIES_DRY_RUN) {
    console.log('⚠️  REPLIES_DRY_RUN=true, skipping actual posting (dry-run mode)');
    process.exit(0);
  }
  
  console.log(`[REPLY_CANARY] Configuration:`);
  console.log(`   REPLIES_ENABLED: ${REPLIES_ENABLED}`);
  console.log(`   REPLIES_DRY_RUN: ${REPLIES_DRY_RUN}`);
  console.log(`   CANARY_MODE: ${CANARY_MODE}\n`);
  
  const supabase = getSupabaseClient();
  const result: CanaryPostResult = {
    mode: 'canary_post',
    draft_loaded: false,
    draft_id: null,
    posted: false,
    tweet_id: null,
    tweet_url: null,
    error: null,
    screenshot_path: null,
  };
  
  // Load one approved draft (canary-eligible if CANARY_MODE)
  let draftQuery = supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });
  
  if (CANARY_MODE) {
    // Only select drafts with canary_eligible=true
    draftQuery = draftQuery.eq('features->canary_eligible', true);
  }
  
  const { data: drafts, error: draftError } = await draftQuery.limit(1);
  
  if (draftError) {
    result.error = `Failed to load drafts: ${draftError.message}`;
    console.error(`[REPLY_CANARY] ❌ ${result.error}`);
    console.log(JSON.stringify(result));
    process.exit(1);
  }
  
  if (!drafts || drafts.length === 0) {
    result.error = 'No drafts found';
    console.log(`[REPLY_CANARY] ⚠️  ${result.error}`);
    console.log(`[REPLY_CANARY] 💡 Run run-reply-dry-run.ts first to generate drafts`);
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  
  const draft = drafts[0];
  result.draft_loaded = true;
  result.draft_id = draft.decision_id;
  
  console.log(`[REPLY_CANARY] 📋 Loaded draft:`);
  console.log(`   Decision ID: ${draft.decision_id}`);
  console.log(`   Target Tweet: ${draft.target_tweet_id}`);
  console.log(`   Target User: @${draft.target_username}`);
  console.log(`   Content: ${(draft.content || '').substring(0, 100)}...\n`);
  
  // Verify target tweet still exists and hasn't been replied to
  const { data: existingReply } = await supabase
    .from('content_metadata')
    .select('tweet_id')
    .eq('decision_type', 'reply')
    .eq('target_tweet_id', draft.target_tweet_id)
    .eq('status', 'posted')
    .limit(1)
    .single();
  
  if (existingReply?.tweet_id) {
    result.error = `Already replied to tweet ${draft.target_tweet_id}`;
    console.log(`[REPLY_CANARY] ⚠️  ${result.error}`);
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  
  // Post reply
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('canary_reply_post');
  const proofDir = path.join(process.cwd(), 'docs', 'proofs', 'reply', `canary-${Date.now()}`);
  fs.mkdirSync(proofDir, { recursive: true });
  
  try {
    const poster = new UltimateTwitterPoster(page);
    
    // Create posting guard using factory function
    const guard = createPostingGuard({
      decision_id: draft.decision_id || '',
      pipeline_source: 'canary_post',
      job_run_id: `canary-${Date.now()}`,
    });
    
    console.log(`[REPLY_CANARY] 🚀 Posting reply...\n`);
    
    const postResult = await poster.postReply(
      draft.content || '',
      draft.target_tweet_id || '',
      guard
    );
    
    if (!postResult.success || !postResult.tweetId) {
      result.error = postResult.error || 'Post failed';
      console.error(`[REPLY_CANARY] ❌ Post failed: ${result.error}`);
      console.log(JSON.stringify(result));
      process.exit(1);
    }
    
    result.posted = true;
    result.tweet_id = postResult.tweetId;
    result.tweet_url = postResult.tweetUrl || `https://x.com/i/status/${postResult.tweetId}`;
    
    console.log(`[REPLY_CANARY] ✅ Reply posted successfully!`);
    console.log(`   Tweet ID: ${result.tweet_id}`);
    console.log(`   Tweet URL: ${result.tweet_url}\n`);
    
    // Update draft status to 'posted'
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({
        status: 'posted',
        tweet_id: result.tweet_id,
        posted_at: new Date().toISOString(),
      })
      .eq('decision_id', draft.decision_id);
    
    if (updateError) {
      console.warn(`[REPLY_CANARY] ⚠️  Failed to update draft status: ${updateError.message}`);
    }
    
    // Mark opportunity as replied
    if (draft.target_tweet_id) {
      await supabase
        .from('reply_opportunities')
        .update({
          replied_to: true,
          reply_decision_id: draft.decision_id,
          replied_at: new Date().toISOString(),
        })
        .eq('tweet_id', draft.target_tweet_id);
    }
    
    // Take screenshot
    try {
      const screenshotPath = path.join(proofDir, 'posted.png');
      await page.screenshot({ path: screenshotPath, fullPage: false });
      result.screenshot_path = screenshotPath;
      
      const htmlPath = path.join(proofDir, 'posted.html');
      const html = await page.content();
      fs.writeFileSync(htmlPath, html);
      
      console.log(`[REPLY_CANARY] 📸 Proof artifacts saved to ${proofDir}`);
    } catch (screenshotError) {
      console.warn(`[REPLY_CANARY] ⚠️  Failed to save screenshot: ${screenshotError}`);
    }
    
  } catch (error: any) {
    result.error = error.message || 'Unknown error';
    console.error(`[REPLY_CANARY] ❌ Fatal error: ${result.error}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await pool.releasePage(page);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(JSON.stringify(result));
  
  if (result.posted) {
    console.log(`\n✅ SUCCESS: Reply posted (canary)`);
    process.exit(0);
  } else {
    console.log(`\n❌ FAILED: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
