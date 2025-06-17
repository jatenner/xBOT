import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export class NightlyOptimizerAgent {
  private readonly promptsPath = './dist/prompts';
  
  /**
   * Run nightly optimization - rewrite prompts based on performance data
   */
  async runNightlyOptimization(): Promise<void> {
    console.log('🌙 === NIGHTLY OPTIMIZATION STARTED ===');
    
    try {
      // 1. Analyze recent performance using existing methods
      const performanceData = await this.analyzeRecentPerformance();
      
      // 2. Determine if optimization is needed
      if (performanceData.averageQuality < 75 || performanceData.totalTweets < 5) {
        console.log('🎯 Performance needs improvement - optimizing prompts...');
        await this.optimizePrompts(performanceData);
      } else {
        console.log('✅ Performance is good - no optimization needed');
      }
      
      // 3. Store optimization results
      await this.storeOptimizationResults(performanceData);
      
      console.log('✅ Nightly optimization completed');
      
    } catch (error) {
      console.error('❌ Nightly optimization failed:', error);
    }
  }

  /**
   * Analyze recent performance using existing supabaseClient methods
   */
  private async analyzeRecentPerformance(): Promise<any> {
    try {
      // Get recent tweets using existing method
      const recentTweets = await supabaseClient.getRecentTweets(7);
      
      const analysis = {
        totalTweets: recentTweets.length,
        averageQuality: this.calculateAverageQuality(recentTweets),
        averageEngagement: this.calculateAverageEngagement(recentTweets),
        bestPerformers: recentTweets.filter(t => t.engagement_score > 10).length
      };

      console.log('📊 Performance Analysis:', analysis);
      return analysis;
      
    } catch (error) {
      console.error('⚠️ Error analyzing performance:', error);
      return { totalTweets: 0, averageQuality: 0, averageEngagement: 0, bestPerformers: 0 };
    }
  }

  /**
   * Optimize prompts when performance is below threshold
   */
  private async optimizePrompts(performanceData: any): Promise<void> {
    try {
      // Read current persona
      const personaPath = join(this.promptsPath, 'persona.txt');
      const currentPersona = await readFile(personaPath, 'utf-8');

      // Generate optimization suggestions
      const prompt = `
Based on recent bot performance, suggest improvements to this health tech bot persona:

Current Performance:
- Total tweets: ${performanceData.totalTweets}
- Average quality: ${performanceData.averageQuality}/100
- Average engagement: ${performanceData.averageEngagement}
- High performers: ${performanceData.bestPerformers}

Current Persona:
${currentPersona}

Provide 3 specific improvements to increase quality and engagement while maintaining professional health tech focus.
`;

      const suggestions = await openaiClient.generateTweet({ style: 'professional' });
      
      // Store suggestions for manual review (safer than auto-updating)
      await supabaseClient.setBotConfig('optimization_suggestions', suggestions);
      await supabaseClient.setBotConfig('optimization_date', new Date().toISOString());
      
      console.log('✅ Optimization suggestions generated and stored');
      
    } catch (error) {
      console.error('❌ Error optimizing prompts:', error);
    }
  }

  /**
   * Store optimization results in bot config
   */
  private async storeOptimizationResults(performanceData: any): Promise<void> {
    try {
      const results = {
        date: new Date().toISOString(),
        performance: performanceData,
        optimizationRun: true
      };
      
      await supabaseClient.setBotConfig('last_optimization', JSON.stringify(results));
      console.log('📊 Optimization results stored');
      
    } catch (error) {
      console.error('⚠️ Error storing optimization results:', error);
    }
  }

  /**
   * Calculate average quality score from recent tweets
   */
  private calculateAverageQuality(tweets: any[]): number {
    if (tweets.length === 0) return 0;
    
    // Use engagement_score as proxy for quality if no quality_score field
    const scores = tweets.map(t => t.quality_score || t.engagement_score || 0);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculate average engagement from recent tweets
   */
  private calculateAverageEngagement(tweets: any[]): number {
    if (tweets.length === 0) return 0;
    
    const engagementScores = tweets.map(t => t.likes + t.retweets + t.replies);
    return engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length;
  }
} 