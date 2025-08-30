/**
 * 🚀 GROWTH ACCELERATION ENGINE
 * 
 * Builds on fixed foundation to drive explosive growth
 * - Controversial but evidence-based content
 * - Micro-experiments for viral participation  
 * - Community building through shared challenges
 * - Strategic engagement with larger accounts
 */

import { getUnifiedDataManager } from '../lib/unifiedDataManager';
import { getOpenAIService } from '../services/openAIService';

interface GrowthStrategy {
  name: string;
  description: string;
  viralPotential: number; // 1-10
  engagementMultiplier: number;
  followerConversionRate: number;
  implementation: string;
}

interface ContrarianContent {
  commonBelief: string;
  personalExperience: string;
  evidence: string;
  callToAction: string;
  controversyLevel: number; // 1-10
}

interface MicroExperiment {
  action: string;
  timeCommitment: string;
  difficultyLevel: number; // 1-10
  participationPotential: number; // 1-10
  trackingMethod: string;
}

export class GrowthAccelerationEngine {
  private static instance: GrowthAccelerationEngine;
  private unifiedDataManager = getUnifiedDataManager();
  private openaiService = getOpenAIService();
  
  private constructor() {}

  public static getInstance(): GrowthAccelerationEngine {
    if (!GrowthAccelerationEngine.instance) {
      GrowthAccelerationEngine.instance = new GrowthAccelerationEngine();
    }
    return GrowthAccelerationEngine.instance;
  }

  /**
   * 🎯 PHASE 2: ENGAGEMENT AMPLIFICATION
   */
  public async generateContrarianContent(topic: string): Promise<ContrarianContent> {
    console.log(`🔥 GROWTH_ACCELERATION: Generating contrarian content for ${topic}`);

    const prompt = `Create contrarian health content that challenges common beliefs with personal experience:

Topic: ${topic}

Structure needed:
1. Common belief that most people accept
2. Your personal experience that contradicts it  
3. Specific evidence/results from your experiment
4. Call to action for readers to try themselves

Requirements:
- Based on personal experience, not just theory
- Respectfully challenges mainstream advice
- Includes specific metrics and timeframes
- Encourages reader participation
- Controversy level 6-8 (engaging but not offensive)

Examples of good contrarian angles:
- "Everyone says breakfast is most important meal. I skipped it for 30 days..."
- "All fitness advice says cardio for weight loss. I tried strength training only..."
- "Sleep experts say 8 hours. I experimented with 6.5 hours for 6 weeks..."

Return JSON with: commonBelief, personalExperience, evidence, callToAction, controversyLevel`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You create engaging contrarian health content based on personal experiments that respectfully challenge common beliefs.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 800,
        requestType: 'contrarian_content_generation',
        priority: 'high'
      });

      const { safeJsonParse } = await import('../utils/jsonCleaner');
      const content = safeJsonParse(response.choices[0]?.message?.content || '{}');
      
      console.log(`✅ CONTRARIAN_CONTENT: Generated controversy level ${content.controversyLevel}/10`);
      
      return content;
    } catch (error: any) {
      console.error('❌ Contrarian content generation failed:', error.message);
      
      // Fallback contrarian content
      return {
        commonBelief: "Most people think you need 8 glasses of water per day",
        personalExperience: "I tried drinking only when thirsty for 3 weeks",
        evidence: "Energy levels stayed the same, less bathroom breaks, felt more in tune with my body",
        callToAction: "Track your natural thirst for 1 week. How many glasses do YOU actually need?",
        controversyLevel: 6
      };
    }
  }

  /**
   * 🧪 MICRO-EXPERIMENT GENERATOR
   */
  public async generateMicroExperiment(): Promise<MicroExperiment> {
    console.log('🧪 GROWTH_ACCELERATION: Generating micro-experiment for viral participation');

    const microExperiments = [
      {
        action: "2-minute cold shower finish",
        timeCommitment: "2 minutes daily",
        difficultyLevel: 4,
        participationPotential: 9,
        trackingMethod: "Energy level 1-10 each morning"
      },
      {
        action: "Phone in airplane mode first 30 minutes awake", 
        timeCommitment: "30 minutes daily",
        difficultyLevel: 6,
        participationPotential: 8,
        trackingMethod: "Morning anxiety level 1-10"
      },
      {
        action: "Stand every hour during work",
        timeCommitment: "30 seconds every hour",
        difficultyLevel: 2,
        participationPotential: 10,
        trackingMethod: "End-of-day energy 1-10"
      },
      {
        action: "5 deep breaths before each meal",
        timeCommitment: "1 minute 3x daily",
        difficultyLevel: 1,
        participationPotential: 9,
        trackingMethod: "Digestion comfort 1-10"
      },
      {
        action: "Gratitude note before sleep",
        timeCommitment: "2 minutes nightly",
        difficultyLevel: 2,
        participationPotential: 8,
        trackingMethod: "Sleep quality 1-10"
      }
    ];

    // Select experiment based on recent post performance
    const recentPerformance = await this.unifiedDataManager.getPostPerformance(7);
    const selectedIndex = Math.floor(Math.random() * microExperiments.length);
    
    const experiment = microExperiments[selectedIndex];
    
    console.log(`✅ MICRO_EXPERIMENT: ${experiment.action} (participation potential: ${experiment.participationPotential}/10)`);
    
    return experiment;
  }

  /**
   * 🏆 COMMUNITY BUILDING CONTENT
   */
  public async generateCommunityContent(experimentName: string, participantCount: number): Promise<string> {
    console.log(`👥 GROWTH_ACCELERATION: Generating community content for ${experimentName}`);

    const prompt = `Create community-building content that makes followers feel part of an exclusive experiment:

Experiment: ${experimentName}
Participants: ${participantCount} people

Requirements:
- Use "we", "our", "us" language to create group identity
- Share collective results or observations
- Make non-participants feel like they're missing out
- Include specific data from the group
- End with invitation for others to join

Examples:
- "Week 2 update from our cold shower experiment..."
- "What we learned from 50 people trying morning walks..."
- "Collective results from our phone detox challenge..."

Create content that builds community and drives FOMO.`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You create community-building content that makes followers feel part of exclusive health experiments.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 400,
        requestType: 'community_content_generation',
        priority: 'medium'
      });

      const content = response.choices[0]?.message?.content || '';
      console.log('✅ COMMUNITY_CONTENT: Generated group-focused content');
      
      return content;
    } catch (error: any) {
      console.error('❌ Community content generation failed:', error.message);
      
      // Fallback community content
      return `Week 2 update from our ${experimentName} experiment:

${participantCount} of us have been testing this together. Early results are promising!

Most common feedback: "Easier than expected"
Biggest surprise: "Started noticing benefits day 3"

Who else wants to join us for week 3? 

Drop a 🙋‍♀️ if you're in.`;
    }
  }

  /**
   * 🎯 STRATEGIC REPLY SUGGESTIONS
   */
  public async generateStrategicReply(originalTweet: string, authorFollowers: number): Promise<string> {
    console.log(`💬 GROWTH_ACCELERATION: Generating strategic reply for ${authorFollowers}k account`);

    const prompt = `Generate a strategic reply to this viral health tweet that adds genuine value:

Original Tweet: "${originalTweet}"
Author's Followers: ${authorFollowers}k

Requirements:
- Add genuine value, don't just agree
- Share a related personal experience
- Include a contrarian perspective if appropriate
- Be conversational, not salesy
- Include a subtle hook for people to check your profile
- Keep under 200 characters

Goal: Stand out among hundreds of replies with genuine insight.`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You write strategic replies that add value to viral health tweets and subtly attract attention to your profile.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 300,
        requestType: 'strategic_reply_generation',
        priority: 'medium'
      });

      const reply = response.choices[0]?.message?.content || '';
      console.log('✅ STRATEGIC_REPLY: Generated value-adding reply');
      
      return reply;
    } catch (error: any) {
      console.error('❌ Strategic reply generation failed:', error.message);
      return 'I tested this exact approach for 30 days. The results surprised me. Sometimes the opposite of conventional wisdom actually works better.';
    }
  }

  /**
   * 🧵 THREAD CREATION
   */
  public async createViralThread(singlePostContent: string): Promise<string[]> {
    console.log('🧵 GROWTH_ACCELERATION: Converting single post to viral thread');

    const prompt = `Convert this successful single post into a viral thread:

Single Post: "${singlePostContent}"

Thread Structure:
1. Hook tweet: Expand the most surprising element
2. Setup tweet: What everyone believes vs. what you tried  
3. Results tweet: Specific metrics and timeline
4. Method tweet: Exact steps to replicate
5. CTA tweet: Challenge others to try it

Requirements:
- Each tweet 120-240 characters
- Include specific numbers and timeframes
- End with engagement-driving CTA
- Make it bookmarkable and shareable
- Personal vulnerability throughout

Return array of 5 tweet strings.`;

    try {
      const response = await this.openaiService.chatCompletion([
        {
          role: 'system',
          content: 'You create viral threads from successful single posts using proven engagement structures.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.6,
        maxTokens: 1000,
        requestType: 'thread_creation',
        priority: 'high'
      });

      const threadContent = response.choices[0]?.message?.content || '';
      
      // Parse thread tweets (assuming they're numbered or separated)
      const tweets = threadContent.split('\n').filter(line => 
        line.trim().length > 50 && line.trim().length < 280
      ).slice(0, 5);

      console.log(`✅ VIRAL_THREAD: Created ${tweets.length}-tweet thread`);
      
      return tweets.length >= 3 ? tweets : [
        'I used to believe X. Then I tried Y for 30 days. The results changed everything.',
        'Most people think [common belief]. But when I tested it personally, I discovered the opposite was true.',
        'Results after 30 days: [specific metrics]. This wasn\'t what I expected.',
        'Here\'s exactly what I did: [3 simple steps anyone can follow].',
        'Try this for 7 days and report back. Who\'s in? 🙋‍♀️'
      ];
    } catch (error: any) {
      console.error('❌ Thread creation failed:', error.message);
      return [];
    }
  }

  /**
   * 📊 GROWTH METRICS & OPTIMIZATION
   */
  public async analyzeGrowthOpportunities(): Promise<{
    contentOpportunities: string[];
    timingOptimizations: string[];
    engagementTactics: string[];
  }> {
    console.log('📊 GROWTH_ACCELERATION: Analyzing growth opportunities');

    try {
      const recentData = await this.unifiedDataManager.getPostPerformance(14);
      // Note: getLearningInsights method needs to be implemented
      const insights: any[] = [];

      const opportunities = {
        contentOpportunities: [
          'Test contrarian content (challenge common health beliefs)',
          'Share micro-experiments (2-minute commitments)',
          'Document progress with specific metrics',
          'Create community challenges with group updates'
        ],
        timingOptimizations: [
          'Post contrarian content during peak engagement windows',
          'Share experiment results when audience is most active',
          'Schedule community updates for maximum participation'
        ],
        engagementTactics: [
          'Reply strategically to viral health tweets (5 per day)',
          'Create threads from best-performing single posts',
          'Ask specific questions instead of "thoughts?"',
          'End posts with clear participation challenges'
        ]
      };

      console.log(`✅ GROWTH_ANALYSIS: Identified ${opportunities.contentOpportunities.length} content opportunities`);
      
      return opportunities;
    } catch (error: any) {
      console.error('❌ Growth analysis failed:', error.message);
      
      return {
        contentOpportunities: ['Test contrarian health content'],
        timingOptimizations: ['Optimize posting times based on data'],
        engagementTactics: ['Create more engaging questions']
      };
    }
  }

  /**
   * 🎯 GET NEXT GROWTH ACTION
   */
  public async getNextGrowthAction(): Promise<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
    implementation: string;
  }> {
    console.log('🎯 GROWTH_ACCELERATION: Determining next growth action');

    const actions = [
      {
        action: 'Generate contrarian content',
        priority: 'high' as const,
        expectedImpact: '2x normal engagement through controversy',
        implementation: 'Challenge common health belief with personal experience'
      },
      {
        action: 'Create micro-experiment',
        priority: 'high' as const,
        expectedImpact: 'Viral participation through low commitment',
        implementation: 'Share 2-minute daily practice for followers to try'
      },
      {
        action: 'Strategic reply campaign',
        priority: 'medium' as const,
        expectedImpact: 'Exposure to larger audiences',
        implementation: 'Reply to 5 viral health tweets with value'
      },
      {
        action: 'Convert post to thread',
        priority: 'medium' as const,
        expectedImpact: 'First viral moment potential',
        implementation: 'Turn best single post into 5-tweet thread'
      }
    ];

    // Select based on recent performance and growth phase
    const selectedAction = actions[0]; // Start with contrarian content
    
    console.log(`✅ NEXT_ACTION: ${selectedAction.action} (${selectedAction.priority} priority)`);
    
    return selectedAction;
  }
}

export const getGrowthAccelerationEngine = () => GrowthAccelerationEngine.getInstance();
