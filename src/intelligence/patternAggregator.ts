/**
 * Pattern Aggregator
 *
 * Aggregates external (vi_collected_tweets, external_reply_patterns) and internal
 * (growth_ledger) data by dimension combo into the `external_patterns` table.
 *
 * Run periodically (e.g. every 30 min) to keep the pattern store fresh.
 * The tick advisor reads from external_patterns to steer real-time decisions.
 */

import { getSupabaseClient } from '../db/index';
import { getFollowerCountFromDB } from '../utils/followerCountHelper';

const TAG = '[PATTERN_AGG]';

// ─── Account stage inference ───

function inferOurStage(f: number): string {
  if (f < 500) return 'bootstrap';
  if (f < 2000) return 'early';
  if (f < 10000) return 'growth';
  return 'established';
}

// ─── Hour bucket mapping ───

function hourBucket(hour: number): string {
  if (hour >= 0 && hour <= 5) return 'night';
  if (hour >= 6 && hour <= 9) return 'morning';
  if (hour >= 10 && hour <= 13) return 'midday';
  if (hour >= 14 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'night'; // 22-23
}

// ─── Types ───

interface DimensionGroup {
  pattern_type: string;
  angle: string;
  tone: string;
  format: string;
  hour_bucket: string;
  topic: string;
  target_tier: string;
  avg_engagement: number;
  avg_likes: number;
  count: number;
  breakout_rate: number;
  avg_views: number;
  avg_reward: number;
  avg_followers_gained: number;
  avg_reply_likes: number;
  avg_outperformance: number;
}

function comboKey(g: Pick<DimensionGroup, 'pattern_type' | 'angle' | 'tone' | 'format' | 'hour_bucket' | 'topic' | 'target_tier'>): string {
  const safe = (v: string | null | undefined) => v || 'any';
  return `${safe(g.pattern_type)}|${safe(g.angle)}|${safe(g.tone)}|${safe(g.format)}|${safe(g.hour_bucket)}|${safe(g.topic)}|${safe(g.target_tier)}`;
}

// ─── Source 1: External tweets (vi_collected_tweets + vi_content_classification) ───

async function fetchExternalTweetPatterns(): Promise<Map<string, DimensionGroup>> {
  const supabase = getSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Simple query — no joins (Supabase FK relationships may not exist)
  const { data, error } = await supabase
    .from('vi_collected_tweets')
    .select('tweet_id, engagement_rate, likes, is_viral, scraped_at, posted_at, author_username')
    .gte('scraped_at', thirtyDaysAgo)
    .limit(5000);

  if (error || !data) {
    console.warn(`${TAG} External tweets query failed: ${error?.message || 'no data'}`);
    return new Map();
  }

  // Get classifications separately
  const tweetIds = data.map((d: any) => d.tweet_id).filter(Boolean);
  const { data: classifications } = tweetIds.length > 0
    ? await supabase
        .from('vi_content_classification')
        .select('tweet_id, internal_angle, internal_tone, internal_format, topic')
        .in('tweet_id', tweetIds.slice(0, 1000))
    : { data: [] };

  const classMap = new Map<string, any>();
  for (const c of (classifications || [])) {
    if (c.tweet_id) classMap.set(c.tweet_id, c);
  }

  // Merge classification into tweet data
  for (const tweet of data as any[]) {
    const cls = classMap.get(tweet.tweet_id);
    if (cls) {
      tweet.internal_angle = cls.internal_angle;
      tweet.internal_tone = cls.internal_tone;
      tweet.internal_format = cls.internal_format;
      tweet.topic = cls.topic;
    }
  }

  // Group by dimensions
  const now = Date.now();
  const groups = new Map<string, {
    weighted_er_sum: number;
    recency_weight_sum: number;
    likes: number[];
    viral_count: number;
    count: number;
    trust_scores: number[];
    days_old_sum: number;
    key_parts: Pick<DimensionGroup, 'pattern_type' | 'angle' | 'tone' | 'format' | 'hour_bucket' | 'topic' | 'target_tier'>;
  }>();

  for (const row of data) {
    const cls = (row as any).vi_content_classification;
    if (!cls) continue;

    const hb = hourBucket(row.hour_posted ?? 12);
    const parts = {
      pattern_type: 'external_tweet',
      angle: cls.internal_angle || 'any',
      tone: cls.internal_tone || 'any',
      format: cls.internal_format || 'any',
      hour_bucket: hb,
      topic: row.topic || 'any',
      target_tier: 'any',
    };
    const key = comboKey(parts);

    if (!groups.has(key)) {
      groups.set(key, { weighted_er_sum: 0, recency_weight_sum: 0, likes: [], viral_count: 0, count: 0, trust_scores: [], days_old_sum: 0, key_parts: parts });
    }
    const g = groups.get(key)!;

    // Source trust weighting (Improvement 1)
    const trustTarget = (row as any).vi_scrape_targets;
    const trustScore = Number(trustTarget?.source_trust_score) || 1.0;
    g.trust_scores.push(trustScore);

    // Recency decay (Improvement 6)
    const dateRef = (row as any).scraped_at || (row as any).posted_at;
    const daysOld = dateRef ? (now - new Date(dateRef).getTime()) / (24 * 60 * 60 * 1000) : 15;
    const recencyWeight = Math.exp(-daysOld / 14);
    g.days_old_sum += daysOld;

    const er = Number(row.engagement_rate) || 0;
    // Weight ER by both trust and recency
    g.weighted_er_sum += er * trustScore * recencyWeight;
    g.recency_weight_sum += trustScore * recencyWeight;

    g.likes.push(Number(row.likes) || 0);
    if (row.is_viral) g.viral_count++;
    g.count++;
  }

  const result = new Map<string, DimensionGroup & { source_trust_weight: number; avg_recency_days: number }>();
  for (const [key, g] of Array.from(groups.entries())) {
    // Weighted average ER (trust + recency weighted)
    const avgEng = g.recency_weight_sum > 0 ? g.weighted_er_sum / g.recency_weight_sum : 0;
    const avgLikes = g.likes.reduce((a, b) => a + b, 0) / g.count;
    const sourceTrustWeight = g.trust_scores.reduce((a, b) => a + b, 0) / g.trust_scores.length;
    const avgRecencyDays = g.days_old_sum / g.count;
    result.set(key, {
      ...g.key_parts,
      avg_engagement: avgEng,
      avg_likes: avgLikes,
      count: g.count,
      breakout_rate: g.count > 0 ? g.viral_count / g.count : 0,
      avg_views: 0,
      avg_reward: 0,
      avg_followers_gained: 0,
      avg_reply_likes: 0,
      avg_outperformance: 0,
      source_trust_weight: sourceTrustWeight,
      avg_recency_days: avgRecencyDays,
    });
  }

  console.log(`${TAG} External tweets: ${data.length} rows -> ${result.size} groups`);
  return result;
}

// ─── Source 2: External reply patterns ───

async function fetchExternalReplyPatterns(): Promise<Map<string, DimensionGroup>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('external_reply_patterns')
    .select('angle, tone, format, reply_likes, outperformance_ratio, is_loser_sample')
    .eq('classified', true)
    .limit(3000);

  if (error || !data) {
    console.warn(`${TAG} External reply patterns query failed: ${error?.message || 'no data'}`);
    return new Map();
  }

  const groups = new Map<string, {
    reply_likes: number[];
    outperformance: number[];
    count: number;
    winner_likes: number[];
    loser_likes: number[];
    loser_count: number;
    key_parts: Pick<DimensionGroup, 'pattern_type' | 'angle' | 'tone' | 'format' | 'hour_bucket' | 'topic' | 'target_tier'>;
  }>();

  for (const row of data) {
    const parts = {
      pattern_type: 'reply',
      angle: row.angle || 'any',
      tone: row.tone || 'any',
      format: row.format || 'any',
      hour_bucket: 'any',
      topic: 'any',
      target_tier: 'any',
    };
    const key = comboKey(parts);

    if (!groups.has(key)) {
      groups.set(key, { reply_likes: [], outperformance: [], count: 0, winner_likes: [], loser_likes: [], loser_count: 0, key_parts: parts });
    }
    const g = groups.get(key)!;
    const likes = Number(row.reply_likes) || 0;
    g.reply_likes.push(likes);
    g.outperformance.push(Number(row.outperformance_ratio) || 0);
    // Track winner/loser split (Improvement 2)
    if (row.is_loser_sample) {
      g.loser_likes.push(likes);
      g.loser_count++;
    } else {
      g.winner_likes.push(likes);
    }
    g.count++;
  }

  const result = new Map<string, DimensionGroup & { loser_sample_count: number; contrast_ratio: number }>();
  for (const [key, g] of Array.from(groups.entries())) {
    const avgWinnerLikes = g.winner_likes.length > 0 ? g.winner_likes.reduce((a, b) => a + b, 0) / g.winner_likes.length : 0;
    const avgLoserLikes = g.loser_likes.length > 0 ? g.loser_likes.reduce((a, b) => a + b, 0) / g.loser_likes.length : 0;
    const contrastRatio = avgWinnerLikes / Math.max(1, avgLoserLikes);
    result.set(key, {
      ...g.key_parts,
      avg_engagement: 0,
      avg_likes: 0,
      count: g.count,
      breakout_rate: 0,
      avg_views: 0,
      avg_reward: 0,
      avg_followers_gained: 0,
      avg_reply_likes: g.reply_likes.reduce((a, b) => a + b, 0) / g.count,
      avg_outperformance: g.outperformance.reduce((a, b) => a + b, 0) / g.count,
      loser_sample_count: g.loser_count,
      contrast_ratio: Math.round(contrastRatio * 1000) / 1000,
    });
  }

  console.log(`${TAG} External reply patterns: ${data.length} rows -> ${result.size} groups`);
  return result;
}

// ─── Source 4: Brain tweets (richer signal — algo_score, velocity, bookmark_save_rate) ───
// Brain combo_keys are prefixed with "brain:" so they don't collide with vi-source rows.
// tickAdvisor prefers source='brain' rows when both exist (via ORDER BY).

async function fetchBrainTweetPatterns(): Promise<Map<string, DimensionGroup & { source_trust_weight: number; avg_recency_days: number }>> {
  const supabase = getSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tweets, error } = await supabase
    .from('brain_tweets')
    .select('tweet_id, engagement_rate, likes, viral_multiplier, algo_score, bookmark_save_rate, conversation_ratio, share_ratio, velocity_15m, scraped_at, posted_at, posted_hour_utc, author_tier')
    .gte('scraped_at', thirtyDaysAgo)
    .not('engagement_rate', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(5000);

  if (error || !tweets || tweets.length === 0) {
    if (error) console.warn(`${TAG} brain_tweets fetch failed: ${error.message}`);
    return new Map();
  }

  const tweetIds = (tweets as any[]).map(t => t.tweet_id).filter(Boolean);
  const { data: classifications } = tweetIds.length > 0
    ? await supabase
        .from('brain_classifications')
        .select('tweet_id, domain, hook_type, tone, format')
        .in('tweet_id', tweetIds.slice(0, 1000))
    : { data: [] as any[] };

  const classMap = new Map<string, any>();
  for (const c of (classifications ?? [])) {
    if ((c as any).tweet_id) classMap.set((c as any).tweet_id, c);
  }

  const now = Date.now();
  const groups = new Map<string, {
    weighted_score_sum: number;
    recency_weight_sum: number;
    likes: number[];
    viral_count: number;
    count: number;
    days_old_sum: number;
    velocity_sum: number;
    velocity_count: number;
    key_parts: Pick<DimensionGroup, 'pattern_type' | 'angle' | 'tone' | 'format' | 'hour_bucket' | 'topic' | 'target_tier'>;
  }>();

  for (const row of tweets as any[]) {
    const cls = classMap.get(row.tweet_id);
    if (!cls) continue; // brain-source patterns require classification

    const hb = hourBucket(row.posted_hour_utc ?? 12);
    const parts = {
      pattern_type: 'external_tweet',
      angle: cls.hook_type || 'any',
      tone: cls.tone || 'any',
      format: cls.format || 'any',
      hour_bucket: hb,
      topic: cls.domain || 'any',
      target_tier: row.author_tier || 'any',
    };
    // Prefix with "brain:" so it doesn't collide with vi-source combo_keys.
    const key = 'brain:' + comboKey(parts);

    if (!groups.has(key)) {
      groups.set(key, {
        weighted_score_sum: 0,
        recency_weight_sum: 0,
        likes: [],
        viral_count: 0,
        count: 0,
        days_old_sum: 0,
        velocity_sum: 0,
        velocity_count: 0,
        key_parts: parts,
      });
    }
    const g = groups.get(key)!;

    // Recency decay (same as vi source)
    const dateRef = row.scraped_at || row.posted_at;
    const daysOld = dateRef ? (now - new Date(dateRef).getTime()) / (24 * 60 * 60 * 1000) : 15;
    const recencyWeight = Math.exp(-daysOld / 14);
    g.days_old_sum += daysOld;

    // Use algo_score when present (richer composite); fall back to engagement_rate.
    const score = row.algo_score != null
      ? Number(row.algo_score)
      : Number(row.engagement_rate) || 0;

    g.weighted_score_sum += score * recencyWeight;
    g.recency_weight_sum += recencyWeight;
    g.likes.push(Number(row.likes) || 0);
    if (Number(row.viral_multiplier) >= 5) g.viral_count++;

    if (row.velocity_15m != null) {
      g.velocity_sum += Number(row.velocity_15m);
      g.velocity_count++;
    }

    g.count++;
  }

  const result = new Map<string, DimensionGroup & { source_trust_weight: number; avg_recency_days: number }>();
  for (const [key, g] of Array.from(groups.entries())) {
    const avgScore = g.recency_weight_sum > 0 ? g.weighted_score_sum / g.recency_weight_sum : 0;
    const avgLikes = g.count > 0 ? g.likes.reduce((a, b) => a + b, 0) / g.count : 0;
    const avgRecencyDays = g.count > 0 ? g.days_old_sum / g.count : 0;
    result.set(key, {
      ...g.key_parts,
      avg_engagement: avgScore,
      avg_likes: avgLikes,
      count: g.count,
      breakout_rate: g.count > 0 ? g.viral_count / g.count : 0,
      avg_views: 0,
      avg_reward: 0,
      avg_followers_gained: 0,
      avg_reply_likes: 0,
      avg_outperformance: g.velocity_count > 0 ? g.velocity_sum / g.velocity_count : 0,
      // brain source has no per-row trust score; treat as 1.0 (the brain itself is the trust anchor)
      source_trust_weight: 1.0,
      avg_recency_days: avgRecencyDays,
    });
  }

  console.log(`${TAG} brain_tweets: ${tweets.length} rows -> ${result.size} groups`);
  return result;
}

// ─── Source 3: Growth ledger (internal data) ───

async function fetchGrowthLedgerPatterns(): Promise<Map<string, DimensionGroup>> {
  const supabase = getSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('growth_ledger')
    .select('action_type, topic, format_type, hook_type, archetype, posted_hour_utc, target_tier, views, reward, followers_gained')
    .gte('created_at', thirtyDaysAgo)
    .not('views', 'is', null)
    .limit(1000);

  if (error || !data) {
    console.warn(`${TAG} Growth ledger query failed: ${error?.message || 'no data'}`);
    return new Map();
  }

  const groups = new Map<string, {
    views: number[];
    rewards: number[];
    followers: number[];
    count: number;
    key_parts: Pick<DimensionGroup, 'pattern_type' | 'angle' | 'tone' | 'format' | 'hour_bucket' | 'topic' | 'target_tier'>;
  }>();

  // Map hour to bucket
  function hourToBucket(h: number | null): string {
    if (h == null) return 'any';
    if (h < 6) return 'night'; if (h < 10) return 'morning';
    if (h < 14) return 'midday'; if (h < 18) return 'afternoon';
    if (h < 22) return 'evening'; return 'night';
  }

  for (const row of data as any[]) {
    const parts = {
      pattern_type: 'internal' as const,
      angle: row.hook_type || row.archetype || 'any',
      tone: 'any', // growth_ledger doesn't have tone
      format: row.format_type || row.action_type || 'any',
      hour_bucket: hourToBucket(row.posted_hour_utc),
      topic: row.topic || 'any',
      target_tier: row.target_tier || 'any',
    };
    const key = comboKey(parts);

    if (!groups.has(key)) {
      groups.set(key, { views: [], rewards: [], followers: [], count: 0, key_parts: parts });
    }
    const g = groups.get(key)!;
    g.views.push(Number(row.views) || 0);
    g.rewards.push(Number(row.reward) || 0);
    g.followers.push(Number(row.followers_gained) || 0);
    g.count++;
  }

  const result = new Map<string, DimensionGroup>();
  for (const [key, g] of Array.from(groups.entries())) {
    result.set(key, {
      ...g.key_parts,
      avg_engagement: 0,
      avg_likes: 0,
      count: g.count,
      breakout_rate: 0,
      avg_views: g.views.reduce((a, b) => a + b, 0) / g.count,
      avg_reward: g.rewards.reduce((a, b) => a + b, 0) / g.count,
      avg_followers_gained: g.followers.reduce((a, b) => a + b, 0) / g.count,
      avg_reply_likes: 0,
      avg_outperformance: 0,
    });
  }

  console.log(`${TAG} Growth ledger: ${data.length} rows -> ${result.size} groups`);
  return result;
}

// ─── Normalization (percentile rank) ───

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= value);
  if (idx === -1) return 1.0;
  return idx / sorted.length;
}

// ─── Confidence + Direction ───

function computeConfidence(
  extSample: number,
  intSample: number,
  avgRecencyDays: number | null = null,
): 'high' | 'medium' | 'low' {
  let tier: 'high' | 'medium' | 'low';
  if (extSample >= 20 && intSample >= 5) tier = 'high';
  else if (extSample >= 10 || intSample >= 3) tier = 'medium';
  else tier = 'low';

  // Stale data drops one confidence tier. A pattern mined from 45-day-old
  // tweets is less reliable than the same pattern from last week — Twitter
  // algorithm + taste shifts too fast to trust old signal at high confidence.
  if (avgRecencyDays != null && avgRecencyDays > 30) {
    if (tier === 'high') tier = 'medium';
    else if (tier === 'medium') tier = 'low';
  }

  return tier;
}

function computeDirection(combinedScore: number, totalSample: number): string {
  if (totalSample < 3) return 'explore';
  if (combinedScore > 0.7) return 'do_more';
  if (combinedScore < 0.3) return 'do_less';
  return 'neutral';
}

// ─── Main ───

export async function runPatternAggregation(): Promise<{ patternsUpdated: number }> {
  console.log(`${TAG} Starting pattern aggregation...`);

  // Improvement 3: Determine our account stage
  const followerCount = await getFollowerCountFromDB().catch(() => 0);
  const our_stage = inferOurStage(followerCount);
  console.log(`${TAG} Account stage: ${our_stage} (${followerCount} followers)`);

  // Fetch all sources in parallel (brain_tweets is the new 4th source).
  const [extTweets, extReplies, internal, brainTweets] = await Promise.all([
    fetchExternalTweetPatterns().catch(err => {
      console.warn(`${TAG} External tweets fetch failed: ${err.message}`);
      return new Map<string, DimensionGroup>();
    }),
    fetchExternalReplyPatterns().catch(err => {
      console.warn(`${TAG} External replies fetch failed: ${err.message}`);
      return new Map<string, DimensionGroup>();
    }),
    fetchGrowthLedgerPatterns().catch(err => {
      console.warn(`${TAG} Growth ledger fetch failed: ${err.message}`);
      return new Map<string, DimensionGroup>();
    }),
    fetchBrainTweetPatterns().catch(err => {
      console.warn(`${TAG} brain_tweets fetch failed: ${err.message}`);
      return new Map<string, DimensionGroup>();
    }),
  ]);

  // Merge external sources (carry over trust/recency/contrast metadata).
  // Brain-source rows live under 'brain:'-prefixed keys so they're side-by-side
  // with vi-source rows; tickAdvisor's ORDER BY (source='brain') prefers them.
  const extAll = new Map<string, DimensionGroup & { source_trust_weight?: number; avg_recency_days?: number; loser_sample_count?: number; contrast_ratio?: number }>();
  for (const [k, v] of Array.from(extTweets.entries())) extAll.set(k, v as any);
  for (const [k, v] of Array.from(brainTweets.entries())) extAll.set(k, v as any);
  for (const [k, v] of Array.from(extReplies.entries())) {
    if (extAll.has(k)) {
      const existing = extAll.get(k)!;
      existing.avg_reply_likes = v.avg_reply_likes;
      existing.avg_outperformance = v.avg_outperformance;
      existing.count += v.count;
      // Carry loser data from reply patterns
      existing.loser_sample_count = (v as any).loser_sample_count;
      existing.contrast_ratio = (v as any).contrast_ratio;
    } else {
      extAll.set(k, v as any);
    }
  }

  // Collect all unique combo keys
  const allKeys = new Set<string>();
  for (const k of Array.from(extAll.keys())) allKeys.add(k);
  for (const k of Array.from(internal.keys())) allKeys.add(k);

  if (allKeys.size === 0) {
    console.log(`${TAG} No patterns to aggregate (all sources empty)`);
    return { patternsUpdated: 0 };
  }

  // Collect all scores for percentile normalization
  const extScores: number[] = [];
  const intScores: number[] = [];
  for (const g of Array.from(extAll.values())) {
    extScores.push(g.avg_engagement + g.avg_likes * 0.01 + g.avg_reply_likes + g.avg_outperformance);
  }
  for (const g of Array.from(internal.values())) {
    intScores.push(g.avg_views * 0.001 + g.avg_reward + g.avg_followers_gained);
  }

  // Build upsert rows
  const rows: Record<string, any>[] = [];

  for (const key of Array.from(allKeys)) {
    const ext = extAll.get(key);
    const int = internal.get(key);
    const ref = ext || int!;

    const extRaw = ext ? (ext.avg_engagement + ext.avg_likes * 0.01 + ext.avg_reply_likes + ext.avg_outperformance) : 0;
    const intRaw = int ? (int.avg_views * 0.001 + int.avg_reward + int.avg_followers_gained) : 0;

    let normExt = ext ? percentileRank(extScores, extRaw) : 0;
    const normInt = int ? percentileRank(intScores, intRaw) : 0;

    // Improvement 2: Contrast ratio boost (high winner/loser contrast boosts ext signal)
    const contrastRatio = ext?.contrast_ratio ?? 1;
    if (contrastRatio > 1) {
      normExt *= Math.min(1.5, 1 + (contrastRatio - 1) * 0.1);
    }

    // Improvement 4: Dynamic weighting based on internal sample size
    const intSamples = int?.count ?? 0;
    const intWeight = Math.min(0.95, 0.2 + (intSamples / 25) * 0.75);
    const extWeight = 1 - intWeight;

    let combinedScore: number;
    if (ext && int) {
      combinedScore = extWeight * normExt + intWeight * normInt;
    } else if (ext) {
      combinedScore = normExt * 0.5; // halved confidence
    } else {
      combinedScore = normInt;
    }

    const extSample = ext?.count ?? 0;
    const intSample = int?.count ?? 0;
    const confidence = computeConfidence(extSample, intSample, ext?.avg_recency_days ?? null);
    const direction = computeDirection(combinedScore, extSample + intSample);

    // Improvement 5: Causal status
    const causal_status = (ext && int) ? 'tested_candidate' : 'observed_correlation';

    // Source discriminator: brain combo_keys are prefixed; everything else is vi.
    // tickAdvisor uses this column to prefer richer brain-source signal.
    const source = key.startsWith('brain:') ? 'brain' : 'vi';

    rows.push({
      combo_key: key,
      source,
      pattern_type: ref.pattern_type,
      angle: ref.angle,
      tone: ref.tone,
      format: ref.format,
      hour_bucket: ref.hour_bucket,
      topic: ref.topic,
      target_tier: ref.target_tier,
      combined_score: Math.round(combinedScore * 1000) / 1000,
      confidence,
      direction,
      ext_sample_count: extSample,
      int_sample_count: intSample,
      ext_avg_engagement_rate: ext?.avg_engagement ?? null,
      ext_avg_likes: ext?.avg_likes ?? null,
      ext_avg_views: ext?.avg_views ?? null,
      ext_median_outperformance: ext?.avg_outperformance ?? null,
      ext_p75_likes: null,
      ext_breakout_rate: ext?.breakout_rate ?? null,
      int_avg_views: int?.avg_views ?? null,
      int_avg_reward: int?.avg_reward ?? null,
      int_avg_likes: int?.avg_likes ?? null,
      int_avg_followers_gained: int?.avg_followers_gained ?? null,
      int_breakout_rate: null,
      // Improvement 1: Source trust weighting
      source_trust_weight: ext?.source_trust_weight ?? null,
      // Improvement 2: Survivorship bias data
      loser_sample_count: ext?.loser_sample_count ?? null,
      contrast_ratio: ext?.contrast_ratio ?? null,
      // Improvement 3: Account stage
      our_stage,
      // Improvement 5: Causal status
      causal_status,
      // Improvement 6: Recency decay
      avg_recency_days: ext?.avg_recency_days ?? null,
      last_updated_at: new Date().toISOString(),
    });
  }

  // Upsert in batches
  const supabase = getSupabaseClient();
  const BATCH_SIZE = 200;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('external_patterns')
      .upsert(batch, { onConflict: 'combo_key' });

    if (error) {
      console.error(`${TAG} Upsert batch ${i / BATCH_SIZE} failed: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`${TAG} Aggregation complete: ${upserted} patterns upserted from ${allKeys.size} combos`);
  return { patternsUpdated: upserted };
}
