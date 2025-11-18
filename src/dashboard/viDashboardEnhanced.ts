/**
 * 🔍 ENHANCED VISUAL INTELLIGENCE DASHBOARD
 * 
 * Modern, interactive dashboard with:
 * - Real-time visualizations
 * - Generator distribution
 * - Pattern insights
 * - Visual examples
 * - Better data presentation
 */

import { getSupabaseClient } from '../db/index';

export async function generateVIDashboardEnhanced(): Promise<string> {
  const supabase = getSupabaseClient();
  
  try {
    const [
      collectionStats,
      topTweets,
      tierBreakdown,
      topicBreakdown,
      recentActivity,
      patternStats,
      accountStats,
      generatorDistribution,
      angleToneBreakdown,
      visualPatterns,
      intelligenceStats,
      accountDiversity,
      generatorAccountMapping,
      learningProgress
    ] = await Promise.all([
      getCollectionStats(supabase),
      getTopPerformingTweets(supabase),
      getTierBreakdown(supabase),
      getTopicBreakdown(supabase),
      getRecentActivity(supabase),
      getPatternStats(supabase),
      getAccountStats(supabase),
      getGeneratorDistribution(supabase),
      getAngleToneBreakdown(supabase),
      getVisualPatterns(supabase),
      getIntelligenceStats(supabase),
      getAccountDiversity(supabase),
      getGeneratorAccountMapping(supabase),
      getLearningProgress(supabase)
    ]);

    return generateEnhancedHTML({
      collectionStats,
      topTweets,
      tierBreakdown,
      topicBreakdown,
      recentActivity,
      patternStats,
      accountStats,
      generatorDistribution,
      angleToneBreakdown,
      visualPatterns,
      intelligenceStats,
      accountDiversity,
      generatorAccountMapping,
      learningProgress
    });

  } catch (error: any) {
    console.error('[VI_DASHBOARD] Error:', error.message);
    return generateErrorHTML(error.message);
  }
}

// ============================================================
// ENHANCED DATA FETCHERS
// ============================================================

async function getCollectionStats(supabase: any) {
  const { count: total, error: totalError } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true });

  const { count: withViews } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gt('views', 0);

  const { count: classified } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('classified', true);

  const { count: analyzed } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('analyzed', true);

  // 🔥 NEW: Tweets collected in last 4 hours (critical metric)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { count: recent4h, data: recent4hData } = await supabase
    .from('vi_collected_tweets')
    .select('scraped_at', { count: 'exact' })
    .gte('scraped_at', fourHoursAgo)
    .order('scraped_at', { ascending: false });

  // Get last collection time
  const { data: lastCollection } = await supabase
    .from('vi_collected_tweets')
    .select('scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  // Get last 24 hours for rate calculation
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recent24h } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', twentyFourHoursAgo);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', sevenDaysAgo);

  const { data: accounts } = await supabase
    .from('vi_scrape_targets')
    .select('username, is_active')
    .eq('is_active', true);

  // Get successful tweets (2%+ ER)
  const { count: successful } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('engagement_rate', 0.02);

  // Get viral tweets
  const { count: viral } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('is_viral', true);

  // Calculate hours since last collection
  let hoursSinceLastCollection: number | null = null;
  if (lastCollection?.scraped_at) {
    const lastCollectionTime = new Date(lastCollection.scraped_at);
    hoursSinceLastCollection = Math.round((Date.now() - lastCollectionTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
  }

  // Calculate collection rate (tweets per hour)
  const collectionRate4h = recent4h ? recent4h / 4 : 0; // tweets per hour
  const collectionRate24h = recent24h ? recent24h / 24 : 0;

  return {
    total: total || 0,
    withViews: withViews || 0,
    classified: classified || 0,
    analyzed: analyzed || 0,
    recent7d: recent || 0,
    recent24h: recent24h || 0,
    recent4h: recent4h || 0, // 🔥 NEW: Critical metric
    lastCollectionTime: lastCollection?.scraped_at || null,
    hoursSinceLastCollection: hoursSinceLastCollection,
    collectionRate4h: collectionRate4h, // tweets/hour in last 4h
    collectionRate24h: collectionRate24h, // tweets/hour in last 24h
    activeAccounts: (accounts || []).length,
    successful: successful || 0,
    viral: viral || 0,
    viewsPercent: total ? Math.round((withViews / total) * 100) : 0,
    classifiedPercent: total ? Math.round((classified / total) * 100) : 0,
    analyzedPercent: total ? Math.round((analyzed / total) * 100) : 0,
    successRate: total ? Math.round((successful / total) * 100) : 0
  };
}

async function getTopPerformingTweets(supabase: any) {
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('tweet_id, content, author_username, views, likes, retweets, replies, engagement_rate, viral_multiplier, tier, posted_at')
    .gt('views', 0)
    .order('engagement_rate', { ascending: false })
    .limit(25);

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    content: (t.content || '').substring(0, 200),
    erPercent: ((t.engagement_rate || 0) * 100).toFixed(2)
  }));
}

async function getTierBreakdown(supabase: any) {
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('tier, views, likes, engagement_rate')
    .gt('views', 0);

  if (error) throw error;

  const byTier: Record<string, { count: number; avgViews: number; avgLikes: number; avgER: number; totalViews: number }> = {};
  
  (data || []).forEach((t: any) => {
    const tier = t.tier || 'unknown';
    if (!byTier[tier]) {
      byTier[tier] = { count: 0, avgViews: 0, avgLikes: 0, avgER: 0, totalViews: 0 };
    }
    byTier[tier].count++;
    byTier[tier].avgViews += t.views || 0;
    byTier[tier].avgLikes += t.likes || 0;
    byTier[tier].avgER += t.engagement_rate || 0;
    byTier[tier].totalViews += t.views || 0;
  });

  return Object.entries(byTier).map(([tier, stats]) => ({
    tier,
    count: stats.count,
    avgViews: Math.round(stats.avgViews / stats.count),
    avgLikes: Math.round(stats.avgLikes / stats.count),
    avgER: (stats.avgER / stats.count) * 100,
    totalViews: stats.totalViews
  })).sort((a, b) => b.count - a.count);
}

async function getTopicBreakdown(supabase: any) {
  try {
    const { data: classifications } = await supabase
      .from('vi_content_classification')
      .select('tweet_id, topic')
      .gte('topic_confidence', 0.6)
      .limit(1000);

    if (!classifications || classifications.length === 0) return [];

    const tweetIds = classifications.map(c => c.tweet_id).filter(Boolean);
    const { data: tweets } = await supabase
      .from('vi_collected_tweets')
      .select('tweet_id, views, likes, engagement_rate')
      .in('tweet_id', tweetIds)
      .gt('views', 0);

    const tweetMap = new Map<string, any>((tweets || []).map((t: any) => [t.tweet_id, t]));
    const byTopic: Record<string, { count: number; avgViews: number; avgLikes: number; avgER: number }> = {};
    
    classifications.forEach((c: any) => {
      const tweet = tweetMap.get(c.tweet_id);
      if (!tweet || !tweet.views) return;
      
      const topic = c.topic || 'unknown';
      if (!byTopic[topic]) {
        byTopic[topic] = { count: 0, avgViews: 0, avgLikes: 0, avgER: 0 };
      }
      byTopic[topic].count++;
      byTopic[topic].avgViews += tweet.views || 0;
      byTopic[topic].avgLikes += tweet.likes || 0;
      byTopic[topic].avgER += tweet.engagement_rate || 0;
    });

    return Object.entries(byTopic).map(([topic, stats]) => ({
      topic,
      count: stats.count,
      avgViews: Math.round(stats.avgViews / stats.count),
      avgLikes: Math.round(stats.avgLikes / stats.count),
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER).slice(0, 15);
  } catch (e) {
    return [];
  }
}

async function getRecentActivity(supabase: any) {
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('scraped_at, author_username')
    .order('scraped_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const byDay = new Map<string, number>();
  (data || []).forEach((t: any) => {
    const day = new Date(t.scraped_at).toISOString().split('T')[0];
    byDay.set(day, (byDay.get(day) || 0) + 1);
  });

  return Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)
    .map(([day, count]) => ({ day, count }));
}

async function getPatternStats(supabase: any) {
  const { count } = await supabase
    .from('vi_format_intelligence')
    .select('*', { count: 'exact', head: true });

  const { data: patterns } = await supabase
    .from('vi_format_intelligence')
    .select('confidence_level, based_on_count, generator_match')
    .limit(200);

  const highConf = (patterns || []).filter((p: any) => p.confidence_level === 'high').length;
  const mediumConf = (patterns || []).filter((p: any) => p.confidence_level === 'medium').length;
  const avgSamples = patterns && patterns.length > 0
    ? Math.round((patterns as any[]).reduce((sum, p) => sum + (p.based_on_count || 0), 0) / patterns.length)
    : 0;

  // Generator-specific patterns
  const generatorPatterns = (patterns || []).filter((p: any) => p.generator_match).length;

  return {
    total: count || 0,
    highConfidence: highConf,
    mediumConfidence: mediumConf,
    avgSamplesPerPattern: avgSamples,
    generatorSpecific: generatorPatterns
  };
}

async function getAccountStats(supabase: any) {
  const { data: targets } = await supabase
    .from('vi_scrape_targets')
    .select('username, is_active, tier, last_scraped_at, scrape_success_count, followers_count')
    .eq('is_active', true);

  const byTier: Record<string, number> = {};
  (targets || []).forEach((t: any) => {
    const tier = t.tier || 'unknown';
    byTier[tier] = (byTier[tier] || 0) + 1;
  });

  const recentlyScraped = (targets || []).filter((t: any) => {
    if (!t.last_scraped_at) return false;
    const hoursAgo = (Date.now() - new Date(t.last_scraped_at).getTime()) / (1000 * 60 * 60);
    return hoursAgo < 12;
  }).length;

  // Total followers across all accounts
  const totalFollowers = (targets || []).reduce((sum: number, t: any) => sum + (t.followers_count || 0), 0);

  return {
    total: (targets || []).length,
    byTier: Object.entries(byTier).map(([tier, count]) => ({ tier, count })),
    recentlyScraped,
    scrapeSuccessRate: targets && targets.length > 0
      ? Math.round((recentlyScraped / targets.length) * 100)
      : 0,
    totalFollowers
  };
}

// ✅ NEW: Generator distribution
async function getGeneratorDistribution(supabase: any) {
  const { data: classifications } = await supabase
    .from('vi_content_classification')
    .select('generator_match, tweet_id')
    .not('generator_match', 'is', null)
    .limit(2000);

  if (!classifications || classifications.length === 0) return [];

  const tweetIds = classifications.map(c => c.tweet_id).filter(Boolean);
  const { data: tweets } = await supabase
    .from('vi_collected_tweets')
    .select('tweet_id, engagement_rate')
    .in('tweet_id', tweetIds)
    .gt('views', 0);

  const tweetMap = new Map<string, any>((tweets || []).map((t: any) => [t.tweet_id, t]));
  const byGenerator: Record<string, { count: number; avgER: number; successful: number }> = {};
  
  classifications.forEach((c: any) => {
    const tweet = tweetMap.get(c.tweet_id);
    if (!tweet) return;
    
    const gen = c.generator_match || 'unknown';
    if (!byGenerator[gen]) {
      byGenerator[gen] = { count: 0, avgER: 0, successful: 0 };
    }
    byGenerator[gen].count++;
    byGenerator[gen].avgER += tweet.engagement_rate || 0;
    if ((tweet.engagement_rate || 0) >= 0.02) {
      byGenerator[gen].successful++;
    }
  });

  return Object.entries(byGenerator).map(([gen, stats]) => ({
    generator: gen,
    count: stats.count,
    avgER: (stats.avgER / stats.count) * 100,
    successRate: (stats.successful / stats.count) * 100
  })).sort((a, b) => b.count - a.count);
}

// ✅ NEW: Angle/Tone breakdown
async function getAngleToneBreakdown(supabase: any) {
  const { data: classifications } = await supabase
    .from('vi_content_classification')
    .select('angle, tone, hook_effectiveness, controversy_level, tweet_id')
    .gte('angle_confidence', 0.6)
    .gte('tone_confidence', 0.6)
    .limit(1000);

  if (!classifications || classifications.length === 0) return { angles: [], tones: [], hookScores: [], controversyScores: [] };

  const tweetIds = classifications.map(c => c.tweet_id).filter(Boolean);
  const { data: tweets } = await supabase
    .from('vi_collected_tweets')
    .select('tweet_id, engagement_rate')
    .in('tweet_id', tweetIds)
    .gt('views', 0);

  const tweetMap = new Map<string, any>((tweets || []).map((t: any) => [t.tweet_id, t]));

  // By angle
  const byAngle: Record<string, { count: number; avgER: number }> = {};
  // By tone
  const byTone: Record<string, { count: number; avgER: number }> = {};
  // Hook effectiveness distribution
  const hookScores: number[] = [];
  // Controversy level distribution
  const controversyScores: number[] = [];

  classifications.forEach((c: any) => {
    const tweet = tweetMap.get(c.tweet_id);
    if (!tweet) return;

    // Angle
    const angle = c.angle || 'unknown';
    if (!byAngle[angle]) {
      byAngle[angle] = { count: 0, avgER: 0 };
    }
    byAngle[angle].count++;
    byAngle[angle].avgER += tweet.engagement_rate || 0;

    // Tone
    const tone = c.tone || 'unknown';
    if (!byTone[tone]) {
      byTone[tone] = { count: 0, avgER: 0 };
    }
    byTone[tone].count++;
    byTone[tone].avgER += tweet.engagement_rate || 0;

    // Hook effectiveness
    if (c.hook_effectiveness !== null && c.hook_effectiveness !== undefined) {
      hookScores.push(c.hook_effectiveness);
    }

    // Controversy
    if (c.controversy_level !== null && c.controversy_level !== undefined) {
      controversyScores.push(c.controversy_level);
    }
  });

  return {
    angles: Object.entries(byAngle).map(([angle, stats]) => ({
      angle,
      count: stats.count,
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER),
    tones: Object.entries(byTone).map(([tone, stats]) => ({
      tone,
      count: stats.count,
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER),
    hookScores: hookScores.length > 0 ? {
      avg: Math.round(hookScores.reduce((a, b) => a + b, 0) / hookScores.length),
      min: Math.min(...hookScores),
      max: Math.max(...hookScores)
    } : null,
    controversyScores: controversyScores.length > 0 ? {
      avg: Math.round(controversyScores.reduce((a, b) => a + b, 0) / controversyScores.length),
      min: Math.min(...controversyScores),
      max: Math.max(...controversyScores)
    } : null
  };
}

// ✅ NEW: Visual patterns
async function getVisualPatterns(supabase: any) {
  const { data: visuals } = await supabase
    .from('vi_visual_formatting')
    .select('char_count, line_breaks, emoji_count, hook_type, readability_score, engagement_velocity, tweet_id')
    .limit(1000);

  if (!visuals || visuals.length === 0) return null;

  const tweetIds = visuals.map(v => v.tweet_id).filter(Boolean);
  const { data: tweets } = await supabase
    .from('vi_collected_tweets')
    .select('tweet_id, engagement_rate')
    .in('tweet_id', tweetIds)
    .gt('views', 0);

  const tweetMap = new Map<string, any>((tweets || []).map((t: any) => [t.tweet_id, t]));

  // Correlate patterns with ER
  const byLineBreaks: Record<number, { count: number; avgER: number }> = {};
  const byEmojiCount: Record<number, { count: number; avgER: number }> = {};
  const byCharCount: Record<string, { count: number; avgER: number }> = {};
  const byHookType: Record<string, { count: number; avgER: number }> = {};
  const readabilityScores: number[] = [];

  visuals.forEach((v: any) => {
    const tweet = tweetMap.get(v.tweet_id);
    if (!tweet) return;

    // Line breaks
    const breaks = v.line_breaks || 0;
    if (!byLineBreaks[breaks]) {
      byLineBreaks[breaks] = { count: 0, avgER: 0 };
    }
    byLineBreaks[breaks].count++;
    byLineBreaks[breaks].avgER += tweet.engagement_rate || 0;

    // Emoji count
    const emojis = v.emoji_count || 0;
    if (!byEmojiCount[emojis]) {
      byEmojiCount[emojis] = { count: 0, avgER: 0 };
    }
    byEmojiCount[emojis].count++;
    byEmojiCount[emojis].avgER += tweet.engagement_rate || 0;

    // Char count (bucketed)
    const chars = v.char_count || 0;
    const bucket = chars < 100 ? '0-100' : chars < 200 ? '100-200' : chars < 280 ? '200-280' : '280+';
    if (!byCharCount[bucket]) {
      byCharCount[bucket] = { count: 0, avgER: 0 };
    }
    byCharCount[bucket].count++;
    byCharCount[bucket].avgER += tweet.engagement_rate || 0;

    // Hook type
    const hook = v.hook_type || 'unknown';
    if (!byHookType[hook]) {
      byHookType[hook] = { count: 0, avgER: 0 };
    }
    byHookType[hook].count++;
    byHookType[hook].avgER += tweet.engagement_rate || 0;

    // Readability
    if (v.readability_score !== null && v.readability_score !== undefined) {
      readabilityScores.push(v.readability_score);
    }
  });

  return {
    lineBreaks: Object.entries(byLineBreaks).map(([breaks, stats]) => ({
      breaks: Number(breaks),
      count: stats.count,
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER),
    emojiCount: Object.entries(byEmojiCount).map(([count, stats]) => ({
      count: Number(count),
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER),
    charCount: Object.entries(byCharCount).map(([bucket, stats]) => ({
      bucket,
      count: stats.count,
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER),
    hookType: Object.entries(byHookType).map(([hook, stats]) => ({
      hook,
      count: stats.count,
      avgER: (stats.avgER / stats.count) * 100
    })).sort((a, b) => b.avgER - a.avgER),
    readability: readabilityScores.length > 0 ? {
      avg: Math.round(readabilityScores.reduce((a, b) => a + b, 0) / readabilityScores.length),
      min: Math.min(...readabilityScores),
      max: Math.max(...readabilityScores)
    } : null
  };
}

// ✅ NEW: Intelligence stats
async function getIntelligenceStats(supabase: any) {
  const { data: intelligence } = await supabase
    .from('vi_format_intelligence')
    .select('confidence_level, based_on_count, generator_match, primary_tier, weighted_avg_engagement')
    .limit(200);

  if (!intelligence || intelligence.length === 0) {
    return {
      total: 0,
      byGenerator: [],
      byTier: [],
      avgEngagement: 0
    };
  }

  // By generator
  const byGenerator: Record<string, { count: number; avgEngagement: number }> = {};
  // By tier
  const byTier: Record<string, { count: number; avgEngagement: number }> = {};

  let totalEngagement = 0;
  let engagementCount = 0;

  intelligence.forEach((i: any) => {
    // Generator
    if (i.generator_match) {
      const gen = i.generator_match;
      if (!byGenerator[gen]) {
        byGenerator[gen] = { count: 0, avgEngagement: 0 };
      }
      byGenerator[gen].count++;
      byGenerator[gen].avgEngagement += (i.weighted_avg_engagement || 0) * 100;
    }

    // Tier
    const tier = i.primary_tier || 'unknown';
    if (!byTier[tier]) {
      byTier[tier] = { count: 0, avgEngagement: 0 };
    }
    byTier[tier].count++;
    byTier[tier].avgEngagement += (i.weighted_avg_engagement || 0) * 100;

    // Overall
    if (i.weighted_avg_engagement) {
      totalEngagement += i.weighted_avg_engagement * 100;
      engagementCount++;
    }
  });

  return {
    total: intelligence.length,
    byGenerator: Object.entries(byGenerator).map(([gen, stats]) => ({
      generator: gen,
      count: stats.count,
      avgEngagement: (stats.avgEngagement / stats.count).toFixed(2)
    })).sort((a, b) => b.count - a.count),
    byTier: Object.entries(byTier).map(([tier, stats]) => ({
      tier,
      count: stats.count,
      avgEngagement: (stats.avgEngagement / stats.count).toFixed(2)
    })).sort((a, b) => b.count - a.count),
    avgEngagement: engagementCount > 0 ? (totalEngagement / engagementCount).toFixed(2) : '0.00'
  };
}

// ✅ NEW: Account diversity metrics
async function getAccountDiversity(supabase: any) {
  const { data: accounts } = await supabase
    .from('vi_scrape_targets')
    .select('username, tier, discovery_method, inclusion_reason, is_active')
    .eq('is_active', true);

  if (!accounts || accounts.length === 0) {
    return {
      total: 0,
      bulkAdded: 0,
      byDiscovery: {},
      byGenerator: {},
      needsMoreAccounts: true
    };
  }

  const bulkAdded = accounts.filter(a => a.discovery_method === 'manual_bulk_add').length;
  
  // By discovery method
  const byDiscovery: Record<string, number> = {};
  accounts.forEach(a => {
    const method = a.discovery_method || 'unknown';
    byDiscovery[method] = (byDiscovery[method] || 0) + 1;
  });

  // By generator (from inclusion_reason)
  const byGenerator: Record<string, number> = {};
  accounts.forEach(a => {
    try {
      const reason = typeof a.inclusion_reason === 'string' 
        ? JSON.parse(a.inclusion_reason) 
        : a.inclusion_reason;
      const generators = reason?.primary_generators || [];
      generators.forEach((gen: string) => {
        byGenerator[gen] = (byGenerator[gen] || 0) + 1;
      });
    } catch (e) {
      // Skip if can't parse
    }
  });

  return {
    total: accounts.length,
    bulkAdded,
    byDiscovery: Object.entries(byDiscovery).map(([method, count]) => ({ method, count })),
    byGenerator: Object.entries(byGenerator).map(([gen, count]) => ({ generator: gen, count })).sort((a, b) => b.count - a.count),
    needsMoreAccounts: accounts.length < 300
  };
}

// ✅ NEW: Generator-account mapping
async function getGeneratorAccountMapping(supabase: any) {
  const { data: accounts } = await supabase
    .from('vi_scrape_targets')
    .select('username, inclusion_reason, is_active')
    .eq('is_active', true)
    .limit(500);

  if (!accounts || accounts.length === 0) return [];

  const mapping: Record<string, string[]> = {};

  accounts.forEach(a => {
    try {
      const reason = typeof a.inclusion_reason === 'string' 
        ? JSON.parse(a.inclusion_reason) 
        : a.inclusion_reason;
      const generators = reason?.primary_generators || [];
      generators.forEach((gen: string) => {
        if (!mapping[gen]) mapping[gen] = [];
        if (mapping[gen].length < 10) { // Limit to 10 per generator
          mapping[gen].push(a.username);
        }
      });
    } catch (e) {
      // Skip if can't parse
    }
  });

  return Object.entries(mapping)
    .map(([generator, usernames]) => ({ generator, accounts: usernames, count: usernames.length }))
    .sort((a, b) => b.count - a.count);
}

// ✅ NEW: Learning progress
async function getLearningProgress(supabase: any) {
  const { count: totalTweets } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true });

  const { count: successfulTweets } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('engagement_rate', 0.02);

  const { count: intelligencePatterns } = await supabase
    .from('vi_format_intelligence')
    .select('*', { count: 'exact', head: true });

  const { count: generatorIntelligence } = await supabase
    .from('vi_format_intelligence')
    .select('*', { count: 'exact', head: true })
    .not('generator_match', 'is', null);

  const { data: accounts } = await supabase
    .from('vi_scrape_targets')
    .select('username, is_active')
    .eq('is_active', true);

  // Calculate progress milestones
  const milestones = {
    tweets1000: (totalTweets || 0) >= 1000,
    tweets5000: (totalTweets || 0) >= 5000,
    tweets10000: (totalTweets || 0) >= 10000,
    accounts100: ((accounts || []).length) >= 100,
    accounts300: ((accounts || []).length) >= 300,
    accounts500: ((accounts || []).length) >= 500,
    intelligence50: (intelligencePatterns || 0) >= 50,
    intelligence100: (intelligencePatterns || 0) >= 100,
    generatorIntelligence: (generatorIntelligence || 0) > 0
  };

  const recommendations: string[] = [];
  if (!milestones.accounts300) {
    recommendations.push('Add more accounts (target: 300+) for better diversity');
  }
  if (!milestones.tweets5000) {
    recommendations.push('Continue collecting tweets (target: 5,000+) for robust learning');
  }
  if (!milestones.generatorIntelligence) {
    recommendations.push('Build generator-specific intelligence patterns');
  }
  if ((successfulTweets || 0) < 100) {
    recommendations.push('Focus on collecting more successful tweets (2%+ ER)');
  }

  return {
    totalTweets: totalTweets || 0,
    successfulTweets: successfulTweets || 0,
    intelligencePatterns: intelligencePatterns || 0,
    generatorIntelligence: generatorIntelligence || 0,
    totalAccounts: (accounts || []).length,
    milestones,
    recommendations,
    learningScore: Math.min(100, Math.round(
      ((totalTweets || 0) / 10000 * 30) +
      ((successfulTweets || 0) / 500 * 30) +
      ((intelligencePatterns || 0) / 100 * 20) +
      (((accounts || []).length) / 500 * 20)
    ))
  };
}

// ============================================================
// ENHANCED HTML GENERATOR
// ============================================================

function generateEnhancedHTML(data: any): string {
  const {
    collectionStats,
    topTweets,
    tierBreakdown,
    topicBreakdown,
    recentActivity,
    patternStats,
    accountStats,
    generatorDistribution,
    angleToneBreakdown,
    visualPatterns,
    intelligenceStats,
    accountDiversity,
    generatorAccountMapping,
    learningProgress
  } = data;
  
  return `<!DOCTYPE html>
<html>
<head>
    <title>xBOT Visual Intelligence Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
            min-height: 100vh;
        }
        .container {
            max-width: 1600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            margin-bottom: 30px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #667eea;
            font-size: 2.8em;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        .nav-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .nav-tab {
            padding: 12px 24px;
            background: white;
            border-radius: 8px;
            text-decoration: none;
            color: #333;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.2s;
        }
        .nav-tab.active {
            background: #667eea;
            color: white;
        }
        .nav-tab:hover {
            background: #5568d3;
            color: white;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .stat-value {
            font-size: 2.2em;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .stat-sub {
            font-size: 0.85em;
            opacity: 0.8;
        }
        .section {
            margin-bottom: 50px;
        }
        .section-title {
            font-size: 1.6em;
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            height: 400px;
        }
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        .three-column {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background: #f5f7fa;
        }
        .tweet-preview {
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-high { background: #10b981; color: white; }
        .badge-medium { background: #f59e0b; color: white; }
        .badge-low { background: #ef4444; color: white; }
        .badge-established { background: #6366f1; color: white; }
        .badge-growth { background: #8b5cf6; color: white; }
        .badge-micro { background: #ec4899; color: white; }
        .badge-viral_unknown { background: #f97316; color: white; }
        .insight-box {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-left: 4px solid #667eea;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .insight-box h3 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .insight-box p {
            color: #555;
            line-height: 1.6;
        }
        .progress-bar {
            width: 100%;
            height: 24px;
            background: #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 8px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.85em;
            font-weight: 600;
        }
        @media (max-width: 1200px) {
            .two-column { grid-template-columns: 1fr; }
            .three-column { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Visual Intelligence Dashboard</h1>
            <p>Teaching the AI the language of Twitter through ${collectionStats.total.toLocaleString()} analyzed tweets</p>
            ${collectionStats.hoursSinceLastCollection !== null ? `
            <div style="margin-top: 15px; padding: 12px; background: ${collectionStats.hoursSinceLastCollection <= 2 ? '#d1fae5' : collectionStats.hoursSinceLastCollection <= 6 ? '#fef3c7' : '#fee2e2'}; border-radius: 8px; display: inline-block; border: 2px solid ${collectionStats.hoursSinceLastCollection <= 2 ? '#10b981' : collectionStats.hoursSinceLastCollection <= 6 ? '#f59e0b' : '#ef4444'};">
                <strong>Collection Status:</strong> 
                ${collectionStats.hoursSinceLastCollection <= 2 ? '✅ Active' : collectionStats.hoursSinceLastCollection <= 6 ? '⚠️ Slowing' : '❌ Stalled'} 
                • Last collection: ${collectionStats.hoursSinceLastCollection < 0.1 ? '< 6 minutes ago' : collectionStats.hoursSinceLastCollection < 1 ? `${Math.round(collectionStats.hoursSinceLastCollection * 60)} minutes ago` : `${collectionStats.hoursSinceLastCollection.toFixed(1)} hours ago`}
                ${collectionStats.recent4h > 0 ? `• Last 4h: ${collectionStats.recent4h.toLocaleString()} tweets (${Math.round(collectionStats.collectionRate4h)}/hour)` : '• No tweets in last 4 hours'}
            </div>
            ` : ''}
        </div>

        <div class="nav-tabs">
            <a href="/dashboard/recent?token=xbot-admin-2025" class="nav-tab">📅 Recent</a>
            <a href="/dashboard/posts?token=xbot-admin-2025" class="nav-tab">📊 Metrics</a>
            <a href="/dashboard/replies?token=xbot-admin-2025" class="nav-tab">💬 Replies</a>
            <a href="/dashboard/vi?token=xbot-admin-2025" class="nav-tab active">🔍 VI Collection</a>
            <a href="/dashboard/health?token=xbot-admin-2025" class="nav-tab">🔧 Health</a>
        </div>

        <!-- Key Metrics -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Tweets Collected</div>
                <div class="stat-value">${collectionStats.total.toLocaleString()}</div>
                <div class="stat-sub">From ${collectionStats.activeAccounts} accounts</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Successful Tweets</div>
                <div class="stat-value">${collectionStats.successful.toLocaleString()}</div>
                <div class="stat-sub">${collectionStats.successRate}% (2%+ ER)</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Viral Tweets</div>
                <div class="stat-value">${collectionStats.viral.toLocaleString()}</div>
                <div class="stat-sub">50%+ reach</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">AI Classified</div>
                <div class="stat-value">${collectionStats.classified.toLocaleString()}</div>
                <div class="stat-sub">${collectionStats.classifiedPercent}% complete</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pattern Analyzed</div>
                <div class="stat-value">${collectionStats.analyzed.toLocaleString()}</div>
                <div class="stat-sub">${collectionStats.analyzedPercent}% complete</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last 4 Hours</div>
                <div class="stat-value">${collectionStats.recent4h.toLocaleString()}</div>
                <div class="stat-sub">${collectionStats.recent4h > 0 ? `~${Math.round(collectionStats.collectionRate4h)}/hour` : '0 tweets'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last 7 Days</div>
                <div class="stat-value">${collectionStats.recent7d.toLocaleString()}</div>
                <div class="stat-sub">~${Math.round(collectionStats.recent7d / 7)}/day</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last 24 Hours</div>
                <div class="stat-value">${collectionStats.recent24h.toLocaleString()}</div>
                <div class="stat-sub">${collectionStats.recent24h > 0 ? `~${Math.round(collectionStats.collectionRate24h)}/hour` : '0 tweets'}</div>
            </div>
            ${collectionStats.hoursSinceLastCollection !== null ? `
            <div class="stat-card" style="background: ${collectionStats.hoursSinceLastCollection > 6 ? '#fee' : collectionStats.hoursSinceLastCollection > 3 ? '#ffe' : '#efe'}">
                <div class="stat-label">Last Collection</div>
                <div class="stat-value">${collectionStats.hoursSinceLastCollection < 0.1 ? '< 6min' : collectionStats.hoursSinceLastCollection < 1 ? `${Math.round(collectionStats.hoursSinceLastCollection * 60)}m ago` : `${collectionStats.hoursSinceLastCollection.toFixed(1)}h ago`}</div>
                <div class="stat-sub">${collectionStats.lastCollectionTime ? new Date(collectionStats.lastCollectionTime).toLocaleString() : 'Never'}</div>
            </div>
            ` : ''}
        </div>

        <!-- Learning Progress -->
        <div class="section" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #667eea;">
            <h2 class="section-title">📊 Learning Progress</h2>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px;">
                <div class="stat-card" style="background: white; color: #333;">
                    <div class="stat-label">Learning Score</div>
                    <div class="stat-value" style="color: #667eea;">${learningProgress.learningScore}%</div>
                    <div class="stat-sub">Overall system maturity</div>
                </div>
                <div class="stat-card" style="background: white; color: #333;">
                    <div class="stat-label">Total Tweets</div>
                    <div class="stat-value" style="color: #667eea;">${learningProgress.totalTweets.toLocaleString()}</div>
                    <div class="stat-sub">${learningProgress.milestones.tweets10000 ? '✅' : '⏳'} Target: 10,000</div>
                </div>
                <div class="stat-card" style="background: white; color: #333;">
                    <div class="stat-label">Successful Tweets</div>
                    <div class="stat-value" style="color: #667eea;">${learningProgress.successfulTweets.toLocaleString()}</div>
                    <div class="stat-sub">2%+ engagement rate</div>
                </div>
                <div class="stat-card" style="background: white; color: #333;">
                    <div class="stat-label">Intelligence Patterns</div>
                    <div class="stat-value" style="color: #667eea;">${learningProgress.intelligencePatterns}</div>
                    <div class="stat-sub">${learningProgress.milestones.intelligence100 ? '✅' : '⏳'} Target: 100</div>
                </div>
            </div>
            ${learningProgress.recommendations.length > 0 ? `
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h3 style="color: #856404; margin-bottom: 10px;">💡 Recommendations</h3>
                <ul style="color: #856404; margin-left: 20px;">
                    ${learningProgress.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>

        <!-- Insights -->
        <div class="insight-box">
            <h3>💡 What We're Learning</h3>
            <p>
                The VI system is teaching the AI the <strong>language of Twitter</strong> by analyzing ${collectionStats.total.toLocaleString()} tweets from ${collectionStats.activeAccounts} accounts.
                We're learning <strong>principles</strong> (how Twitter works), not just statistics. ${collectionStats.successful.toLocaleString()} successful tweets (${collectionStats.successRate}%) 
                provide the foundation for understanding what good posts look like.
            </p>
        </div>

        <!-- Account Diversity -->
        ${accountDiversity.total > 0 ? `
        <div class="section">
            <h2 class="section-title">🌍 Account Diversity</h2>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 20px;">
                <div class="stat-card">
                    <div class="stat-label">Total Accounts</div>
                    <div class="stat-value">${accountDiversity.total}</div>
                    <div class="stat-sub">${learningProgress.milestones.accounts300 ? '✅' : '⏳'} Target: 300+</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Bulk Added</div>
                    <div class="stat-value">${accountDiversity.bulkAdded}</div>
                    <div class="stat-sub">Recently added</div>
                </div>
            </div>
            ${accountDiversity.byGenerator.length > 0 ? `
            <div style="margin-top: 20px;">
                <h3 style="margin-bottom: 15px; color: #667eea;">Accounts by Generator Match</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    ${accountDiversity.byGenerator.slice(0, 12).map((g: any) => `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
                            <strong style="color: #667eea;">${g.generator}</strong>
                            <div style="font-size: 1.5em; margin-top: 5px; color: #333;">${g.count}</div>
                            <div style="font-size: 0.85em; color: #666; margin-top: 5px;">accounts</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
        ` : ''}

        <!-- Generator-Account Mapping -->
        ${generatorAccountMapping.length > 0 ? `
        <div class="section">
            <h2 class="section-title">🎭 Generator-Account Mapping</h2>
            <p style="color: #666; margin-bottom: 20px;">Which accounts each generator learns from</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                ${generatorAccountMapping.slice(0, 12).map((m: any) => `
                    <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #667eea;">
                        <h3 style="color: #667eea; margin-bottom: 10px; font-size: 1.1em;">${m.generator}</h3>
                        <div style="font-size: 0.9em; color: #666; margin-bottom: 10px;">${m.count} accounts</div>
                        <div style="font-size: 0.85em; color: #555;">
                            ${m.accounts.slice(0, 5).map((u: string) => `<div style="padding: 4px 0;">@${u}</div>`).join('')}
                            ${m.accounts.length > 5 ? `<div style="color: #999; font-style: italic;">+${m.accounts.length - 5} more...</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- Charts Row 1: Collection Trends & Generator Distribution -->
        <div class="two-column">
            <div class="section">
                <h2 class="section-title">📈 Collection Trends (Last 14 Days)</h2>
                <div class="chart-container">
                    <canvas id="collectionChart"></canvas>
                </div>
            </div>
            <div class="section">
                <h2 class="section-title">🎭 Generator Distribution</h2>
                <div class="chart-container">
                    <canvas id="generatorChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Charts Row 2: Tier Performance & Visual Patterns -->
        <div class="two-column">
            <div class="section">
                <h2 class="section-title">📊 Tier Performance (Avg Engagement Rate)</h2>
                <div class="chart-container">
                    <canvas id="tierChart"></canvas>
                </div>
            </div>
            <div class="section">
                <h2 class="section-title">🎨 Visual Patterns (Line Breaks vs ER)</h2>
                <div class="chart-container">
                    <canvas id="visualChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Account Statistics -->
        <div class="section">
            <h2 class="section-title">👥 Account Statistics</h2>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                ${accountStats.byTier.map((t: any) => `
                    <div class="stat-card">
                        <div class="stat-label">${t.tier} Accounts</div>
                        <div class="stat-value">${t.count}</div>
                    </div>
                `).join('')}
                <div class="stat-card">
                    <div class="stat-label">Recently Scraped</div>
                    <div class="stat-value">${accountStats.recentlyScraped}</div>
                    <div class="stat-sub">${accountStats.scrapeSuccessRate}% success</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Followers</div>
                    <div class="stat-value">${(accountStats.totalFollowers / 1000000).toFixed(1)}M</div>
                    <div class="stat-sub">Across all accounts</div>
                </div>
            </div>
        </div>

        <!-- Generator Performance Table -->
        ${generatorDistribution.length > 0 ? `
        <div class="section">
            <h2 class="section-title">🎭 Generator Performance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Generator</th>
                        <th>Tweets</th>
                        <th>Avg ER</th>
                        <th>Success Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${generatorDistribution.slice(0, 15).map((g: any) => `
                        <tr>
                            <td><strong>${g.generator}</strong></td>
                            <td>${g.count}</td>
                            <td><strong>${g.avgER.toFixed(2)}%</strong></td>
                            <td>${g.successRate.toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Top Performing Tweets -->
        <div class="section">
            <h2 class="section-title">🔥 Top Performing Tweets (by Engagement Rate)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Author</th>
                        <th>Content Preview</th>
                        <th>Views</th>
                        <th>Likes</th>
                        <th>RTs</th>
                        <th>ER</th>
                        <th>Tier</th>
                    </tr>
                </thead>
                <tbody>
                    ${topTweets.slice(0, 20).map((t: any) => `
                        <tr>
                            <td><strong>@${t.author_username}</strong></td>
                            <td class="tweet-preview" title="${escapeHtml(t.content)}">${escapeHtml(t.content)}</td>
                            <td>${(t.views || 0).toLocaleString()}</td>
                            <td>${(t.likes || 0).toLocaleString()}</td>
                            <td>${(t.retweets || 0).toLocaleString()}</td>
                            <td><strong>${t.erPercent}%</strong></td>
                            <td><span class="badge badge-${t.tier || 'unknown'}">${t.tier || 'unknown'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Angle/Tone Breakdown -->
        ${angleToneBreakdown.angles.length > 0 ? `
        <div class="two-column">
            <div class="section">
                <h2 class="section-title">📐 Top Angles (by Avg ER)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Angle</th>
                            <th>Tweets</th>
                            <th>Avg ER</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${angleToneBreakdown.angles.slice(0, 10).map((a: any) => `
                            <tr>
                                <td><strong>${a.angle}</strong></td>
                                <td>${a.count}</td>
                                <td><strong>${a.avgER.toFixed(2)}%</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="section">
                <h2 class="section-title">🎤 Top Tones (by Avg ER)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Tone</th>
                            <th>Tweets</th>
                            <th>Avg ER</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${angleToneBreakdown.tones.slice(0, 10).map((t: any) => `
                            <tr>
                                <td><strong>${t.tone}</strong></td>
                                <td>${t.count}</td>
                                <td><strong>${t.avgER.toFixed(2)}%</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}

        <!-- Visual Patterns -->
        ${visualPatterns ? `
        <div class="section">
            <h2 class="section-title">🎨 Visual Pattern Analysis</h2>
            <div class="three-column">
                <div>
                    <h3 style="margin-bottom: 15px; color: #667eea;">Line Breaks</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Breaks</th>
                                <th>Tweets</th>
                                <th>Avg ER</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visualPatterns.lineBreaks.slice(0, 5).map((p: any) => `
                                <tr>
                                    <td><strong>${p.breaks}</strong></td>
                                    <td>${p.count}</td>
                                    <td><strong>${p.avgER.toFixed(2)}%</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div>
                    <h3 style="margin-bottom: 15px; color: #667eea;">Emoji Count</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Emojis</th>
                                <th>Tweets</th>
                                <th>Avg ER</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visualPatterns.emojiCount.slice(0, 5).map((p: any) => `
                                <tr>
                                    <td><strong>${p.count}</strong></td>
                                    <td>${p.count}</td>
                                    <td><strong>${p.avgER.toFixed(2)}%</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div>
                    <h3 style="margin-bottom: 15px; color: #667eea;">Hook Types</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Hook</th>
                                <th>Tweets</th>
                                <th>Avg ER</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visualPatterns.hookType.slice(0, 5).map((p: any) => `
                                <tr>
                                    <td><strong>${p.hook}</strong></td>
                                    <td>${p.count}</td>
                                    <td><strong>${p.avgER.toFixed(2)}%</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ${visualPatterns.readability ? `
            <div style="margin-top: 20px; padding: 15px; background: #f5f7fa; border-radius: 8px;">
                <strong>Readability:</strong> Avg ${visualPatterns.readability.avg} (Flesch score, range: ${visualPatterns.readability.min}-${visualPatterns.readability.max})
            </div>
            ` : ''}
        </div>
        ` : ''}

        <!-- Intelligence Stats -->
        ${intelligenceStats.total > 0 ? `
        <div class="section">
            <h2 class="section-title">🧠 Pattern Intelligence</h2>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="stat-card">
                    <div class="stat-label">Total Patterns</div>
                    <div class="stat-value">${intelligenceStats.total}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">High Confidence</div>
                    <div class="stat-value">${patternStats.highConfidence}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Generator-Specific</div>
                    <div class="stat-value">${patternStats.generatorSpecific}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Engagement</div>
                    <div class="stat-value">${intelligenceStats.avgEngagement}%</div>
                </div>
            </div>
            ${intelligenceStats.byGenerator.length > 0 ? `
            <div style="margin-top: 20px;">
                <h3 style="margin-bottom: 15px; color: #667eea;">Generator-Specific Intelligence</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Generator</th>
                            <th>Patterns</th>
                            <th>Avg ER</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${intelligenceStats.byGenerator.slice(0, 10).map((g: any) => `
                            <tr>
                                <td><strong>${g.generator}</strong></td>
                                <td>${g.count}</td>
                                <td><strong>${g.avgEngagement}%</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>
        ` : ''}

        <!-- Topic Breakdown -->
        ${topicBreakdown.length > 0 ? `
        <div class="section">
            <h2 class="section-title">🎯 Topic Performance (by Avg ER)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Topic</th>
                        <th>Tweets</th>
                        <th>Avg Views</th>
                        <th>Avg Likes</th>
                        <th>Avg ER</th>
                    </tr>
                </thead>
                <tbody>
                    ${topicBreakdown.map((t: any) => `
                        <tr>
                            <td><strong>${t.topic}</strong></td>
                            <td>${t.count.toLocaleString()}</td>
                            <td>${t.avgViews.toLocaleString()}</td>
                            <td>${t.avgLikes.toLocaleString()}</td>
                            <td><strong>${t.avgER.toFixed(2)}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
    </div>

    <script>
        // Collection Trends Chart
        const collectionCtx = document.getElementById('collectionChart');
        new Chart(collectionCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(recentActivity.map((a: any) => a.day))},
                datasets: [{
                    label: 'Tweets Collected',
                    data: ${JSON.stringify(recentActivity.map((a: any) => a.count))},
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                }
            }
        });

        // Generator Distribution Chart
        const generatorCtx = document.getElementById('generatorChart');
        new Chart(generatorCtx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(generatorDistribution.slice(0, 10).map((g: any) => g.generator))},
                datasets: [{
                    data: ${JSON.stringify(generatorDistribution.slice(0, 10).map((g: any) => g.count))},
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
                        '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#330867'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        // Tier Performance Chart
        const tierCtx = document.getElementById('tierChart');
        new Chart(tierCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(tierBreakdown.map((t: any) => t.tier))},
                datasets: [{
                    label: 'Avg Engagement Rate (%)',
                    data: ${JSON.stringify(tierBreakdown.map((t: any) => t.avgER))},
                    backgroundColor: '#667eea'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Visual Patterns Chart
        const visualCtx = document.getElementById('visualChart');
        new Chart(visualCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(visualPatterns ? visualPatterns.lineBreaks.slice(0, 6).map((p: any) => `${p.breaks} breaks`) : [])},
                datasets: [{
                    label: 'Avg ER (%)',
                    data: ${JSON.stringify(visualPatterns ? visualPatterns.lineBreaks.slice(0, 6).map((p: any) => p.avgER) : [])},
                    backgroundColor: '#764ba2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    </script>
</body>
</html>`;
}

function generateErrorHTML(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Error - VI Dashboard</title>
    <meta charset="UTF-8">
</head>
<body>
    <div style="padding: 40px; text-align: center;">
        <h1 style="color: #ef4444;">❌ Error Loading Dashboard</h1>
        <p>${escapeHtml(message)}</p>
    </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

