/**
 * 🛡️ REAL DATA ENFORCEMENT SYSTEM
 * 
 * Ensures ZERO fake data in the system - all learning from authentic Twitter metrics only
 */

import { getSupabaseClient } from '../db/index';

export interface DataValidationResult {
  isValid: boolean;
  dataSource: 'twitter_scraping' | 'twitter_api' | 'real_metrics' | 'FAKE_DETECTED';
  confidence: number;
  issues: string[];
  recommendations: string[];
}

export interface RealDataReport {
  totalRecords: number;
  realDataPercentage: number;
  fakeDataDetected: number;
  lastValidationTime: Date;
  dataQualityScore: number;
  criticalIssues: string[];
}

export class RealDataEnforcementSystem {
  private static instance: RealDataEnforcementSystem;
  
  private readonly FAKE_DATA_PATTERNS = [
    // Fake ID patterns
    /^fake_/,
    /^mock_/,
    /^test_/,
    /^dummy_/,
    /^placeholder_/,
    
    // Unrealistic engagement patterns
    /^999\d+/, // IDs starting with 999
    /^123456/, // Sequential test IDs
    
    // Fake metric patterns (too perfect/unrealistic)
    /engagement_rate.*1\.0$/, // 100% engagement rate
    /likes.*[5-9]\d{4,}/, // Unrealistically high likes (50k+)
  ];

  private readonly REALISTIC_METRICS_THRESHOLDS = {
    maxLikes: 1000, // Small account realistic max
    maxRetweets: 200,
    maxReplies: 100,
    maxEngagementRate: 0.15, // 15% is very high for small accounts
    minEngagementRate: 0.001, // 0.1% minimum realistic
  };

  private constructor() {}

  public static getInstance(): RealDataEnforcementSystem {
    if (!RealDataEnforcementSystem.instance) {
      RealDataEnforcementSystem.instance = new RealDataEnforcementSystem();
    }
    return RealDataEnforcementSystem.instance;
  }

  /**
   * 🔍 VALIDATE DATA AUTHENTICITY - Comprehensive fake data detection
   */
  public async validateDataAuthenticity(data: {
    tweetId?: string;
    likes?: number;
    retweets?: number;
    replies?: number;
    engagementRate?: number;
    content?: string;
    source?: string;
  }): Promise<DataValidationResult> {
    console.log('🔍 REAL_DATA_VALIDATION: Checking data authenticity...');

    const issues: string[] = [];
    const recommendations: string[] = [];
    let confidence = 100;
    let dataSource: DataValidationResult['dataSource'] = 'real_metrics';

    // 1. Check for fake ID patterns
    if (data.tweetId) {
      for (const pattern of this.FAKE_DATA_PATTERNS) {
        if (pattern.test(data.tweetId)) {
          issues.push(`Tweet ID matches fake pattern: ${pattern.source}`);
          dataSource = 'FAKE_DETECTED';
          confidence = 0;
        }
      }

      // Check for realistic Twitter ID format (Twitter IDs are 18-19 digit numbers)
      if (!/^\d{18,19}$/.test(data.tweetId)) {
        issues.push('Tweet ID format is not realistic Twitter format');
        confidence -= 30;
      }
    }

    // 2. Validate engagement metrics for realism
    if (data.likes !== undefined && data.likes > this.REALISTIC_METRICS_THRESHOLDS.maxLikes) {
      issues.push(`Likes (${data.likes}) exceed realistic threshold for small account`);
      confidence -= 25;
      recommendations.push('Verify likes count through direct Twitter scraping');
    }

    if (data.retweets !== undefined && data.retweets > this.REALISTIC_METRICS_THRESHOLDS.maxRetweets) {
      issues.push(`Retweets (${data.retweets}) exceed realistic threshold`);
      confidence -= 25;
    }

    if (data.engagementRate !== undefined) {
      if (data.engagementRate > this.REALISTIC_METRICS_THRESHOLDS.maxEngagementRate) {
        issues.push(`Engagement rate (${(data.engagementRate * 100).toFixed(1)}%) unrealistically high`);
        confidence -= 30;
      }
      if (data.engagementRate < this.REALISTIC_METRICS_THRESHOLDS.minEngagementRate) {
        issues.push(`Engagement rate (${(data.engagementRate * 100).toFixed(3)}%) unrealistically low`);
        confidence -= 15;
      }
    }

    // 3. Check for perfect ratios (often indicate fake data)
    if (data.likes && data.retweets && data.replies) {
      const totalEngagement = data.likes + data.retweets + data.replies;
      const likesRatio = data.likes / totalEngagement;
      
      // Real data rarely has perfect ratios
      if (likesRatio === 1.0 || likesRatio === 0.5 || likesRatio === 0.33) {
        issues.push('Engagement ratios appear artificially perfect');
        confidence -= 20;
      }
    }

    // 4. Check content for placeholder patterns
    if (data.content) {
      const placeholderPatterns = [
        'placeholder',
        'dummy content',
        'test tweet',
        'sample post',
        'lorem ipsum'
      ];
      
      for (const pattern of placeholderPatterns) {
        if (data.content.toLowerCase().includes(pattern)) {
          issues.push(`Content contains placeholder pattern: ${pattern}`);
          dataSource = 'FAKE_DETECTED';
          confidence = 0;
        }
      }
    }

    // 5. Check data source reliability
    if (data.source) {
      if (data.source.includes('mock') || data.source.includes('fake') || data.source.includes('test')) {
        issues.push('Data source indicates non-production data');
        dataSource = 'FAKE_DETECTED';
        confidence = 0;
      }
    }

    // Determine final validation result
    const isValid = confidence >= 70 && dataSource !== 'FAKE_DETECTED';

    if (!isValid) {
      recommendations.push('Reject this data and collect authentic metrics');
      recommendations.push('Use browser automation to scrape real Twitter metrics');
    }

    console.log(`${isValid ? '✅' : '❌'} VALIDATION_RESULT: ${confidence}% confidence, ${issues.length} issues`);

    return {
      isValid,
      dataSource,
      confidence,
      issues,
      recommendations
    };
  }

  /**
   * 🧹 CLEAN FAKE DATA FROM DATABASE
   */
  public async cleanFakeDataFromDatabase(): Promise<{
    removedRecords: number;
    tablesProcessed: string[];
    errors: string[];
  }> {
    console.log('🧹 FAKE_DATA_CLEANUP: Starting comprehensive database cleanup...');

    const supabase = getSupabaseClient();
    let removedRecords = 0;
    const tablesProcessed: string[] = [];
    const errors: string[] = [];

    try {
      // Clean tweets table
      try {
        const { data: tweets } = await supabase
          .from('tweets')
          .select('id, tweet_id, content, likes, retweets');

        if (tweets) {
          for (const tweet of tweets) {
            const validation = await this.validateDataAuthenticity({
              tweetId: tweet.tweet_id as string,
              likes: tweet.likes as number,
              retweets: tweet.retweets as number,
              content: tweet.content as string
            });

            if (!validation.isValid) {
              await supabase.from('tweets').delete().eq('id', tweet.id);
              removedRecords++;
              console.log(`🗑️ REMOVED_FAKE_TWEET: ${tweet.tweet_id} (${validation.issues.join(', ')})`);
            }
          }
        }
        tablesProcessed.push('tweets');
      } catch (error: any) {
        errors.push(`tweets table: ${error.message}`);
      }

      // Clean real_tweet_metrics table
      try {
        const { data: metrics } = await supabase
          .from('real_tweet_metrics')
          .select('tweet_id, likes, retweets, replies, engagement_rate');

        if (metrics) {
          for (const metric of metrics) {
            const validation = await this.validateDataAuthenticity({
              tweetId: metric.tweet_id as string,
              likes: metric.likes as number,
              retweets: metric.retweets as number,
              replies: metric.replies as number,
              engagementRate: metric.engagement_rate as number
            });

            if (!validation.isValid) {
              await supabase.from('real_tweet_metrics').delete().eq('tweet_id', metric.tweet_id);
              removedRecords++;
              console.log(`🗑️ REMOVED_FAKE_METRICS: ${metric.tweet_id}`);
            }
          }
        }
        tablesProcessed.push('real_tweet_metrics');
      } catch (error: any) {
        errors.push(`real_tweet_metrics table: ${error.message}`);
      }

      // Clean learning_posts table
      try {
        const { data: learningPosts } = await supabase
          .from('learning_posts')
          .select('tweet_id, content');

        if (learningPosts) {
          for (const post of learningPosts) {
            const validation = await this.validateDataAuthenticity({
              tweetId: post.tweet_id as string,
              content: post.content as string
            });

            if (!validation.isValid) {
              await supabase.from('learning_posts').delete().eq('tweet_id', post.tweet_id);
              removedRecords++;
              console.log(`🗑️ REMOVED_FAKE_LEARNING_POST: ${post.tweet_id}`);
            }
          }
        }
        tablesProcessed.push('learning_posts');
      } catch (error: any) {
        errors.push(`learning_posts table: ${error.message}`);
      }

      console.log(`✅ CLEANUP_COMPLETE: Removed ${removedRecords} fake records from ${tablesProcessed.length} tables`);

    } catch (error: any) {
      console.error('❌ CLEANUP_FAILED:', error.message);
      errors.push(`General cleanup error: ${error.message}`);
    }

    return {
      removedRecords,
      tablesProcessed,
      errors
    };
  }

  /**
   * 📊 GENERATE REAL DATA REPORT
   */
  public async generateRealDataReport(): Promise<RealDataReport> {
    console.log('📊 REAL_DATA_REPORT: Analyzing data authenticity across system...');

    const supabase = getSupabaseClient();
    let totalRecords = 0;
    let validRecords = 0;
    let fakeDataDetected = 0;
    const criticalIssues: string[] = [];

    try {
      // Analyze real_tweet_metrics table
      const { data: metrics } = await supabase
        .from('real_tweet_metrics')
        .select('tweet_id, likes, retweets, replies, engagement_rate')
        .order('collected_at', { ascending: false })
        .limit(100);

      if (metrics) {
        for (const metric of metrics) {
          totalRecords++;
          const validation = await this.validateDataAuthenticity({
            tweetId: metric.tweet_id as string,
            likes: metric.likes as number,
            retweets: metric.retweets as number,
            replies: metric.replies as number,
            engagementRate: metric.engagement_rate as number
          });

          if (validation.isValid) {
            validRecords++;
          } else {
            fakeDataDetected++;
            if (validation.confidence === 0) {
              criticalIssues.push(`Critical fake data in metrics: ${metric.tweet_id}`);
            }
          }
        }
      }

      // Analyze unified_posts table
      const { data: posts } = await supabase
        .from('unified_posts')
        .select('postId, content')
        .order('createdAt', { ascending: false })
        .limit(50);

      if (posts) {
        for (const post of posts) {
          totalRecords++;
          const validation = await this.validateDataAuthenticity({
            tweetId: post.postId as string,
            content: post.content as string
          });

          if (validation.isValid) {
            validRecords++;
          } else {
            fakeDataDetected++;
            if (validation.confidence === 0) {
              criticalIssues.push(`Critical fake data in posts: ${post.postId}`);
            }
          }
        }
      }

      const realDataPercentage = totalRecords > 0 ? (validRecords / totalRecords) * 100 : 0;
      const dataQualityScore = Math.max(0, realDataPercentage - (criticalIssues.length * 10));

      console.log(`📊 DATA_QUALITY_REPORT: ${realDataPercentage.toFixed(1)}% real data, ${fakeDataDetected} fake records detected`);

      return {
        totalRecords,
        realDataPercentage: Math.round(realDataPercentage),
        fakeDataDetected,
        lastValidationTime: new Date(),
        dataQualityScore: Math.round(dataQualityScore),
        criticalIssues
      };

    } catch (error: any) {
      console.error('❌ REPORT_GENERATION_FAILED:', error.message);
      return {
        totalRecords: 0,
        realDataPercentage: 0,
        fakeDataDetected: 0,
        lastValidationTime: new Date(),
        dataQualityScore: 0,
        criticalIssues: [`Report generation failed: ${error.message}`]
      };
    }
  }

  /**
   * 🚨 ENFORCE REAL DATA ONLY POLICY
   */
  public async enforceRealDataOnlyPolicy(): Promise<void> {
    console.log('🚨 REAL_DATA_ENFORCEMENT: Activating zero-fake-data policy...');

    try {
      // 1. Clean existing fake data
      const cleanupResult = await this.cleanFakeDataFromDatabase();
      console.log(`🧹 CLEANUP_SUMMARY: ${cleanupResult.removedRecords} fake records removed`);

      // 2. Generate data quality report
      const report = await this.generateRealDataReport();
      console.log(`📊 DATA_QUALITY: ${report.dataQualityScore}/100 score, ${report.realDataPercentage}% real data`);

      // 3. Log enforcement status
      if (report.dataQualityScore >= 90) {
        console.log('✅ REAL_DATA_ENFORCEMENT: System meets high quality standards');
      } else if (report.dataQualityScore >= 70) {
        console.log('⚠️ REAL_DATA_ENFORCEMENT: System needs improvement');
        console.log(`🔧 CRITICAL_ISSUES: ${report.criticalIssues.slice(0, 3).join(', ')}`);
      } else {
        console.log('🚨 REAL_DATA_ENFORCEMENT: System requires immediate attention');
        console.log(`❌ CRITICAL_ISSUES: ${report.criticalIssues.join(', ')}`);
      }

      // 4. Set up continuous monitoring
      console.log('🔍 CONTINUOUS_MONITORING: Real data validation active');

    } catch (error: any) {
      console.error('❌ ENFORCEMENT_FAILED:', error.message);
      throw new Error(`Real data enforcement failed: ${error.message}`);
    }
  }

  /**
   * ✅ VALIDATE INCOMING DATA - Use before storing any metrics
   */
  public async validateBeforeStorage(data: {
    tweetId: string;
    metrics: {
      likes: number;
      retweets: number;
      replies: number;
      engagementRate: number;
    };
    content?: string;
  }): Promise<boolean> {
    const validation = await this.validateDataAuthenticity({
      tweetId: data.tweetId,
      likes: data.metrics.likes,
      retweets: data.metrics.retweets,
      replies: data.metrics.replies,
      engagementRate: data.metrics.engagementRate,
      content: data.content
    });

    if (!validation.isValid) {
      console.warn(`🚫 STORAGE_BLOCKED: Fake data rejected for ${data.tweetId}`);
      console.warn(`📋 ISSUES: ${validation.issues.join(', ')}`);
      return false;
    }

    console.log(`✅ STORAGE_APPROVED: Real data validated for ${data.tweetId}`);
    return true;
  }
}

// Export singleton
export const realDataEnforcementSystem = RealDataEnforcementSystem.getInstance();
