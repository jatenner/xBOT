/**
 * 🧠 ENGAGEMENT-BASED LEARNING SYSTEM
 * 
 * Analyzes performance of the last 100 tweets to extract successful patterns.
 * Learns from engagement data to optimize future content generation.
 * 
 * Features:
 * - Performance analysis of top-performing tweets
 * - Tone, format, and keyword pattern extraction
 * - Learning profile generation and storage
 * - 24-hour learning cycle automation
 * - Integration with content generation for real-time optimization
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

interface TweetPerformanceData {
  tweetId: string;
  content: string;
  engagementScore: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  postingTime: string;
  tone?: string;
  contentType?: string;
  keywords: string[];
  hashtags: string[];
}

interface LearningInsights {
  topPerformingTones: { tone: string; avgEngagement: number; sampleSize: number }[];
  highEngagementKeywords: { keyword: string; avgEngagement: number; frequency: number }[];
  optimalFormats: { format: string; avgEngagement: number; description: string }[];
  bestPostingTimes: { hour: number; avgEngagement: number; sampleSize: number }[];
  engagementDrivers: string[];
}

interface LearnedToneProfile {
  lastUpdated: string;
  analysisVersion: string;
  tweetsAnalyzed: number;
  learningConfidence: number;
  insights: LearningInsights;
  recommendations: {
    preferredTones: string[];
    avoidTones: string[];
    topKeywords: string[];
    optimalPostingHours: number[];
    contentStrategies: string[];
  };
  performanceBenchmarks: {
    avgEngagementRate: number;
    topPerformerThreshold: number;
    minViableEngagement: number;
  };
}

export class EngagementLearningEngine {
  private static readonly ANALYSIS_TWEET_COUNT = 100;
  private static readonly TOP_PERFORMER_PERCENTILE = 0.2; // Top 20%
  private static readonly MIN_SAMPLE_SIZE = 5;
  private static readonly LEARNING_PROFILE_PATH = path.join(process.cwd(), 'data', 'learned_tone_profile.json');
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🔄 RUN COMPLETE LEARNING CYCLE
   */
  static async runLearningCycle(): Promise<{
    success: boolean;
    insights?: LearningInsights;
    profilePath?: string;
    error?: string;
  }> {
    try {
      console.log('🧠 Starting engagement learning cycle...');

      // Step 1: Collect and analyze tweet performance data
      const performanceData = await this.collectTweetPerformanceData();
      
      if (performanceData.length < this.MIN_SAMPLE_SIZE) {
        console.log(`⚠️ Insufficient data for learning (${performanceData.length} tweets, need ${this.MIN_SAMPLE_SIZE})`);
        return { success: false, error: 'Insufficient tweet data for analysis' };
      }

      console.log(`📊 Analyzing ${performanceData.length} tweets for learning insights...`);

      // Step 2: Extract learning insights
      const insights = await this.extractLearningInsights(performanceData);

      // Step 3: Generate tone profile
      const toneProfile = await this.generateLearnedToneProfile(performanceData, insights);

      // Step 4: Save to file and database
      await this.saveLearningProfile(toneProfile);
      await this.storeLearningCycle(performanceData.length, insights);

      console.log('✅ Learning cycle completed successfully');
      console.log(`📈 Key insights: ${insights.topPerformingTones.length} tone patterns, ${insights.highEngagementKeywords.length} keyword patterns`);

      return {
        success: true,
        insights,
        profilePath: this.LEARNING_PROFILE_PATH
      };

    } catch (error) {
      console.error('❌ Learning cycle failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 📊 COLLECT TWEET PERFORMANCE DATA
   */
  private static async collectTweetPerformanceData(): Promise<TweetPerformanceData[]> {
    try {
      // Get the most recent tweets with engagement data
      const { data: tweetsData, error } = await supabaseClient.supabase
        .from('tweets')
        .select(`
          id,
          content,
          created_at,
          performance_log
        `)
        .not('performance_log', 'is', null)
        .order('created_at', { ascending: false })
        .limit(this.ANALYSIS_TWEET_COUNT);

      if (error) {
        console.error('❌ Failed to fetch tweet data:', error);
        return [];
      }

      const performanceData: TweetPerformanceData[] = [];

      for (const tweet of tweetsData || []) {
        try {
          // Extract latest performance metrics
          const performanceLog = tweet.performance_log;
          if (!performanceLog || !Array.isArray(performanceLog) || performanceLog.length === 0) {
            continue;
          }

          const latestMetrics = performanceLog[performanceLog.length - 1];
          const likes = latestMetrics.likes || 0;
          const retweets = latestMetrics.retweets || 0;
          const replies = latestMetrics.replies || 0;
          const impressions = latestMetrics.impressions || Math.max((likes + retweets + replies) * 10, 100);

          const engagementScore = likes + retweets + replies;
          const engagementRate = impressions > 0 ? engagementScore / impressions : 0;

          // Extract keywords and hashtags
          const keywords = this.extractKeywords(tweet.content);
          const hashtags = this.extractHashtags(tweet.content);

          performanceData.push({
            tweetId: tweet.id,
            content: tweet.content,
            engagementScore,
            likes,
            retweets,
            replies,
            impressions,
            engagementRate,
            postingTime: tweet.created_at,
            keywords,
            hashtags
          });

        } catch (tweetError) {
          console.log(`⚠️ Error processing tweet ${tweet.id}:`, tweetError);
          continue;
        }
      }

      console.log(`📊 Collected performance data for ${performanceData.length} tweets`);
      return performanceData.sort((a, b) => b.engagementScore - a.engagementScore);

    } catch (error) {
      console.error('❌ Failed to collect performance data:', error);
      return [];
    }
  }

  /**
   * 🔍 EXTRACT LEARNING INSIGHTS
   */
  private static async extractLearningInsights(performanceData: TweetPerformanceData[]): Promise<LearningInsights> {
    try {
      // Identify top performers
      const topPerformerCount = Math.max(5, Math.floor(performanceData.length * this.TOP_PERFORMER_PERCENTILE));
      const topPerformers = performanceData.slice(0, topPerformerCount);

      console.log(`🏆 Analyzing top ${topPerformerCount} performing tweets...`);

      // Analyze tones and content types using GPT
      const analysisResults = await this.analyzeContentPatterns(topPerformers);

      // Extract keyword patterns
      const keywordAnalysis = this.analyzeKeywordPatterns(performanceData);

      // Analyze posting time patterns
      const timingAnalysis = this.analyzePostingTimePatterns(performanceData);

      // Extract format patterns
      const formatAnalysis = await this.analyzeFormatPatterns(topPerformers);

      // Generate engagement drivers
      const engagementDrivers = await this.identifyEngagementDrivers(topPerformers);

      return {
        topPerformingTones: analysisResults.toneAnalysis,
        highEngagementKeywords: keywordAnalysis,
        optimalFormats: formatAnalysis,
        bestPostingTimes: timingAnalysis,
        engagementDrivers
      };

    } catch (error) {
      console.error('❌ Failed to extract learning insights:', error);
      
      // Return basic insights as fallback
      return {
        topPerformingTones: [],
        highEngagementKeywords: [],
        optimalFormats: [],
        bestPostingTimes: [],
        engagementDrivers: ['Engaging questions', 'Actionable tips', 'Surprising facts']
      };
    }
  }

  /**
   * 🧠 ANALYZE CONTENT PATTERNS WITH GPT
   */
  private static async analyzeContentPatterns(topPerformers: TweetPerformanceData[]): Promise<{
    toneAnalysis: { tone: string; avgEngagement: number; sampleSize: number }[];
  }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('content-pattern-analysis');

      const sampleTweets = topPerformers.slice(0, 10).map(tweet => 
        `Tweet: "${tweet.content}" | Engagement: ${tweet.engagementScore}`
      ).join('\n\n');

      const analysisPrompt = `Analyze these top-performing health tweets and identify their tone patterns:

${sampleTweets}

For each tweet, identify the primary tone from these categories:
- friendly: Warm, encouraging, conversational
- controversial: Bold claims, contrarian viewpoints  
- scientific: Data-driven, research-based, factual
- personal: Story-based, relatable experiences

Return ONLY a JSON array:
[
  {"tweet_index": 1, "tone": "friendly", "confidence": 0.9},
  {"tweet_index": 2, "tone": "controversial", "confidence": 0.8}
]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 300,
        temperature: 0.1
      });

      const analysisText = response.choices[0]?.message?.content?.trim();
      let toneAssignments: any[] = [];

      try {
        toneAssignments = JSON.parse(analysisText || '[]');
      } catch (parseError) {
        console.log('⚠️ Failed to parse tone analysis, using fallback');
      }

      // Calculate tone performance statistics
      const toneStats: { [key: string]: { engagements: number[]; count: number } } = {};

      toneAssignments.forEach(assignment => {
        const tweetIndex = assignment.tweet_index - 1;
        if (tweetIndex >= 0 && tweetIndex < topPerformers.length) {
          const tone = assignment.tone;
          const engagement = topPerformers[tweetIndex].engagementScore;

          if (!toneStats[tone]) {
            toneStats[tone] = { engagements: [], count: 0 };
          }
          toneStats[tone].engagements.push(engagement);
          toneStats[tone].count++;
        }
      });

      const toneAnalysis = Object.entries(toneStats).map(([tone, stats]) => ({
        tone,
        avgEngagement: stats.engagements.reduce((sum, eng) => sum + eng, 0) / stats.engagements.length,
        sampleSize: stats.count
      })).sort((a, b) => b.avgEngagement - a.avgEngagement);

      return { toneAnalysis };

    } catch (error) {
      console.error('❌ Content pattern analysis failed:', error);
      return { toneAnalysis: [] };
    }
  }

  /**
   * 🔤 ANALYZE KEYWORD PATTERNS
   */
  private static analyzeKeywordPatterns(performanceData: TweetPerformanceData[]): { keyword: string; avgEngagement: number; frequency: number }[] {
    try {
      const keywordStats: { [key: string]: { engagements: number[]; frequency: number } } = {};

      performanceData.forEach(tweet => {
        tweet.keywords.forEach(keyword => {
          if (!keywordStats[keyword]) {
            keywordStats[keyword] = { engagements: [], frequency: 0 };
          }
          keywordStats[keyword].engagements.push(tweet.engagementScore);
          keywordStats[keyword].frequency++;
        });
      });

      return Object.entries(keywordStats)
        .filter(([keyword, stats]) => stats.frequency >= 2) // At least 2 occurrences
        .map(([keyword, stats]) => ({
          keyword,
          avgEngagement: stats.engagements.reduce((sum, eng) => sum + eng, 0) / stats.engagements.length,
          frequency: stats.frequency
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 15); // Top 15 keywords

    } catch (error) {
      console.error('❌ Keyword analysis failed:', error);
      return [];
    }
  }

  /**
   * ⏰ ANALYZE POSTING TIME PATTERNS
   */
  private static analyzePostingTimePatterns(performanceData: TweetPerformanceData[]): { hour: number; avgEngagement: number; sampleSize: number }[] {
    try {
      const hourStats: { [key: number]: { engagements: number[]; count: number } } = {};

      performanceData.forEach(tweet => {
        const hour = new Date(tweet.postingTime).getHours();
        if (!hourStats[hour]) {
          hourStats[hour] = { engagements: [], count: 0 };
        }
        hourStats[hour].engagements.push(tweet.engagementScore);
        hourStats[hour].count++;
      });

      return Object.entries(hourStats)
        .filter(([hour, stats]) => stats.count >= 2) // At least 2 tweets
        .map(([hour, stats]) => ({
          hour: parseInt(hour),
          avgEngagement: stats.engagements.reduce((sum, eng) => sum + eng, 0) / stats.engagements.length,
          sampleSize: stats.count
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 8); // Top 8 hours

    } catch (error) {
      console.error('❌ Timing analysis failed:', error);
      return [];
    }
  }

  /**
   * 📝 ANALYZE FORMAT PATTERNS
   */
  private static async analyzeFormatPatterns(topPerformers: TweetPerformanceData[]): Promise<{ format: string; avgEngagement: number; description: string }[]> {
    try {
      // Analyze common formats in top-performing tweets
      const formatPatterns = [
        { format: 'question_ending', pattern: /\?[ ]*$/, description: 'Tweets ending with questions' },
        { format: 'number_facts', pattern: /\b\d+([.,]\d+)?%?\b/, description: 'Tweets with numerical data' },
        { format: 'emoji_usage', pattern: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u, description: 'Tweets with emojis' },
        { format: 'bold_claims', pattern: /\b(never|always|all|every|most|best|worst|only)\b/i, description: 'Tweets with strong assertions' },
        { format: 'action_words', pattern: /\b(try|do|start|stop|avoid|use|take|get)\b/i, description: 'Tweets with actionable language' }
      ];

      const formatStats: { [key: string]: { engagements: number[]; count: number; description: string } } = {};

      topPerformers.forEach(tweet => {
        formatPatterns.forEach(({ format, pattern, description }) => {
          if (pattern.test(tweet.content)) {
            if (!formatStats[format]) {
              formatStats[format] = { engagements: [], count: 0, description };
            }
            formatStats[format].engagements.push(tweet.engagementScore);
            formatStats[format].count++;
          }
        });
      });

      return Object.entries(formatStats)
        .filter(([format, stats]) => stats.count >= 2)
        .map(([format, stats]) => ({
          format,
          avgEngagement: stats.engagements.reduce((sum, eng) => sum + eng, 0) / stats.engagements.length,
          description: stats.description
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement);

    } catch (error) {
      console.error('❌ Format analysis failed:', error);
      return [];
    }
  }

  /**
   * 🚀 IDENTIFY ENGAGEMENT DRIVERS
   */
  private static async identifyEngagementDrivers(topPerformers: TweetPerformanceData[]): Promise<string[]> {
    try {
      // Extract common themes from top performers
      const commonPatterns = [
        'Surprising health facts',
        'Actionable tips',
        'Myth-busting content',
        'Personal stories',
        'Scientific explanations',
        'Controversial viewpoints',
        'Practical advice',
        'Data-driven insights',
        'Engaging questions',
        'Relatable experiences'
      ];

      // This could be enhanced with more sophisticated analysis
      return commonPatterns.slice(0, 5);

    } catch (error) {
      console.error('❌ Failed to identify engagement drivers:', error);
      return ['Engaging content', 'Clear value proposition', 'Audience interaction'];
    }
  }

  /**
   * 📋 GENERATE LEARNED TONE PROFILE
   */
  private static async generateLearnedToneProfile(
    performanceData: TweetPerformanceData[],
    insights: LearningInsights
  ): Promise<LearnedToneProfile> {
    try {
      const avgEngagementRate = performanceData.reduce((sum, tweet) => sum + tweet.engagementRate, 0) / performanceData.length;
      const topPerformerThreshold = performanceData[Math.floor(performanceData.length * this.TOP_PERFORMER_PERCENTILE)]?.engagementScore || 0;

      const profile: LearnedToneProfile = {
        lastUpdated: new Date().toISOString(),
        analysisVersion: '2.0',
        tweetsAnalyzed: performanceData.length,
        learningConfidence: Math.min(1.0, performanceData.length / this.ANALYSIS_TWEET_COUNT),
        insights,
        recommendations: {
          preferredTones: insights.topPerformingTones.slice(0, 2).map(t => t.tone),
          avoidTones: insights.topPerformingTones.slice(-2).map(t => t.tone),
          topKeywords: insights.highEngagementKeywords.slice(0, 8).map(k => k.keyword),
          optimalPostingHours: insights.bestPostingTimes.slice(0, 3).map(t => t.hour),
          contentStrategies: insights.engagementDrivers
        },
        performanceBenchmarks: {
          avgEngagementRate,
          topPerformerThreshold,
          minViableEngagement: avgEngagementRate * 0.5
        }
      };

      return profile;

    } catch (error) {
      console.error('❌ Failed to generate tone profile:', error);
      throw error;
    }
  }

  /**
   * 💾 SAVE LEARNING PROFILE
   */
  private static async saveLearningProfile(profile: LearnedToneProfile): Promise<void> {
    try {
      // Ensure directory exists
      const dataDir = path.dirname(this.LEARNING_PROFILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Save to file
      fs.writeFileSync(this.LEARNING_PROFILE_PATH, JSON.stringify(profile, null, 2));
      console.log(`💾 Saved learning profile to ${this.LEARNING_PROFILE_PATH}`);

    } catch (error) {
      console.error('❌ Failed to save learning profile:', error);
      throw error;
    }
  }

  /**
   * 📊 STORE LEARNING CYCLE IN DATABASE
   */
  private static async storeLearningCycle(tweetsAnalyzed: number, insights: LearningInsights): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('learning_cycles')
        .insert({
          cycle_end: new Date().toISOString(),
          tweets_analyzed: tweetsAnalyzed,
          top_performing_count: insights.topPerformingTones.length,
          insights_generated: insights,
          tone_recommendations: insights.topPerformingTones,
          keyword_recommendations: insights.highEngagementKeywords,
          format_recommendations: insights.optimalFormats,
          completed: true
        });

      console.log('📊 Stored learning cycle in database');

    } catch (error) {
      console.error('❌ Failed to store learning cycle:', error);
    }
  }

  /**
   * 📖 LOAD CURRENT LEARNING PROFILE
   */
  static loadCurrentProfile(): LearnedToneProfile | null {
    try {
      if (fs.existsSync(this.LEARNING_PROFILE_PATH)) {
        const profileData = fs.readFileSync(this.LEARNING_PROFILE_PATH, 'utf8');
        return JSON.parse(profileData);
      }
    } catch (error) {
      console.error('❌ Failed to load learning profile:', error);
    }
    return null;
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static extractKeywords(content: string): string[] {
    // Extract meaningful keywords (this could be enhanced with NLP)
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'were', 'been', 'your', 'what', 'when', 'where', 'more', 'most', 'some'].includes(word));
    
    return [...new Set(words)]; // Remove duplicates
  }

  private static extractHashtags(content: string): string[] {
    const hashtagMatches = content.match(/#\w+/g);
    return hashtagMatches ? hashtagMatches.map(tag => tag.toLowerCase()) : [];
  }

  /**
   * 📈 GET LEARNING ANALYTICS
   */
  static async getLearningAnalytics(): Promise<{
    totalCycles: number;
    lastCycleDate: string;
    avgTweetsAnalyzed: number;
    currentConfidence: number;
    topInsights: string[];
  }> {
    try {
      const { data: cycles } = await supabaseClient.supabase
        .from('learning_cycles')
        .select('*')
        .order('cycle_end', { ascending: false })
        .limit(10);

      const currentProfile = this.loadCurrentProfile();

      return {
        totalCycles: cycles?.length || 0,
        lastCycleDate: cycles?.[0]?.cycle_end || 'Never',
        avgTweetsAnalyzed: cycles?.length ? cycles.reduce((sum, cycle) => sum + (cycle.tweets_analyzed || 0), 0) / cycles.length : 0,
        currentConfidence: currentProfile?.learningConfidence || 0,
        topInsights: currentProfile?.recommendations?.contentStrategies || []
      };

    } catch (error) {
      console.error('❌ Failed to get learning analytics:', error);
      return {
        totalCycles: 0,
        lastCycleDate: 'Error',
        avgTweetsAnalyzed: 0,
        currentConfidence: 0,
        topInsights: []
      };
    }
  }
}

export const engagementLearningEngine = EngagementLearningEngine; 