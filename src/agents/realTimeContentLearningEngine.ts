#!/usr/bin/env node

/**
 * 🧠 REAL-TIME CONTENT LEARNING ENGINE
 * 
 * Actively learns and improves content generation in real-time by:
 * 1. Analyzing every piece of content BEFORE and AFTER posting
 * 2. Learning from engagement patterns immediately
 * 3. Applying learned improvements to the NEXT content generation
 * 4. Building a dynamic content optimization database
 * 5. Continuously evolving content quality without human intervention
 */

import { supabaseClient } from '../utils/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

// Performance insights interface
export interface PerformanceInsights {
  bestTimeBlocks: string[];
  highPerformanceTones: string[];
  keywordsToPrioritize: string[];
  contentPatterns: {
    avgEngagement: number;
    topPerformingLength: number;
    mostViralTimes: string[];
    underperformingPatterns: string[];
  };
  replyInsights: {
    bestReplyTones: string[];
    avgReplyEngagement: number;
    topReplyKeywords: string[];
  };
  temporalPatterns: {
    hourlyPerformance: { [hour: string]: number };
    weekdayPerformance: { [day: string]: number };
    optimalPostingWindows: string[];
  };
}

// Analysis result interface
export interface ContentAnalysisResult {
  success: boolean;
  insights: PerformanceInsights;
  confidence: number;
  dataPoints: number;
  generatedAt: string;
  summary: string;
  error?: string;
}

// Tweet performance data for analysis
interface TweetAnalysisData {
  tweet_id: string;
  content: string;
  content_type: string;
  likes: number;
  retweets: number;
  replies: number;
  engagement_score: number;
  created_at: string;
  performance_log: any[];
  gpt_reply_score?: number;
  reply_tone?: string;
}

export class RealTimeContentLearningEngine {
  private strategyPath = path.join(process.cwd(), 'src', 'strategy', 'tweetingStrategy.ts');
  private analysisLogPath = path.join(process.cwd(), 'logs', 'content-learning.json');
  private readonly MIN_DATA_POINTS = 10; // Minimum tweets needed for reliable analysis
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const strategyDir = path.dirname(this.strategyPath);
    const logsDir = path.dirname(this.analysisLogPath);
    
    if (!fs.existsSync(strategyDir)) {
      fs.mkdirSync(strategyDir, { recursive: true });
    }
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * 🧠 MAIN CONTENT LEARNING ORCHESTRATOR
   * Analyzes all performance data and generates optimized strategy
   */
  async analyzeAndGenerateStrategy(): Promise<ContentAnalysisResult> {
    console.log('🧠 === REAL-TIME CONTENT LEARNING STARTING ===');
    const startTime = Date.now();

    try {
      // Step 1: Gather performance data
      console.log('📊 Step 1: Gathering performance data...');
      const tweetData = await this.gatherPerformanceData();
      
      if (tweetData.length < this.MIN_DATA_POINTS) {
        return {
          success: false,
          insights: this.getDefaultStrategy(),
          confidence: 0,
          dataPoints: tweetData.length,
          generatedAt: new Date().toISOString(),
          summary: `Insufficient data: ${tweetData.length}/${this.MIN_DATA_POINTS} tweets needed for reliable analysis`,
          error: 'Not enough data points for analysis'
        };
      }

      // Step 2: Analyze temporal patterns
      console.log('⏰ Step 2: Analyzing temporal patterns...');
      const temporalInsights = this.analyzeTemporalPatterns(tweetData);

      // Step 3: Analyze content performance
      console.log('📝 Step 3: Analyzing content performance...');
      const contentInsights = this.analyzeContentPatterns(tweetData);

      // Step 4: Analyze reply performance
      console.log('💬 Step 4: Analyzing reply performance...');
      const replyInsights = this.analyzeReplyPatterns(tweetData);

      // Step 5: Extract keywords and topics
      console.log('🔍 Step 5: Extracting high-performing keywords...');
      const keywordInsights = this.extractTopKeywords(tweetData);

      // Step 6: Generate comprehensive insights
      const insights: PerformanceInsights = {
        bestTimeBlocks: temporalInsights.optimalPostingWindows,
        highPerformanceTones: replyInsights.bestReplyTones,
        keywordsToPrioritize: keywordInsights,
        contentPatterns: {
          avgEngagement: contentInsights.avgEngagement,
          topPerformingLength: contentInsights.optimalLength,
          mostViralTimes: temporalInsights.mostViralTimes,
          underperformingPatterns: contentInsights.underperformingPatterns
        },
        replyInsights: {
          bestReplyTones: replyInsights.bestReplyTones,
          avgReplyEngagement: replyInsights.avgEngagement,
          topReplyKeywords: replyInsights.topKeywords
        },
        temporalPatterns: temporalInsights
      };

      // Step 7: Calculate confidence score
      const confidence = this.calculateConfidence(tweetData.length, insights);

      // Step 8: Generate and save strategy
      console.log('💾 Step 8: Generating optimized strategy...');
      await this.generateStrategyFile(insights, confidence);

      // Step 9: Log analysis results
      await this.logAnalysisResults(insights, confidence, tweetData.length);

      const duration = Date.now() - startTime;
      const summary = `🧠 Learning complete: Analyzed ${tweetData.length} tweets, confidence ${Math.round(confidence * 100)}%, generated optimized strategy in ${Math.round(duration / 1000)}s`;

      console.log(summary);
      
      return {
        success: true,
        insights,
        confidence,
        dataPoints: tweetData.length,
        generatedAt: new Date().toISOString(),
        summary
      };
      
    } catch (error) {
      console.error('❌ Content learning failed:', error);
      return {
        success: false,
        insights: this.getDefaultStrategy(),
        confidence: 0,
        dataPoints: 0,
        generatedAt: new Date().toISOString(),
        summary: `Content learning failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 📊 Gather performance data from Supabase
   */
  private async gatherPerformanceData(): Promise<TweetAnalysisData[]> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Query tweets with performance data
      const { data: tweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        ?.select(`
          tweet_id,
          content,
          content_type,
          likes,
          retweets,
          replies,
          engagement_score,
          created_at,
          performance_log,
          gpt_reply_score
        `)
        ?.eq('success', true)
        ?.gte('created_at', thirtyDaysAgo)
        ?.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Also get reply data if available
      const { data: replyData, error: replyError } = await supabaseClient.supabase
        ?.from('replies') // Assuming you have a replies table
        ?.select('original_tweet_id, content, reply_tone, likes, retweets, created_at')
        ?.gte('created_at', thirtyDaysAgo)
        ?.limit(100)
        ?.maybeSingle();

      console.log(`📊 Gathered ${tweets?.length || 0} tweets for analysis`);
      
      return tweets || [];

    } catch (error) {
      console.error('❌ Error gathering performance data:', error);
      return [];
    }
  }

  /**
   * ⏰ Analyze temporal patterns for optimal posting times
   */
  private analyzeTemporalPatterns(tweets: TweetAnalysisData[]): any {
    const hourlyPerformance: { [hour: string]: number[] } = {};
    const weekdayPerformance: { [day: string]: number[] } = {};
    const viralTimes: string[] = [];

    tweets.forEach(tweet => {
      const date = new Date(tweet.created_at);
      const hour = date.getHours();
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      const timeBlock = `${weekday} ${this.formatHour(hour)}`;
      
      // Calculate engagement rate (likes + retweets + replies)
      const engagement = tweet.likes + tweet.retweets + tweet.replies;
      const engagementRate = engagement / Math.max(1, tweet.engagement_score || 1);

      // Track hourly performance
      if (!hourlyPerformance[hour]) hourlyPerformance[hour] = [];
      hourlyPerformance[hour].push(engagementRate);

      // Track weekday performance
      if (!weekdayPerformance[weekday]) weekdayPerformance[weekday] = [];
      weekdayPerformance[weekday].push(engagementRate);

      // Track viral content times (high engagement)
      if (engagement > 20) { // Threshold for "viral"
        viralTimes.push(timeBlock);
      }
    });

    // Calculate average performance for each time period
    const avgHourlyPerformance: { [hour: string]: number } = {};
    Object.keys(hourlyPerformance).forEach(hour => {
      const performances = hourlyPerformance[hour];
      avgHourlyPerformance[hour] = performances.reduce((a, b) => a + b, 0) / performances.length;
    });

    const avgWeekdayPerformance: { [day: string]: number } = {};
    Object.keys(weekdayPerformance).forEach(day => {
      const performances = weekdayPerformance[day];
      avgWeekdayPerformance[day] = performances.reduce((a, b) => a + b, 0) / performances.length;
    });

    // Find optimal posting windows
    const optimalHours = Object.entries(avgHourlyPerformance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    const optimalDays = Object.entries(avgWeekdayPerformance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);

    // Generate optimal posting windows
    const optimalPostingWindows: string[] = [];
    optimalDays.forEach(day => {
      optimalHours.forEach(hour => {
        optimalPostingWindows.push(`${day} ${this.formatHour(hour)}`);
      });
    });

    return {
      hourlyPerformance: avgHourlyPerformance,
      weekdayPerformance: avgWeekdayPerformance,
      optimalPostingWindows: optimalPostingWindows.slice(0, 4), // Top 4 windows
      mostViralTimes: [...new Set(viralTimes)].slice(0, 3) // Top 3 viral times
    };
  }

  /**
   * 📝 Analyze content patterns for optimization
   */
  private analyzeContentPatterns(tweets: TweetAnalysisData[]): any {
    const lengthPerformance: { length: number; engagement: number }[] = [];
    const contentTypePerformance: { [type: string]: number[] } = {};
    const underperformingPatterns: string[] = [];

    let totalEngagement = 0;

    tweets.forEach(tweet => {
      const engagement = tweet.likes + tweet.retweets + tweet.replies;
      totalEngagement += engagement;

      // Track length vs performance
      lengthPerformance.push({
        length: tweet.content.length,
        engagement
      });

      // Track content type performance
      const type = tweet.content_type || 'general';
      if (!contentTypePerformance[type]) contentTypePerformance[type] = [];
      contentTypePerformance[type].push(engagement);

      // Identify underperforming patterns
      if (engagement < 2) { // Low engagement threshold
        const words = tweet.content.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.length > 6 && !underperformingPatterns.includes(word)) {
            underperformingPatterns.push(word);
          }
        });
      }
    });

    // Find optimal content length
    const sortedByLength = lengthPerformance.sort((a, b) => b.engagement - a.engagement);
    const topPerforming = sortedByLength.slice(0, Math.ceil(sortedByLength.length * 0.2)); // Top 20%
    const avgTopLength = topPerforming.reduce((sum, item) => sum + item.length, 0) / topPerforming.length;

    return {
      avgEngagement: totalEngagement / tweets.length,
      optimalLength: Math.round(avgTopLength),
      contentTypePerformance,
      underperformingPatterns: underperformingPatterns.slice(0, 5) // Top 5 to avoid
    };
  }

  /**
   * 💬 Analyze reply patterns and tones
   */
  private analyzeReplyPatterns(tweets: TweetAnalysisData[]): any {
    const tonePerformance: { [tone: string]: number[] } = {};
    const replyKeywords: { [keyword: string]: number } = {};
    let totalReplyEngagement = 0;
    let replyCount = 0;

    tweets.forEach(tweet => {
      if (tweet.gpt_reply_score && tweet.gpt_reply_score > 0) {
        replyCount++;
        totalReplyEngagement += tweet.gpt_reply_score;

        // Extract tone from content (simplified analysis)
        const tone = this.detectTone(tweet.content);
        if (!tonePerformance[tone]) tonePerformance[tone] = [];
        tonePerformance[tone].push(tweet.gpt_reply_score);

        // Extract keywords from high-performing replies
        if (tweet.gpt_reply_score > 0.7) {
          const words = tweet.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
          words.forEach(word => {
            replyKeywords[word] = (replyKeywords[word] || 0) + 1;
          });
        }
      }
    });

    // Find best performing tones
    const bestTones = Object.entries(tonePerformance)
      .map(([tone, scores]) => ({
        tone,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(item => item.tone);

    // Find top reply keywords
    const topKeywords = Object.entries(replyKeywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([keyword]) => keyword);

    return {
      bestReplyTones: bestTones,
      avgEngagement: replyCount > 0 ? totalReplyEngagement / replyCount : 0,
      topKeywords
    };
  }

  /**
   * 🔍 Extract top-performing keywords
   */
  private extractTopKeywords(tweets: TweetAnalysisData[]): string[] {
    const keywordPerformance: { [keyword: string]: number[] } = {};

    tweets.forEach(tweet => {
      const engagement = tweet.likes + tweet.retweets + tweet.replies;
      
      // Extract meaningful keywords (4+ characters, not common words)
      const words = tweet.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const filteredWords = words.filter(word => 
        !['this', 'that', 'with', 'have', 'will', 'been', 'they', 'were', 'said', 'each', 'which', 'their', 'time', 'about'].includes(word)
      );

      filteredWords.forEach(word => {
        if (!keywordPerformance[word]) keywordPerformance[word] = [];
        keywordPerformance[word].push(engagement);
      });
    });

    // Calculate average performance for each keyword
    const keywordAverages = Object.entries(keywordPerformance)
      .map(([keyword, engagements]) => ({
        keyword,
        avgEngagement: engagements.reduce((a, b) => a + b, 0) / engagements.length,
        frequency: engagements.length
      }))
      .filter(item => item.frequency >= 2) // Keyword must appear at least twice
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 8)
      .map(item => item.keyword);

    return keywordAverages;
  }

  /**
   * 🎭 Detect tone from content
   */
  private detectTone(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('interesting') || lowerContent.includes('fascinating') || lowerContent.includes('insight')) {
      return 'insightful';
    } else if (lowerContent.includes('plot twist') || lowerContent.includes('irony') || lowerContent.includes('wild')) {
      return 'clever';
    } else if (lowerContent.includes('exactly') || lowerContent.includes('absolutely') || lowerContent.includes('yes')) {
      return 'supportive';
    } else if (lowerContent.includes('?') || lowerContent.includes('curious') || lowerContent.includes('wonder')) {
      return 'questioning';
    } else if (lowerContent.includes('though') || lowerContent.includes('except') || lowerContent.includes('caveat')) {
      return 'corrective';
    }
    
    return 'neutral';
  }

  /**
   * ⏰ Format hour for display
   */
  private formatHour(hour: number): string {
    if (hour === 0) return '12AM';
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return '12PM';
    return `${hour - 12}PM`;
  }

  /**
   * 📊 Calculate confidence score
   */
  private calculateConfidence(dataPoints: number, insights: PerformanceInsights): number {
    let confidence = 0;

    // Data quantity factor (0-0.4)
    confidence += Math.min(dataPoints / 50, 0.4);

    // Insight quality factors (0-0.6)
    if (insights.bestTimeBlocks.length > 0) confidence += 0.15;
    if (insights.highPerformanceTones.length > 0) confidence += 0.15;
    if (insights.keywordsToPrioritize.length > 0) confidence += 0.15;
    if (insights.contentPatterns.avgEngagement > 0) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  /**
   * 💾 Generate strategy file
   */
  private async generateStrategyFile(insights: PerformanceInsights, confidence: number): Promise<void> {
    const strategyContent = `// 🧠 AUTO-GENERATED CONTENT STRATEGY
// Generated: ${new Date().toISOString()}
// Confidence: ${Math.round(confidence * 100)}%
// Data source: Real-time performance analysis

export const optimizedStrategy = {
  // 📅 Best posting times based on engagement data
  bestTimeBlocks: ${JSON.stringify(insights.bestTimeBlocks, null, 2)},
  
  // 🎭 Highest performing reply tones
  highPerformanceTones: ${JSON.stringify(insights.highPerformanceTones, null, 2)},
  
  // 🔑 Keywords that drive engagement
  keywordsToPrioritize: ${JSON.stringify(insights.keywordsToPrioritize, null, 2)},
  
  // 📊 Content optimization insights
  contentOptimization: {
    optimalLength: ${insights.contentPatterns.topPerformingLength},
    avgEngagement: ${Math.round(insights.contentPatterns.avgEngagement * 100) / 100},
    viralTimes: ${JSON.stringify(insights.contentPatterns.mostViralTimes, null, 2)},
    avoidPatterns: ${JSON.stringify(insights.contentPatterns.underperformingPatterns, null, 2)}
  },
  
  // 💬 Reply strategy insights  
  replyStrategy: {
    bestTones: ${JSON.stringify(insights.replyInsights.bestReplyTones, null, 2)},
    topKeywords: ${JSON.stringify(insights.replyInsights.topReplyKeywords, null, 2)},
    avgEngagement: ${Math.round(insights.replyInsights.avgReplyEngagement * 100) / 100}
  },
  
  // ⏰ Temporal patterns
  temporalInsights: {
    hourlyPerformance: ${JSON.stringify(insights.temporalPatterns.hourlyPerformance, null, 2)},
    weekdayPerformance: ${JSON.stringify(insights.temporalPatterns.weekdayPerformance, null, 2)},
    optimalWindows: ${JSON.stringify(insights.temporalPatterns.optimalPostingWindows, null, 2)}
  },
  
  // 🎯 Strategy metadata
  metadata: {
    generatedAt: "${new Date().toISOString()}",
    confidence: ${confidence},
    version: "auto-learning-v1"
  }
};

// 🚀 Export for autonomous growth master integration
export default optimizedStrategy;
`;

    fs.writeFileSync(this.strategyPath, strategyContent);
    console.log(`✅ Strategy file generated: ${this.strategyPath}`);
  }

  /**
   * 📝 Log analysis results
   */
  private async logAnalysisResults(insights: PerformanceInsights, confidence: number, dataPoints: number): Promise<void> {
    try {
      let logData = { analyses: [] };
      
      if (fs.existsSync(this.analysisLogPath)) {
        logData = JSON.parse(fs.readFileSync(this.analysisLogPath, 'utf8'));
      }

      logData.analyses.push({
        timestamp: new Date().toISOString(),
        dataPoints,
        confidence,
        insights,
        summary: `Analyzed ${dataPoints} tweets with ${Math.round(confidence * 100)}% confidence`
      });

      // Keep only last 10 analyses
      if (logData.analyses.length > 10) {
        logData.analyses = logData.analyses.slice(-10);
      }

      fs.writeFileSync(this.analysisLogPath, JSON.stringify(logData, null, 2));
      console.log(`📝 Analysis logged: ${this.analysisLogPath}`);
    } catch (error) {
      console.warn('⚠️ Could not log analysis results:', error);
    }
  }

  /**
   * 🎯 Get default strategy for fallback
   */
  private getDefaultStrategy(): PerformanceInsights {
    return {
      bestTimeBlocks: ['Mon 11AM', 'Wed 3PM', 'Thu 4PM'],
      highPerformanceTones: ['insightful', 'clever'],
      keywordsToPrioritize: ['health', 'research', 'breakthrough'],
      contentPatterns: {
        avgEngagement: 0,
        topPerformingLength: 150,
        mostViralTimes: [],
        underperformingPatterns: []
      },
      replyInsights: {
        bestReplyTones: ['insightful', 'supportive'],
        avgReplyEngagement: 0,
        topReplyKeywords: []
      },
      temporalPatterns: {
        hourlyPerformance: {},
        weekdayPerformance: {},
        optimalPostingWindows: ['Mon 11AM', 'Wed 3PM', 'Thu 4PM']
      }
    };
  }

  /**
   * 📊 Get learning statistics
   */
  getLearningStat(): any {
    return {
      minDataPoints: this.MIN_DATA_POINTS,
      confidenceThreshold: this.CONFIDENCE_THRESHOLD,
      strategyPath: this.strategyPath,
      analysisLogPath: this.analysisLogPath,
      lastAnalysis: fs.existsSync(this.analysisLogPath) ? 
        JSON.parse(fs.readFileSync(this.analysisLogPath, 'utf8')).analyses?.slice(-1)[0] : null
    };
  }
}

// Export singleton instance
export const realTimeContentLearningEngine = new RealTimeContentLearningEngine(); 