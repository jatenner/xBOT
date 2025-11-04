/**
 * 🔄 BACKFILL REPLY IDS JOB
 * 
 * Finds replies with placeholder IDs and backfills them with real tweet IDs
 * by scraping the account's timeline.
 * 
 * Runs periodically to fix any replies that failed ID extraction during posting.
 */

import { getSupabaseClient } from '../db';
import { getBrowser, createContext } from '../browser/browserFactory';
import { ImprovedReplyIdExtractor } from '../posting/ImprovedReplyIdExtractor';

export async function backfillReplyIds(): Promise<void> {
  console.log('[BACKFILL] 🔄 Starting reply ID backfill job...');
  
  const supabase = getSupabaseClient();
  
  try {
    // Step 1: Find replies with placeholder IDs
    const { data: placeholderReplies, error } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, target_tweet_id, target_username, posted_at, content')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .like('tweet_id', 'reply_posted_%') // Placeholder pattern
      .order('posted_at', { ascending: false })
      .limit(50); // Process 50 at a time

    if (error) {
      console.error('[BACKFILL] ❌ Failed to query placeholder replies:', error);
      return;
    }

    if (!placeholderReplies || placeholderReplies.length === 0) {
      console.log('[BACKFILL] ✅ No placeholder IDs found - all replies have real IDs!');
      return;
    }

    console.log(`[BACKFILL] 📋 Found ${placeholderReplies.length} replies with placeholder IDs`);

    // Step 2: Setup browser for scraping
    const browser = await getBrowser();
    const context = await createContext(browser);
    const page = await context.newPage();

    let backfilled = 0;
    let failed = 0;

    // Step 3: Process each placeholder reply
    for (const reply of placeholderReplies) {
      try {
        console.log(`[BACKFILL] 🔍 Processing reply ${reply.decision_id}...`);
        console.log(`[BACKFILL]   Target: @${reply.target_username}`);
        console.log(`[BACKFILL]   Placeholder: ${reply.tweet_id}`);

        // Use profile scraping strategy to find the real tweet ID
        const extractionResult = await ImprovedReplyIdExtractor.extractReplyId(
          page,
          reply.target_tweet_id,
          15000 // 15 second timeout for backfill
        );

        if (extractionResult.success && extractionResult.tweetId) {
          // Verify it's not still a placeholder
          if (!extractionResult.tweetId.startsWith('reply_posted_')) {
            console.log(`[BACKFILL] ✅ Found real ID: ${extractionResult.tweetId}`);

            // Update database with real ID
            const { error: updateError } = await supabase
              .from('content_metadata')
              .update({
                tweet_id: extractionResult.tweetId,
                tweet_url: `https://x.com/i/status/${extractionResult.tweetId}`
              })
              .eq('decision_id', reply.decision_id);

            if (updateError) {
              console.error(`[BACKFILL] ❌ Failed to update database:`, updateError);
              failed++;
            } else {
              console.log(`[BACKFILL] ✅ Successfully backfilled ID for ${reply.decision_id}`);
              backfilled++;

              // Also update posted_decisions if it exists
              await supabase
                .from('posted_decisions')
                .update({ tweet_id: extractionResult.tweetId })
                .eq('decision_id', reply.decision_id);
            }
          } else {
            console.warn(`[BACKFILL] ⚠️ Extraction returned another placeholder, skipping`);
            failed++;
          }
        } else {
          console.warn(`[BACKFILL] ⚠️ Could not find real ID for ${reply.decision_id}`);
          failed++;
        }

        // Small delay between backfills
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`[BACKFILL] ❌ Error processing ${reply.decision_id}:`, error.message);
        failed++;
      }
    }

    // Cleanup
    await page.close();
    await context.close();

    // Step 4: Report results
    console.log('\n[BACKFILL] 📊 BACKFILL COMPLETE:');
    console.log(`  • Total processed: ${placeholderReplies.length}`);
    console.log(`  • Successfully backfilled: ${backfilled}`);
    console.log(`  • Failed: ${failed}`);
    console.log(`  • Remaining placeholders: ${placeholderReplies.length - backfilled}\n`);

    // If we backfilled some, log to metrics
    if (backfilled > 0) {
      await supabase
        .from('system_events')
        .insert({
          event_type: 'backfill_reply_ids',
          event_data: {
            backfilled,
            failed,
            total: placeholderReplies.length
          },
          created_at: new Date().toISOString()
        })
        .then(() => {
          console.log('[BACKFILL] 📝 Logged backfill event to system_events');
        })
        .catch(() => {
          // Ignore if table doesn't exist
        });
    }

  } catch (error: any) {
    console.error('[BACKFILL] ❌ Backfill job failed:', error.message);
    throw error;
  }
}

/**
 * Get count of replies with placeholder IDs
 */
export async function getPlaceholderCount(): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .like('tweet_id', 'reply_posted_%');
  
  return count || 0;
}

