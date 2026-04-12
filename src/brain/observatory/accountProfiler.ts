/**
 * Account Profiler
 *
 * Classifies growing accounts by type, niche, voice, and behavior.
 * Filters out noise (follow-farmers, bots, celebrities) so the
 * strategy library only learns from real content creators.
 *
 * Runs hourly. Only profiles accounts flagged as interesting/hot/explosive
 * that either have no profile or a stale one.
 *
 * Two classification methods:
 * 1. Heuristic (free): FF ratio, posting frequency, content patterns
 * 2. AI (gpt-4o-mini): Niche detection, voice style, content summary
 */

import { getSupabaseClient } from '../../db';
import { createBudgetedChatCompletion } from '../../services/openaiBudgetedClient';
import type { AccountType } from '../types';

const LOG_PREFIX = '[observatory/profiler]';
const MAX_AI_ACCOUNTS_PER_RUN = 10;  // AI classification (costs money)
const MAX_HEURISTIC_PER_RUN = 200;   // Heuristic-only (free, instant)
const PROFILE_STALE_DAYS = 14;

export async function runAccountProfiler(): Promise<{
  profiled: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();
  const staleCutoff = new Date(Date.now() - PROFILE_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // === FAST PASS: Heuristic-only classification for ALL unclassified accounts ===
  // This tags celebrities, bots, brands, follow-farmers instantly without AI.
  // Runs on accounts that have follower data but no account_type_cached yet.
  let heuristicTagged = 0;
  try {
    const { data: unclassified } = await supabase
      .from('brain_accounts')
      .select('username, followers_count, following_count, ff_ratio, bio_text')
      .eq('is_active', true)
      .is('account_type_cached', null)
      .not('followers_count', 'is', null)
      .gte('followers_count', 1) // Need at least some follower data
      .limit(MAX_HEURISTIC_PER_RUN);

    if (unclassified && unclassified.length > 0) {
      for (const account of unclassified) {
        const hType = classifyAccountTypeHeuristic(account);
        await supabase
          .from('brain_accounts')
          .update({ account_type_cached: hType })
          .eq('username', account.username);
        heuristicTagged++;
      }
      if (heuristicTagged > 0) {
        console.log(`${LOG_PREFIX} Fast pass: tagged ${heuristicTagged} accounts via heuristic (${unclassified.length} checked)`);
      }
    }
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Heuristic pass error: ${err.message}`);
  }

  // === DEEP PASS: AI classification for growing accounts (niche, voice, style) ===
  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, following_count, ff_ratio, bio_text, growth_status, growth_rate_7d')
    .in('growth_status', ['interesting', 'hot', 'explosive'])
    .eq('is_active', true)
    .limit(MAX_AI_ACCOUNTS_PER_RUN * 3);

  if (!accounts || accounts.length === 0) {
    return { profiled: heuristicTagged, errors: 0 };
  }

  // Filter to those needing profiling
  const usernames = accounts.map(a => a.username);
  const { data: existingProfiles } = await supabase
    .from('brain_account_profiles')
    .select('username, profiled_at')
    .in('username', usernames);

  const profileMap = new Map((existingProfiles ?? []).map(p => [p.username, p.profiled_at]));

  const needsProfile = accounts.filter(a => {
    const profiledAt = profileMap.get(a.username);
    if (!profiledAt) return true; // Never profiled
    return new Date(profiledAt) < new Date(staleCutoff); // Stale profile
  }).slice(0, MAX_AI_ACCOUNTS_PER_RUN);

  if (needsProfile.length === 0) {
    return { profiled: 0, errors: 0 };
  }

  let profiled = 0;
  let errors = 0;

  for (const account of needsProfile) {
    try {
      // Step 1: Heuristic classification (free)
      const heuristicType = classifyAccountTypeHeuristic(account);

      // Skip non-content-creators for AI profiling (save cost)
      if (heuristicType === 'bot' || heuristicType === 'follow_farmer' || heuristicType === 'dormant') {
        await upsertProfile(supabase, {
          username: account.username,
          account_type: heuristicType,
          niche: null,
          sub_niches: [],
          voice_style: null,
          posting_frequency_daily: null,
          reply_ratio: null,
          avg_reply_target_size: null,
          active_hours: null,
          content_style_summary: `Heuristic: classified as ${heuristicType}`,
          ff_ratio: account.ff_ratio,
          profile_confidence: 0.7,
        });

        // Denormalize to brain_accounts
        await supabase
          .from('brain_accounts')
          .update({ account_type_cached: heuristicType })
          .eq('username', account.username);

        profiled++;
        continue;
      }

      // Step 2: Get their archived tweets for AI analysis
      const { data: tweets } = await supabase
        .from('brain_tweets')
        .select('content, likes, retweets, replies, tweet_type, posted_at')
        .eq('author_username', account.username)
        .order('likes', { ascending: false })
        .limit(20);

      if (!tweets || tweets.length < 3) {
        // Not enough content to profile — skip for now
        continue;
      }

      // Step 3: Compute behavioral metrics from tweets
      const totalTweets = tweets.length;
      const replyTweets = tweets.filter(t => t.tweet_type === 'reply').length;
      const replyRatio = totalTweets > 0 ? replyTweets / totalTweets : 0;

      // Posting frequency: estimate from date range
      const dates = tweets.map(t => t.posted_at).filter(Boolean).sort();
      let postingFreq: number | null = null;
      if (dates.length >= 2) {
        const firstDate = new Date(dates[0]!).getTime();
        const lastDate = new Date(dates[dates.length - 1]!).getTime();
        const daySpan = Math.max(1, (lastDate - firstDate) / (24 * 60 * 60 * 1000));
        postingFreq = Math.round((totalTweets / daySpan) * 10) / 10;
      }

      // Active hours distribution
      const hourDist: Record<string, number> = {};
      for (const t of tweets) {
        if (t.posted_at) {
          const hour = new Date(t.posted_at).getUTCHours();
          hourDist[String(hour)] = (hourDist[String(hour)] ?? 0) + 1;
        }
      }

      // Step 4: AI classification for niche, voice, style
      const tweetSamples = tweets.slice(0, 10).map((t, i) =>
        `${i + 1}. "${(t.content || '').substring(0, 200)}" (${t.likes} likes)`
      ).join('\n');

      const aiResult = await classifyWithAI(account.username, account.bio_text, tweetSamples, heuristicType);

      // Step 5: Store profile
      await upsertProfile(supabase, {
        username: account.username,
        account_type: aiResult.account_type || heuristicType,
        niche: aiResult.niche,
        sub_niches: aiResult.sub_niches,
        voice_style: aiResult.voice_style,
        posting_frequency_daily: postingFreq,
        reply_ratio: Math.round(replyRatio * 100) / 100,
        avg_reply_target_size: null, // Would need reply target data
        active_hours: hourDist,
        content_style_summary: aiResult.content_summary,
        ff_ratio: account.ff_ratio,
        profile_confidence: aiResult.confidence,
      });

      // Denormalize to brain_accounts
      await supabase
        .from('brain_accounts')
        .update({
          account_type_cached: aiResult.account_type || heuristicType,
          niche_cached: aiResult.niche,
        })
        .eq('username', account.username);

      profiled++;
      console.log(
        `${LOG_PREFIX} @${account.username}: ${aiResult.account_type || heuristicType} | ` +
        `${aiResult.niche || 'unknown niche'} | ${account.growth_status} (${account.followers_count} followers)`
      );
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error profiling @${account.username}: ${err.message}`);
      errors++;
    }
  }

  if (profiled > 0) {
    console.log(`${LOG_PREFIX} Profiled ${profiled}/${needsProfile.length} accounts (${errors} errors)`);
  }

  return { profiled, errors };
}

// =============================================================================
// Heuristic classification (free, instant)
// =============================================================================

function classifyAccountTypeHeuristic(account: {
  followers_count: number | null;
  following_count: number | null;
  ff_ratio: number | null;
  bio_text: string | null;
}): AccountType {
  const followers = account.followers_count ?? 0;
  const following = account.following_count ?? 0;
  const ffRatio = account.ff_ratio ?? (following > 0 ? followers / following : 0);
  const bio = (account.bio_text ?? '').toLowerCase();

  // Follow farmer: FF ratio near 1:1, following > 5K
  if (ffRatio > 0.7 && ffRatio < 1.5 && following > 5000) {
    return 'follow_farmer';
  }

  // Brand/company indicators in bio
  const brandKeywords = ['official', 'company', 'brand', 'inc.', 'ltd', 'corp', '™', '®', 'shop now', 'link in bio'];
  if (brandKeywords.some(kw => bio.includes(kw))) {
    return 'brand';
  }

  // Celebrity: very high followers with very low following
  if (followers > 100000 && ffRatio > 100) {
    return 'celebrity';
  }

  // Default to content_creator for active accounts with reasonable ratios
  return 'content_creator';
}

// =============================================================================
// AI classification (niche, voice, style)
// =============================================================================

interface AIProfileResult {
  account_type: AccountType | null;
  niche: string | null;
  sub_niches: string[];
  voice_style: string | null;
  content_summary: string | null;
  confidence: number;
}

async function classifyWithAI(
  username: string,
  bio: string | null,
  tweetSamples: string,
  heuristicType: AccountType,
): Promise<AIProfileResult> {
  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing Twitter/X accounts. Given an account's bio and recent tweets, classify the account.

Return JSON with:
- account_type: one of "content_creator", "follow_farmer", "celebrity", "brand", "bot", "viewer"
- niche: primary topic area (e.g. "health/nutrition", "tech/AI", "finance/investing", "personal_development", "humor", "politics", "general")
- sub_niches: array of specific sub-topics (e.g. ["fasting", "sleep", "supplements"])
- voice_style: one of "casual_expert", "academic", "provocative", "motivational", "journalistic", "humorous", "conversational"
- content_summary: 1-2 sentence summary of what this account does and how they engage
- confidence: 0.0 to 1.0 how confident you are in this classification`,
        },
        {
          role: 'user',
          content: `Account: @${username}
Bio: ${bio || '(no bio)'}
Heuristic classification: ${heuristicType}

Recent tweets (sorted by engagement):
${tweetSamples}

Classify this account.`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }, { purpose: 'observatory_account_profiler', priority: 'low' });

    const content = response.choices[0]?.message?.content;
    if (!content) return defaultAIResult();

    const parsed = JSON.parse(content);
    return {
      account_type: parsed.account_type || null,
      niche: parsed.niche || null,
      sub_niches: Array.isArray(parsed.sub_niches) ? parsed.sub_niches : [],
      voice_style: parsed.voice_style || null,
      content_summary: parsed.content_summary || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} AI classification failed for @${username}: ${err.message}`);
    return defaultAIResult();
  }
}

function defaultAIResult(): AIProfileResult {
  return {
    account_type: null,
    niche: null,
    sub_niches: [],
    voice_style: null,
    content_summary: null,
    confidence: 0,
  };
}

// =============================================================================
// DB helpers
// =============================================================================

async function upsertProfile(supabase: any, profile: {
  username: string;
  account_type: AccountType | null;
  niche: string | null;
  sub_niches: string[];
  voice_style: string | null;
  posting_frequency_daily: number | null;
  reply_ratio: number | null;
  avg_reply_target_size: number | null;
  active_hours: Record<string, number> | null;
  content_style_summary: string | null;
  ff_ratio: number | null;
  profile_confidence: number;
}): Promise<void> {
  await supabase
    .from('brain_account_profiles')
    .upsert({
      ...profile,
      profiled_at: new Date().toISOString(),
    }, { onConflict: 'username' });

  // Propagate niche to brain_accounts for fast queries and downstream analytics
  if (profile.niche) {
    await supabase
      .from('brain_accounts')
      .update({
        niche_cached: profile.niche,
        account_type_cached: profile.account_type,
      })
      .eq('username', profile.username);
  }
}
