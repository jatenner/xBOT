#!/usr/bin/env tsx
/**
 * 🔧 BACKFILL POST_SUCCESS EVENTS
 * 
 * Finds content_metadata rows where status='posted' and tweet_id is not null
 * but there is no POST_SUCCESS system_event for that decision_id.
 * Inserts the missing POST_SUCCESS events (idempotent).
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔧 BACKFILL POST_SUCCESS EVENTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Find posted content without POST_SUCCESS events
  const { data: postedContent, error: queryError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, tweet_id, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false });
  
  if (queryError) {
    console.error(`❌ Error querying content_metadata: ${queryError.message}`);
    process.exit(1);
  }
  
  if (!postedContent || postedContent.length === 0) {
    console.log('✅ No posted content found');
    process.exit(0);
  }
  
  console.log(`📊 Found ${postedContent.length} posted content items\n`);
  
  // Check which ones are missing POST_SUCCESS events
  const missingEvents: typeof postedContent = [];
  
  for (const content of postedContent) {
    const { data: existingEvent } = await supabase
      .from('system_events')
      .select('id')
      .eq('event_type', 'POST_SUCCESS')
      .eq('event_data->>decision_id', content.decision_id)
      .maybeSingle();
    
    if (!existingEvent) {
      missingEvents.push(content);
    }
  }
  
  console.log(`📊 Missing POST_SUCCESS events: ${missingEvents.length} out of ${postedContent.length}\n`);
  
  if (missingEvents.length === 0) {
    console.log('✅ All posted content has POST_SUCCESS events - no backfill needed');
    process.exit(0);
  }
  
  // Backfill missing events
  console.log(`🔄 Backfilling ${missingEvents.length} missing POST_SUCCESS events...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const content of missingEvents) {
    try {
      const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
      const tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${content.tweet_id}`;
      
      // Check again (idempotency - another process might have inserted it)
      const { data: checkEvent } = await supabase
        .from('system_events')
        .select('id')
        .eq('event_type', 'POST_SUCCESS')
        .eq('event_data->>decision_id', content.decision_id)
        .maybeSingle();
      
      if (checkEvent) {
        console.log(`⏭️  decision_id=${content.decision_id} already has POST_SUCCESS, skipping`);
        continue;
      }
      
      const { error: insertError } = await supabase.from('system_events').insert({
        event_type: 'POST_SUCCESS',
        severity: 'info',
        message: `Content posted successfully (backfilled): decision_id=${content.decision_id} tweet_id=${content.tweet_id}`,
        event_data: {
          decision_id: content.decision_id,
          tweet_id: content.tweet_id,
          tweet_url: tweetUrl,
          decision_type: content.decision_type || 'unknown',
          app_version: appVersion,
          posted_at: content.posted_at || new Date().toISOString(),
          backfilled: true,
          backfilled_at: new Date().toISOString(),
        },
        created_at: content.posted_at || new Date().toISOString(), // Use original posted_at if available
      });
      
      if (insertError) {
        console.error(`❌ Failed to backfill decision_id=${content.decision_id}: ${insertError.message}`);
        errorCount++;
      } else {
        console.log(`✅ Backfilled: decision_id=${content.decision_id} tweet_id=${content.tweet_id}`);
        successCount++;
      }
    } catch (error: any) {
      console.error(`❌ Error backfilling decision_id=${content.decision_id}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 BACKFILL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Total posted content: ${postedContent.length}`);
  console.log(`Missing POST_SUCCESS: ${missingEvents.length}`);
  console.log(`✅ Successfully backfilled: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}\n`);
  
  if (errorCount > 0) {
    console.log('⚠️  Some events failed to backfill - check logs above');
    process.exit(1);
  } else {
    console.log('✅ Backfill complete - all missing events created');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
