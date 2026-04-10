/**
 * Daily Context Capture
 *
 * Records what's happening on Twitter each day — trending topics, major events,
 * platform changes. This provides the "environment" data for retrospective analyses.
 * retrospectiveAnalyzer reads brain_daily_context.trending_topics for each growth
 * event and writes them to external_correlations so we can tell whether an account
 * grew because of their content or because they rode a trending wave.
 *
 * History: This job previously scraped x.com/explore, but Twitter now hides the
 * explore page behind a login wall for anonymous browsers. Every run silently
 * returned 0 topics — the brain_daily_context table stayed empty and
 * retrospectiveAnalyzer always wrote `external_correlations: {trending_topics: []}`.
 *
 * Fix: scrape trends24.in instead — a public Twitter trends aggregator that
 * doesn't require login. If that fails, fall back to writing a row with
 * notes='sources_unavailable' so the dead-man's-switch can detect the failure
 * instead of it silently accumulating.
 *
 * Runs hourly. Topics accumulate throughout the day (upsert on context_date).
 */

import { getSupabaseClient } from '../../db';
import { submitTask } from '../feeds/brainBrowserPool';

const LOG_PREFIX = '[observatory/context]';
const TRENDS24_URL = 'https://trends24.in/united-states/';
const NAV_TIMEOUT_MS = 20000;

export async function runDailyContextCapture(): Promise<{ topics_captured: number; source: string }> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

  let newTopics: string[] = [];
  let sourceUsed = 'none';

  // Primary source: trends24.in — public, anonymous, stable
  try {
    await submitTask('low', async (page) => {
      // Navigate anonymously (no auth context needed — public site)
      await page.goto(TRENDS24_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      await page.waitForTimeout(1500);

      // trends24 structure: <ol class="trend-card__list"> with <li><a>topic</a></li> items.
      // Also has fallback <a class="trend-link"> elements. We try multiple selectors
      // defensively since public sites change their HTML.
      newTopics = await page.evaluate(`
        (function() {
          var raw = [];

          // Selector 1: ordered list cards
          document.querySelectorAll('ol.trend-card__list li a, ol.trend-card__list li').forEach(function(el) {
            var text = (el.textContent || '').trim();
            if (text) raw.push(text);
          });

          // Selector 2: trend-link anchors
          document.querySelectorAll('a.trend-link').forEach(function(el) {
            var text = (el.textContent || '').trim();
            if (text) raw.push(text);
          });

          // Selector 3: generic trend containers (broader fallback)
          document.querySelectorAll('[class*="trend-card"] a, [class*="trend-card"] li').forEach(function(el) {
            var text = (el.textContent || '').trim();
            if (text) raw.push(text);
          });

          // Normalize + filter
          var clean = raw
            .map(function(t) { return t.replace(/^#/, '').trim(); })
            .filter(function(t) {
              if (t.length < 2 || t.length > 100) return false;
              if (/^\\d+[KMB]?\\s*(posts?|tweets?|Tweets?)?$/i.test(t)) return false; // "1.2K posts"
              if (/^\\d+$/.test(t)) return false; // bare numbers (rank)
              if (/^(show more|trending|view|see all|load more)$/i.test(t)) return false;
              return true;
            });

          // Deduplicate
          var seen = {};
          var unique = [];
          for (var i = 0; i < clean.length; i++) {
            if (!seen[clean[i]]) {
              seen[clean[i]] = true;
              unique.push(clean[i]);
            }
          }
          return unique.slice(0, 50);
        })()
      `);

      if (newTopics.length > 0) {
        sourceUsed = 'trends24';
      }
    });
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} trends24 scrape failed: ${err.message}`);
  }

  // If primary source failed, write a sentinel row so the dead-man's-switch can detect
  // missing daily context instead of it silently failing
  if (newTopics.length === 0) {
    console.warn(`${LOG_PREFIX} No topics captured from any source for ${today}`);
    try {
      await supabase
        .from('brain_daily_context')
        .upsert({
          context_date: today,
          trending_topics: [],
          notes: 'sources_unavailable',
          source: 'none',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'context_date' });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Sentinel write failed: ${err.message}`);
    }
    return { topics_captured: 0, source: 'none' };
  }

  // Upsert: accumulate topics throughout the day
  try {
    const { data: existing } = await supabase
      .from('brain_daily_context')
      .select('trending_topics')
      .eq('context_date', today)
      .maybeSingle();

    const existingTopics: string[] = existing?.trending_topics ?? [];
    const allTopics = Array.from(new Set([...existingTopics, ...newTopics]));

    await supabase
      .from('brain_daily_context')
      .upsert({
        context_date: today,
        trending_topics: allTopics,
        source: sourceUsed,
        notes: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'context_date' });

    const added = allTopics.length - existingTopics.length;
    console.log(`${LOG_PREFIX} +${added} trending topics from ${sourceUsed} for ${today} (total: ${allTopics.length})`);

    return { topics_captured: added, source: sourceUsed };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} DB upsert error: ${err.message}`);
    return { topics_captured: 0, source: sourceUsed };
  }
}
