#!/usr/bin/env tsx
/**
 * Count how many tweets the VI scraper has recovered from other Twitter accounts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function countVIScrapedTweets() {
  const supabase = getSupabaseClient();

  console.log('🔍 Counting VI scraper recovered tweets from other accounts...\n');

  try {
    // Total tweets scraped
    const { count: totalScraped, error: totalError } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Tweets with real view data (not estimated)
    const { count: withRealViews, error: viewsError } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true })
      .gt('views', 0);

    if (viewsError) throw viewsError;

    // Breakdown by tier
    const { data: byTier, error: tierError } = await supabase
      .from('vi_collected_tweets')
      .select('tier, views, engagement_rate, author_username')
      .gt('views', 0);

    if (tierError) throw tierError;

    const tierBreakdown: Record<string, { total: number; avgViews: number; avgER: number }> = {};
    
    (byTier || []).forEach((tweet: any) => {
      const tier = tweet.tier || 'unknown';
      if (!tierBreakdown[tier]) {
        tierBreakdown[tier] = { total: 0, avgViews: 0, avgER: 0 };
      }
      tierBreakdown[tier].total++;
    });

    // Calculate averages
    Object.keys(tierBreakdown).forEach(tier => {
      const tweets = (byTier || []).filter((t: any) => (t.tier || 'unknown') === tier);
      const totalViews = tweets.reduce((sum: number, t: any) => sum + (t.views || 0), 0);
      const totalER = tweets.reduce((sum: number, t: any) => sum + (t.engagement_rate || 0), 0);
      tierBreakdown[tier].avgViews = Math.round(totalViews / tweets.length);
      tierBreakdown[tier].avgER = totalER / tweets.length;
    });

    // Tweets scraped in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentScraped, error: recentError } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_at', sevenDaysAgo);

    if (recentError) throw recentError;

    // Unique accounts scraped
    const { data: uniqueAccounts, error: accountsError } = await supabase
      .from('vi_collected_tweets')
      .select('author_username')
      .gt('views', 0);

    if (accountsError) throw accountsError;

    const accountSet = new Set((uniqueAccounts || []).map((a: any) => a.author_username).filter(Boolean));
    const uniqueAccountCount = accountSet.size;

    // Classification status
    const { count: classified, error: classifiedError } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true })
      .eq('classified', true);

    if (classifiedError) throw classifiedError;

    // Analysis status
    const { count: analyzed, error: analyzedError } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true })
      .eq('analyzed', true);

    if (analyzedError) throw analyzedError;

    // Top performing tweets
    const { data: topTweets, error: topError } = await supabase
      .from('vi_collected_tweets')
      .select('author_username, content, views, likes, engagement_rate, viral_multiplier')
      .gt('views', 0)
      .order('engagement_rate', { ascending: false })
      .limit(5);

    if (topError) throw topError;

    console.log('📊 VI SCRAPER RECOVERED TWEETS SUMMARY\n');
    console.log(`Total tweets scraped: ${totalScraped}`);
    console.log(`Tweets with real view data: ${withRealViews} (${Math.round((withRealViews / (totalScraped || 1)) * 100)}%)`);
    console.log(`Tweets scraped in last 7 days: ${recentScraped}`);
    console.log(`Unique accounts scraped: ${uniqueAccountCount}`);
    console.log(`Tweets classified by AI: ${classified} (${Math.round((classified / (totalScraped || 1)) * 100)}%)`);
    console.log(`Tweets analyzed for patterns: ${analyzed} (${Math.round((analyzed / (totalScraped || 1)) * 100)}%)\n`);

    console.log('📋 BREAKDOWN BY TIER:\n');
    Object.keys(tierBreakdown).sort().forEach(tier => {
      const stats = tierBreakdown[tier];
      console.log(`${tier}:`);
      console.log(`  - Total tweets: ${stats.total}`);
      console.log(`  - Avg views: ${stats.avgViews.toLocaleString()}`);
      console.log(`  - Avg engagement rate: ${(stats.avgER * 100).toFixed(2)}%`);
    });

    if (topTweets && topTweets.length > 0) {
      console.log('\n🔥 TOP 5 PERFORMING TWEETS:\n');
      topTweets.forEach((tweet: any, idx: number) => {
        const preview = (tweet.content || '').substring(0, 60).replace(/\n/g, ' ');
        console.log(`${idx + 1}. @${tweet.author_username}`);
        console.log(`   "${preview}${preview.length >= 60 ? '...' : ''}"`);
        console.log(`   Views: ${tweet.views?.toLocaleString() || 0} | ER: ${((tweet.engagement_rate || 0) * 100).toFixed(2)}% | Viral: ${((tweet.viral_multiplier || 0) * 100).toFixed(1)}%`);
        console.log('');
      });
    }

    console.log(`\n✅ Total tweets recovered from other accounts: ${withRealViews}`);

  } catch (error: any) {
    console.error('❌ Error counting VI tweets:', error.message);
    process.exit(1);
  }
}

countVIScrapedTweets();






