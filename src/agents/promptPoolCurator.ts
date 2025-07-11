/**
 * 🎯 PROMPT POOL CURATOR AGENT
 * 
 * Analyzes tweet performance and adjusts prompt template weights.
 * Learns which creative approaches work best for engagement.
 */

import { PromptPool } from '../utils/promptPool';
import { supabaseClient } from '../utils/supabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';

export class PromptPoolCurator {
  private promptPool: PromptPool;

  constructor() {
    this.promptPool = PromptPool.getInstance();
  }

  async runDailyCuration(): Promise<void> {
    console.log('🎯 Running daily prompt pool curation...');
    
    try {
      // 🚨 EMERGENCY BUDGET CHECK - Skip if budget exceeded
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        console.log('🚨 Budget lockdown active - skipping prompt curation (uses no AI)');
        return;
      }
      
      const recentTweets = await supabaseClient.getRecentTweets(7);
      const performance = this.analyzePerformance(recentTweets);
      this.updateWeights(performance);
      
      console.log('✅ Prompt pool curation completed');
    } catch (error) {
      console.error('❌ Prompt pool curation failed:', error);
    }
  }

  private analyzePerformance(tweets: any[]): Map<string, number> {
    const performance = new Map<string, number>();
    
    tweets.forEach(tweet => {
      const engagementRate = this.calculateEngagementRate(tweet);
      const promptType = this.inferPromptType(tweet.content);
      
      if (promptType) {
        const current = performance.get(promptType) || 0;
        performance.set(promptType, current + engagementRate);
      }
    });
    
    return performance;
  }

  private calculateEngagementRate(tweet: any): number {
    const total = tweet.likes + tweet.retweets + tweet.replies;
    const impressions = tweet.impressions || 1000;
    return total / impressions;
  }

  private inferPromptType(content: string): string | null {
    // TODO: Implement NLP classification for better detection
    if (content.includes('BREAKTHROUGH')) return 'breakthrough';
    if (content.includes('?')) return 'question';
    if (content.match(/\d+%/)) return 'stat';
    if (content.includes('years') || content.includes('future')) return 'future';
    if (content.includes('studies') || content.includes('analyzing')) return 'insight';
    return null;
  }

  private updateWeights(performance: Map<string, number>): void {
    const templates = this.promptPool.getTemplates();
    
    templates.forEach(template => {
      const score = performance.get(template.id) || 0;
      const newWeight = Math.max(0.1, Math.min(3.0, 1.0 + score));
      
      this.promptPool.updateWeight(template.id, newWeight);
      console.log(`📊 Updated '${template.id}' weight: ${newWeight.toFixed(2)}`);
    });
  }
} 