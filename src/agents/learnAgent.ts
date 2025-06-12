import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';

export interface LearningInsights {
  topPerformingTweets: any[];
  engagementTrends: any[];
  contentRecommendations: string[];
  timingInsights: any[];
}

export class LearnAgent {
  async run(): Promise<LearningInsights | null> {
    try {
      console.log('📊 LearnAgent: Analyzing engagement data and learning...');

      // Fetch recent tweets and their current engagement
      const recentTweets = await this.fetchRecentTweetsWithEngagement();
      
      if (recentTweets.length === 0) {
        console.log('No recent tweets to analyze');
        return null;
      }

      // Update engagement metrics in database
      await this.updateEngagementMetrics(recentTweets);

      // Analyze patterns and generate insights
      const insights = await this.analyzeEngagementPatterns(recentTweets);

      // Store learning insights for future use
      await this.storeLearningInsights(insights);

      console.log('✅ Learning analysis completed');
      return insights;

    } catch (error) {
      console.error('Error in LearnAgent:', error);
      return null;
    }
  }

  private async fetchRecentTweetsWithEngagement(): Promise<any[]> {
    try {
      // Get our recent tweets from X/Twitter with current engagement
      const myTweets = await xClient.getMyTweets(20);
      
      const tweetsWithEngagement = [];

      for (const tweet of myTweets) {
        // Get updated engagement data
        const currentData = await xClient.getTweetById(tweet.id);
        
        if (currentData) {
          tweetsWithEngagement.push({
            ...tweet,
            current_engagement: currentData.public_metrics,
            engagement_score: this.calculateEngagementScore(currentData.public_metrics),
          });
        }
      }

      return tweetsWithEngagement;

    } catch (error) {
      console.error('Error fetching recent tweets:', error);
      return [];
    }
  }

  private async updateEngagementMetrics(tweets: any[]): Promise<void> {
    try {
      for (const tweet of tweets) {
        // Update tweet engagement in database
        const engagementData = {
          likes: tweet.current_engagement.like_count,
          retweets: tweet.current_engagement.retweet_count,
          replies: tweet.current_engagement.reply_count,
          impressions: tweet.current_engagement.impression_count,
          engagement_score: tweet.engagement_score,
        };

        await supabaseClient.updateTweetEngagement(tweet.id, engagementData);

        // Record engagement analytics for trend analysis
        await supabaseClient.recordEngagement({
          content_type: 'tweet',
          content_id: tweet.id,
          metric_type: 'daily',
          engagement_score: tweet.engagement_score,
          reach_score: tweet.current_engagement.impression_count,
        });
      }
    } catch (error) {
      console.error('Error updating engagement metrics:', error);
    }
  }

  private async analyzeEngagementPatterns(tweets: any[]): Promise<LearningInsights> {
    try {
      // TODO: Implement sophisticated pattern analysis
      // 1. Identify high-performing content themes
      // 2. Analyze optimal posting times
      // 3. Determine best content formats (threads vs single tweets)
      // 4. Evaluate CTA effectiveness
      // 5. Assess emoji and hashtag performance

      // Sort tweets by engagement score
      const sortedTweets = tweets.sort((a, b) => b.engagement_score - a.engagement_score);
      const topPerformingTweets = sortedTweets.slice(0, 5);

      // Analyze timing patterns
      const timingInsights = await this.analyzeTimingPatterns(tweets);

      // Generate content recommendations using AI
      const contentRecommendations = await this.generateContentRecommendations(topPerformingTweets);

      return {
        topPerformingTweets,
        engagementTrends: [], // TODO: Implement trend analysis
        contentRecommendations,
        timingInsights,
      };

    } catch (error) {
      console.error('Error analyzing engagement patterns:', error);
      return {
        topPerformingTweets: [],
        engagementTrends: [],
        contentRecommendations: [],
        timingInsights: [],
      };
    }
  }

  private async analyzeTimingPatterns(tweets: any[]): Promise<any[]> {
    // TODO: Implement timing analysis
    // 1. Group tweets by hour of day
    // 2. Calculate average engagement by time slot
    // 3. Identify peak engagement windows
    // 4. Consider day of week patterns
    // 5. Account for audience timezone distribution

    const hourlyEngagement: { [hour: number]: { total: number; count: number } } = {};

    for (const tweet of tweets) {
      const hour = new Date(tweet.created_at).getHours();
      
      if (!hourlyEngagement[hour]) {
        hourlyEngagement[hour] = { total: 0, count: 0 };
      }
      
      hourlyEngagement[hour].total += tweet.engagement_score;
      hourlyEngagement[hour].count += 1;
    }

    const insights = Object.entries(hourlyEngagement).map(([hour, data]) => ({
      hour: parseInt(hour),
      averageEngagement: data.total / data.count,
      tweetCount: data.count,
    }));

    return insights.sort((a, b) => b.averageEngagement - a.averageEngagement);
  }

  private async generateContentRecommendations(topTweets: any[]): Promise<string[]> {
    try {
      // Use AI to analyze what made top tweets successful
      const recommendations = [];

      for (const tweet of topTweets) {
        const analysis = await openaiClient.analyzeEngagement(
          tweet.text,
          tweet.current_engagement
        );

        if (analysis.suggestions.length > 0) {
          recommendations.push(...analysis.suggestions);
        }
      }

      // Remove duplicates and return unique recommendations
      return [...new Set(recommendations)];

    } catch (error) {
      console.error('Error generating content recommendations:', error);
      return [];
    }
  }

  private async storeLearningInsights(insights: LearningInsights): Promise<void> {
    try {
      console.log('💾 Storing learning insights in database...');

      // Store content recommendations
      if (insights.contentRecommendations.length > 0) {
        await supabaseClient.storeLearningInsight({
          insight_type: 'content_recommendations',
          insight_data: { recommendations: insights.contentRecommendations },
          confidence_score: 0.8,
          performance_impact: 0.15,
          sample_size: insights.topPerformingTweets.length
        });
      }

      // Store timing insights
      if (insights.timingInsights.length > 0) {
        await supabaseClient.storeLearningInsight({
          insight_type: 'optimal_timing',
          insight_data: { timing_patterns: insights.timingInsights },
          confidence_score: 0.7,
          performance_impact: 0.25,
          sample_size: insights.timingInsights.reduce((sum, t) => sum + t.tweetCount, 0)
        });

        // Update bot config with best posting hours
        const bestHours = insights.timingInsights
          .slice(0, 3)
          .map(t => t.hour)
          .join(',');
        
        await supabaseClient.setBotConfig('preferred_posting_hours', bestHours);
      }

      // Update content themes and style performance
      for (const tweet of insights.topPerformingTweets) {
        // Extract themes from successful tweets
        const themes = this.extractContentThemes(tweet.text);
        for (const theme of themes) {
          await supabaseClient.updateContentTheme(theme, tweet.engagement_score, tweet.id);
        }

        // Update timing insights
        const tweetDate = new Date(tweet.created_at);
        await supabaseClient.updateTimingInsight(
          tweetDate.getHours(),
          tweetDate.getDay(),
          tweet.engagement_score
        );

        // Update style performance (analyze tweet style)
        const style = this.analyzeContentStyle(tweet.text);
        const threshold = parseInt(await supabaseClient.getBotConfig('min_engagement_threshold') || '5');
        await supabaseClient.updateStylePerformance(style, tweet.engagement_score, threshold);
      }

      // Update preferred content style based on best performance
      const styles = await supabaseClient.getBestPerformingStyles();
      if (styles.length > 0) {
        await supabaseClient.setBotConfig('preferred_content_style', styles[0].style_type);
      }

      console.log('✅ Learning insights stored successfully');

    } catch (error) {
      console.error('Error storing learning insights:', error);
    }
  }

  private extractContentThemes(text: string): string[] {
    const themes: string[] = [];
    
    // Define theme keywords
    const themeKeywords = {
      'AI_diagnosis': ['ai', 'artificial intelligence', 'machine learning', 'diagnosis', 'diagnostic'],
      'wearable_tech': ['wearable', 'smartwatch', 'fitness tracker', 'monitoring', 'sensor'],
      'research_studies': ['study', 'research', 'university', 'findings', 'data', 'evidence'],
      'preventive_care': ['prevention', 'preventive', 'early detection', 'screening', 'wellness'],
      'biomarkers': ['biomarker', 'blood', 'genetic', 'molecular', 'testing'],
      'longevity': ['longevity', 'aging', 'lifespan', 'healthspan', 'mortality'],
      'mental_health': ['mental health', 'stress', 'anxiety', 'depression', 'mindfulness'],
      'nutrition': ['nutrition', 'diet', 'food', 'supplement', 'micronutrient']
    };

    const lowerText = text.toLowerCase();
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        themes.push(theme);
      }
    }

    return themes;
  }

  private analyzeContentStyle(text: string): 'educational' | 'humorous' | 'thought-provoking' | 'technical' {
    const lowerText = text.toLowerCase();
    
    // Educational indicators
    if (lowerText.includes('study') || lowerText.includes('research') || lowerText.includes('according to') || 
        lowerText.includes('evidence') || lowerText.includes('data shows')) {
      return 'educational';
    }
    
    // Technical indicators
    if (lowerText.includes('algorithm') || lowerText.includes('ml') || lowerText.includes('ai') ||
        lowerText.includes('biomarker') || lowerText.includes('molecular')) {
      return 'technical';
    }
    
    // Humorous indicators
    if (lowerText.includes('😂') || lowerText.includes('lol') || lowerText.includes('funny') ||
        lowerText.includes('joke') || lowerText.includes('humor')) {
      return 'humorous';
    }
    
    // Thought-provoking indicators (questions, future predictions)
    if (text.includes('?') || lowerText.includes('imagine') || lowerText.includes('what if') ||
        lowerText.includes('future') || lowerText.includes('think about')) {
      return 'thought-provoking';
    }
    
    return 'educational'; // Default
  }

  private calculateEngagementScore(metrics: any): number {
    if (!metrics) return 0;
    return metrics.like_count + (metrics.retweet_count * 2) + (metrics.reply_count * 3);
  }

  async generateWeeklyReport(): Promise<void> {
    try {
      console.log('📈 Generating weekly performance report...');

      // TODO: Implement comprehensive weekly report
      // 1. Total tweets and replies posted
      // 2. Engagement metrics summary
      // 3. Top performing content
      // 4. Growth metrics (followers, reach)
      // 5. Snap2Health CTA effectiveness
      // 6. Recommendations for next week

      const insights = await this.run();
      
      if (insights) {
        console.log('Weekly Report Generated:');
        console.log('- Top content themes identified');
        console.log('- Optimal posting times analyzed');
        console.log('- Content recommendations updated');
      }

    } catch (error) {
      console.error('Error generating weekly report:', error);
    }
  }
}

// Allow running as standalone script
if (require.main === module) {
  const agent = new LearnAgent();
  
  if (process.argv.includes('--weekly-report')) {
    agent.generateWeeklyReport();
  } else {
    agent.run().then(insights => {
      if (insights) {
        console.log('Learning completed successfully');
      } else {
        console.log('Learning failed or no data to analyze');
      }
      process.exit(0);
    });
  }
} 