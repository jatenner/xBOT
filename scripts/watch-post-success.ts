#!/usr/bin/env tsx
/**
 * 🔔 WATCH POST SUCCESS NOTIFIER
 * 
 * Polls system_events for POST_SUCCESS events and prints tweet URLs.
 * Supports webhook notification if POST_SUCCESS_WEBHOOK_URL is set.
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/watch-post-success.ts --minutes=120 --once
 *   railway run -s xBOT -- pnpm exec tsx scripts/watch-post-success.ts --minutes=60 --pollSeconds=30
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

interface PostSuccessEvent {
  decision_id: string;
  target_tweet_id: string;
  posted_reply_tweet_id: string;
  tweet_url: string;
  created_at: string;
  app_version?: string;
}

async function sendWebhook(event: PostSuccessEvent): Promise<void> {
  const webhookUrl = process.env.POST_SUCCESS_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'POST_SUCCESS',
        tweet_url: event.tweet_url,
        posted_reply_tweet_id: event.posted_reply_tweet_id,
        target_tweet_id: event.target_tweet_id,
        decision_id: event.decision_id,
        created_at: event.created_at,
        app_version: event.app_version,
      }),
    });
    
    if (!response.ok) {
      console.warn(`⚠️  Webhook POST failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`✅ Webhook notification sent`);
    }
  } catch (error: any) {
    console.warn(`⚠️  Webhook error: ${error.message}`);
  }
}

async function main() {
  const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.split('=')[1];
  const pollSecondsArg = process.argv.find(arg => arg.startsWith('--pollSeconds='))?.split('=')[1];
  const onceFlag = process.argv.includes('--once');
  
  const minutes = parseInt(minutesArg || '60', 10);
  const pollSeconds = parseInt(pollSecondsArg || '30', 10);
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔔 POST SUCCESS NOTIFIER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Looking for POST_SUCCESS events newer than: ${cutoffTime}`);
  console.log(`Poll interval: ${pollSeconds} seconds`);
  console.log(`Mode: ${onceFlag ? 'once (exit after first check)' : 'continuous polling'}\n`);
  
  if (process.env.POST_SUCCESS_WEBHOOK_URL) {
    console.log(`✅ Webhook enabled: ${process.env.POST_SUCCESS_WEBHOOK_URL}\n`);
  }
  
  const supabase = getSupabaseClient();
  const seenIds = new Set<string>();
  
  while (true) {
    // Query POST_SUCCESS events
    const { data: successEvents, error } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'POST_SUCCESS')
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error(`❌ Error querying system_events: ${error.message}`);
      if (onceFlag) process.exit(1);
      await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
      continue;
    }
    
    if (!successEvents || successEvents.length === 0) {
      console.log(`[${new Date().toISOString()}] No POST_SUCCESS events found (newer than ${cutoffTime})`);
      if (onceFlag) {
        console.log('Exiting (--once flag set)\n');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
      continue;
    }
    
    // Process events (newest first)
    const newEvents: PostSuccessEvent[] = [];
    
    for (const event of successEvents) {
      const eventData = typeof event.event_data === 'string'
        ? JSON.parse(event.event_data)
        : event.event_data;
      
      const postedTweetId = eventData.posted_reply_tweet_id || eventData.tweet_id;
      if (!postedTweetId) continue;
      
      const eventId = `${event.created_at}_${postedTweetId}`;
      if (seenIds.has(eventId)) continue; // Already seen
      
      seenIds.add(eventId);
      
      const tweetUrl = eventData.tweet_url || `https://x.com/i/status/${postedTweetId}`;
      
      newEvents.push({
        decision_id: eventData.decision_id || 'N/A',
        target_tweet_id: eventData.target_tweet_id || 'N/A',
        posted_reply_tweet_id: postedTweetId,
        tweet_url: tweetUrl,
        created_at: event.created_at,
        app_version: eventData.app_version,
      });
    }
    
    if (newEvents.length > 0) {
      // Sort by created_at (newest first)
      newEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log(`\n✅ Found ${newEvents.length} new POST_SUCCESS event(s):\n`);
      
      // Print newest 5
      const toPrint = newEvents.slice(0, 5);
      for (const event of toPrint) {
        console.log(`🎯 Tweet URL: ${event.tweet_url}`);
        console.log(`   Posted at: ${event.created_at}`);
        console.log(`   Decision ID: ${event.decision_id}`);
        console.log(`   Target Tweet ID: ${event.target_tweet_id}`);
        console.log(`   Posted Reply Tweet ID: ${event.posted_reply_tweet_id}`);
        if (event.app_version) {
          console.log(`   App Version: ${event.app_version}`);
        }
        console.log('');
        
        // Send webhook if configured
        await sendWebhook(event);
      }
      
      if (newEvents.length > 5) {
        console.log(`   ... and ${newEvents.length - 5} more\n`);
      }
      
      // Exit if --once flag
      if (onceFlag) {
        console.log('✅ POST_SUCCESS found - exiting (--once flag set)\n');
        process.exit(0);
      }
    } else {
      console.log(`[${new Date().toISOString()}] No new POST_SUCCESS events`);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
