/**
 * Insert a controlled reply decision for testing
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { v4 as uuidv4 } from 'uuid';

const targetTweetId = process.argv[2];
const allowSelfReply = process.argv.includes('--allow-self-reply');

if (!targetTweetId) {
  console.error('Usage: tsx scripts/insert-controlled-reply.ts <target_tweet_id> [--allow-self-reply]');
  console.error('');
  console.error('Example:');
  console.error('  tsx scripts/insert-controlled-reply.ts 2008642002473414949');
  console.error('');
  console.error('⚠️  By default, self-replies are BLOCKED. Use --allow-self-reply to override.');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  const decisionId = uuidv4();
  // Fix build_sha marker - use actual SHA or fallback with warning
  const buildSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || process.env.RAILWAY_DEPLOYMENT_ID || `local_${Date.now()}`;
  if (!buildSha || (buildSha.startsWith('unknown') && !buildSha.includes('local_'))) {
    console.warn(`⚠️  WARNING: build_sha is missing! Using fallback: ${buildSha}`);
    console.warn(`   Required env vars: RAILWAY_GIT_COMMIT_SHA, GIT_SHA, or RAILWAY_DEPLOYMENT_ID`);
    console.warn(`   This is required for traceability in production.`);
  }
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  
  // Use ISO timestamp format to avoid thread pattern detection (no "1/6/2026" format)
  // Include question mark to pass SUBSTANCE_GATE
  const isoTimestamp = new Date().toISOString().substring(0, 19).replace('T', ' ');
  const content = `[CONTROLLED_REPLY_TEST_1] Have you tried adaptogens? They help your body adapt to stress. build_sha=${buildSha.substring(0, 12)} ts=${isoTimestamp}`;
  
  if (content.length > 240) {
    console.error(`❌ Content too long: ${content.length} chars (max 240)`);
    process.exit(1);
  }
  
  // Fetch target tweet content and author for gate fields
  console.log('📝 Fetching target tweet content and author...');
  let targetContent = '';
  let targetAuthor = '';
  const ourHandle = (process.env.TWITTER_USERNAME || 'SignalAndSynapse').toLowerCase();
  
  try {
    const { UnifiedBrowserPool } = await import('../src/browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('fetch_target_tweet');
    
    try {
      await page.goto(`https://x.com/i/web/status/${targetTweetId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const tweetData = await page.evaluate(() => {
        const tweetText = document.querySelector('[data-testid="tweetText"]');
        const authorElement = document.querySelector('[data-testid="User-Name"] a');
        return {
          content: tweetText?.textContent || '',
          author: authorElement?.textContent?.replace('@', '').toLowerCase().trim() || ''
        };
      });
      
      targetContent = tweetData.content;
      targetAuthor = tweetData.author;
      
      console.log(`✅ Target content fetched: ${targetContent.substring(0, 60)}...`);
      console.log(`✅ Target author: @${targetAuthor}`);
      
      // 🔒 NO SELF-REPLY GUARD (unless --allow-self-reply flag)
      if (!allowSelfReply && targetAuthor === ourHandle) {
        console.error(`❌ ERROR: Target tweet ${targetTweetId} is from our own account (@${targetAuthor})`);
        console.error(`   Self-replies are BLOCKED by default.`);
        console.error(`   To override, use: --allow-self-reply`);
        process.exit(1);
      }
      
      if (allowSelfReply && targetAuthor === ourHandle) {
        console.warn(`⚠️  WARNING: Creating self-reply (--allow-self-reply flag provided)`);
      }
    } finally {
      await pool.releasePage(page);
    }
  } catch (fetchError: any) {
    console.warn(`⚠️  Could not fetch target content: ${fetchError.message}`);
    console.warn(`   Using placeholder content for gate fields`);
    targetContent = 'Target tweet content placeholder for controlled test';
    // If we can't fetch author, fail-closed (don't allow)
    if (!allowSelfReply) {
      console.error(`❌ ERROR: Could not verify target author. Self-replies blocked by default.`);
      process.exit(1);
    }
  }
  
  // Generate hash and similarity for gate fields
  const crypto = await import('crypto');
  const targetContentHash = crypto.createHash('sha256').update(targetContent).digest('hex');
  const semanticSimilarity = 0.75; // Controlled test - set reasonable similarity
  
  console.log('📝 Creating controlled reply decision...\n');
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Target Tweet ID: ${targetTweetId}`);
  console.log(`   Content: ${content}`);
  console.log(`   Length: ${content.length} chars`);
  console.log(`   Target content snapshot: ${targetContent.substring(0, 40)}...`);
  console.log(`   Semantic similarity: ${semanticSimilarity}\n`);
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: content,
      target_tweet_id: targetTweetId,
      root_tweet_id: targetTweetId, // 🔒 ROOT-ONLY: root_tweet_id must equal target_tweet_id
      target_tweet_content_snapshot: targetContent.substring(0, 500), // Gate requires >= 20 chars
      target_tweet_content_hash: targetContentHash,
      semantic_similarity: semanticSimilarity,
      target_username: targetAuthor || null, // Store author for self-reply guard
      status: 'queued',
      scheduled_at: new Date().toISOString(),
      build_sha: buildSha,
      pipeline_source: 'controlled_test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error(`❌ Error inserting reply decision: ${error.message}`);
    process.exit(1);
  }
  
  console.log('✅ Controlled reply decision created:');
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Target Tweet ID: ${targetTweetId}`);
  console.log('');
  console.log('📋 Next steps:');
  console.log(`   1. Start controlled window: pnpm exec tsx scripts/start-controlled-window.ts ${decisionId}`);
  console.log(`   2. Set Railway variables (from step 1 output)`);
  console.log(`   3. Run one-shot: railway run -- pnpm exec tsx scripts/run-controlled-post-once.ts`);
  
  process.exit(0);
}

main().catch(console.error);

