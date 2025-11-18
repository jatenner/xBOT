/**
 * 📈 TRENDING TOPIC EXTRACTOR
 * 
 * Extracts trending health topics from reply_opportunities table
 * (viral tweets discovered by harvester)
 * 
 * Used to inform post generation with trending context
 */

import { supabaseClient } from '../db/supabaseClient';
import { OpenAI } from 'openai';

export interface TrendingTopic {
  topic: string;
  engagement: number; // Total likes from all tweets about this topic
  tweet_count: number; // Number of viral tweets about this topic
  avg_likes: number; // Average likes per tweet
  urgency_score: number; // 1-10, how hot/trending right now
  health_relevance: number; // 1-10, how relevant to health content
}

export class TrendingTopicExtractor {
  private static instance: TrendingTopicExtractor;
  private openai: OpenAI;
  private cache: TrendingTopic[] = [];
  private cacheExpiry: Date | null = null;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public static getInstance(): TrendingTopicExtractor {
    if (!TrendingTopicExtractor.instance) {
      TrendingTopicExtractor.instance = new TrendingTopicExtractor();
    }
    return TrendingTopicExtractor.instance;
  }

  /**
   * 🎯 Get trending topics from harvester data
   * Returns topics extracted from viral tweets in reply_opportunities
   */
  async getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
    // Check cache
    if (this.cache.length > 0 && this.cacheExpiry && new Date() < this.cacheExpiry) {
      console.log('[TRENDING_EXTRACTOR] 📦 Using cached trending topics');
      return this.cache.slice(0, limit);
    }

    console.log('[TRENDING_EXTRACTOR] 🔍 Extracting trending topics from harvester data...');

    try {
      // Get recent viral tweets from reply_opportunities (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const { data: opportunities, error } = await supabaseClient
        .from('reply_opportunities')
        .select('tweet_content, like_count, reply_count, tier, tweet_posted_at')
        .gte('tweet_posted_at', twentyFourHoursAgo.toISOString())
        .gte('like_count', 2000) // Only truly viral tweets (2K+ likes)
        .eq('replied_to', false) // Not yet replied to (still active)
        .order('like_count', { ascending: false })
        .limit(100); // Get top 100 viral tweets

      if (error) {
        console.error('[TRENDING_EXTRACTOR] ❌ Error fetching opportunities:', error);
        return [];
      }

      if (!opportunities || opportunities.length === 0) {
        console.log('[TRENDING_EXTRACTOR] ⚠️ No viral tweets found in last 24h');
        return [];
      }

      console.log(`[TRENDING_EXTRACTOR] 📊 Found ${opportunities.length} viral tweets to analyze`);

      // Extract topics using AI
      const topics = await this.extractTopicsFromTweets(opportunities);

      // Cache results
      this.cache = topics;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);

      console.log(`[TRENDING_EXTRACTOR] ✅ Extracted ${topics.length} trending topics`);
      return topics.slice(0, limit);

    } catch (error: any) {
      console.error('[TRENDING_EXTRACTOR] ❌ Error extracting topics:', error.message);
      return [];
    }
  }

  /**
   * 🧠 Use AI to extract health topics from viral tweets
   */
  private async extractTopicsFromTweets(
    tweets: Array<{ tweet_content: string; like_count: number; reply_count: number; tier?: string | null }>
  ): Promise<TrendingTopic[]> {
    // Prepare tweet samples for AI analysis
    const tweetSamples = tweets.slice(0, 50).map(t => ({
      content: String(t.tweet_content || '').substring(0, 200), // Truncate for prompt
      likes: t.like_count || 0,
      tier: t.tier || 'unknown'
    }));

    const prompt = `You are analyzing viral health tweets to identify trending topics.

VIRAL TWEETS (last 24 hours):
${JSON.stringify(tweetSamples, null, 2)}

TASK: Extract the TOP 10 health topics that are trending RIGHT NOW based on these viral tweets.

For each topic, provide:
1. Topic name (specific, not generic - e.g., "magnesium glycinate for sleep" not "sleep")
2. Total engagement (sum of likes from tweets about this topic)
3. Number of viral tweets mentioning this topic
4. Average likes per tweet
5. Urgency score (1-10): How hot/trending is this RIGHT NOW?
6. Health relevance (1-10): How relevant to evidence-based health content?

Return as JSON object with "topics" array:
{
  "topics": [
    {
      "topic": "specific topic name",
      "engagement": 50000,
      "tweet_count": 5,
      "avg_likes": 10000,
      "urgency_score": 8,
      "health_relevance": 9
    }
  ]
}

Focus on:
- Specific health topics (not generic like "health" or "wellness")
- Topics with high engagement (10K+ likes total)
- Topics that are timely/trending (not evergreen)
- Topics relevant to evidence-based health content

Return ONLY the JSON object, no other text.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse JSON response
      const parsed = JSON.parse(content);
      // Handle both formats: { topics: [...] } or direct array
      const topics = Array.isArray(parsed.topics) ? parsed.topics : 
                     Array.isArray(parsed) ? parsed : 
                     (parsed.data && Array.isArray(parsed.data) ? parsed.data : []);

      // Validate and return
      return topics
        .filter((t: any) => t.topic && t.engagement > 0)
        .sort((a: any, b: any) => b.urgency_score - a.urgency_score)
        .slice(0, 10);

    } catch (error: any) {
      console.error('[TRENDING_EXTRACTOR] ❌ AI extraction failed:', error.message);
      
      // Fallback: Simple keyword extraction
      return this.fallbackKeywordExtraction(tweets);
    }
  }

  /**
   * 🔄 Fallback: Simple keyword-based extraction
   */
  private fallbackKeywordExtraction(
    tweets: Array<{ tweet_content: string; like_count: number }>
  ): TrendingTopic[] {
    const healthKeywords: Record<string, number> = {};
    
    tweets.forEach(tweet => {
      const content = String(tweet.tweet_content || '').toLowerCase();
      const likes = tweet.like_count || 0;
      
      // Extract health keywords
      const keywords = content.match(/\b(sleep|circadian|melatonin|cortisol|insulin|glucose|metabolic|gut|microbiome|fasting|autophagy|nad\+|longevity|testosterone|estrogen|dopamine|serotonin|hrv|zone 2|cold|heat|sauna|magnesium|vitamin d|protein|keto|carnivore|vegan|meditation|breathwork|supplement|probiotic|prebiotic|polyphenol|antioxidant|inflammation|mitochondria|mTOR|AMPK|ketosis|thermogenesis|vagal|parasympathetic|sympathetic)\b/g);
      
      if (keywords) {
        keywords.forEach(keyword => {
          if (!healthKeywords[keyword]) {
            healthKeywords[keyword] = 0;
          }
          healthKeywords[keyword] += likes;
        });
      }
    });

    // Convert to TrendingTopic format
    const topics: TrendingTopic[] = Object.entries(healthKeywords)
      .map(([topic, engagement]) => ({
        topic,
        engagement,
        tweet_count: tweets.filter(t => 
          String(t.tweet_content || '').toLowerCase().includes(topic)
        ).length,
        avg_likes: engagement / tweets.filter(t => 
          String(t.tweet_content || '').toLowerCase().includes(topic)
        ).length,
        urgency_score: 7, // Default
        health_relevance: 8 // Default
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);

    return topics;
  }

  /**
   * 🎯 Get top trending topic for post generation
   * Returns single best topic based on urgency + relevance
   */
  async getTopTrendingTopic(): Promise<string | null> {
    const topics = await this.getTrendingTopics(5);
    if (topics.length === 0) {
      return null;
    }

    // Score by urgency + relevance
    const scored = topics.map(t => ({
      topic: t.topic,
      score: (t.urgency_score * 0.6) + (t.health_relevance * 0.4)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].topic;
  }

  /**
   * 🔄 Clear cache (force refresh)
   */
  clearCache(): void {
    this.cache = [];
    this.cacheExpiry = null;
  }
}

export const trendingTopicExtractor = TrendingTopicExtractor.getInstance();

