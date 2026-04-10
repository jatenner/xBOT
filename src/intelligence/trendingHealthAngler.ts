/**
 * TRENDING HEALTH ANGLER
 *
 * Finds health/science angles in whatever is currently trending on Twitter.
 * Transforms generic health content into timely, relevant takes that ride
 * trending waves.
 *
 * Examples of what this produces:
 * - "Neuralink just got FDA approval for its next trial. Here's what most people
 *    don't understand about brain-computer interfaces and neuroplasticity..."
 * - "Everyone's debating ozempic access. The real question: what happens to your
 *    gut microbiome after 2 years on GLP-1 agonists?"
 * - "That viral clip of the athlete collapsing mid-game? Here's the actual cardiac
 *    mechanism behind exercise-induced arrhythmia..."
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendingAngle {
  trending_topic: string;       // what's trending
  health_angle: string;         // the health spin
  suggested_hook: string;       // opening line suggestion
  urgency: 'breaking' | 'trending' | 'evergreen';
  source_tweets: string[];      // tweet IDs that inspired this
  confidence: number;           // 0-1, how strong is the health angle
}

// Internal: raw row coming back from the DB query
interface OpportunityRow {
  id: string;
  target_tweet_content: string | null;
  tweet_content: string | null;
  like_count: number;
  reply_count: number;
  tweet_posted_at: string;
  source_account_handle: string | null;
  target_tweet_id: string | null;
}

// ---------------------------------------------------------------------------
// Cache (avoid hammering the DB + OpenAI on every plan tick)
// ---------------------------------------------------------------------------

let cachedAngles: TrendingAngle[] = [];
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

// ---------------------------------------------------------------------------
// Core: findTrendingHealthAngles
// ---------------------------------------------------------------------------

/**
 * Discovers trending topics from recent high-engagement tweets and finds
 * creative health / science angles for each one.
 *
 * 1. Queries reply_opportunities for tweets from the last 6 hours with high
 *    engagement (like_count > 100 OR reply_count > 20).
 * 2. Groups by content similarity to surface the most common themes.
 * 3. Sends the top trending tweets to GPT for health-angle extraction.
 * 4. Filters by confidence > 0.5 and returns sorted desc.
 */
export async function findTrendingHealthAngles(): Promise<TrendingAngle[]> {
  // Serve from cache if fresh
  if (cachedAngles.length > 0 && Date.now() < cacheExpiresAt) {
    console.log('[HEALTH_ANGLER] Using cached angles (%d)', cachedAngles.length);
    return cachedAngles;
  }

  console.log('[HEALTH_ANGLER] Searching for trending health angles...');

  try {
    const supabase = getSupabaseClient();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // -----------------------------------------------------------------------
    // Step 1 & 2: Fetch high-engagement recent tweets
    // -----------------------------------------------------------------------

    // Query A: high likes
    const { data: highLikes, error: errLikes } = await supabase
      .from('reply_opportunities')
      .select('id, target_tweet_content, tweet_content, like_count, reply_count, tweet_posted_at, source_account_handle, target_tweet_id')
      .gte('tweet_posted_at', sixHoursAgo)
      .gte('like_count', 100)
      .order('like_count', { ascending: false })
      .limit(50);

    // Query B: high replies (may surface discussion-heavy topics with fewer likes)
    const { data: highReplies, error: errReplies } = await supabase
      .from('reply_opportunities')
      .select('id, target_tweet_content, tweet_content, like_count, reply_count, tweet_posted_at, source_account_handle, target_tweet_id')
      .gte('tweet_posted_at', sixHoursAgo)
      .gte('reply_count', 20)
      .order('reply_count', { ascending: false })
      .limit(50);

    if (errLikes) console.error('[HEALTH_ANGLER] DB error (likes query):', errLikes.message);
    if (errReplies) console.error('[HEALTH_ANGLER] DB error (replies query):', errReplies.message);

    // Merge and deduplicate by id
    const seenIds = new Set<string>();
    const merged: OpportunityRow[] = [];
    for (const row of [...(highLikes || []), ...(highReplies || [])]) {
      const typed = row as unknown as OpportunityRow;
      if (!seenIds.has(typed.id)) {
        seenIds.add(typed.id);
        merged.push(typed);
      }
    }

    if (merged.length === 0) {
      console.log('[HEALTH_ANGLER] No high-engagement tweets found in last 6h');
      cachedAngles = [];
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return [];
    }

    console.log('[HEALTH_ANGLER] Found %d high-engagement tweets to analyze', merged.length);

    // -----------------------------------------------------------------------
    // Step 3: Send to GPT for health-angle extraction
    // -----------------------------------------------------------------------

    // Take the top ~15 by a combined engagement score
    const scored = merged
      .map((t) => ({
        ...t,
        score: (t.like_count || 0) + (t.reply_count || 0) * 3, // replies weighted higher (discussion signal)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const tweetSummaries = scored.map((t, i) => ({
      idx: i + 1,
      content: String(t.target_tweet_content ?? t.tweet_content ?? '').slice(0, 280),
      likes: t.like_count ?? 0,
      replies: t.reply_count ?? 0,
      author: t.source_account_handle ?? 'unknown',
      tweet_id: t.target_tweet_id ?? t.id,
    }));

    const systemPrompt = `You are a health content strategist for a popular health/science Twitter account.
Given these trending tweets, find creative health/science angles.
Not everything is obvious health -- find the connection:
- Tech news -> health implications (AI, Neuralink, wearables, EMF)
- Political news -> public health angle (policy, access, funding)
- Celebrity news -> relevant health education (addiction, fitness, aging)
- Viral moments -> the science behind it (physics, physiology, psychology)
- Sports -> performance science, injury prevention, recovery
- Finance/economy -> stress, financial wellness, healthcare costs
- Food/culture -> nutrition science, gut health, food safety

Rules:
- Be specific and provocative. "Sleep is important" is boring. "Here's why shift workers have 3x the Alzheimer's risk" is interesting.
- The hook must be a single opening line that stops the scroll.
- Not every tweet will have a strong health angle. Only include ones where the connection is genuinely interesting (confidence > 0.5).
- Urgency: "breaking" = news from today, "trending" = hot topic this week, "evergreen" = timeless but topical.

For each trending topic, output a health angle and a hook.
Return JSON array: [{trending_topic, health_angle, suggested_hook, urgency, confidence}]`;

    const userPrompt = `Here are the top trending tweets right now:

${JSON.stringify(tweetSummaries, null, 2)}

For each tweet where you can find a genuinely interesting health/science angle, produce an entry.
Skip tweets where the connection is too forced.

Return a JSON object:
{
  "angles": [
    {
      "trending_topic": "short description of what's trending",
      "health_angle": "the specific health/science angle to explore",
      "suggested_hook": "the opening line for a tweet about this",
      "urgency": "breaking" | "trending" | "evergreen",
      "source_tweet_indices": [1, 3],
      "confidence": 0.0-1.0
    }
  ]
}

Return ONLY the JSON object.`;

    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
      { purpose: 'trending_health_angler' },
    );

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      console.warn('[HEALTH_ANGLER] Empty response from GPT');
      cachedAngles = [];
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return [];
    }

    // -----------------------------------------------------------------------
    // Step 4: Parse, map source tweet IDs, filter by confidence
    // -----------------------------------------------------------------------

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error('[HEALTH_ANGLER] Failed to parse GPT JSON:', (parseErr as Error).message);
      cachedAngles = [];
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return [];
    }

    const rawAngles: any[] = Array.isArray(parsed.angles)
      ? parsed.angles
      : Array.isArray(parsed)
        ? parsed
        : [];

    const angles: TrendingAngle[] = rawAngles
      .filter((a: any) => typeof a.confidence === 'number' && a.confidence > 0.5)
      .map((a: any) => {
        // Map source_tweet_indices back to actual tweet IDs
        const indices: number[] = Array.isArray(a.source_tweet_indices) ? a.source_tweet_indices : [];
        const sourceTweetIds = indices
          .map((idx: number) => {
            const summary = tweetSummaries.find((s) => s.idx === idx);
            return summary ? String(summary.tweet_id) : null;
          })
          .filter(Boolean) as string[];

        return {
          trending_topic: String(a.trending_topic || '').slice(0, 200),
          health_angle: String(a.health_angle || '').slice(0, 500),
          suggested_hook: String(a.suggested_hook || '').slice(0, 280),
          urgency: (['breaking', 'trending', 'evergreen'].includes(a.urgency) ? a.urgency : 'trending') as TrendingAngle['urgency'],
          source_tweets: sourceTweetIds,
          confidence: Math.min(1, Math.max(0, Number(a.confidence) || 0)),
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    console.log('[HEALTH_ANGLER] Produced %d health angles (filtered from %d)', angles.length, rawAngles.length);
    for (const a of angles.slice(0, 3)) {
      console.log(
        `  "${a.trending_topic}" -> "${a.health_angle}" (confidence: ${a.confidence.toFixed(2)})`,
      );
    }

    // Cache
    cachedAngles = angles;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return angles;
  } catch (err: any) {
    console.error('[HEALTH_ANGLER] Fatal error:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// injectTrendingContext
// ---------------------------------------------------------------------------

/**
 * Takes the existing topic pool from planJob and enriches it with
 * trending health angles. Returns an expanded list of topic strings.
 *
 * The injected topics are phrased as specific, actionable angles rather than
 * generic topic names -- this gives the content generator much better material.
 */
export async function injectTrendingContext(existingTopicPool: string[]): Promise<string[]> {
  try {
    const angles = await findTrendingHealthAngles();

    if (angles.length === 0) {
      console.log('[HEALTH_ANGLER] No trending angles to inject; returning original pool');
      return existingTopicPool;
    }

    // Build topic strings from angles. Use the health_angle because it's more
    // specific than trending_topic and gives the content generator a real direction.
    const trendingTopics = angles.map((a) => {
      // Prefix with urgency hint so the content generator can prioritise
      const prefix = a.urgency === 'breaking' ? '[BREAKING] ' : a.urgency === 'trending' ? '[TRENDING] ' : '';
      return `${prefix}${a.health_angle} (hook: ${a.suggested_hook})`;
    });

    // Deduplicate against existing pool (fuzzy: if the first 40 chars match, skip)
    const existingLower = new Set(existingTopicPool.map((t) => t.toLowerCase().slice(0, 40)));
    const unique = trendingTopics.filter(
      (t) => !existingLower.has(t.toLowerCase().slice(0, 40)),
    );

    const merged = [...existingTopicPool, ...unique];

    console.log(
      '[HEALTH_ANGLER] Injected %d trending topics into pool (pool size: %d -> %d)',
      unique.length,
      existingTopicPool.length,
      merged.length,
    );

    return merged;
  } catch (err: any) {
    console.error('[HEALTH_ANGLER] injectTrendingContext error:', err.message);
    // Never break the caller -- return original pool on failure
    return existingTopicPool;
  }
}
