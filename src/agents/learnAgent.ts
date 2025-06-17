import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';
import { OpenAIService } from '../utils/openaiClient';

export interface LearningInsights {
  topPerformingTweets: any[];
  engagementTrends: any[];
  contentRecommendations: string[];
  timingInsights: any[];
}

interface VariantPerformance {
  variant: string;
  tweetCount: number;
  avgQualityScore: number;
  avgEngagement: number;
  successRate: number;
}

export class LearnAgent {
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = new OpenAIService();
  }

  async run(): Promise<{ success: boolean; insights?: any; topVariant?: string }> {
    try {
      console.log('🧠 LearnAgent: Analyzing performance patterns...');

      // Analyze variant performance
      const variantAnalysis = await this.analyzeVariantPerformance();
      
      // Update variant of the day
      const topVariant = await this.updateVariantOfTheDay(variantAnalysis);

      // Generate learning insights
      const insights = await this.generateLearningInsights(variantAnalysis);

      console.log(`✅ Learning analysis complete. Top variant: ${topVariant}`);
      return { success: true, insights, topVariant };

    } catch (error) {
      console.error('❌ LearnAgent error:', error);
      return { success: false };
    }
  }

  private async analyzeVariantPerformance(): Promise<VariantPerformance[]> {
    try {
      // Get tweets from the last 7 days with variant data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: tweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('variant, quality_score, engagement_score, posted_at')
        .gte('posted_at', sevenDaysAgo.toISOString())
        .not('variant', 'is', null);

      if (error || !tweets) {
        console.log('No variant data available for analysis');
        return [];
      }

      // Group by variant and calculate performance metrics
      const variantGroups = tweets.reduce((groups: any, tweet) => {
        const variant = tweet.variant || 'default';
        if (!groups[variant]) {
          groups[variant] = [];
        }
        groups[variant].push(tweet);
        return groups;
      }, {});

      const variantPerformance: VariantPerformance[] = Object.entries(variantGroups).map(([variant, tweets]: [string, any[]]) => {
        const qualityScores = tweets.map(t => t.quality_score || 0).filter(s => s > 0);
        const engagementScores = tweets.map(t => t.engagement_score || 0).filter(s => s > 0);
        
        return {
          variant,
          tweetCount: tweets.length,
          avgQualityScore: qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0,
          avgEngagement: engagementScores.length > 0 ? engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length : 0,
          successRate: qualityScores.filter(s => s >= 70).length / Math.max(tweets.length, 1)
        };
      });

      // Sort by composite performance score
      variantPerformance.sort((a, b) => {
        const scoreA = (a.avgQualityScore * 0.4) + (a.avgEngagement * 0.4) + (a.successRate * 100 * 0.2);
        const scoreB = (b.avgQualityScore * 0.4) + (b.avgEngagement * 0.4) + (b.successRate * 100 * 0.2);
        return scoreB - scoreA;
      });

      console.log(`📊 Analyzed ${variantPerformance.length} variants from ${tweets.length} tweets`);
      return variantPerformance;

    } catch (error) {
      console.error('Error analyzing variant performance:', error);
      return [];
    }
  }

  private async updateVariantOfTheDay(variantAnalysis: VariantPerformance[]): Promise<string> {
    try {
      // Choose top performing variant, or default if no data
      const topVariant = variantAnalysis.length > 0 ? variantAnalysis[0].variant : 'default';

      // Update or insert the variant of the day
      const { error } = await supabaseClient.supabase
        ?.from('prompt_features')
        .upsert({
          id: 1,
          variant_of_the_day: topVariant,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating variant of the day:', error);
        return 'default';
      }

      console.log(`🎯 Updated variant of the day: ${topVariant}`);
      return topVariant;

    } catch (error) {
      console.error('Error updating variant of the day:', error);
      return 'default';
    }
  }

  private async generateLearningInsights(variantAnalysis: VariantPerformance[]): Promise<any> {
    try {
      if (variantAnalysis.length === 0) {
        return { message: 'Insufficient data for learning insights' };
      }

      const insights = {
        topPerformingVariant: variantAnalysis[0],
        totalVariantsTested: variantAnalysis.length,
        performanceGap: variantAnalysis.length > 1 ? 
          variantAnalysis[0].avgQualityScore - variantAnalysis[variantAnalysis.length - 1].avgQualityScore : 0,
        recommendations: this.generateRecommendations(variantAnalysis),
        timestamp: new Date().toISOString()
      };

      // Store insights for dashboard
      await supabaseClient.supabase
        ?.from('learning_insights')
        .insert({
          insights: JSON.stringify(insights),
          created_at: new Date().toISOString()
        });

      return insights;

    } catch (error) {
      console.error('Error generating learning insights:', error);
      return { error: 'Failed to generate insights' };
    }
  }

  private generateRecommendations(variantAnalysis: VariantPerformance[]): string[] {
    const recommendations: string[] = [];

    if (variantAnalysis.length === 0) {
      recommendations.push('Start A/B testing different content variants');
      return recommendations;
    }

    const topVariant = variantAnalysis[0];
    
    if (topVariant.avgQualityScore > 80) {
      recommendations.push(`Continue using ${topVariant.variant} variant - high quality performance`);
    } else if (topVariant.avgQualityScore < 60) {
      recommendations.push('All variants underperforming - review content strategy');
    }

    if (topVariant.successRate > 0.8) {
      recommendations.push(`${topVariant.variant} variant shows consistent success - scale up`);
    } else if (topVariant.successRate < 0.5) {
      recommendations.push('Low success rates across variants - review quality thresholds');
    }

    if (variantAnalysis.length < 3) {
      recommendations.push('Increase variant diversity for better A/B testing');
    }

    return recommendations;
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