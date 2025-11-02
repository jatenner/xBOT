/**
 * 🔍 FIND MISSING TWEET IDs
 * 
 * Finds posts/replies that are status='posted' but have placeholder tweet_ids
 * Uses Twitter profile scraping + content matching to find real IDs
 * 
 * This is a self-healing mechanism that ensures ALL posts get real tweet IDs
 * even if immediate extraction fails due to Twitter lag, browser issues, etc.
 */

import { getSupabaseClient } from '../db/index';

export async function findMissingTweetIds(): Promise<void> {
  console.log('[FIND_MISSING_IDS] 🔍 Starting search for placeholder tweet IDs...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Find posts/replies with placeholder IDs posted in last 24 hours
    const { data: placeholders, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, decision_type, content, tweet_id, posted_at, target_tweet_id')
      .eq('status', 'posted')
      .or('tweet_id.like.posted_%,tweet_id.like.reply_%')
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('[FIND_MISSING_IDS] ❌ Database query failed:', error.message);
      return;
    }
    
    if (!placeholders || placeholders.length === 0) {
      console.log('[FIND_MISSING_IDS] ✅ No placeholders found - all IDs extracted!');
      return;
    }
    
    console.log(`[FIND_MISSING_IDS] 📋 Found ${placeholders.length} posts with placeholder IDs`);
    
    // Import scraper (use browser to scrape profile)
    const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
    const { BulletproofTweetExtractor } = await import('../utils/bulletproofTweetExtractor');
    
    let foundCount = 0;
    let failedCount = 0;
    
    for (const post of placeholders) {
      try {
        const isReply = post.decision_type === 'reply';
        const content = String(post.content || '');
        const contentPreview = content.substring(0, 40);
        
        console.log(`[FIND_MISSING_IDS] 🔍 Finding ID for ${isReply ? 'reply' : 'post'}: "${contentPreview}..."`);
        console.log(`[FIND_MISSING_IDS] 📝 Current placeholder: ${post.tweet_id}`);
        
        // Use UltimateTwitterPoster to create a browser context
        const poster = new UltimateTwitterPoster();
        await (poster as any).ensureContext();
        const page = (poster as any).page;
        
        if (!page) {
          console.error('[FIND_MISSING_IDS] ❌ No browser page available');
          failedCount++;
          continue;
        }
        
        // Use BulletproofTweetExtractor to find the tweet by content
        const extraction = await BulletproofTweetExtractor.extractTweetId(page, {
          expectedContent: content,
          expectedUsername: process.env.TWITTER_USERNAME || 'SignalAndSynapse',
          maxAgeSeconds: 86400, // 24 hours
          navigateToVerify: true
        });
        
        await poster.dispose();
        
        if (extraction.success && extraction.tweetId) {
          // Verify it's not the placeholder
          if (extraction.tweetId !== post.tweet_id && 
              !extraction.tweetId.startsWith('posted_') && 
              !extraction.tweetId.startsWith('reply_')) {
            
            console.log(`[FIND_MISSING_IDS] ✅ Found real ID: ${extraction.tweetId}`);
            console.log(`[FIND_MISSING_IDS] 🔄 Replacing: ${post.tweet_id}`);
            
            // Update database with real ID
            const { error: updateError } = await supabase
              .from('content_metadata')
              .update({ tweet_id: extraction.tweetId })
              .eq('decision_id', post.decision_id);
            
            if (updateError) {
              console.error(`[FIND_MISSING_IDS] ❌ Failed to update database:`, updateError.message);
              failedCount++;
            } else {
              console.log(`[FIND_MISSING_IDS] 💾 Database updated successfully`);
              foundCount++;
            }
          } else {
            console.log(`[FIND_MISSING_IDS] ⚠️ Extracted ID is still placeholder or same as current`);
            failedCount++;
          }
        } else {
          console.log(`[FIND_MISSING_IDS] ❌ Extraction failed: ${extraction.error || 'Unknown error'}`);
          failedCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        console.error(`[FIND_MISSING_IDS] ❌ Error processing post: ${error.message}`);
        failedCount++;
      }
    }
    
    console.log(`[FIND_MISSING_IDS] ✅ Completed: ${foundCount} IDs found, ${failedCount} failed`);
    
  } catch (error: any) {
    console.error('[FIND_MISSING_IDS] ❌ Job failed:', error.message);
  }
}

