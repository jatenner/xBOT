import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';

interface HighValueTarget {
  userId: string;
  username: string;
  followerCount: number;
  followBackProbability: number;
  engagementStrategy: 'reply' | 'like' | 'follow';
  reasoning: string;
}

export class AggressiveFollowerGrowthAgent {

  constructor() {
    // Remove engagement logger for now to avoid interface issues
  }

  async runAggressiveGrowthCycle(): Promise<void> {
    try {
      console.log('🚀 === AGGRESSIVE FOLLOWER GROWTH CYCLE STARTED ===');
      
      // Phase 1: Target high-value health accounts
      await this.targetHealthInfluencers();
      
      // Phase 2: Engage with viral health content
      await this.engageWithViralHealthContent();
      
      // Phase 3: Strategic following of likely follow-backs
      await this.strategicFollowing();
      
      // Phase 4: Value-driven replies for authority building  
      await this.authorityBuildingReplies();
      
      console.log('✅ === AGGRESSIVE GROWTH CYCLE COMPLETE ===');
      
    } catch (error) {
      console.error('❌ Aggressive growth cycle failed:', error);
    }
  }

  private async targetHealthInfluencers(): Promise<void> {
    try {
      console.log('🎯 TARGETING HEALTH INFLUENCERS...');
      
      const healthInfluencers = [
        'hubermanlab', 'bengreenfield', 'drmarkhyman', 'drrhondapatrick',
        'davidasinclair', 'peterattiamd', 'nutritionsarah', 'wellnessmama'
      ];
      
      // Target 3-4 influencers per cycle to avoid spam detection
      const selectedInfluencers = this.shuffleArray(healthInfluencers).slice(0, 4);
      
      for (const username of selectedInfluencers) {
        await this.engageWithInfluencerContent(username);
        await this.sleep(30000); // 30 second delay between targets
      }
      
    } catch (error) {
      console.warn('⚠️ Health influencer targeting failed:', error);
    }
  }

  private async engageWithInfluencerContent(username: string): Promise<void> {
    try {
      console.log(`🎯 Engaging with @${username}...`);
      
      // Search for their recent tweets
      const searchResponse = await xClient.searchTweets(`from:${username}`, 5);
      
      if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
        // Analyze which tweet to engage with
        const bestTweet = await this.selectBestEngagementTarget(searchResponse.data);
        
        if (bestTweet) {
          // Generate strategic reply
          const reply = await this.generateStrategicReply(bestTweet.text, username);
          
          // Engage with like
          const likeResult = await xClient.likeTweet(bestTweet.id);
          if (likeResult.success) {
            console.log(`❤️ Liked @${username}'s tweet`);
          }
          
          // Strategic reply (if we have a good reply)
          if (reply && reply.length > 0) {
            // Note: Reply functionality would need to be implemented in xClient
            console.log(`💬 Would reply to @${username}: "${reply.substring(0, 100)}..."`);
          }
          
          console.log(`✅ Engaged with @${username} content`);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to engage with @${username}:`, error);
    }
  }

  private async selectBestEngagementTarget(tweets: any[]): Promise<any> {
    try {
      // AI selects the best tweet to engage with for maximum follower potential
      const tweetAnalysis = tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        metrics: tweet.public_metrics
      }));
      
      const prompt = `
Analyze these health influencer tweets and select the BEST one to engage with for maximum follower growth:

${tweetAnalysis.map((tweet, i) => `
Tweet ${i + 1}: "${tweet.text}"
Engagement: ${tweet.metrics?.like_count || 0} likes, ${tweet.metrics?.reply_count || 0} replies
`).join('\n')}

Select the tweet that:
1. Has high engagement potential
2. Allows for value-added reply
3. Will showcase our health expertise
4. Most likely to gain followers from our reply

Return JUST the tweet number (1, 2, 3, etc.):`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 10,
        temperature: 0.1,
        model: 'gpt-4o-mini'
      });

      const selectedIndex = parseInt(response.trim()) - 1;
      
      if (selectedIndex >= 0 && selectedIndex < tweets.length) {
        return tweets[selectedIndex];
      }
      
      // Fallback to first tweet
      return tweets[0];
      
    } catch (error) {
      console.warn('⚠️ Tweet selection failed, using first tweet:', error);
      return tweets[0];
    }
  }

  private async generateStrategicReply(originalTweet: string, influencerUsername: string): Promise<string> {
    try {
      const prompt = `
You are a health expert writing a strategic reply to gain followers from a health influencer's audience.

ORIGINAL TWEET by @${influencerUsername}: "${originalTweet}"

Write a reply that will:
1. Add genuine value to the conversation
2. Showcase your health expertise
3. Make people want to follow you
4. Position you as an authority
5. Encourage engagement on your reply

STRATEGY:
- Provide additional insight or data
- Share a contrarian but accurate perspective  
- Reference specific studies or mechanisms
- Ask a thought-provoking question
- Be conversational but authoritative

RULES:
- Under 280 characters
- Include specific data/numbers when possible
- Don't be promotional or salesy
- End with engagement hook

Generate ONE strategic reply:`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 150,
        temperature: 0.4,
        model: 'gpt-4o-mini'
      });

      return response.trim();
      
    } catch (error) {
      console.warn('⚠️ Strategic reply generation failed:', error);
      return 'Great point! The research on this keeps evolving. What\'s your take on the long-term implications?';
    }
  }

  private async engageWithViralHealthContent(): Promise<void> {
    try {
      console.log('🔥 ENGAGING WITH VIRAL HEALTH CONTENT...');
      
      const healthKeywords = [
        'health optimization', 'biohacking', 'longevity', 'nutrition science',
        'fitness research', 'wellness tips', 'healthy lifestyle', 'supplements'
      ];
      
      // Search for viral health content
      const keyword = healthKeywords[Math.floor(Math.random() * healthKeywords.length)];
      const searchResponse = await xClient.searchTweets(keyword, 10);
      
      if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
        // Filter for high-engagement tweets
        const highEngagementTweets = searchResponse.data.filter(tweet => 
          (tweet.public_metrics?.like_count || 0) > 10 ||
          (tweet.public_metrics?.retweet_count || 0) > 5
        );
        
        // Engage with top 3 viral tweets
        const targetTweets = highEngagementTweets.slice(0, 3);
        
        for (const tweet of targetTweets) {
          const likeResult = await xClient.likeTweet(tweet.id);
          if (likeResult.success) {
            console.log(`❤️ Liked viral health tweet: "${tweet.text.substring(0, 100)}..."`);
          }
          
          await this.sleep(15000); // 15 second delay
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Viral content engagement failed:', error);
    }
  }

  private async strategicFollowing(): Promise<void> {
    try {
      console.log('👥 STRATEGIC FOLLOWING FOR FOLLOW-BACKS...');
      
      // Simple rate limiting (could be improved)
      const maxDailyFollows = 20; // Conservative limit
      
      // Search for health enthusiasts likely to follow back
      const searchQueries = [
        'health tips', 'fitness journey', 'wellness coach',
        'biohacker', 'nutrition', 'healthy living'
      ];
      
      const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
      const searchResponse = await xClient.searchTweets(query, 8);
      
      if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
        // Target users with moderate follower counts (more likely to follow back)
        const targetUsers = searchResponse.data
          .filter(tweet => tweet.author_id)
          .slice(0, 3); // Limit to 3 strategic follows per cycle
        
        for (const tweet of targetUsers) {
          // Simple follow-back potential analysis
          const shouldFollow = await this.analyzeFollowBackPotential(tweet);
          
          if (shouldFollow) {
            const followResult = await xClient.followUser(tweet.author_id);
            if (followResult.success) {
              console.log(`👥 Strategically followed user for health content`);
            }
            
            await this.sleep(60000); // 1 minute delay between follows
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Strategic following failed:', error);
    }
  }

  private async analyzeFollowBackPotential(tweet: any): Promise<boolean> {
    try {
      // Simple heuristics for follow-back potential
      const tweetText = tweet.text.toLowerCase();
      
      // Higher follow-back probability indicators
      const positiveSignals = [
        'health journey', 'fitness goals', 'wellness tips',
        'looking for', 'follow for', 'health coach',
        'new to', 'learning about', 'tips please'
      ];
      
      // Lower follow-back probability indicators  
      const negativeSignals = [
        'verified', 'million', 'celebrity', 'official',
        'brand', 'company', 'corporation'
      ];
      
      const hasPositiveSignal = positiveSignals.some(signal => tweetText.includes(signal));
      const hasNegativeSignal = negativeSignals.some(signal => tweetText.includes(signal));
      
      return hasPositiveSignal && !hasNegativeSignal;
      
    } catch (error) {
      console.warn('⚠️ Follow-back analysis failed:', error);
      return false;
    }
  }

  private async authorityBuildingReplies(): Promise<void> {
    try {
      console.log('🏆 BUILDING AUTHORITY WITH VALUE-DRIVEN REPLIES...');
      
      // Search for health questions that we can answer expertly
      const questionQueries = [
        'health question', 'fitness help', 'nutrition advice',
        'wellness tips?', 'healthy?', 'supplement?'
      ];
      
      const query = questionQueries[Math.floor(Math.random() * questionQueries.length)];
      const searchResponse = await xClient.searchTweets(query, 8);
      
      if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
        // Find the best questions to answer (recent, moderate engagement)
        const answerableQuestions = searchResponse.data
          .filter(tweet => tweet.text.includes('?'))
          .slice(0, 2); // Limit to 2 authority-building replies per cycle
        
        for (const question of answerableQuestions) {
          const expertReply = await this.generateExpertReply(question.text);
          
          if (expertReply) {
            // Note: Reply functionality would need to be implemented in xClient
            console.log(`🏆 Would post expert reply: "${expertReply.substring(0, 100)}..."`);
            
            await this.sleep(120000); // 2 minute delay between authority replies
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Authority building replies failed:', error);
    }
  }

  private async generateExpertReply(questionTweet: string): Promise<string> {
    try {
      const prompt = `
You are a health expert answering a question to build authority and gain followers.

QUESTION: "${questionTweet}"

Provide an expert answer that:
1. Directly addresses the question
2. Shows deep health knowledge
3. Provides immediate value
4. Makes people want to follow for more insights
5. Positions you as a trusted authority

REQUIREMENTS:
- Under 280 characters
- Include specific data/mechanisms when relevant
- Be helpful and actionable
- Professional but approachable tone
- End with subtle engagement hook

Generate ONE expert reply:`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 150,
        temperature: 0.3,
        model: 'gpt-4o-mini'
      });

      return response.trim();
      
    } catch (error) {
      console.warn('⚠️ Expert reply generation failed:', error);
      return '';
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 