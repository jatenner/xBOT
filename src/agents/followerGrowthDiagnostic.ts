import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';

interface GrowthDiagnostic {
  currentFollowers: number;
  followingCount: number;
  tweetCount: number;
  engagementRate: number;
  problemAreas: string[];
  growthStrategy: string[];
  urgentFixes: string[];
  expectedGrowthRate: number;
}

interface FollowerStrategy {
  targetAccounts: string[];
  dailyActions: string[];
  contentStrategy: string[];
  urgentActions: string[];
  expectedGrowthRate: number;
}

export class FollowerGrowthDiagnostic {

  async diagnoseGrowthProblem(): Promise<GrowthDiagnostic> {
    try {
      console.log('🔍 DIAGNOSING FOLLOWER GROWTH PROBLEM...');
      
      // Get current account metrics (simplified for now)
      const userProfile = {
        followers: 13,
        following: 4,
        tweets: 20
      };
      
      // Get recent tweet performance
      const recentTweets = await this.getRecentTweetPerformance();
      
      // Simple diagnostic instead of AI (to avoid JSON parsing issues)
      const diagnostic: GrowthDiagnostic = {
        currentFollowers: userProfile.followers,
        followingCount: userProfile.following,
        tweetCount: recentTweets.length,
        engagementRate: 2.1, // Estimated low engagement rate
        problemAreas: [
          'Only 13 followers after weeks of activity',
          'Low engagement rate on tweets',
          'Need more strategic targeting',
          'Content needs more viral hooks'
        ],
        growthStrategy: [
          'Target health influencer audiences',
          'Engage with viral health content',
          'Use controversial but accurate takes',
          'Strategic following of health enthusiasts'
        ],
        urgentFixes: [
          'Optimize bio for clear value proposition',
          'Increase engagement frequency',
          'Use more attention-grabbing hooks',
          'Target specific health communities'
        ],
        expectedGrowthRate: 50 // followers per week with aggressive strategy
      };
      
      console.log(`🚨 Growth Problem Identified: ${diagnostic.problemAreas.length} major issues`);
      console.log(`🎯 Growth Target: ${diagnostic.expectedGrowthRate} followers/week`);
      
      return diagnostic;

    } catch (error) {
      console.warn('⚠️ Growth diagnostic failed:', error);
      return {
        currentFollowers: 13,
        followingCount: 0,
        tweetCount: 0,
        engagementRate: 0,
        problemAreas: ['Unknown - diagnostic failed'],
        growthStrategy: ['Manual analysis needed'],
        urgentFixes: ['Fix diagnostic system'],
        expectedGrowthRate: 10
      };
    }
  }

  async createAggressiveGrowthStrategy(currentFollowers: number): Promise<FollowerStrategy> {
    try {
      const prompt = `Create an aggressive follower acquisition strategy for a health Twitter account with ${currentFollowers} followers.

YOU MUST RESPOND WITH ONLY VALID JSON. NO OTHER TEXT.

{
  "targetAccounts": ["@account1", "@account2", "@account3"],
  "dailyActions": ["action1", "action2", "action3"],
  "contentStrategy": ["strategy1", "strategy2"],
  "urgentActions": ["urgent1", "urgent2"],
  "expectedGrowthRate": 25
}

CRITICAL: ONLY JSON, NO EXTRA TEXT BEFORE OR AFTER.`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 200,
        temperature: 0.3,
        model: 'gpt-4o-mini'
      });

      // Check if response looks like JSON
      let jsonStr = response.trim();
      
      // If it doesn't start with {, it's probably content text, not JSON
      if (!jsonStr.startsWith('{')) {
        console.log('📝 OpenAI returned content text instead of JSON, using fallback strategy');
        return this.getFallbackGrowthStrategy();
      }
      
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      try {
        const strategy = JSON.parse(jsonStr);
        
        // Validate the parsed object has expected structure
        if (!strategy || typeof strategy !== 'object') {
          throw new Error('Invalid strategy object');
        }
        
        return {
          targetAccounts: Array.isArray(strategy.targetAccounts) ? strategy.targetAccounts : 
            ['@hubermanlab', '@bengreenfield', '@drmarkhyman'],
          dailyActions: Array.isArray(strategy.dailyActions) ? strategy.dailyActions :
            ['Like viral health content', 'Reply to health influencers', 'Follow health enthusiasts'],
          contentStrategy: Array.isArray(strategy.contentStrategy) ? strategy.contentStrategy :
            ['Post controversial health takes', 'Share actionable tips', 'Use viral hooks'],
          urgentActions: Array.isArray(strategy.urgentActions) ? strategy.urgentActions :
            ['Optimize bio for clarity', 'Increase posting frequency', 'Engage with trending topics'],
          expectedGrowthRate: typeof strategy.expectedGrowthRate === 'number' ? strategy.expectedGrowthRate : 25
        };
      } catch (parseError) {
        console.log('⚠️ Growth strategy JSON parsing failed, using fallback. Response was:', jsonStr.substring(0, 100) + '...');
        return this.getFallbackGrowthStrategy();
      }

    } catch (error) {
      console.error('❌ Growth strategy creation error:', error);
      return this.getFallbackGrowthStrategy();
    }
  }

  private getFallbackGrowthStrategy(): FollowerStrategy {
    return {
      targetAccounts: ['@hubermanlab', '@bengreenfield', '@drmarkhyman', '@peterattiamd', '@bengreenfield'],
      dailyActions: [
        'Like 20 viral health posts daily',
        'Reply to 5 health influencer tweets',
        'Follow 10 health enthusiasts',
        'Share controversial health takes',
        'Post actionable health tips'
      ],
      contentStrategy: [
        'Controversial but accurate health statements',
        'Actionable tips with specific numbers',
        'Behind-the-scenes health industry insights',
        'Personal health transformation stories'
      ],
      urgentActions: [
        'Optimize bio with clear value proposition',
        'Increase posting to 17 tweets/day',
        'Engage aggressively with health community',
        'Use trending health hashtags strategically'
      ],
      expectedGrowthRate: 30
    };
  }

  async generateViralFollowerMagnet(): Promise<string> {
    try {
      console.log('🧲 GENERATING VIRAL FOLLOWER MAGNET CONTENT...');
      
      const prompt = `
You are a viral content creator who specializes in health content that gains massive followers quickly.

Create a health/wellness tweet that will:
1. Go viral and get thousands of views
2. Make people immediately want to follow for more insights
3. Position the account as a must-follow health authority
4. Generate discussion and engagement

VIRAL FOLLOWER MAGNET CRITERIA:
- Shocking but true health fact
- Challenges common beliefs
- Provides immediate value
- Makes people think "I need to follow this person"
- Ends with engagement hook

EXAMPLES OF FOLLOWER MAGNETS:
- "Everyone's doing intermittent fasting wrong. Here's the one thing that matters..."
- "I spent $50K on health optimization. These 3 things moved the needle most..."
- "Doctors won't tell you this about cholesterol because..."

Generate ONE tweet that will be a follower magnet:`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 200,
        temperature: 0.6,
        model: 'gpt-4o-mini'
      });

      const viralContent = response.trim();
      
      console.log(`🧲 Viral Follower Magnet: "${viralContent.substring(0, 100)}..."`);
      
      return viralContent;

    } catch (error) {
      console.warn('⚠️ Viral content generation failed:', error);
      return 'Most people think 8 glasses of water daily is healthy. Actually, it can dilute your electrolytes and slow metabolism. Here\'s what actually works... 🧵';
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      // This would use Twitter API to get user profile
      // For now, return basic structure
      return {
        followers: 13,
        following: 4,
        tweets: 20
      };
    } catch (error) {
      console.warn('⚠️ Could not fetch user profile:', error);
      return null;
    }
  }

  private async getRecentTweetPerformance(): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10) || { data: null, error: null };

      if (error) {
        console.warn('⚠️ Could not fetch recent tweets:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('⚠️ Database query failed:', error);
      return [];
    }
  }

  async runCompleteGrowthAudit(): Promise<void> {
    console.log('🚨 RUNNING COMPLETE FOLLOWER GROWTH AUDIT...');
    
    const diagnostic = await this.diagnoseGrowthProblem();
    const strategy = await this.createAggressiveGrowthStrategy(diagnostic.currentFollowers);
    const viralContent = await this.generateViralFollowerMagnet();
    
    console.log('\n🔍 === GROWTH DIAGNOSTIC RESULTS ===');
    console.log(`Current Followers: ${diagnostic.currentFollowers}`);
    console.log(`Problem Areas: ${diagnostic.problemAreas.join(', ')}`);
    console.log(`Expected Growth: ${diagnostic.expectedGrowthRate} followers/week`);
    
    console.log('\n🚀 === AGGRESSIVE GROWTH STRATEGY ===');
    console.log(`Target Accounts: ${strategy.targetAccounts.join(', ')}`);
    console.log(`Urgent Actions: ${strategy.urgentActions.join(', ')}`);
    
    console.log('\n🧲 === VIRAL FOLLOWER MAGNET ===');
    console.log(`"${viralContent}"`);
    
    console.log('\n✅ GROWTH AUDIT COMPLETE - IMPLEMENT URGENTLY!');
  }
} 