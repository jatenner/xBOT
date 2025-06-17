import { supabaseClient } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';

export class EvergreenRecyclerAgent {
  private readonly minRecycleInterval = 30; // Days before content can be recycled
  private readonly minPerformanceThreshold = 10; // Minimum engagement for evergreen content

  /**
   * Find and recycle high-performing evergreen content when fresh content is scarce
   */
  async recycleEvergreenContent(): Promise<string | null> {
    console.log('♻️ Searching for evergreen content to recycle...');

    try {
      // Get recent high-performing tweets
      const recentTweets = await supabaseClient.getRecentTweets(60); // Look back 60 days
      
      // Filter for high-performing content
      const evergreenCandidates = recentTweets.filter(tweet => 
        tweet.engagement_score >= this.minPerformanceThreshold
      );

      if (evergreenCandidates.length === 0) {
        console.log('⚠️ No suitable evergreen content found');
        return null;
      }

      // Select best performing tweet
      const selectedTweet = evergreenCandidates
        .sort((a, b) => b.engagement_score - a.engagement_score)[0];

      // Create fresh variation
      const refreshedContent = await this.createFreshVariation(selectedTweet);
      
      console.log(`♻️ Recycled evergreen content (${selectedTweet.engagement_score} score): ${refreshedContent.slice(0, 100)}...`);
      
      return refreshedContent;

    } catch (error) {
      console.error('❌ Error recycling evergreen content:', error);
      return null;
    }
  }

  /**
   * Create a fresh variation of evergreen content
   */
  private async createFreshVariation(originalTweet: any): Promise<string> {
    const prompt = `
Create a fresh variation of this high-performing health tech tweet while maintaining its core message:

Original: "${originalTweet.content}"
Performance: ${originalTweet.engagement_score} engagement score

Requirements:
1. Keep the same factual information and statistics
2. Use different wording and structure  
3. Maintain professional health tech tone
4. Include relevant hashtags for discovery
5. Ensure content fits Twitter's character limit
6. Add current relevance if possible

Generate a refreshed version that feels new while preserving the proven engagement factors.
`;

    try {
      const freshContent = await openaiClient.generateTweet({ style: 'professional' });
      return freshContent;
    } catch (error) {
      console.error('⚠️ Error creating fresh variation:', error);
      // Fallback to modified original
      return this.createSimpleVariation(originalTweet.content);
    }
  }

  /**
   * Create a simple variation when AI generation fails
   */
  private createSimpleVariation(originalContent: string): string {
    const variations = [
      `UPDATE: ${originalContent}`,
      `LATEST: ${originalContent}`,
      `REMINDER: ${originalContent}`,
      originalContent.replace('This', 'This exciting development'),
      originalContent.replace('shows', 'demonstrates'),
      originalContent.replace('Research', 'New research'),
    ];

    const randomVariation = variations[Math.floor(Math.random() * variations.length)];
    return randomVariation;
  }

  /**
   * Check if we should recycle content (when fresh content is low)
   */
  async shouldRecycleContent(): Promise<boolean> {
    try {
      // Check recent posting activity using existing methods
      const recentTweets = await supabaseClient.getRecentTweets(1); // Last 24 hours
      
      // If less than 3 posts in 24 hours, consider recycling
      const shouldRecycle = recentTweets.length < 3;
      
      if (shouldRecycle) {
        console.log('♻️ Low fresh content detected - recycling recommended');
      }

      return shouldRecycle;
    } catch (error) {
      console.error('⚠️ Error checking recycle conditions:', error);
      return false;
    }
  }
} 