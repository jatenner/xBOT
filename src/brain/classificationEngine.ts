/**
 * Brain Classification Engine
 *
 * Multi-stage classification pipeline:
 *
 * Stage 1: DOM-extracted features (runs at ingest in discoveryEngine — FREE)
 * Stage 2: AI batch classification via gpt-4o-mini (this file — CHEAP)
 * Stage 3: Time-series re-scraping for engagement trajectory (this file — FREE)
 * Stage 4: Deep analysis of viral tweets — reply trees, amplifiers (this file — MODERATE)
 */

import { createBudgetedChatCompletion, type CallMetadata } from '../services/openaiBudgetedClient';
import { getBrainPage, brainGoto } from './feeds/brainNavigator';
import { getSupabaseClient } from '../db';
import {
  getBrainTweetsForClassification,
  getBrainTweetsForRescrape,
  getBrainTweetsForDeepAnalysis,
  upsertBrainClassifications,
  insertBrainTweetSnapshot,
  getSnapshotsForTweet,
} from './db';
import { extractTweetsFromPage } from './discoveryEngine';
import type {
  BrainClassification,
  Domain,
  HookType,
  Tone,
  ContentFormat,
  EmotionalTrigger,
  Specificity,
  Actionability,
  IdentitySignal,
  EngagementTrajectory,
} from './types';

const LOG_PREFIX = '[brain/classify]';

// Clamped env parser — mirrors pattern used in src/browser/UnifiedBrowserPool.ts:27
function parseEnvInt(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// =============================================================================
// Stage 2: AI Batch Classification
// =============================================================================

// BATCH_SIZE capped at 40 to avoid JSON truncation under gpt-4o-mini's default output limit.
// MAX_PER_RUN controls how many tweets Stage 2 will attempt per job run.
const STAGE2_BATCH_SIZE = parseEnvInt('BRAIN_STAGE2_BATCH_SIZE', 20, 10, 40);
// Lifted default 200→600 to clear the classification backlog (currently 14% of
// 115K tweets are classified; pattern engine starves until this catches up).
// At gpt-4o-mini ~$0.002/tweet that's ~$1.20/run; at 2hr cadence ~$15/day.
const STAGE2_MAX_PER_RUN = parseEnvInt('BRAIN_STAGE2_MAX_PER_RUN', 600, 50, 1000);
const STAGE2_MODEL = 'gpt-4o-mini';

// Compressed from ~400 to ~220 tokens. [ORIGINAL]/[REPLY] tag is inline per-tweet
// instead of in the system prompt — saves ~50 tokens per call at 840 calls/day.
const CLASSIFICATION_PROMPT = `Classify each tweet. Return JSON array, one object per tweet, same order.
[ORIGINAL]=standalone post (content strategy). [REPLY]=response (reply strategy).

Fields per object:
- domain: health|tech|finance|business|politics|entertainment|sports|science|crypto|personal_dev|humor|news|culture|other
- sub_domain: specific niche (free text)
- hook_type: contrarian|myth_bust|question|surprising_stat|personal_story|bold_claim|curiosity_gap|controversy|social_proof|how_to|analogy|observation|list|hot_take|data_driven|other
- tone: authoritative|casual|provocative|educational|vulnerable|humorous|urgent|inspirational|conversational|analytical|other
- format: one_liner|short|medium|long|thread|list|story|data_driven|question|hot_take|tutorial|framework|analogy|meme_text|other
- emotional_trigger: fear|curiosity|anger|hope|humor|surprise|outrage|inspiration|fomo|empathy|nostalgia|belonging|identity|other
- specificity: vague|moderate|specific|hyper_specific
- actionability: none|low|moderate|high
- identity_signal: none|aspirational|tribal|contrarian|expert|relatable
- controversy_level: 0.0-1.0
- novelty_level: 0.0-1.0`;

interface Stage2Input {
  tweet_id: string;
  content: string;
  author_username: string;
  likes: number;
  views: number;
  tweet_type?: string;
  reply_to_username?: string;
}

interface Stage2Output {
  domain: Domain;
  sub_domain?: string;
  hook_type: HookType;
  tone: Tone;
  format: ContentFormat;
  emotional_trigger: EmotionalTrigger;
  specificity: Specificity;
  actionability: Actionability;
  identity_signal: IdentitySignal;
  controversy_level: number;
  novelty_level: number;
}

export async function runStage2Classification(): Promise<{ classified: number; errors: number }> {
  const tweets = await getBrainTweetsForClassification(STAGE2_MAX_PER_RUN);

  if (tweets.length === 0) {
    console.log(`${LOG_PREFIX} Stage 2: No tweets to classify`);
    return { classified: 0, errors: 0 };
  }

  let totalClassified = 0;
  let totalErrors = 0;

  // Process in batches
  for (let i = 0; i < tweets.length; i += STAGE2_BATCH_SIZE) {
    const batch = tweets.slice(i, i + STAGE2_BATCH_SIZE);

    try {
      const classifications = await classifyBatch(batch);

      if (classifications.length > 0) {
        const dbRecords: Partial<BrainClassification>[] = classifications.map((c, idx) => ({
          tweet_id: batch[idx].tweet_id,
          domain: c.domain,
          sub_domain: c.sub_domain || null,
          domain_confidence: 0.8, // gpt-4o-mini is generally confident
          hook_type: c.hook_type,
          tone: c.tone,
          format: c.format,
          emotional_trigger: c.emotional_trigger,
          specificity: c.specificity,
          actionability: c.actionability,
          identity_signal: c.identity_signal,
          controversy_level: c.controversy_level,
          novelty_level: c.novelty_level,
          classification_stage: 2,
          classified_at: new Date().toISOString(),
          classification_model: STAGE2_MODEL,
        }));

        const count = await upsertBrainClassifications(dbRecords);
        totalClassified += count;
      }
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Stage 2 batch error:`, err.message);
      totalErrors += batch.length;
    }
  }

  console.log(`${LOG_PREFIX} Stage 2: Classified ${totalClassified}/${tweets.length} tweets (${totalErrors} errors)`);
  return { classified: totalClassified, errors: totalErrors };
}

async function classifyBatch(tweets: Stage2Input[]): Promise<Stage2Output[]> {
  const tweetTexts = tweets.map((t, i) => {
    const isReply = t.tweet_type === 'reply';
    const typeLabel = isReply ? '[REPLY]' : '[ORIGINAL]';
    const replyContext = isReply && t.reply_to_username ? ` replying to @${t.reply_to_username}` : '';
    return `Tweet ${i + 1} ${typeLabel} (@${t.author_username}${replyContext}, ${t.likes} likes, ${t.views} views):\n"${t.content.substring(0, 500)}"`;
  }).join('\n\n');

  const metadata: CallMetadata = {
    purpose: 'brain_stage2_classification',
    priority: 'low',
  };

  const response = await createBudgetedChatCompletion({
    model: STAGE2_MODEL,
    messages: [
      { role: 'system', content: CLASSIFICATION_PROMPT },
      { role: 'user', content: `Classify these ${tweets.length} tweets:\n\n${tweetTexts}\n\nReturn a JSON array with ${tweets.length} objects.` },
    ],
    temperature: 0.2,
    // Budget ~180 output tokens/tweet so larger batches don't truncate under the
    // default cap. Capped at 4000 to stay within gpt-4o-mini response limits.
    max_tokens: Math.min(4000, tweets.length * 180),
    response_format: { type: 'json_object' },
  }, metadata);

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);

    // Handle multiple response formats gpt-4o-mini might use
    let results: any[];
    if (Array.isArray(parsed)) {
      results = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Try common key names the model might wrap the array in
      const possibleKeys = ['results', 'classifications', 'tweets', 'data', 'items', 'analysis'];
      results = [];
      for (const key of possibleKeys) {
        if (Array.isArray(parsed[key])) {
          results = parsed[key];
          break;
        }
      }
      // If still empty, try the first array-valued key
      if (results.length === 0) {
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key])) {
            results = parsed[key];
            console.log(`${LOG_PREFIX} Stage 2: Found results under key "${key}"`);
            break;
          }
        }
      }
    } else {
      results = [];
    }

    if (!Array.isArray(results) || results.length === 0) {
      console.warn(`${LOG_PREFIX} Stage 2: No array found in response. Keys: ${Object.keys(parsed || {}).join(', ')}`);
      return [];
    }

    // Validate and sanitize each result
    return results.slice(0, tweets.length).map(sanitizeClassification);
  } catch (err: any) {
    // The API call already cost money — try to salvage any valid JSON objects
    // inside the malformed response (truncation, trailing garbage, etc.).
    // Recovers partial batch yield that would otherwise be 100% loss.
    const salvaged = salvagePartialObjects(content);
    if (salvaged.length > 0) {
      console.warn(`${LOG_PREFIX} Stage 2 JSON parse failed but salvaged ${salvaged.length}/${tweets.length} objects: ${err.message}`);
      return salvaged.slice(0, tweets.length).map(sanitizeClassification);
    }
    console.error(`${LOG_PREFIX} Stage 2 JSON parse error (no salvage):`, err.message, content?.substring(0, 200));
    return [];
  }
}

// Extract any balanced-brace JSON objects from a malformed string. Handles the
// common gpt-4o-mini failure modes: truncation at max_tokens, trailing commas,
// surrounding prose, code fences.
function salvagePartialObjects(raw: string | null | undefined): any[] {
  if (!raw) return [];
  const objects: any[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = raw.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          // Only keep objects that look like classifications (have domain+hook_type)
          if (parsed && typeof parsed === 'object' && parsed.domain && parsed.hook_type) {
            objects.push(parsed);
          }
        } catch {
          // Silently skip unparseable candidates
        }
        start = -1;
      }
    }
  }
  return objects;
}

function sanitizeClassification(raw: any): Stage2Output {
  return {
    domain: validateEnum(raw.domain, VALID_DOMAINS, 'other') as Domain,
    hook_type: validateEnum(raw.hook_type, VALID_HOOKS, 'other') as HookType,
    tone: validateEnum(raw.tone, VALID_TONES, 'other') as Tone,
    format: validateEnum(raw.format, VALID_FORMATS, 'other') as ContentFormat,
    emotional_trigger: validateEnum(raw.emotional_trigger, VALID_TRIGGERS, 'other') as EmotionalTrigger,
    specificity: validateEnum(raw.specificity, ['vague', 'moderate', 'specific', 'hyper_specific'], 'moderate') as Specificity,
    actionability: validateEnum(raw.actionability, ['none', 'low', 'moderate', 'high'], 'low') as Actionability,
    identity_signal: validateEnum(raw.identity_signal, ['none', 'aspirational', 'tribal', 'contrarian', 'expert', 'relatable'], 'none') as IdentitySignal,
    controversy_level: clamp(parseFloat(raw.controversy_level) || 0, 0, 1),
    novelty_level: clamp(parseFloat(raw.novelty_level) || 0, 0, 1),
  };
}

const VALID_DOMAINS = ['health', 'tech', 'finance', 'business', 'politics', 'entertainment', 'sports', 'science', 'crypto', 'personal_dev', 'humor', 'news', 'culture', 'other'];
const VALID_HOOKS = ['contrarian', 'myth_bust', 'question', 'surprising_stat', 'personal_story', 'bold_claim', 'curiosity_gap', 'controversy', 'social_proof', 'how_to', 'analogy', 'observation', 'list', 'hot_take', 'data_driven', 'other'];
const VALID_TONES = ['authoritative', 'casual', 'provocative', 'educational', 'vulnerable', 'humorous', 'urgent', 'inspirational', 'conversational', 'analytical', 'other'];
const VALID_FORMATS = ['one_liner', 'short', 'medium', 'long', 'thread', 'list', 'story', 'data_driven', 'question', 'hot_take', 'tutorial', 'framework', 'analogy', 'meme_text', 'other'];
const VALID_TRIGGERS = ['fear', 'curiosity', 'anger', 'hope', 'humor', 'surprise', 'outrage', 'inspiration', 'fomo', 'empathy', 'nostalgia', 'belonging', 'identity', 'other'];

function validateEnum(value: any, valid: string[], fallback: string): string {
  if (typeof value === 'string' && valid.includes(value.toLowerCase())) {
    return value.toLowerCase();
  }
  return fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// =============================================================================
// Stage 3: Time-Series Re-Scraping
// =============================================================================

const STAGE3_MAX_PER_RUN = 25;

export async function runStage3Rescrape(): Promise<{ rescraped: number; errors: number }> {
  const tweets = await getBrainTweetsForRescrape(STAGE3_MAX_PER_RUN);

  if (tweets.length === 0) {
    console.log(`${LOG_PREFIX} Stage 3: No tweets to rescrape`);
    return { rescraped: 0, errors: 0 };
  }

  let rescraped = 0;
  let errors = 0;

  try {
    const page = await getBrainPage();
    await (async () => {
      try {
        for (const tweet of tweets) {
          try {
            const tweetUrl = `https://x.com/${tweet.author_username}/status/${tweet.tweet_id}`;

            const nav = await brainGoto(page, tweetUrl, 20000);
            if (!nav.success) {
              errors++;
              continue;
            }

            // Wait for tweet to load
            try {
              await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
            } catch {
              errors++;
              continue;
            }

            // Extract current metrics from the page
            const metrics = await page.evaluate(() => {
              const article = document.querySelector('article[data-testid="tweet"]');
              if (!article) return null;

              function parseMetric(testId: string): number {
                const el = article!.querySelector(`[data-testid="${testId}"]`);
                if (!el) return 0;
                const txt = (el.textContent || '0').replace(/[^\d.KkMmBb]/g, '').trim();
                if (!txt) return 0;
                let num = parseFloat(txt.replace(/,/g, ''));
                const upper = txt.toUpperCase();
                if (upper.endsWith('K')) num = parseFloat(txt) * 1e3;
                else if (upper.endsWith('M')) num = parseFloat(txt) * 1e6;
                return Number.isFinite(num) ? Math.round(num) : 0;
              }

              return {
                likes: parseMetric('like'),
                retweets: parseMetric('retweet'),
                replies: parseMetric('reply'),
                views: 0, // Views require analytics page — skip for now
                bookmarks: 0,
                quotes: 0,
              };
            });

            if (!metrics) {
              errors++;
              continue;
            }

            // Save snapshot
            await insertBrainTweetSnapshot({
              tweet_id: tweet.tweet_id,
              views: metrics.views || null,
              likes: metrics.likes,
              retweets: metrics.retweets,
              replies: metrics.replies,
              bookmarks: metrics.bookmarks,
              quotes: metrics.quotes,
            });

            // Compute trajectory from snapshots
            const snapshots = await getSnapshotsForTweet(tweet.tweet_id);
            const trajectory = computeTrajectory(snapshots, tweet.likes ?? 0, metrics.likes);

            // Update brain_tweets with latest metrics and trajectory
            const supabase = getSupabaseClient();
            await supabase
              .from('brain_tweets')
              .update({
                likes: Math.max(metrics.likes, tweet.likes ?? 0),
                retweets: metrics.retweets,
                replies: metrics.replies,
                rescrape_count: (tweet.rescrape_count ?? 0) + 1,
                last_rescrape_at: new Date().toISOString(),
                engagement_trajectory: trajectory.trajectory,
                peak_velocity: trajectory.peakVelocity,
                peak_likes: Math.max(metrics.likes, tweet.likes ?? 0),
              })
              .eq('tweet_id', tweet.tweet_id);

            rescraped++;

            // Small delay between scrapes
            await page.waitForTimeout(1500);
          } catch (err: any) {
            console.error(`${LOG_PREFIX} Stage 3: Error scraping ${tweet.tweet_id}:`, err.message);
            errors++;
          }
        }
      } finally {
        await page.close();
      }
    })();
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Stage 3 error:`, err.message);
  }

  console.log(`${LOG_PREFIX} Stage 3: Rescraped ${rescraped}/${tweets.length} tweets (${errors} errors)`);
  return { rescraped, errors };
}

interface TrajectoryResult {
  trajectory: EngagementTrajectory;
  peakVelocity: number | null;
}

function computeTrajectory(
  snapshots: { likes: number | null; scraped_at: string }[],
  originalLikes: number,
  currentLikes: number,
): TrajectoryResult {
  if (snapshots.length < 2) {
    // Not enough data — infer from original vs current
    if (currentLikes > originalLikes * 1.5) {
      return { trajectory: 'rising', peakVelocity: null };
    }
    return { trajectory: 'flatline', peakVelocity: null };
  }

  // Compute velocity between each pair of snapshots
  const velocities: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const timeDeltaMin = (new Date(curr.scraped_at).getTime() - new Date(prev.scraped_at).getTime()) / 60000;
    if (timeDeltaMin <= 0) continue;

    const likesDelta = (curr.likes ?? 0) - (prev.likes ?? 0);
    velocities.push(likesDelta / timeDeltaMin);
  }

  if (velocities.length === 0) {
    return { trajectory: 'flatline', peakVelocity: null };
  }

  const peakVelocity = Math.max(...velocities);
  const lastVelocity = velocities[velocities.length - 1];
  const avgVelocity = velocities.reduce((s, v) => s + v, 0) / velocities.length;

  // Determine trajectory
  let trajectory: EngagementTrajectory;
  if (velocities.length >= 3) {
    const firstHalf = velocities.slice(0, Math.floor(velocities.length / 2));
    const secondHalf = velocities.slice(Math.floor(velocities.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.5) {
      trajectory = 'second_wave';
    } else if (lastVelocity > avgVelocity * 0.8) {
      trajectory = 'rising';
    } else if (lastVelocity < avgVelocity * 0.3 && peakVelocity > avgVelocity * 2) {
      trajectory = 'decaying';
    } else if (lastVelocity < 0.01) {
      trajectory = 'flatline';
    } else {
      trajectory = 'peaked';
    }
  } else {
    trajectory = lastVelocity > 0.1 ? 'rising' : 'flatline';
  }

  return {
    trajectory,
    peakVelocity: Math.round(peakVelocity * 100) / 100,
  };
}

// =============================================================================
// Stage 4: Deep Analysis (Viral Tweets Only)
// =============================================================================

const STAGE4_MAX_PER_RUN = 5;

export async function runStage4DeepAnalysis(): Promise<{ analyzed: number; errors: number }> {
  const tweets = await getBrainTweetsForDeepAnalysis(STAGE4_MAX_PER_RUN);

  if (tweets.length === 0) {
    console.log(`${LOG_PREFIX} Stage 4: No viral tweets to deep-analyze`);
    return { analyzed: 0, errors: 0 };
  }

  let analyzed = 0;
  let errors = 0;

  try {
    const page = await getBrainPage();
    await (async () => {
      try {
        for (const tweet of tweets) {
          try {
            const tweetUrl = `https://x.com/${tweet.author_username}/status/${tweet.tweet_id}`;

            const nav = await brainGoto(page, tweetUrl, 25000);
            if (!nav.success) {
              errors++;
              continue;
            }

            // Wait for tweet + replies to load
            try {
              await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
            } catch {
              errors++;
              continue;
            }

            // Scroll to load replies
            for (let s = 0; s < 3; s++) {
              await page.evaluate(() => window.scrollBy(0, 1000));
              await page.waitForTimeout(2000);
            }

            // Extract reply tree info
            const deepData = await page.evaluate(() => {
              const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
              // First article is the main tweet, rest are replies
              const replies = articles.slice(1);

              const replyData: { author: string; likes: number; followers: number | null }[] = [];

              for (const reply of replies.slice(0, 20)) {
                // Author
                const authorLinks = reply.querySelectorAll('a[role="link"]');
                let author = 'unknown';
                for (const al of Array.from(authorLinks)) {
                  const ah = al.getAttribute('href') || '';
                  if (ah.match(/^\/[a-zA-Z0-9_]+$/) && !ah.includes('/status/')) {
                    author = ah.replace('/', '');
                    break;
                  }
                }

                // Likes
                const likeEl = reply.querySelector('[data-testid="like"]');
                const likeText = (likeEl?.textContent || '0').replace(/[^\d.KkMm]/g, '').trim();
                let likes = parseInt(likeText) || 0;
                if (likeText.toUpperCase().endsWith('K')) likes = Math.round(parseFloat(likeText) * 1000);
                if (likeText.toUpperCase().endsWith('M')) likes = Math.round(parseFloat(likeText) * 1000000);

                // Follower count (if visible in card/hover)
                let followers: number | null = null;
                const bodyText = (reply as HTMLElement).innerText || reply.textContent || '';
                const fMatch = bodyText.match(/([\d.,]+)\s*([KMB])?\s*Followers?/i);
                if (fMatch) {
                  let fn = parseFloat(fMatch[1].replace(/,/g, ''));
                  const fs = (fMatch[2] || '').toUpperCase();
                  if (fs === 'K') fn *= 1e3;
                  else if (fs === 'M') fn *= 1e6;
                  if (Number.isFinite(fn)) followers = Math.round(fn);
                }

                replyData.push({ author, likes, followers });
              }

              return {
                totalReplies: replies.length,
                replyData,
              };
            });

            // Compute deep analysis metrics
            const topReplies = deepData.replyData.filter(r => r.likes >= 10);
            const amplifiers = deepData.replyData
              .filter(r => r.followers !== null && r.followers >= 10000)
              .map(r => ({
                username: r.author,
                followers: r.followers!,
                engagement_type: 'reply' as const,
              }));

            // Estimate conversation depth (simplified — replies visible is a proxy)
            const replyTreeDepth = Math.min(deepData.totalReplies, 20);

            // Update classification with Stage 4 data
            const supabase = getSupabaseClient();
            await supabase
              .from('brain_classifications')
              .upsert({
                tweet_id: tweet.tweet_id,
                reply_tree_depth: replyTreeDepth,
                top_reply_count: topReplies.length,
                amplifier_accounts: amplifiers.length > 0 ? amplifiers : null,
                classification_stage: 4,
                classified_at: new Date().toISOString(),
              }, { onConflict: 'tweet_id' });

            analyzed++;
            console.log(`${LOG_PREFIX} Stage 4: ${tweet.tweet_id} — ${replyTreeDepth} replies, ${topReplies.length} top, ${amplifiers.length} amplifiers`);

            await page.waitForTimeout(2000);
          } catch (err: any) {
            console.error(`${LOG_PREFIX} Stage 4: Error on ${tweet.tweet_id}:`, err.message);
            errors++;
          }
        }
      } finally {
        await page.close();
      }
    })();
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Stage 4 error:`, err.message);
  }

  console.log(`${LOG_PREFIX} Stage 4: Deep-analyzed ${analyzed}/${tweets.length} tweets (${errors} errors)`);
  return { analyzed, errors };
}
