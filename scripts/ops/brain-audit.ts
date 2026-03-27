/**
 * Brain Audit — Full overnight analysis
 * Usage: npx tsx scripts/ops/brain-audit.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';

async function main() {
  const s = getSupabaseClient();

  console.log('\n' + '='.repeat(70));
  console.log('🧠 BRAIN SYSTEM v2 — OVERNIGHT AUDIT');
  console.log('='.repeat(70));

  // 1. Total counts
  const { count: tweetCount } = await s.from('brain_tweets').select('id', { count: 'exact', head: true });
  const { count: accountCount } = await s.from('brain_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { count: keywordCount } = await s.from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { count: classCount } = await s.from('brain_classifications').select('id', { count: 'exact', head: true });

  console.log(`\n📊 TOTALS:`);
  console.log(`   Tweets: ${tweetCount}`);
  console.log(`   Accounts: ${accountCount}`);
  console.log(`   Keywords: ${keywordCount}`);
  console.log(`   Classifications: ${classCount}`);

  // 2. Top tweets by engagement
  console.log(`\n🏆 TOP 20 TWEETS BY LIKES:`);
  const { data: topTweets } = await s.from('brain_tweets')
    .select('tweet_id, author_username, likes, retweets, replies, content, discovery_source, discovery_keyword, author_followers, engagement_rate')
    .order('likes', { ascending: false })
    .limit(20);

  for (const t of topTweets ?? []) {
    const content = (t.content || '').substring(0, 80).replace(/\n/g, ' ');
    console.log(`   ${String(t.likes).padStart(6)} likes | @${t.author_username.padEnd(18)} | [${t.discovery_source}] "${content}..."`);
  }

  // 3. Source breakdown
  console.log(`\n📡 SOURCE PERFORMANCE:`);
  const { data: allTweets } = await s.from('brain_tweets').select('discovery_source, likes, retweets, author_followers');
  const sources: Record<string, { count: number; totalLikes: number; maxLikes: number; avgFollowers: number; followerCount: number }> = {};
  for (const t of allTweets ?? []) {
    const src = t.discovery_source;
    if (!sources[src]) sources[src] = { count: 0, totalLikes: 0, maxLikes: 0, avgFollowers: 0, followerCount: 0 };
    sources[src].count++;
    sources[src].totalLikes += t.likes ?? 0;
    sources[src].maxLikes = Math.max(sources[src].maxLikes, t.likes ?? 0);
    if (t.author_followers) {
      sources[src].avgFollowers += t.author_followers;
      sources[src].followerCount++;
    }
  }
  for (const [src, data] of Object.entries(sources).sort((a, b) => b[1].count - a[1].count)) {
    const avgLikes = data.count > 0 ? Math.round(data.totalLikes / data.count) : 0;
    const avgFollowers = data.followerCount > 0 ? Math.round(data.avgFollowers / data.followerCount) : 0;
    console.log(`   ${src.padEnd(16)} | ${String(data.count).padStart(5)} tweets | avg ${String(avgLikes).padStart(5)} likes | max ${String(data.maxLikes).padStart(6)} likes | avg followers ${avgFollowers}`);
  }

  // 4. Top keywords by tweet volume
  console.log(`\n🔑 TOP KEYWORDS BY VOLUME:`);
  const { data: kwTweets } = await s.from('brain_tweets').select('discovery_keyword, likes').not('discovery_keyword', 'is', null);
  const kwStats: Record<string, { count: number; totalLikes: number; maxLikes: number }> = {};
  for (const t of kwTweets ?? []) {
    const kw = t.discovery_keyword;
    if (!kwStats[kw]) kwStats[kw] = { count: 0, totalLikes: 0, maxLikes: 0 };
    kwStats[kw].count++;
    kwStats[kw].totalLikes += t.likes ?? 0;
    kwStats[kw].maxLikes = Math.max(kwStats[kw].maxLikes, t.likes ?? 0);
  }
  const sortedKw = Object.entries(kwStats).sort((a, b) => b[1].count - a[1].count).slice(0, 20);
  for (const [kw, data] of sortedKw) {
    const avgLikes = data.count > 0 ? Math.round(data.totalLikes / data.count) : 0;
    console.log(`   "${kw}".padEnd(35) | ${String(data.count).padStart(4)} tweets | avg ${String(avgLikes).padStart(4)} likes | max ${data.maxLikes}`);
  }

  // 5. Engagement distribution
  console.log(`\n📈 ENGAGEMENT DISTRIBUTION:`);
  const { data: engDist } = await s.from('brain_tweets').select('likes');
  const buckets = { '0': 0, '1-10': 0, '11-100': 0, '101-1K': 0, '1K-10K': 0, '10K-100K': 0, '100K+': 0 };
  for (const t of engDist ?? []) {
    const l = t.likes ?? 0;
    if (l === 0) buckets['0']++;
    else if (l <= 10) buckets['1-10']++;
    else if (l <= 100) buckets['11-100']++;
    else if (l <= 1000) buckets['101-1K']++;
    else if (l <= 10000) buckets['1K-10K']++;
    else if (l <= 100000) buckets['10K-100K']++;
    else buckets['100K+']++;
  }
  for (const [bucket, count] of Object.entries(buckets)) {
    const pct = tweetCount ? ((count / (tweetCount as number)) * 100).toFixed(1) : 0;
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(buckets)) * 30));
    console.log(`   ${bucket.padEnd(10)} | ${String(count).padStart(5)} (${String(pct).padStart(5)}%) ${bar}`);
  }

  // 6. Account tier distribution
  console.log(`\n👥 ACCOUNT TIERS:`);
  const { data: tierData } = await s.from('brain_accounts').select('tier, followers_count, avg_engagement_rate_30d').eq('is_active', true);
  const tiers: Record<string, { count: number; totalFollowers: number; hasFollowers: number }> = {};
  for (const a of tierData ?? []) {
    if (!tiers[a.tier]) tiers[a.tier] = { count: 0, totalFollowers: 0, hasFollowers: 0 };
    tiers[a.tier].count++;
    if (a.followers_count) {
      tiers[a.tier].totalFollowers += a.followers_count;
      tiers[a.tier].hasFollowers++;
    }
  }
  for (const tier of ['S', 'A', 'B', 'C', 'dormant']) {
    const d = tiers[tier];
    if (!d) continue;
    const avgF = d.hasFollowers > 0 ? Math.round(d.totalFollowers / d.hasFollowers) : 0;
    console.log(`   ${tier}-tier: ${d.count} accounts (avg ${avgF.toLocaleString()} followers)`);
  }

  // 7. Keyword pool health
  console.log(`\n🔑 KEYWORD POOL HEALTH:`);
  const { data: kwPool } = await s.from('brain_keywords').select('keyword, source, priority, search_count, avg_engagement_found, tweets_found_total, is_active');
  const bySrc: Record<string, number> = {};
  for (const k of kwPool ?? []) {
    bySrc[k.source] = (bySrc[k.source] ?? 0) + 1;
  }
  console.log(`   By source: ${Object.entries(bySrc).map(([s, c]) => `${s}:${c}`).join(', ')}`);
  console.log(`   Active: ${(kwPool ?? []).filter(k => k.is_active).length}`);
  console.log(`   Searched at least once: ${(kwPool ?? []).filter(k => k.search_count > 0).length}`);

  // Top performing keywords
  const searched = (kwPool ?? []).filter(k => k.search_count > 0 && k.avg_engagement_found != null);
  searched.sort((a, b) => (b.avg_engagement_found ?? 0) - (a.avg_engagement_found ?? 0));
  if (searched.length > 0) {
    console.log(`   Top by avg engagement:`);
    for (const k of searched.slice(0, 10)) {
      console.log(`     "${k.keyword}" — avg ${Math.round(k.avg_engagement_found ?? 0)} likes, ${k.tweets_found_total ?? 0} total tweets, searched ${k.search_count}x [${k.source}]`);
    }
  }

  // 8. Unique authors
  console.log(`\n✍️  UNIQUE AUTHORS:`);
  const { data: authors } = await s.from('brain_tweets').select('author_username').limit(10000);
  const uniqueAuthors = new Set((authors ?? []).map(a => a.author_username));
  console.log(`   ${uniqueAuthors.size} unique authors across ${tweetCount} tweets`);

  // Top authors by tweet count
  const authorCounts: Record<string, number> = {};
  for (const a of authors ?? []) {
    authorCounts[a.author_username] = (authorCounts[a.author_username] ?? 0) + 1;
  }
  const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`   Most scraped:`);
  for (const [author, count] of topAuthors) {
    console.log(`     @${author}: ${count} tweets`);
  }

  // 9. Ratios analysis (engagement quality signals)
  console.log(`\n📐 ENGAGEMENT RATIOS (avg across all tweets):`);
  const { data: ratios } = await s.from('brain_tweets')
    .select('like_to_view_ratio, bookmark_to_like_ratio, reply_to_like_ratio, retweet_to_like_ratio, engagement_rate, viral_multiplier')
    .not('engagement_rate', 'is', null)
    .limit(5000);

  if (ratios && ratios.length > 0) {
    const avgER = ratios.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / ratios.length;
    const avgBTL = ratios.filter(r => r.bookmark_to_like_ratio != null).reduce((s, r) => s + (r.bookmark_to_like_ratio ?? 0), 0) / (ratios.filter(r => r.bookmark_to_like_ratio != null).length || 1);
    const avgRTL = ratios.filter(r => r.reply_to_like_ratio != null).reduce((s, r) => s + (r.reply_to_like_ratio ?? 0), 0) / (ratios.filter(r => r.reply_to_like_ratio != null).length || 1);
    const avgRetweetL = ratios.filter(r => r.retweet_to_like_ratio != null).reduce((s, r) => s + (r.retweet_to_like_ratio ?? 0), 0) / (ratios.filter(r => r.retweet_to_like_ratio != null).length || 1);

    console.log(`   Avg engagement rate: ${(avgER * 100).toFixed(2)}%`);
    console.log(`   Avg bookmark/like ratio: ${avgBTL.toFixed(3)} (higher = save-worthy content)`);
    console.log(`   Avg reply/like ratio: ${avgRTL.toFixed(3)} (higher = conversation-starting)`);
    console.log(`   Avg retweet/like ratio: ${avgRetweetL.toFixed(3)} (higher = shareable content)`);
    console.log(`   Tweets with ratio data: ${ratios.length}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`END AUDIT`);
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
