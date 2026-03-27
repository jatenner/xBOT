/**
 * Brain: Keyword Pool Manager
 *
 * Self-expanding keyword management:
 * - Auto-adds keywords from trending topics (handled by trendingScraper)
 * - Extracts entities from high-engagement tweets
 * - Auto-deprioritizes stale keywords (no fresh content in 7 days)
 * - Recomputes keyword priorities based on performance
 *
 * Runs hourly.
 */

import { getSupabaseClient } from '../db';
import { upsertBrainKeywords, deactivateKeyword } from './db';

const LOG_PREFIX = '[brain/keyword-pool]';

const STALENESS_THRESHOLD_DAYS = 7;
const MIN_ENGAGEMENT_TO_KEEP = 5;
const MAX_ACTIVE_KEYWORDS = 500;

export async function runKeywordPoolManagement(): Promise<{
  keywords_added: number;
  keywords_deactivated: number;
  keywords_reprioritized: number;
}> {
  const supabase = getSupabaseClient();
  let keywordsAdded = 0;
  let keywordsDeactivated = 0;
  let keywordsReprioritized = 0;

  // ==========================================================================
  // 1. Extract entities from recent high-engagement brain_tweets
  // ==========================================================================
  try {
    const { data: highEngTweets } = await supabase
      .from('brain_tweets')
      .select('content')
      .gte('likes', 50)
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    if (highEngTweets && highEngTweets.length > 0) {
      const entityCounts: Record<string, number> = {};

      for (const tweet of highEngTweets) {
        const entities = extractEntities(tweet.content || '');
        for (const entity of entities) {
          entityCounts[entity] = (entityCounts[entity] ?? 0) + 1;
        }
      }

      // Add entities that appear 3+ times as keywords
      const newKeywords = Object.entries(entityCounts)
        .filter(([_, count]) => count >= 3)
        .map(([keyword, count]) => ({
          keyword: keyword.toLowerCase().trim(),
          source: 'entity_extraction' as const,
          source_detail: `extracted_from_${highEngTweets.length}_tweets`,
          priority: Math.min(0.6 + (count / 20), 0.9),
          is_active: true,
        }));

      if (newKeywords.length > 0) {
        keywordsAdded = await upsertBrainKeywords(newKeywords);
        if (keywordsAdded > 0) {
          console.log(`${LOG_PREFIX} Added ${keywordsAdded} entity-extracted keywords`);
        }
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Entity extraction error:`, err.message);
  }

  // ==========================================================================
  // 2. Deactivate stale keywords
  // ==========================================================================
  try {
    const staleCutoff = new Date(Date.now() - STALENESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleKeywords } = await supabase
      .from('brain_keywords')
      .select('keyword, last_searched_at, avg_engagement_found, search_count')
      .eq('is_active', true)
      .lt('last_searched_at', staleCutoff)
      .gt('search_count', 3); // Only deactivate keywords we've tried enough

    if (staleKeywords) {
      for (const kw of staleKeywords) {
        // Deactivate if consistently low engagement
        if ((kw.avg_engagement_found ?? 0) < MIN_ENGAGEMENT_TO_KEEP) {
          await deactivateKeyword(kw.keyword, `stale_low_engagement_avg_${Math.round(kw.avg_engagement_found ?? 0)}`);
          keywordsDeactivated++;
        }
      }

      if (keywordsDeactivated > 0) {
        console.log(`${LOG_PREFIX} Deactivated ${keywordsDeactivated} stale keywords`);
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Stale keyword cleanup error:`, err.message);
  }

  // ==========================================================================
  // 3. Reprioritize active keywords based on performance
  // ==========================================================================
  try {
    const { data: activeKeywords } = await supabase
      .from('brain_keywords')
      .select('keyword, avg_engagement_found, viral_tweets_found, tweets_found_total, search_count, source')
      .eq('is_active', true);

    if (activeKeywords && activeKeywords.length > 0) {
      for (const kw of activeKeywords) {
        const avgEng = kw.avg_engagement_found ?? 0;
        const viralRate = kw.tweets_found_total > 0
          ? (kw.viral_tweets_found ?? 0) / kw.tweets_found_total
          : 0;

        // Priority formula:
        // - Base: 0.3 for all active keywords
        // - Engagement bonus: up to 0.3 based on avg engagement
        // - Viral bonus: up to 0.2 based on viral discovery rate
        // - Seed bonus: 0.1 for seed keywords (keep them active)
        const engBonus = Math.min(avgEng / 200, 0.3);
        const viralBonus = Math.min(viralRate * 2, 0.2);
        const seedBonus = kw.source === 'seed' ? 0.1 : 0;

        const newPriority = Math.min(0.3 + engBonus + viralBonus + seedBonus, 1.0);
        const roundedPriority = Math.round(newPriority * 100) / 100;

        await supabase
          .from('brain_keywords')
          .update({ priority: roundedPriority, updated_at: new Date().toISOString() })
          .eq('keyword', kw.keyword);

        keywordsReprioritized++;
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Reprioritization error:`, err.message);
  }

  // ==========================================================================
  // 4. Enforce max active keywords (deactivate lowest priority if over limit)
  // ==========================================================================
  try {
    const { count } = await supabase
      .from('brain_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (count && count > MAX_ACTIVE_KEYWORDS) {
      const excess = count - MAX_ACTIVE_KEYWORDS;
      const { data: lowest } = await supabase
        .from('brain_keywords')
        .select('keyword')
        .eq('is_active', true)
        .neq('source', 'seed') // Never deactivate seed keywords
        .order('priority', { ascending: true })
        .limit(excess);

      if (lowest) {
        for (const kw of lowest) {
          await deactivateKeyword(kw.keyword, 'pool_overflow_lowest_priority');
          keywordsDeactivated++;
        }
        console.log(`${LOG_PREFIX} Deactivated ${lowest.length} overflow keywords (pool > ${MAX_ACTIVE_KEYWORDS})`);
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Pool overflow cleanup error:`, err.message);
  }

  console.log(`${LOG_PREFIX} Pool management: +${keywordsAdded} added, -${keywordsDeactivated} deactivated, ${keywordsReprioritized} reprioritized`);

  return {
    keywords_added: keywordsAdded,
    keywords_deactivated: keywordsDeactivated,
    keywords_reprioritized: keywordsReprioritized,
  };
}

// =============================================================================
// Entity extraction — simple keyword/phrase extraction from tweet text
// =============================================================================

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const textLower = text.toLowerCase();

  // Extract multi-word phrases (2-3 words that appear together)
  // Look for capitalized phrases (proper nouns, brand names)
  const capitalizedPhrases = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g) || [];
  for (const phrase of capitalizedPhrases) {
    if (phrase.length >= 4 && phrase.length <= 50) {
      entities.push(phrase.toLowerCase());
    }
  }

  // Extract hashtags as keywords (without the #)
  const hashtags = text.match(/#([a-zA-Z0-9_]{2,30})/g) || [];
  for (const tag of hashtags) {
    entities.push(tag.replace('#', '').toLowerCase());
  }

  // Extract quoted phrases (things in quotes are often key concepts)
  const quoted = text.match(/"([^"]{3,40})"/g) || [];
  for (const q of quoted) {
    entities.push(q.replace(/"/g, '').toLowerCase());
  }

  // Deduplicate
  return Array.from(new Set(entities)).filter(e =>
    e.length >= 3 &&
    e.length <= 40 &&
    // Filter out common stop words
    !['the', 'and', 'but', 'for', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our'].includes(e)
  );
}
