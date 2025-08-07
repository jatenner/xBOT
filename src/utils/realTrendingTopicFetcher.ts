/**
 * 🔥 REAL TRENDING TOPIC INTEGRATION
 * 
 * Replaces mock trending system with real-time health topic scraping from Google News.
 * Fetches trending health topics every 4 hours and stores them with relevance scoring.
 * 
 * Features:
 * - Google News health topic scraping
 * - Health relevance scoring using GPT
 * - Intelligent topic filtering and deduplication
 * - Usage tracking to prevent overuse
 * - Fallback mechanisms for reliability
 * - Integration with content generation system
 */

import { chromium, Browser, Page } from 'playwright';
import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { getChromiumLaunchOptions } from './playwrightUtils';
import { OpenAI } from 'openai';

interface RawTrendingTopic {
  title: string;
  source: string;
  url?: string;
  publishedTime?: string;
  description?: string;
}

interface ProcessedTrendingTopic {
  topic: string;
  source: string;
  relevanceScore: number;
  healthRelevance: number;
  searchVolume: number;
  trendVelocity: 'rising' | 'stable' | 'declining';
  expiresAt: string;
  rawData: any;
}

interface TopicSelectionResult {
  success: boolean;
  topics?: ProcessedTrendingTopic[];
  selectedTopic?: ProcessedTrendingTopic;
  error?: string;
}

export class RealTrendingTopicFetcher {
  private static readonly FETCH_INTERVAL_HOURS = 4;
  private static readonly MAX_TOPICS_PER_FETCH = 20;
  private static readonly MIN_HEALTH_RELEVANCE = 0.3;
  private static readonly TOPIC_EXPIRY_HOURS = 48;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🌐 FETCH TRENDING HEALTH TOPICS FROM GOOGLE NEWS
   */
  static async fetchTrendingTopics(): Promise<{
    success: boolean;
    topicsFetched: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let browser: Browser | null = null;

    try {
      console.log('🔥 Fetching trending health topics from Google News...');

      // Launch browser
      const launchOptions = getChromiumLaunchOptions();
      browser = await chromium.launch(launchOptions);
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Add stealth settings
      await page.addInitScript(() => {
        delete (window as any).navigator.webdriver;
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
      });

      // Scrape Google News health section
      const rawTopics = await this.scrapeGoogleNewsHealth(page);
      
      if (rawTopics.length === 0) {
        console.log('⚠️ No topics found from Google News, trying fallback sources...');
        // Could add more sources here (Reddit health, Twitter trends, etc.)
      }

      console.log(`📰 Scraped ${rawTopics.length} raw topics from Google News`);

      // Process and score topics
      const processedTopics = await this.processAndScoreTopics(rawTopics);
      
      // Filter by health relevance
      const relevantTopics = processedTopics.filter(topic => 
        topic.healthRelevance >= this.MIN_HEALTH_RELEVANCE
      );

      console.log(`🎯 ${relevantTopics.length} topics passed health relevance filter`);

      // Store in database
      const storedCount = await this.storeTopicsInDatabase(relevantTopics);

      // Record fetch history
      await this.recordFetchHistory('google_news', storedCount, true, Date.now() - startTime);

      console.log(`✅ Successfully stored ${storedCount} trending health topics`);

      return {
        success: true,
        topicsFetched: storedCount
      };

    } catch (error) {
      console.error('❌ Failed to fetch trending topics:', error);
      
      // Record failed fetch
      await this.recordFetchHistory('google_news', 0, false, Date.now() - startTime, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        topicsFetched: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 🗞️ SCRAPE GOOGLE NEWS HEALTH SECTION
   */
  private static async scrapeGoogleNewsHealth(page: Page): Promise<RawTrendingTopic[]> {
    try {
      const topics: RawTrendingTopic[] = [];

      // Multiple health-related search queries to get diverse topics
      const healthQueries = [
        'health news',
        'nutrition research',
        'fitness trends',
        'medical breakthrough',
        'wellness study',
        'health technology',
        'diet research'
      ];

      for (const query of healthQueries.slice(0, 3)) { // Limit to avoid rate limits
        try {
          console.log(`🔍 Searching Google News for: "${query}"`);

          const searchUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
          
          await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });

          // Wait for articles to load
          await page.waitForTimeout(2000);

          // Extract articles
          const articles = await page.evaluate(() => {
            const articleElements = document.querySelectorAll('article[role="article"]');
            const results: any[] = [];

            articleElements.forEach((article, index) => {
              if (index >= 8) return; // Limit per query

              try {
                const titleElement = article.querySelector('h3, h4, [role="heading"]');
                const linkElement = article.querySelector('a[href^="./articles/"]');
                const timeElement = article.querySelector('time');
                const sourceElement = article.querySelector('[data-n-tid]');

                const title = titleElement?.textContent?.trim();
                const href = linkElement?.getAttribute('href');
                const publishedTime = timeElement?.getAttribute('datetime') || timeElement?.textContent?.trim();
                const source = sourceElement?.textContent?.trim();

                if (title && title.length > 10) {
                  results.push({
                    title,
                    url: href ? `https://news.google.com${href}` : undefined,
                    publishedTime,
                    source: source || 'Unknown',
                    description: title // Use title as description for now
                  });
                }
              } catch (error) {
                console.log('Error processing article:', error);
              }
            });

            return results;
          });

          topics.push(...articles.map((article: any) => ({
            title: article.title,
            source: 'google_news',
            url: article.url,
            publishedTime: article.publishedTime,
            description: article.description
          })));

          // Random delay between queries
          await page.waitForTimeout(1000 + Math.random() * 2000);

        } catch (queryError) {
          console.log(`⚠️ Error with query "${query}":`, queryError);
          continue;
        }
      }

      return topics;

    } catch (error) {
      console.error('❌ Google News scraping failed:', error);
      return [];
    }
  }

  /**
   * 🧠 PROCESS AND SCORE TOPICS WITH GPT
   */
  private static async processAndScoreTopics(rawTopics: RawTrendingTopic[]): Promise<ProcessedTrendingTopic[]> {
    const processedTopics: ProcessedTrendingTopic[] = [];

    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('trending-topic-analysis');

      // Process topics in batches
      const batchSize = 5;
      for (let i = 0; i < rawTopics.length; i += batchSize) {
        const batch = rawTopics.slice(i, i + batchSize);
        
        try {
          const batchResults = await this.scoreTopicBatch(batch);
          processedTopics.push(...batchResults);
        } catch (batchError) {
          console.log(`⚠️ Error processing batch ${i}-${i + batchSize}:`, batchError);
          
          // Fallback: create basic processed topics without GPT scoring
          batch.forEach(topic => {
            processedTopics.push({
              topic: this.extractTopicFromTitle(topic.title),
              source: 'google_news',
              relevanceScore: 0.5,
              healthRelevance: this.basicHealthRelevanceCheck(topic.title),
              searchVolume: 100,
              trendVelocity: 'stable',
              expiresAt: new Date(Date.now() + this.TOPIC_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
              rawData: topic
            });
          });
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error('❌ Topic processing failed:', error);
      
      // Fallback: create basic processed topics for all
      rawTopics.forEach(topic => {
        processedTopics.push({
          topic: this.extractTopicFromTitle(topic.title),
          source: 'google_news',
          relevanceScore: 0.5,
          healthRelevance: this.basicHealthRelevanceCheck(topic.title),
          searchVolume: 100,
          trendVelocity: 'stable',
          expiresAt: new Date(Date.now() + this.TOPIC_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
          rawData: topic
        });
      });
    }

    return processedTopics;
  }

  /**
   * 📊 SCORE TOPIC BATCH WITH GPT
   */
  private static async scoreTopicBatch(topics: RawTrendingTopic[]): Promise<ProcessedTrendingTopic[]> {
    try {
      const topicsText = topics.map((topic, index) => 
        `${index + 1}. "${topic.title}" (Source: ${topic.source})`
      ).join('\n');

      const scoringPrompt = `Analyze these health news topics and score their relevance for health/wellness content creation:

${topicsText}

For each topic, provide:
1. Extracted core topic (2-4 words, e.g., "ozempic weight loss")
2. Health relevance score (0.0-1.0, where 1.0 = directly health-related)
3. Content potential score (0.0-1.0, based on engagement potential)
4. Trend velocity (rising/stable/declining)

Return ONLY a JSON array:
[
  {
    "index": 1,
    "topic": "ozempic weight loss",
    "health_relevance": 0.9,
    "content_potential": 0.8,
    "trend_velocity": "rising"
  }
]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: scoringPrompt }],
        max_tokens: 400,
        temperature: 0.1
      });

      const scoringText = response.choices[0]?.message?.content?.trim();
      let scoringResults: any[] = [];

      try {
        scoringResults = JSON.parse(scoringText || '[]');
      } catch (parseError) {
        console.log('⚠️ Failed to parse GPT scoring results');
        return [];
      }

      const processedTopics: ProcessedTrendingTopic[] = [];

      scoringResults.forEach(result => {
        const topicIndex = result.index - 1;
        if (topicIndex >= 0 && topicIndex < topics.length) {
          const rawTopic = topics[topicIndex];
          
          processedTopics.push({
            topic: result.topic || this.extractTopicFromTitle(rawTopic.title),
            source: 'google_news',
            relevanceScore: result.content_potential || 0.5,
            healthRelevance: result.health_relevance || 0.3,
            searchVolume: this.estimateSearchVolume(rawTopic.title),
            trendVelocity: result.trend_velocity || 'stable',
            expiresAt: new Date(Date.now() + this.TOPIC_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
            rawData: rawTopic
          });
        }
      });

      return processedTopics;

    } catch (error) {
      console.error('❌ GPT topic scoring failed:', error);
      return [];
    }
  }

  /**
   * 💾 STORE TOPICS IN DATABASE
   */
  private static async storeTopicsInDatabase(topics: ProcessedTrendingTopic[]): Promise<number> {
    let storedCount = 0;

    try {
      for (const topic of topics) {
        try {
          // Check for duplicates
          const { data: existing } = await supabaseClient.supabase
            .from('real_trending_topics')
            .select('id')
            .eq('topic', topic.topic)
            .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .single();

          if (existing) {
            console.log(`⚠️ Skipping duplicate topic: ${topic.topic}`);
            continue;
          }

          // Insert new topic
          const { error } = await supabaseClient.supabase
            .from('real_trending_topics')
            .insert({
              topic: topic.topic,
              source: topic.source,
              relevance_score: topic.relevanceScore,
              search_volume: topic.searchVolume,
              trend_velocity: topic.trendVelocity,
              health_relevance: topic.healthRelevance,
              expires_at: topic.expiresAt,
              raw_data: topic.rawData,
              timestamp: new Date().toISOString()
            });

          if (!error) {
            storedCount++;
          } else {
            console.log(`⚠️ Failed to store topic "${topic.topic}":`, error);
          }

        } catch (topicError) {
          console.log(`⚠️ Error processing topic "${topic.topic}":`, topicError);
        }
      }

    } catch (error) {
      console.error('❌ Failed to store topics in database:', error);
    }

    return storedCount;
  }

  /**
   * 📝 RECORD FETCH HISTORY
   */
  private static async recordFetchHistory(
    source: string,
    topicsFetched: number,
    success: boolean,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const nextFetchAt = new Date(Date.now() + this.FETCH_INTERVAL_HOURS * 60 * 60 * 1000);

      await supabaseClient.supabase
        .from('trending_fetch_history')
        .insert({
          source,
          topics_fetched: topicsFetched,
          fetch_success: success,
          fetch_duration_ms: durationMs,
          error_message: errorMessage,
          next_fetch_at: nextFetchAt.toISOString(),
          fetched_at: new Date().toISOString()
        });

    } catch (error) {
      console.error('❌ Failed to record fetch history:', error);
    }
  }

  /**
   * 🎯 GET TRENDING TOPICS FOR CONTENT GENERATION
   */
  static async getTrendingTopicsForContent(limit: number = 3): Promise<TopicSelectionResult> {
    try {
      console.log(`🔥 Selecting ${limit} trending topics for content generation...`);

      const { data, error } = await supabaseClient.supabase
        .rpc('get_trending_topics_for_content', { limit_count: limit });

      if (error) {
        console.error('❌ Failed to get trending topics:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No trending topics available');
        return { success: false, error: 'No trending topics available' };
      }

      const topics = data.map((topic: any) => ({
        topic: topic.topic,
        source: topic.source,
        relevanceScore: topic.relevance_score,
        healthRelevance: topic.health_relevance,
        searchVolume: 0, // Not returned by stored procedure
        trendVelocity: 'stable' as const,
        expiresAt: '',
        rawData: {}
      }));

      // Select the best topic
      const selectedTopic = topics[0];

      console.log(`✅ Selected trending topic: "${selectedTopic.topic}" (relevance: ${selectedTopic.relevanceScore})`);

      return {
        success: true,
        topics,
        selectedTopic
      };

    } catch (error) {
      console.error('❌ Error selecting trending topics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ✅ MARK TOPIC AS USED
   */
  static async markTopicAsUsed(topicId: number, tweetId: string, usageType: 'primary' | 'secondary' | 'context' = 'primary'): Promise<void> {
    try {
      // Record usage
      await supabaseClient.supabase
        .from('trending_topic_usage')
        .insert({
          topic_id: topicId,
          tweet_id: tweetId,
          usage_type: usageType,
          used_at: new Date().toISOString()
        });

      // Update topic usage count
      await supabaseClient.supabase
        .from('real_trending_topics')
        .update({
          used: true,
          usage_count: supabaseClient.supabase!.raw('usage_count + 1'),
          last_used: new Date().toISOString()
        })
        .eq('id', topicId);

      console.log(`✅ Marked topic ${topicId} as used for tweet ${tweetId}`);

    } catch (error) {
      console.error('❌ Failed to mark topic as used:', error);
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static extractTopicFromTitle(title: string): string {
    // Extract key terms from title
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'were', 'been', 'says', 'news', 'study', 'research'].includes(word));
    
    return words.slice(0, 3).join(' ') || title.substring(0, 30);
  }

  private static basicHealthRelevanceCheck(title: string): number {
    const healthKeywords = [
      'health', 'medical', 'nutrition', 'diet', 'fitness', 'wellness', 'exercise',
      'vitamin', 'supplement', 'disease', 'therapy', 'treatment', 'doctor',
      'hospital', 'clinic', 'medicine', 'drug', 'pharmaceutical', 'obesity',
      'diabetes', 'heart', 'cancer', 'mental', 'sleep', 'stress', 'immune'
    ];

    const titleLower = title.toLowerCase();
    const matchCount = healthKeywords.filter(keyword => titleLower.includes(keyword)).length;
    
    return Math.min(1.0, matchCount * 0.3);
  }

  private static estimateSearchVolume(title: string): number {
    // Simple heuristic based on title characteristics
    const baseVolume = 100;
    const titleLength = title.length;
    const hasNumbers = /\d/.test(title);
    const hasPercentage = /%/.test(title);
    
    let multiplier = 1;
    if (titleLength > 50) multiplier += 0.3;
    if (hasNumbers) multiplier += 0.2;
    if (hasPercentage) multiplier += 0.2;
    
    return Math.floor(baseVolume * multiplier);
  }

  /**
   * 📊 GET TRENDING ANALYTICS
   */
  static async getTrendingAnalytics(): Promise<{
    totalTopics: number;
    usedTopics: number;
    lastFetchTime: string;
    averageHealthRelevance: number;
    topSources: { source: string; count: number }[];
  }> {
    try {
      const { data: topicsData } = await supabaseClient.supabase
        .from('real_trending_topics')
        .select('source, used, health_relevance, timestamp')
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: fetchData } = await supabaseClient.supabase
        .from('trending_fetch_history')
        .select('fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(1);

      const totalTopics = topicsData?.length || 0;
      const usedTopics = topicsData?.filter(t => t.used).length || 0;
      const avgHealthRelevance = totalTopics > 0 
        ? topicsData!.reduce((sum, t) => sum + (t.health_relevance || 0), 0) / totalTopics 
        : 0;

      // Source distribution
      const sourceCounts: { [key: string]: number } = {};
      topicsData?.forEach(topic => {
        sourceCounts[topic.source] = (sourceCounts[topic.source] || 0) + 1;
      });

      const topSources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalTopics,
        usedTopics,
        lastFetchTime: fetchData?.[0]?.fetched_at || 'Never',
        averageHealthRelevance: avgHealthRelevance,
        topSources
      };

    } catch (error) {
      console.error('❌ Failed to get trending analytics:', error);
      return {
        totalTopics: 0,
        usedTopics: 0,
        lastFetchTime: 'Error',
        averageHealthRelevance: 0,
        topSources: []
      };
    }
  }

  /**
   * 🧹 CLEANUP EXPIRED TOPICS
   */
  static async cleanupExpiredTopics(): Promise<number> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('real_trending_topics')
        .delete()
        .lt('expires_at', new Date().toISOString());

      const deletedCount = data?.length || 0;
      console.log(`🧹 Cleaned up ${deletedCount} expired trending topics`);

      return deletedCount;

    } catch (error) {
      console.error('❌ Failed to cleanup expired topics:', error);
      return 0;
    }
  }
}

export const realTrendingTopicFetcher = RealTrendingTopicFetcher; 