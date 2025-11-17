#!/usr/bin/env tsx
/**
 * Count how many tweets the system has recovered/scraped from Twitter
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function countRecoveredTweets() {
  const supabase = getSupabaseClient();

  console.log('🔍 Counting recovered tweets from Twitter...\n');

  try {
    // Total tweets with tweet_id (posted to Twitter)
    const { count: totalPosted, error: postedError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .not('tweet_id', 'is', null);

    if (postedError) throw postedError;

    // Tweets with metrics scraped (recovered from Twitter)
    const { count: withMetrics, error: metricsError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .not('tweet_id', 'is', null)
      .not('actual_impressions', 'is', null);

    if (metricsError) throw metricsError;

    // Breakdown by type
    const { data: byType, error: typeError } = await supabase
      .from('content_metadata')
      .select('decision_type, tweet_id, actual_impressions')
      .not('tweet_id', 'is', null);

    if (typeError) throw typeError;

    const breakdown = {
      single: { total: 0, withMetrics: 0 },
      reply: { total: 0, withMetrics: 0 },
      thread: { total: 0, withMetrics: 0 }
    };

    (byType || []).forEach((tweet: any) => {
      const type = tweet.decision_type || 'unknown';
      if (type in breakdown) {
        breakdown[type as keyof typeof breakdown].total++;
        if (tweet.actual_impressions !== null) {
          breakdown[type as keyof typeof breakdown].withMetrics++;
        }
      }
    });

    // Tweets scraped in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentScraped, error: recentError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .not('tweet_id', 'is', null)
      .not('actual_impressions', 'is', null)
      .gte('updated_at', sevenDaysAgo);

    if (recentError) throw recentError;

    // Total content in database
    const { count: totalContent, error: totalError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    console.log('📊 RECOVERED TWEETS SUMMARY\n');
    console.log(`Total content in database: ${totalContent}`);
    console.log(`Tweets posted to Twitter: ${totalPosted}`);
    console.log(`Tweets with metrics recovered: ${withMetrics} (${Math.round((withMetrics / (totalPosted || 1)) * 100)}% of posted)`);
    console.log(`Tweets scraped in last 7 days: ${recentScraped}\n`);

    console.log('📋 BREAKDOWN BY TYPE:\n');
    console.log(`Single Posts:`);
    console.log(`  - Total posted: ${breakdown.single.total}`);
    console.log(`  - With metrics: ${breakdown.single.withMetrics} (${Math.round((breakdown.single.withMetrics / (breakdown.single.total || 1)) * 100)}%)`);
    
    console.log(`\nReplies:`);
    console.log(`  - Total posted: ${breakdown.reply.total}`);
    console.log(`  - With metrics: ${breakdown.reply.withMetrics} (${Math.round((breakdown.reply.withMetrics / (breakdown.reply.total || 1)) * 100)}%)`);
    
    console.log(`\nThreads:`);
    console.log(`  - Total posted: ${breakdown.thread.total}`);
    console.log(`  - With metrics: ${breakdown.thread.withMetrics} (${Math.round((breakdown.thread.withMetrics / (breakdown.thread.total || 1)) * 100)}%)`);

    console.log(`\n✅ Total tweets recovered from Twitter: ${withMetrics}`);

  } catch (error: any) {
    console.error('❌ Error counting tweets:', error.message);
    process.exit(1);
  }
}

countRecoveredTweets();

