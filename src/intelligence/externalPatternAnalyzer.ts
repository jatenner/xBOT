/**
 * External Pattern Analyzer
 *
 * Analyzes data from reply_opportunities (external tweets) and our own reply
 * outcomes to extract actionable patterns that improve content and targeting.
 *
 * Produces an ExternalIntelligence object that can be turned into a prompt
 * snippet via generateReplyGuidance().
 */

import { getSupabaseClient } from '../db/index';
import { extractContentFeatures, ContentFeatures } from '../utils/contentFeatureExtractor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExternalIntelligence {
  /** Content patterns from analyzing external tweets */
  content_patterns: {
    avg_char_count_top_tweets: number;
    question_rate_top_vs_bottom: number;
    number_rate_top_vs_bottom: number;
    top_opening_patterns: string[];
    optimal_length_range: [number, number];
  };

  /** Reply patterns from analyzing OUR replies and their outcomes */
  reply_patterns: {
    avg_views_by_length_bucket: Record<string, number>;   // short|medium|long -> avg views
    avg_views_by_has_question: Record<string, number>;     // yes|no -> avg views
    avg_views_by_has_numbers: Record<string, number>;
    avg_views_by_reply_delay: Record<string, number>;      // fast|medium|slow -> avg views
    best_reply_length_range: [number, number];
  };

  /** Account targeting patterns */
  account_patterns: {
    best_follower_range: [number, number];
    avg_views_by_follower_tier: Record<string, number>;
    best_discovery_sources: string[];
  };

  /** Timing patterns */
  timing_patterns: {
    best_hours_utc: number[];
    avg_engagement_by_hour: Record<string, number>;
  };

  generated_at: string;
  sample_size: { external_tweets: number; our_replies: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAG = '[EXTERNAL_PATTERN]';

function safeDiv(a: number, b: number, fallback = 0): number {
  return b > 0 ? a / b : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

/** Classify follower count into a tier label. */
function followerTier(followers: number): string {
  if (followers < 10_000) return '0-10K';
  if (followers < 50_000) return '10K-50K';
  if (followers < 200_000) return '50K-200K';
  if (followers < 1_000_000) return '200K-1M';
  return '1M+';
}

/** Classify character count into a length bucket. */
function lengthBucket(chars: number): string {
  if (chars < 80) return 'short';
  if (chars <= 160) return 'medium';
  return 'long';
}

/** Classify reply delay (minutes) into a speed bucket. */
function delayBucket(minutes: number): string {
  if (minutes < 15) return 'fast';
  if (minutes <= 60) return 'medium';
  return 'slow';
}

interface BucketAccumulator {
  sum: number;
  count: number;
}

function bucketAvg(acc: Record<string, BucketAccumulator>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, { sum, count }] of Object.entries(acc)) {
    result[key] = round2(safeDiv(sum, count));
  }
  return result;
}

function addToBucket(acc: Record<string, BucketAccumulator>, key: string, value: number): void {
  if (!acc[key]) acc[key] = { sum: 0, count: 0 };
  acc[key].sum += value;
  acc[key].count += 1;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultIntelligence(): ExternalIntelligence {
  return {
    content_patterns: {
      avg_char_count_top_tweets: 140,
      question_rate_top_vs_bottom: 1.0,
      number_rate_top_vs_bottom: 1.0,
      top_opening_patterns: [],
      optimal_length_range: [80, 200],
    },
    reply_patterns: {
      avg_views_by_length_bucket: { short: 0, medium: 0, long: 0 },
      avg_views_by_has_question: { yes: 0, no: 0 },
      avg_views_by_has_numbers: { yes: 0, no: 0 },
      avg_views_by_reply_delay: { fast: 0, medium: 0, slow: 0 },
      best_reply_length_range: [60, 140],
    },
    account_patterns: {
      best_follower_range: [10_000, 200_000],
      avg_views_by_follower_tier: {},
      best_discovery_sources: [],
    },
    timing_patterns: {
      best_hours_utc: [14, 15, 16, 17, 18],
      avg_engagement_by_hour: {},
    },
    generated_at: new Date().toISOString(),
    sample_size: { external_tweets: 0, our_replies: 0 },
  };
}

// ---------------------------------------------------------------------------
// 1. Content Patterns (from reply_opportunities)
// ---------------------------------------------------------------------------

async function analyzeContentPatterns(): Promise<ExternalIntelligence['content_patterns']> {
  const supabase = getSupabaseClient();
  const defaults = defaultIntelligence().content_patterns;

  try {
    // Fetch opportunities with content and likes > 0, ordered by likes desc.
    // Limit to recent 2000 for performance.
    const { data, error } = await supabase
      .from('reply_opportunities')
      .select('tweet_content, like_count')
      .gt('like_count', 0)
      .not('tweet_content', 'is', null)
      .order('like_count', { ascending: false })
      .limit(2000);

    if (error || !data || data.length < 20) {
      console.warn(`${TAG} contentPatterns: insufficient data (${data?.length ?? 0} rows). Using defaults.`);
      return defaults;
    }

    // Extract features for every row
    const rows = data.map((r: { tweet_content: string; like_count: number }) => ({
      features: extractContentFeatures(r.tweet_content),
      likes: Number(r.like_count) || 0,
    }));

    // Top 25% and bottom 25% by likes (data is already sorted desc)
    const q75idx = Math.floor(rows.length * 0.25);
    const top25 = rows.slice(0, q75idx);
    const bottom25 = rows.slice(rows.length - q75idx);

    // Avg char count of top tweets
    const avgCharTop = safeDiv(
      top25.reduce((s, r) => s + r.features.char_count, 0),
      top25.length,
    );

    // Question rate comparison
    const questionRateTop = safeDiv(top25.filter(r => r.features.has_question).length, top25.length);
    const questionRateBot = safeDiv(bottom25.filter(r => r.features.has_question).length, bottom25.length);
    const questionRatio = round2(safeDiv(questionRateTop, questionRateBot, 1));

    // Number rate comparison
    const numberRateTop = safeDiv(top25.filter(r => r.features.has_numbers).length, top25.length);
    const numberRateBot = safeDiv(bottom25.filter(r => r.features.has_numbers).length, bottom25.length);
    const numberRatio = round2(safeDiv(numberRateTop, numberRateBot, 1));

    // Opening patterns: count opening_pattern occurrences in top25, take top 10
    const openingCounts = new Map<string, number>();
    for (const r of top25) {
      const op = r.features.opening_pattern;
      if (op && op.length > 3) {
        openingCounts.set(op, (openingCounts.get(op) || 0) + 1);
      }
    }
    const topOpenings = Array.from(openingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern]) => pattern);

    // Optimal length range: char_count range of top 25%
    const topChars = top25.map(r => r.features.char_count).sort((a, b) => a - b);
    const optLow = percentile(topChars, 0.1);
    const optHigh = percentile(topChars, 0.9);

    return {
      avg_char_count_top_tweets: round2(avgCharTop),
      question_rate_top_vs_bottom: questionRatio,
      number_rate_top_vs_bottom: numberRatio,
      top_opening_patterns: topOpenings,
      optimal_length_range: [optLow, optHigh],
    };
  } catch (err) {
    console.error(`${TAG} contentPatterns error:`, err);
    return defaults;
  }
}

// ---------------------------------------------------------------------------
// 2. Reply Patterns (from our replies + outcomes)
// ---------------------------------------------------------------------------

async function analyzeReplyPatterns(): Promise<{
  patterns: ExternalIntelligence['reply_patterns'];
  replyCount: number;
}> {
  const supabase = getSupabaseClient();
  const defaults = defaultIntelligence().reply_patterns;

  try {
    // Join reply_execution_events -> reply_performance_snapshots for outcome data.
    // Use the latest snapshot per reply (highest minutes_since_post) for best metrics.
    // Also join to content_generation_metadata_comprehensive for content features + delay.

    // Step 1: Get reply execution events
    const { data: events, error: evtErr } = await supabase
      .from('reply_execution_events')
      .select('id, target_tweet_id, posted_at, target_tweet_age_minutes, our_reply_tweet_id, metadata_json')
      .eq('dry_run', false)
      .order('posted_at', { ascending: false })
      .limit(1000);

    if (evtErr || !events || events.length === 0) {
      console.warn(`${TAG} replyPatterns: no execution events. Using defaults.`);
      return { patterns: defaults, replyCount: 0 };
    }

    // Step 2: Get snapshots for these events (latest per event)
    const eventIds = events.map((e: { id: string }) => e.id);

    const { data: snapshots, error: snapErr } = await supabase
      .from('reply_performance_snapshots')
      .select('reply_execution_event_id, impressions, likes, minutes_since_post')
      .in('reply_execution_event_id', eventIds)
      .order('minutes_since_post', { ascending: false });

    if (snapErr) {
      console.warn(`${TAG} replyPatterns: snapshot query error: ${snapErr.message}`);
      return { patterns: defaults, replyCount: 0 };
    }

    // Deduplicate: keep only latest snapshot per event
    const latestByEvent = new Map<string, { impressions: number; likes: number }>();
    for (const snap of (snapshots || [])) {
      const eid = snap.reply_execution_event_id as string;
      if (!latestByEvent.has(eid) && snap.impressions != null && snap.impressions > 0) {
        latestByEvent.set(eid, {
          impressions: Number(snap.impressions) || 0,
          likes: Number(snap.likes) || 0,
        });
      }
    }

    // Step 3: Get content + delay info from content_generation_metadata_comprehensive
    const replyTweetIds = events
      .map((e: { our_reply_tweet_id: string }) => e.our_reply_tweet_id)
      .filter(Boolean);

    const contentMap = new Map<
      string,
      { content: string; reply_delay_minutes: number | null; content_features: ContentFeatures | null }
    >();

    if (replyTweetIds.length > 0) {
      const { data: contentRows } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('content, reply_delay_minutes, content_features, tweet_id')
        .eq('decision_type', 'reply')
        .in('tweet_id', replyTweetIds)
        .limit(1000);

      if (contentRows) {
        for (const row of contentRows) {
          const tid = row.tweet_id as string;
          if (tid) {
            contentMap.set(tid, {
              content: (row.content as string) || '',
              reply_delay_minutes:
                row.reply_delay_minutes != null ? Number(row.reply_delay_minutes) : null,
              content_features: row.content_features as ContentFeatures | null,
            });
          }
        }
      }
    }

    // Step 4: Build buckets
    const lengthAcc: Record<string, BucketAccumulator> = {};
    const questionAcc: Record<string, BucketAccumulator> = {};
    const numberAcc: Record<string, BucketAccumulator> = {};
    const delayAcc: Record<string, BucketAccumulator> = {};
    const validLengths: { chars: number; views: number }[] = [];
    let replyCount = 0;

    for (const evt of events) {
      const outcome = latestByEvent.get(evt.id as string);
      if (!outcome || outcome.impressions <= 0) continue;

      const views = outcome.impressions;
      const contentInfo = contentMap.get(evt.our_reply_tweet_id as string);

      // Extract features: prefer stored, else extract from content
      let features: ContentFeatures | null = null;
      if (contentInfo?.content_features) {
        features = contentInfo.content_features;
      } else if (contentInfo?.content) {
        features = extractContentFeatures(contentInfo.content);
      }

      if (features) {
        // Length bucket
        const lb = lengthBucket(features.char_count);
        addToBucket(lengthAcc, lb, views);
        validLengths.push({ chars: features.char_count, views });

        // Question
        addToBucket(questionAcc, features.has_question ? 'yes' : 'no', views);

        // Numbers
        addToBucket(numberAcc, features.has_numbers ? 'yes' : 'no', views);
      }

      // Reply delay
      const delayMin =
        contentInfo?.reply_delay_minutes ??
        (evt.target_tweet_age_minutes != null ? Number(evt.target_tweet_age_minutes) : null);
      if (delayMin != null && delayMin >= 0) {
        addToBucket(delayAcc, delayBucket(delayMin), views);
      }

      replyCount++;
    }

    if (replyCount < 5) {
      console.warn(`${TAG} replyPatterns: only ${replyCount} replies with outcomes. Using defaults.`);
      return { patterns: defaults, replyCount };
    }

    // Best reply length range: sort by views desc, take top 25%, find 10-90 percentile
    validLengths.sort((a, b) => b.views - a.views);
    const top25Lengths = validLengths.slice(0, Math.max(3, Math.floor(validLengths.length * 0.25)));
    const topCharsSorted = top25Lengths.map(r => r.chars).sort((a, b) => a - b);
    const bestLow = topCharsSorted.length > 0 ? percentile(topCharsSorted, 0.1) : 60;
    const bestHigh = topCharsSorted.length > 0 ? percentile(topCharsSorted, 0.9) : 140;

    return {
      patterns: {
        avg_views_by_length_bucket: bucketAvg(lengthAcc),
        avg_views_by_has_question: bucketAvg(questionAcc),
        avg_views_by_has_numbers: bucketAvg(numberAcc),
        avg_views_by_reply_delay: bucketAvg(delayAcc),
        best_reply_length_range: [bestLow, bestHigh],
      },
      replyCount,
    };
  } catch (err) {
    console.error(`${TAG} replyPatterns error:`, err);
    return { patterns: defaults, replyCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// 3. Account Patterns (from reply_opportunities + reply execution events)
// ---------------------------------------------------------------------------

async function analyzeAccountPatterns(): Promise<ExternalIntelligence['account_patterns']> {
  const supabase = getSupabaseClient();
  const defaults = defaultIntelligence().account_patterns;

  try {
    // Get reply_opportunities with target_followers and like_count
    const { data: opps, error: oppErr } = await supabase
      .from('reply_opportunities')
      .select('target_followers, like_count')
      .gt('like_count', 0)
      .not('target_followers', 'is', null)
      .gt('target_followers', 0)
      .order('like_count', { ascending: false })
      .limit(2000);

    const tierAcc: Record<string, BucketAccumulator> = {};

    if (!oppErr && opps && opps.length > 0) {
      for (const opp of opps) {
        const followers = Number(opp.target_followers) || 0;
        const likes = Number(opp.like_count) || 0;
        if (followers > 0) {
          addToBucket(tierAcc, followerTier(followers), likes);
        }
      }
    }

    // Also pull from reply_execution_events for discovery source stats
    const { data: execEvents, error: execErr } = await supabase
      .from('reply_execution_events')
      .select('id, target_followers, account_size_tier, discovery_source')
      .eq('dry_run', false)
      .not('target_followers', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(500);

    // Discovery source counts
    const sourceCounts = new Map<string, number>();
    if (!execErr && execEvents) {
      for (const evt of execEvents) {
        const src = (evt.discovery_source as string) || 'unknown';
        sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
      }
    }

    const avgByTier = bucketAvg(tierAcc);

    // Find best follower range: tier with highest avg likes
    let bestTier = '10K-50K';
    let bestAvg = 0;
    for (const [tier, avg] of Object.entries(avgByTier)) {
      if (avg > bestAvg) {
        bestAvg = avg;
        bestTier = tier;
      }
    }

    // Map tier label to numeric range
    const tierRanges: Record<string, [number, number]> = {
      '0-10K': [0, 10_000],
      '10K-50K': [10_000, 50_000],
      '50K-200K': [50_000, 200_000],
      '200K-1M': [200_000, 1_000_000],
      '1M+': [1_000_000, 10_000_000],
    };

    const bestRange = tierRanges[bestTier] || [10_000, 200_000];

    // Top discovery sources
    const bestSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([src]) => src);

    return {
      best_follower_range: bestRange,
      avg_views_by_follower_tier: avgByTier,
      best_discovery_sources: bestSources.length > 0 ? bestSources : defaults.best_discovery_sources,
    };
  } catch (err) {
    console.error(`${TAG} accountPatterns error:`, err);
    return defaults;
  }
}

// ---------------------------------------------------------------------------
// 4. Timing Patterns (from reply_opportunities)
// ---------------------------------------------------------------------------

async function analyzeTimingPatterns(): Promise<ExternalIntelligence['timing_patterns']> {
  const supabase = getSupabaseClient();
  const defaults = defaultIntelligence().timing_patterns;

  try {
    // Fetch opportunities with a timestamp and engagement
    const { data, error } = await supabase
      .from('reply_opportunities')
      .select('tweet_posted_at, created_at, like_count')
      .gt('like_count', 0)
      .order('like_count', { ascending: false })
      .limit(3000);

    if (error || !data || data.length < 20) {
      console.warn(`${TAG} timingPatterns: insufficient data (${data?.length ?? 0}). Using defaults.`);
      return defaults;
    }

    const hourAcc: Record<string, BucketAccumulator> = {};

    for (const row of data) {
      const ts = row.tweet_posted_at || row.created_at;
      if (!ts) continue;
      const date = new Date(ts as string);
      if (isNaN(date.getTime())) continue;
      const hourUtc = date.getUTCHours();
      const likes = Number(row.like_count) || 0;
      addToBucket(hourAcc, String(hourUtc), likes);
    }

    const avgByHour = bucketAvg(hourAcc);

    // Top 5 hours by avg engagement
    const bestHours = Object.entries(avgByHour)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h]) => Number(h));

    return {
      best_hours_utc: bestHours.length > 0 ? bestHours : defaults.best_hours_utc,
      avg_engagement_by_hour: avgByHour,
    };
  } catch (err) {
    console.error(`${TAG} timingPatterns error:`, err);
    return defaults;
  }
}

// ---------------------------------------------------------------------------
// Cache: getCachedIntelligence
// ---------------------------------------------------------------------------

let cachedIntelligence: ExternalIntelligence | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getCachedIntelligence(): Promise<ExternalIntelligence | null> {
  if (cachedIntelligence && Date.now() - cacheTime < CACHE_TTL) return cachedIntelligence;
  try {
    cachedIntelligence = await analyzeExternalPatterns();
    cacheTime = Date.now();
    return cachedIntelligence;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main: analyzeExternalPatterns
// ---------------------------------------------------------------------------

export async function analyzeExternalPatterns(): Promise<ExternalIntelligence> {
  console.log(`${TAG} Starting external pattern analysis...`);

  // Run all four analyses in parallel
  const [contentPatterns, replyResult, accountPatterns, timingPatterns] = await Promise.all([
    analyzeContentPatterns(),
    analyzeReplyPatterns(),
    analyzeAccountPatterns(),
    analyzeTimingPatterns(),
  ]);

  // Get approximate count of external tweets analyzed
  let externalCount = 0;
  try {
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from('reply_opportunities')
      .select('id', { count: 'exact', head: true })
      .gt('like_count', 0);
    externalCount = count ?? 0;
  } catch {
    // Ignore — count is informational only
  }

  const intelligence: ExternalIntelligence = {
    content_patterns: contentPatterns,
    reply_patterns: replyResult.patterns,
    account_patterns: accountPatterns,
    timing_patterns: timingPatterns,
    generated_at: new Date().toISOString(),
    sample_size: {
      external_tweets: externalCount,
      our_replies: replyResult.replyCount,
    },
  };

  console.log(
    `${TAG} Analysis complete. External tweets: ${externalCount}, Our replies: ${replyResult.replyCount}`,
  );

  return intelligence;
}

// ---------------------------------------------------------------------------
// generateReplyGuidance — turns intelligence into a prompt snippet
// ---------------------------------------------------------------------------

export async function generateReplyGuidance(intelligence: ExternalIntelligence): Promise<string> {
  const lines: string[] = [];
  const { content_patterns, reply_patterns, account_patterns, timing_patterns, sample_size } =
    intelligence;

  lines.push(
    `Based on analysis of ${sample_size.external_tweets} external tweets and ${sample_size.our_replies} of our own replies:`,
  );

  // Content length guidance
  const [optLow, optHigh] = content_patterns.optimal_length_range;
  if (optLow > 0 && optHigh > 0) {
    lines.push(`- Top-performing tweets are ${optLow}-${optHigh} characters long.`);
  }

  // Best reply length
  const [rLow, rHigh] = reply_patterns.best_reply_length_range;
  if (rLow > 0 && rHigh > 0 && sample_size.our_replies >= 5) {
    lines.push(`- Our best-performing replies are ${rLow}-${rHigh} characters.`);
  }

  // Questions — external signal
  if (content_patterns.question_rate_top_vs_bottom > 1.2) {
    lines.push(
      `- Questions get ${content_patterns.question_rate_top_vs_bottom}x more engagement than non-questions.`,
    );
  } else if (content_patterns.question_rate_top_vs_bottom < 0.8) {
    lines.push(`- Questions underperform — prefer declarative statements.`);
  }

  // Questions — our reply signal
  const qYes = reply_patterns.avg_views_by_has_question['yes'] || 0;
  const qNo = reply_patterns.avg_views_by_has_question['no'] || 0;
  if (qYes > 0 && qNo > 0) {
    const ratio = round2(qYes / qNo);
    if (ratio > 1.2) {
      lines.push(`- Our replies with questions get ${ratio}x more views.`);
    } else if (ratio < 0.8) {
      lines.push(`- Our replies without questions actually perform better.`);
    }
  }

  // Numbers/stats — external signal
  if (content_patterns.number_rate_top_vs_bottom > 1.2) {
    lines.push(
      `- Tweets with numbers/stats get ${content_patterns.number_rate_top_vs_bottom}x more engagement.`,
    );
  }

  // Numbers/stats — our reply signal
  const nYes = reply_patterns.avg_views_by_has_numbers['yes'] || 0;
  const nNo = reply_patterns.avg_views_by_has_numbers['no'] || 0;
  if (nYes > 0 && nNo > 0) {
    const ratio = round2(nYes / nNo);
    if (ratio > 1.2) {
      lines.push(`- Including a specific number or stat in replies boosts views by ${ratio}x.`);
    }
  }

  // Reply speed
  const fast = reply_patterns.avg_views_by_reply_delay['fast'] || 0;
  const medium = reply_patterns.avg_views_by_reply_delay['medium'] || 0;
  const slow = reply_patterns.avg_views_by_reply_delay['slow'] || 0;
  if (fast > 0 && slow > 0 && fast > slow * 1.2) {
    lines.push(
      `- Reply within 15 minutes for best visibility (fast replies avg ${Math.round(fast)} views vs ${Math.round(slow)} for slow).`,
    );
  } else if (medium > fast && medium > slow && medium > 0) {
    lines.push(
      `- Mid-speed replies (15-60 min) perform best at avg ${Math.round(medium)} views.`,
    );
  }

  // Account targeting
  const [bLow, bHigh] = account_patterns.best_follower_range;
  if (bLow > 0 || bHigh > 0) {
    const formatK = (n: number) =>
      n >= 1_000_000
        ? `${(n / 1_000_000).toFixed(1)}M`
        : `${Math.round(n / 1000)}K`;
    lines.push(`- Best reply targets have ${formatK(bLow)}-${formatK(bHigh)} followers.`);
  }

  // Timing
  if (timing_patterns.best_hours_utc.length > 0) {
    const hoursStr = timing_patterns.best_hours_utc
      .slice(0, 3)
      .map(h => `${h}:00`)
      .join(', ');
    lines.push(`- Peak engagement hours (UTC): ${hoursStr}.`);
  }

  // Length-bucket winner from our replies
  const lenBuckets = reply_patterns.avg_views_by_length_bucket;
  const bucketEntries = Object.entries(lenBuckets).filter(([, v]) => v > 0);
  if (bucketEntries.length >= 2) {
    const bestBucket = bucketEntries.sort((a, b) => b[1] - a[1])[0];
    lines.push(
      `- "${bestBucket[0]}" replies perform best (avg ${Math.round(bestBucket[1])} views).`,
    );
  }

  return lines.join('\n');
}
