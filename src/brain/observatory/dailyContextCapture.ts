/**
 * Daily Context Capture
 *
 * Records what's happening on Twitter each day — trending topics,
 * major events, platform changes. This provides the "environment"
 * data for retrospective analyses.
 *
 * When we see an account grow, we need to know: was something trending
 * that they rode? Was there a major event they commented on?
 *
 * Runs hourly, accumulates topics throughout the day.
 * Uses anonymous browser to visit Explore page.
 */

import { getSupabaseClient } from '../../db';
import { submitTask } from '../feeds/brainBrowserPool';
import { brainGoto } from '../feeds/brainNavigator';

const LOG_PREFIX = '[observatory/context]';

export async function runDailyContextCapture(): Promise<{ topics_captured: number }> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

  let newTopics: string[] = [];

  try {
    await submitTask('low', async (page) => {
      // Try Explore page (needs auth for full trending)
      const nav = await brainGoto(page, 'https://x.com/explore', 15000);
      if (!nav.success) return;

      await page.waitForTimeout(2000);

      // Extract trending topics from the page
      newTopics = await page.evaluate(`
        (function() {
          var topics = [];
          var trendCells = document.querySelectorAll('[data-testid="trend"]');
          trendCells.forEach(function(cell) {
            var spans = cell.querySelectorAll('span');
            spans.forEach(function(span) {
              var text = (span.textContent || '').trim();
              if (text.length > 2 && text.length < 100
                && !/^\\d+[KMB]?\\s*(posts?|tweets?)?$/i.test(text)
                && !/^Trending/i.test(text)
                && !/^\\d+\\s*·/i.test(text)
                && text !== 'Show more'
                && text !== 'Trending') {
                topics.push(text.replace(/^#/, ''));
              }
            });
          });

          // Also check for "What's happening" section
          var headings = document.querySelectorAll('h2, [role="heading"]');
          headings.forEach(function(h) {
            var text = (h.textContent || '').trim();
            if (text.length > 3 && text.length < 80 && text !== "What's happening" && text !== 'Trending') {
              topics.push(text);
            }
          });

          // Deduplicate
          return topics.filter(function(t, i) { return topics.indexOf(t) === i; }).slice(0, 30);
        })()
      `);
    });
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Browser scrape failed: ${err.message}`);
  }

  if (newTopics.length === 0) {
    return { topics_captured: 0 };
  }

  // Upsert into brain_daily_context — accumulate topics throughout the day
  try {
    const { data: existing } = await supabase
      .from('brain_daily_context')
      .select('trending_topics')
      .eq('context_date', today)
      .single();

    const existingTopics: string[] = existing?.trending_topics ?? [];
    const allTopics = Array.from(new Set([...existingTopics, ...newTopics]));

    await supabase
      .from('brain_daily_context')
      .upsert({
        context_date: today,
        trending_topics: allTopics,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'context_date' });

    const added = allTopics.length - existingTopics.length;
    if (added > 0) {
      console.log(`${LOG_PREFIX} +${added} trending topics for ${today} (total: ${allTopics.length})`);
    }

    return { topics_captured: added };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} DB error: ${err.message}`);
    return { topics_captured: 0 };
  }
}
