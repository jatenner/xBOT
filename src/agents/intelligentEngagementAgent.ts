import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';

interface EngagementTarget {
  userId: string;
  username: string;
  followerCount: number;
  tweetContent: string;
  engagementScore: number;
  shouldEngage: boolean;
  engagementType: 'like' | 'reply' | 'follow' | 'skip';
  reasoning: string;
}

interface FollowerGrowthStrategy {
  targetAudience: string[];
  engagementTactics: string[];
  contentApproach: string;
  expectedGrowthRate: number;
}

export class IntelligentEngagementAgent {

  async analyzeEngagementTarget(userProfile: any, tweetContent: string): Promise<EngagementTarget> {
    try {
      console.log('🧠 AI analyzing engagement target...');
      
      const prompt = `
You are a legendary growth hacker who helps health accounts gain massive followings through strategic engagement.

ANALYZE THIS ENGAGEMENT TARGET:

USER PROFILE:
- Username: ${userProfile.username}
- Followers: ${userProfile.public_metrics?.followers_count || 'unknown'}
- Following: ${userProfile.public_metrics?.following_count || 'unknown'}
- Bio: ${userProfile.description || 'No bio'}

RECENT TWEET: "${tweetContent}"

STRATEGIC ANALYSIS:
1. FOLLOWER GROWTH POTENTIAL (1-10):
   - Will they likely follow back?
   - Do they have engaged audience we want?
   - Is their content quality high?
   - Do they engage with similar accounts?

2. AUDIENCE OVERLAP (1-10):
   - Are their followers our target audience?
   - Health/wellness focus alignment
   - Professional vs general audience
   - Engagement quality of their followers

3. ENGAGEMENT VALUE (1-10):
   - Will engaging boost our visibility?
   - Quality of their engagement
   - Likelihood of meaningful interaction
   - Potential for viral boost

RECOMMENDATION:
- Should we engage? (Yes/No)
- Best engagement type: (like/reply/follow/skip)
- Strategic reasoning

Return JSON:
{
  "userId": "${userProfile.id}",
  "username": "${userProfile.username}",
  "followerCount": ${userProfile.public_metrics?.followers_count || 0},
  "tweetContent": "${tweetContent}",
  "engagementScore": number (1-10),
  "shouldEngage": boolean,
  "engagementType": "like|reply|follow|skip",
  "reasoning": "detailed strategic reasoning"
}`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 350,
        temperature: 0.3,
        model: 'gpt-4o-mini'
      });

      const analysis = JSON.parse(response) as EngagementTarget;
      
      console.log(`🎯 Engagement Score: ${analysis.engagementScore}/10 - ${analysis.engagementType.toUpperCase()}`);
      console.log(`📊 Decision: ${analysis.shouldEngage ? 'ENGAGE' : 'SKIP'} - ${analysis.reasoning.substring(0, 100)}...`);
      
      return analysis;

    } catch (error) {
      console.warn('⚠️ Engagement analysis failed:', error);
      return {
        userId: userProfile.id || 'unknown',
        username: userProfile.username || 'unknown',
        followerCount: 0,
        tweetContent,
        engagementScore: 5,
        shouldEngage: true,
        engagementType: 'like',
        reasoning: 'Fallback due to analysis error'
      };
    }
  }

  async generateIntelligentReply(originalTweet: string, authorProfile: any): Promise<string> {
    try {
      console.log('💬 AI generating intelligent reply...');
      
      const prompt = `
You are a health expert who writes replies that consistently gain followers and engagement.

ORIGINAL TWEET: "${originalTweet}"
AUTHOR: @${authorProfile.username} (${authorProfile.public_metrics?.followers_count || 0} followers)

Generate a STRATEGIC REPLY that will:
1. Add genuine value to the conversation
2. Demonstrate our health expertise  
3. Make people want to follow us
4. Position us as an authority
5. Encourage engagement on our reply

REPLY STRATEGY:
- Provide additional insight or data
- Ask thought-provoking questions
- Share contrarian but accurate perspective
- Reference specific studies/mechanisms
- Be conversational but authoritative

RULES:
- Under 280 characters
- Include specific data/numbers when possible
- End with engagement hook (question/surprising fact)
- Maintain professional but approachable tone
- Don't be salesy or promotional

Generate ONE strategic reply:`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 150,
        temperature: 0.4,
        model: 'gpt-4o-mini'
      });

      const reply = response.trim();
      
      console.log(`💬 Generated reply: "${reply.substring(0, 100)}..."`);
      
      return reply;

    } catch (error) {
      console.warn('⚠️ Reply generation failed:', error);
      return 'Interesting perspective! The research on this keeps evolving. What\'s your take on the long-term implications?';
    }
  }

  async developFollowerGrowthStrategy(): Promise<FollowerGrowthStrategy> {
    try {
      console.log('🚀 AI developing follower growth strategy...');
      
      const prompt = `
You are a legendary growth strategist who has helped health accounts grow from 0 to 100K+ followers.

Develop a COMPREHENSIVE FOLLOWER GROWTH STRATEGY for a health/wellness Twitter account:

CURRENT SITUATION:
- Health/wellness content focus
- Professional target audience  
- Data-driven, authoritative approach
- Goal: Maximum follower acquisition

STRATEGIC ANALYSIS:
1. TARGET AUDIENCE SEGMENTS:
   - Who are our ideal followers?
   - What content do they engage with?
   - When are they most active?
   - What problems do they need solved?

2. ENGAGEMENT TACTICS:
   - Which accounts to target for engagement?
   - Best times and methods to engage
   - How to maximize follow-back rates
   - Content that drives viral growth

3. CONTENT APPROACH:
   - Topics that consistently gain followers
   - Posting frequency and timing
   - Content mix and variety
   - Engagement optimization

Return JSON:
{
  "targetAudience": ["segment1", "segment2", "segment3"],
  "engagementTactics": ["tactic1", "tactic2", "tactic3"],
  "contentApproach": "detailed content strategy",
  "expectedGrowthRate": number (followers per week)
}`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 400,
        temperature: 0.3,
        model: 'gpt-4o-mini'
      });

      const strategy = JSON.parse(response) as FollowerGrowthStrategy;
      
      console.log(`🎯 Growth Strategy: ${strategy.expectedGrowthRate} followers/week expected`);
      console.log(`👥 Target: ${strategy.targetAudience.join(', ')}`);
      
      return strategy;

    } catch (error) {
      console.warn('⚠️ Strategy development failed:', error);
      return {
        targetAudience: ['Health professionals', 'Fitness enthusiasts', 'Biohackers'],
        engagementTactics: ['Engage with health influencers', 'Reply to trending health topics', 'Like quality health content'],
        contentApproach: 'Data-driven health tips with controversial but accurate takes',
        expectedGrowthRate: 50
      };
    }
  }

  async optimizePostingTiming(): Promise<{ bestTimes: string[]; reasoning: string }> {
    try {
      console.log('⏰ AI optimizing posting timing...');
      
      const prompt = `
You are a social media timing expert who maximizes engagement through strategic posting schedules.

Analyze OPTIMAL POSTING TIMES for maximum follower growth on Twitter:

TARGET AUDIENCE: Health-conscious professionals, fitness enthusiasts, biohackers
GOAL: Maximum engagement and follower acquisition
TIMEZONE: Eastern Time (US audience focus)

ANALYSIS FACTORS:
1. When is our target audience most active?
2. When do health/wellness tweets perform best?
3. Optimal frequency to avoid algorithm penalties
4. Best times for different content types
5. Competition analysis (when others post less)

STRATEGIC RECOMMENDATIONS:
- Specific optimal posting times
- Frequency recommendations  
- Content timing strategies
- Weekend vs weekday approaches

Return JSON:
{
  "bestTimes": ["time1", "time2", "time3"],
  "reasoning": "detailed explanation of timing strategy"
}`;

      const response = await openaiClient.generateCompletion(prompt, {
        maxTokens: 300,
        temperature: 0.3,
        model: 'gpt-4o-mini'
      });

      const optimization = JSON.parse(response);
      
      console.log(`⏰ Optimal times: ${optimization.bestTimes.join(', ')}`);
      
      return optimization;

    } catch (error) {
      console.warn('⚠️ Timing optimization failed:', error);
      return {
        bestTimes: ['7:00 AM EST', '12:00 PM EST', '6:00 PM EST'],
        reasoning: 'Standard peak engagement times for health content'
      };
    }
  }
} 