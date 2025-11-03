/**
 * 🔥 VIRAL TWEET SCRAPER JOB
 * 
 * Scheduled job to scrape high-performing viral tweets for format learning
 * Runs every 6 hours to build the viral_tweet_library database
 */

import { getSupabaseClient } from '../db';
import { TrendingViralScraper } from '../scraper/trendingViralScraper';

export async function viralScraperJob(): Promise<void> {
  console.log('[VIRAL_SCRAPER_JOB] 🔥 Starting viral tweet collection...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Check how many viral tweets we already have
    const { count } = await supabase
      .from('viral_tweet_library')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    console.log(`[VIRAL_SCRAPER_JOB] 📊 Current viral tweet library: ${count || 0} tweets`);
    
    // If we have > 500 tweets, less aggressive scraping
    const targetCount = (count || 0) < 500 ? 30 : 15;
    console.log(`[VIRAL_SCRAPER_JOB] 🎯 Targeting ${targetCount} new viral tweets this cycle`);
    
    // Run the scraper
    const scraper = new TrendingViralScraper(supabase);
    const result = await scraper.scrapeTrendingTweets({
      maxTweets: targetCount,
      minViews: 50000,    // Only viral tweets (50K+ views)
      minEngagement: 0.02  // 2%+ engagement rate
    });
    
    console.log(`[VIRAL_SCRAPER_JOB] ✅ Scraped ${result.totalScraped} viral tweets`);
    console.log(`[VIRAL_SCRAPER_JOB] 📊 Analyzed ${result.analyzed} with AI insights`);
    
    if (result.errors.length > 0) {
      console.warn(`[VIRAL_SCRAPER_JOB] ⚠️ ${result.errors.length} errors during scraping`);
      // Log first error for debugging
      if (result.errors[0]) {
        console.warn(`[VIRAL_SCRAPER_JOB] First error: ${result.errors[0]}`);
      }
    }
    
    // Log sample of what we learned
    if (result.analyzed > 0) {
      const { data: recentAnalyses } = await supabase
        .from('viral_tweet_library')
        .select('hook_type, why_it_works, pattern_strength')
        .not('why_it_works', 'is', null)
        .order('scraped_at', { ascending: false })
        .limit(3);
      
      if (recentAnalyses && recentAnalyses.length > 0) {
        console.log('[VIRAL_SCRAPER_JOB] 🧠 Sample AI insights from this cycle:');
        recentAnalyses.forEach((analysis: any, i: number) => {
          console.log(`  ${i + 1}. ${analysis.hook_type} (strength: ${analysis.pattern_strength})`);
          console.log(`     → ${(analysis.why_it_works || '').substring(0, 100)}...`);
        });
      }
    }
    
    console.log('[VIRAL_SCRAPER_JOB] ✅ Viral scraping cycle complete');
    
  } catch (error: any) {
    console.error('[VIRAL_SCRAPER_JOB] ❌ Viral scraping failed:', error.message);
    throw error;
  }
}

