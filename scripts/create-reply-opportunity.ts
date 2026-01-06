/**
 * Create a reply_opportunities entry for controlled testing
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const targetTweetId = process.argv[2];

if (!targetTweetId) {
  console.error('Usage: tsx scripts/create-reply-opportunity.ts <target_tweet_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  console.log(`📝 Creating reply_opportunities entry for tweet ${targetTweetId}...\n`);
  
  // Fetch target tweet content
  let targetContent = '';
  try {
    const { UnifiedBrowserPool } = await import('../src/browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('fetch_target_tweet');
    
    try {
      await page.goto(`https://x.com/i/web/status/${targetTweetId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      targetContent = await page.evaluate(() => {
        const tweetText = document.querySelector('[data-testid="tweetText"]');
        return tweetText?.textContent || '';
      });
      
      console.log(`✅ Target content fetched: ${targetContent.substring(0, 60)}...`);
    } finally {
      await pool.releasePage(page, 'fetch_target_tweet');
    }
  } catch (fetchError: any) {
    console.warn(`⚠️  Could not fetch target content: ${fetchError.message}`);
    targetContent = 'Target tweet content placeholder';
  }
  
  // Fetch target username
  let targetUsername = 'SignalAndSynapse'; // Default to our account
  try {
    const { UnifiedBrowserPool } = await import('../src/browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('fetch_target_username');
    
    try {
      await page.goto(`https://x.com/i/web/status/${targetTweetId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      targetUsername = await page.evaluate(() => {
        const authorElement = document.querySelector('[data-testid="User-Name"] a');
        return authorElement?.textContent?.replace('@', '') || 'SignalAndSynapse';
      });
      
      console.log(`✅ Target username fetched: @${targetUsername}`);
    } finally {
      await pool.releasePage(page, 'fetch_target_username');
    }
  } catch (fetchError: any) {
    console.warn(`⚠️  Could not fetch target username: ${fetchError.message}`);
  }
  
  const targetTweetUrl = `https://x.com/${targetUsername}/status/${targetTweetId}`;
  
  const { data, error } = await supabase
    .from('reply_opportunities')
    .upsert({
      target_tweet_id: targetTweetId,
      target_tweet_content: targetContent,
      target_username: targetUsername,
      target_tweet_url: targetTweetUrl,
      is_root_tweet: true, // Controlled test - verified root tweet
      tweet_posted_at: new Date().toISOString(),
      like_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'target_tweet_id'
    })
    .select()
    .single();
  
  if (error) {
    console.error(`❌ Error creating reply opportunity: ${error.message}`);
    process.exit(1);
  }
  
  console.log('✅ Reply opportunity created:');
  console.log(`   Target Tweet ID: ${targetTweetId}`);
  console.log(`   Is Root Tweet: ${data.is_root_tweet}`);
  console.log(`   Content: ${targetContent.substring(0, 60)}...`);
  
  process.exit(0);
}

main().catch(console.error);

