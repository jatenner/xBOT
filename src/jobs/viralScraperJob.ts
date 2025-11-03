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
    const scraper = TrendingViralScraper.getInstance();
    const viralTweets = await scraper.scrapeViralTweets({
      maxTweets: targetCount,
      minViews: 50000,    // Only viral tweets (50K+ views)
      minEngagementRate: 0.02  // 2%+ engagement rate
    });
    
    console.log(`[VIRAL_SCRAPER_JOB] ✅ Scraped ${viralTweets.length} viral tweets`);
    
    // Now analyze them with AI and store in viral_tweet_library
    if (viralTweets.length > 0) {
      const { getFormatAnalyzer } = await import('../analysis/viralFormatAnalyzer');
      const formatAnalyzer = getFormatAnalyzer();
      
      console.log(`[VIRAL_SCRAPER_JOB] 🧠 Analyzing formats with AI...`);
      const analyses = await formatAnalyzer.batchAnalyze(viralTweets.map(t => ({
        tweet_id: t.tweet_id,
        text: t.text,
        account_handle: t.author_handle,
        likes: t.likes,
        reposts: t.retweets,
        replies: t.replies,
        views: t.views,
        engagement_rate: t.engagement_rate
      })));
      
      console.log(`[VIRAL_SCRAPER_JOB] 📊 Analyzed ${analyses.size} formats`);
      
      // Store in viral_tweet_library
      let stored = 0;
      for (const [tweetId, analysis] of analyses) {
        const tweet = viralTweets.find(t => t.tweet_id === tweetId);
        if (!tweet) continue;
        
        try {
          await supabase.from('viral_tweet_library').upsert({
            tweet_id: tweetId,
            text: tweet.text,
            author_handle: tweet.author_handle,
            
            // Metrics
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views,
            engagement_rate: tweet.engagement_rate,
            viral_coefficient: tweet.retweets / (tweet.views || 1),
            
            // AI-analyzed patterns
            hook_type: analysis.hookType,
            formatting_patterns: analysis.visualStructure,
            emoji_count: analysis.emojiStrategy === 'none' ? 0 : 
                         analysis.emojiStrategy === 'strategic_one' ? 1 : 2,
            character_count: tweet.text.length,
            has_numbers: /\d/.test(tweet.text),
            
            // AI insights - THE KEY DATA!
            why_it_works: analysis.whyItWorks,
            pattern_strength: analysis.patternStrength,
            
            // Category
            topic_category: 'universal',
            content_type: 'viral',
            structure: 'single',
            is_active: true,
            scraped_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          }, { onConflict: 'tweet_id' });
          stored++;
        } catch (err: any) {
          console.warn(`[VIRAL_SCRAPER_JOB] ⚠️ Failed to store ${tweetId}: ${err.message}`);
        }
      }
      
      console.log(`[VIRAL_SCRAPER_JOB] 💾 Stored ${stored} analyzed tweets in viral_tweet_library`);
      
      // Log sample of what we learned
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

