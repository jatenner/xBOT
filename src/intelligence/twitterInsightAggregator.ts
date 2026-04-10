/**
 * 🌐 TWITTER INSIGHT AGGREGATOR
 *
 * Queries peer_posts (populated by peer_scraper every 2h) and produces
 * structured insights about what's working on health Twitter RIGHT NOW.
 *
 * Output feeds into GrowthIntelligencePackage → content generation prompts.
 * No scraping, no browser — pure database aggregation.
 */

import { getSupabaseClient } from '../db';

export interface TwitterExternalInsights {
  topPerformingTopics: { topic: string; avgEngagement: number; postCount: number; exampleTweet: string }[];
  topPerformingHooks: { hookType: string; avgEngagement: number; count: number }[];
  topPerformingFormats: { format: string; avgEngagement: number; count: number }[];
  viralExamples: { text: string; authorHandle: string; engagement: number; hookType: string; whyItWorks: string }[];
  trendShifts: string[];
  generatedAt: string;
}

// Module-level cache with 1-hour TTL
let cachedInsights: TwitterExternalInsights | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getCachedInsights(): Promise<TwitterExternalInsights | null> {
  if (cachedInsights && Date.now() < cacheExpiresAt) {
    return cachedInsights;
  }
  return aggregateTwitterInsights();
}

export async function aggregateTwitterInsights(): Promise<TwitterExternalInsights | null> {
  const supabase = getSupabaseClient();

  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Fetch recent peer posts with engagement data
    const { data: posts, error } = await supabase
      .from('peer_posts')
      .select('account_handle, text, topic, hook_type, format, normalized_engagement, likes, views, created_at')
      .gte('created_at', fortyEightHoursAgo)
      .not('normalized_engagement', 'is', null)
      .order('normalized_engagement', { ascending: false })
      .limit(200);

    if (error || !posts || posts.length === 0) {
      console.log(`[TWITTER_INSIGHTS] No peer posts found in last 48h (${error?.message || 'empty'})`);
      return null;
    }

    console.log(`[TWITTER_INSIGHTS] Aggregating from ${posts.length} peer posts`);

    // 1. Top performing topics
    const topicMap = new Map<string, { total: number; count: number; bestTweet: string; bestEng: number }>();
    for (const p of posts) {
      if (!p.topic) continue;
      const topic = p.topic.toLowerCase().trim();
      const existing = topicMap.get(topic) || { total: 0, count: 0, bestTweet: '', bestEng: 0 };
      existing.total += p.normalized_engagement || 0;
      existing.count++;
      if ((p.normalized_engagement || 0) > existing.bestEng) {
        existing.bestEng = p.normalized_engagement || 0;
        existing.bestTweet = (p.text || '').substring(0, 120);
      }
      topicMap.set(topic, existing);
    }
    const topPerformingTopics = Array.from(topicMap.entries())
      .map(([topic, d]) => ({ topic, avgEngagement: d.total / d.count, postCount: d.count, exampleTweet: d.bestTweet }))
      .filter(t => t.postCount >= 2) // need at least 2 samples
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 5);

    // 2. Top performing hooks
    const hookMap = new Map<string, { total: number; count: number }>();
    for (const p of posts) {
      if (!p.hook_type) continue;
      const hook = p.hook_type;
      const existing = hookMap.get(hook) || { total: 0, count: 0 };
      existing.total += p.normalized_engagement || 0;
      existing.count++;
      hookMap.set(hook, existing);
    }
    const topPerformingHooks = Array.from(hookMap.entries())
      .map(([hookType, d]) => ({ hookType, avgEngagement: d.total / d.count, count: d.count }))
      .filter(h => h.count >= 2)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 5);

    // 3. Top performing formats
    const formatMap = new Map<string, { total: number; count: number }>();
    for (const p of posts) {
      if (!p.format) continue;
      const fmt = p.format;
      const existing = formatMap.get(fmt) || { total: 0, count: 0 };
      existing.total += p.normalized_engagement || 0;
      existing.count++;
      formatMap.set(fmt, existing);
    }
    const topPerformingFormats = Array.from(formatMap.entries())
      .map(([format, d]) => ({ format, avgEngagement: d.total / d.count, count: d.count }))
      .filter(f => f.count >= 2)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3);

    // 4. Viral examples (top 5 individual tweets)
    const viralExamples = posts
      .filter(p => p.text && p.text.length > 20)
      .slice(0, 5)
      .map(p => ({
        text: (p.text || '').substring(0, 150),
        authorHandle: p.account_handle || 'unknown',
        engagement: p.normalized_engagement || 0,
        hookType: p.hook_type || 'unknown',
        whyItWorks: `${p.hook_type || 'engaging'} hook with ${p.likes || 0} likes and ${p.views || 0} views`,
      }));

    // 5. Trend shifts — compare recent 24h vs previous 24h
    const trendShifts: string[] = [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentPosts = posts.filter(p => p.created_at && p.created_at >= twentyFourHoursAgo);
    const olderPosts = posts.filter(p => p.created_at && p.created_at < twentyFourHoursAgo);

    if (recentPosts.length >= 3 && olderPosts.length >= 3) {
      const recentTopics = new Map<string, number[]>();
      const olderTopics = new Map<string, number[]>();

      for (const p of recentPosts) {
        if (!p.topic) continue;
        const t = p.topic.toLowerCase().trim();
        if (!recentTopics.has(t)) recentTopics.set(t, []);
        recentTopics.get(t)!.push(p.normalized_engagement || 0);
      }
      for (const p of olderPosts) {
        if (!p.topic) continue;
        const t = p.topic.toLowerCase().trim();
        if (!olderTopics.has(t)) olderTopics.set(t, []);
        olderTopics.get(t)!.push(p.normalized_engagement || 0);
      }

      for (const [topic, recentEngs] of recentTopics) {
        const olderEngs = olderTopics.get(topic);
        if (!olderEngs || olderEngs.length < 2 || recentEngs.length < 2) continue;
        const recentAvg = recentEngs.reduce((a, b) => a + b, 0) / recentEngs.length;
        const olderAvg = olderEngs.reduce((a, b) => a + b, 0) / olderEngs.length;
        if (olderAvg === 0) continue;
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        if (Math.abs(change) >= 20) {
          trendShifts.push(`"${topic}" engagement ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}% vs yesterday`);
        }
      }
    }

    const insights: TwitterExternalInsights = {
      topPerformingTopics,
      topPerformingHooks,
      topPerformingFormats,
      viralExamples,
      trendShifts,
      generatedAt: new Date().toISOString(),
    };

    // Cache it
    cachedInsights = insights;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    console.log(`[TWITTER_INSIGHTS] ✅ Aggregated: ${topPerformingTopics.length} topics, ${topPerformingHooks.length} hooks, ${viralExamples.length} examples, ${trendShifts.length} shifts`);
    return insights;
  } catch (err: any) {
    console.error(`[TWITTER_INSIGHTS] ❌ Aggregation failed: ${err.message}`);
    return null;
  }
}
