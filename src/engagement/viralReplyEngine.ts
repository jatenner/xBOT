/**
 * 🚀 VIRAL REPLY ENGINE - FOLLOWER GROWTH FOCUSED
 * 
 * Creates strategic replies on other people's posts that:
 * 1. Post as REAL comments (not fake @username tweets)
 * 2. Showcase viral authority insights
 * 3. Drive curiosity and followers to your account
 * 4. Use zero personal language
 */

import { OpenAI } from 'openai';

export interface ViralReplyTarget {
  tweet_id: string;
  username: string;
  content: string;
  follower_count?: number;
  engagement_rate?: number;
  topic?: string;
}

export interface ViralReply {
  success: boolean;
  content: string;
  strategy: string;
  hook_type: string;
  curiosity_score: number;
  authority_score: number;
  expected_clicks: number;
  metadata: {
    reply_type: string;
    viral_elements: string[];
    authority_markers: string[];
    curiosity_drivers: string[];
  };
}

export class ViralReplyEngine {
  private static instance: ViralReplyEngine;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public static getInstance(): ViralReplyEngine {
    if (!ViralReplyEngine.instance) {
      ViralReplyEngine.instance = new ViralReplyEngine();
    }
    return ViralReplyEngine.instance;
  }

  /**
   * 🎯 Generate viral reply that drives followers
   */
  async generateViralReply(target: ViralReplyTarget): Promise<ViralReply> {
    console.log(`🎯 VIRAL_REPLY: Generating follower-magnet reply to @${target.username}`);

    try {
      const strategy = this.selectReplyStrategy(target);
      const prompt = this.buildViralReplyPrompt(target, strategy);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200 // Keep replies concise
      });

      const replyContent = response.choices[0]?.message?.content || '';
      
      // Score the reply for viral potential
      const scores = this.scoreViralReply(replyContent, target);
      
      return {
        success: true,
        content: replyContent.trim(),
        strategy: strategy.name,
        hook_type: strategy.hook_type,
        curiosity_score: scores.curiosityScore,
        authority_score: scores.authorityScore,
        expected_clicks: this.calculateExpectedClicks(scores.curiosityScore, scores.authorityScore),
        metadata: {
          reply_type: strategy.name,
          viral_elements: this.extractViralElements(replyContent),
          authority_markers: this.extractAuthorityMarkers(replyContent),
          curiosity_drivers: this.extractCuriosityDrivers(replyContent)
        }
      };

    } catch (error) {
      console.error('❌ VIRAL_REPLY_ERROR:', error);
      return this.getFallbackReply(target);
    }
  }

  /**
   * 🎲 Select optimal reply strategy based on target
   */
  private selectReplyStrategy(target: ViralReplyTarget): {
    name: string;
    hook_type: string;
    description: string;
  } {
    const strategies = [
      {
        name: 'contrarian_expert',
        hook_type: 'contrarian',
        description: 'Challenge the premise with expert insight'
      },
      {
        name: 'authority_addition',
        hook_type: 'additive',
        description: 'Add surprising research that builds on their point'
      },
      {
        name: 'curiosity_gap',
        hook_type: 'curiosity',
        description: 'Create knowledge gap that drives profile visits'
      },
      {
        name: 'myth_correction',
        hook_type: 'correction',
        description: 'Politely correct with authoritative sources'
      },
      {
        name: 'insider_knowledge',
        hook_type: 'insider',
        description: 'Share lesser-known expert insight'
      }
    ];

    // Select based on target characteristics
    const hasHighFollowers = (target.follower_count || 0) > 10000;
    const isHealthTopic = target.content.toLowerCase().includes('health') || 
                         target.content.toLowerCase().includes('fitness') ||
                         target.content.toLowerCase().includes('sleep') ||
                         target.content.toLowerCase().includes('diet');

    if (hasHighFollowers && isHealthTopic) {
      return strategies[0]; // Contrarian expert for big accounts
    } else if (isHealthTopic) {
      return strategies[1]; // Authority addition for health content
    } else {
      return strategies[2]; // Curiosity gap for general content
    }
  }

  /**
   * 🏗️ Build viral reply prompt
   */
  private buildViralReplyPrompt(target: ViralReplyTarget, strategy: any): string {
    return `You are replying to a tweet as an expert health researcher. Your goal is to create a reply that makes people curious about your expertise and drives them to check out your profile.

ORIGINAL TWEET by @${target.username}:
"${target.content}"

REPLY STRATEGY: ${strategy.description}

VIRAL REPLY RULES:
🎯 GOAL: Make people think "Wow, this person knows things I don't - let me check their profile"
🧠 CURIOSITY DRIVERS: Drop knowledge that sounds insider/expert level
📊 AUTHORITY MARKERS: Reference studies, institutions, specific data
🚫 NO PERSONAL LANGUAGE: Never use "I", "me", "my", "we", "us", "our"
⚡ BREVITY: Maximum 200 characters for maximum impact

VIRAL REPLY FORMULAS:

CONTRARIAN EXPERT:
"Actually, latest research from [Institution] shows the opposite: [surprising finding]. [Specific stat]% of people don't realize [insight]."

AUTHORITY ADDITION:  
"This aligns with [Institution] research showing [specific finding]. The mechanism involves [brief explanation]. [Stat]% improvement in studies."

CURIOSITY GAP:
"The real reason this works has to do with [physiological process]. Most people miss the [specific detail] that makes all the difference."

MYTH CORRECTION:
"Common misconception. [Institution] studies actually show [correct information]. The [specific number]% difference is significant."

INSIDER KNOWLEDGE:
"Researchers at [Institution] discovered [surprising detail] about this. The [specific mechanism] explains why [insight]."

AUTHORITY ELEMENTS TO INCLUDE:
✅ Institution names: Harvard, Stanford, Mayo Clinic, Johns Hopkins
✅ Specific percentages: "47% improvement", "2.3x more effective"  
✅ Research terms: "studies show", "data reveals", "research indicates"
✅ Mechanism details: "via dopamine pathways", "through cortisol reduction"

CURIOSITY TRIGGERS:
✅ "The real reason..."
✅ "Most people don't realize..."  
✅ "Latest research shows..."
✅ "The mechanism involves..."
✅ "Researchers discovered..."

EXAMPLES OF PERFECT VIRAL REPLIES:

Original: "Just had an amazing workout! Feeling energized!"
Reply: "That energy boost is from BDNF increasing 200% post-exercise [Harvard research]. Most people don't realize the peak hits 2-4 hours later, not immediately."

Original: "Can't sleep again... 😴"  
Reply: "Sleep latency increases 73% when core body temp doesn't drop properly [Stanford Sleep Lab]. The magnesium-glycine pathway is usually the culprit."

Original: "This supplement changed my life!"
Reply: "Placebo accounts for 40% of supplement benefits [Mayo Clinic analysis]. The bioavailability factor most people miss makes the real difference."

CRITICAL REQUIREMENTS:
❌ NO personal language ("I think", "In my experience")
❌ NO medical advice ("You should take", "Try this")
❌ NO attacking or dismissive tone
✅ Expert authority voice ("Research shows", "Studies indicate")
✅ Specific data and institutions
✅ Curiosity gaps that drive profile visits
✅ Concise, impactful delivery

Generate a viral reply using the ${strategy.name} strategy that will make people curious about your expertise and drive them to follow your account.`;
  }

  /**
   * 📊 Score reply for viral potential
   */
  private scoreViralReply(content: string, target: ViralReplyTarget): {
    curiosityScore: number;
    authorityScore: number;
  } {
    let curiosityScore = 0;
    let authorityScore = 0;

    // Curiosity indicators
    const curiosityPatterns = [
      { pattern: /(real reason|most people don't|mechanism|actually)/i, points: 15 },
      { pattern: /(latest research|discovered|reveals)/i, points: 12 },
      { pattern: /(the.*that makes|the.*people miss)/i, points: 10 },
      { pattern: /\d+%|\d+\.\d+x/i, points: 8 }
    ];

    curiosityPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) curiosityScore += points;
    });

    // Authority indicators
    const authorityPatterns = [
      { pattern: /(harvard|stanford|mayo|johns hopkins)/i, points: 20 },
      { pattern: /(research|study|studies|data)/i, points: 10 },
      { pattern: /\d+% (improvement|increase|difference)/i, points: 15 },
      { pattern: /(mechanism|pathway|cortisol|dopamine|BDNF)/i, points: 12 }
    ];

    authorityPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) authorityScore += points;
    });

    return {
      curiosityScore: Math.min(curiosityScore, 100),
      authorityScore: Math.min(authorityScore, 100)
    };
  }

  /**
   * 📈 Calculate expected profile clicks from reply
   */
  private calculateExpectedClicks(curiosityScore: number, authorityScore: number): number {
    const baseClicks = 2;
    const curiosityMultiplier = curiosityScore / 25;
    const authorityMultiplier = authorityScore / 30;
    
    return Math.round(baseClicks + curiosityMultiplier + authorityMultiplier);
  }

  /**
   * 🔥 Extract viral elements
   */
  private extractViralElements(content: string): string[] {
    const elements = [];
    if (/real reason|actually|mechanism/i.test(content)) elements.push('curiosity_gap');
    if (/most people don't|people miss/i.test(content)) elements.push('knowledge_gap');
    if (/(latest|new) research/i.test(content)) elements.push('cutting_edge');
    if (/\d+%/i.test(content)) elements.push('specific_data');
    return elements;
  }

  /**
   * 🎓 Extract authority markers
   */
  private extractAuthorityMarkers(content: string): string[] {
    const markers = [];
    const institutions = content.match(/(harvard|stanford|mayo|johns hopkins)/gi) || [];
    const percentages = content.match(/\d+%/g) || [];
    const studies = content.match(/(research|study|data)/gi) || [];
    
    return [...institutions, ...percentages, ...studies];
  }

  /**
   * 🧠 Extract curiosity drivers
   */
  private extractCuriosityDrivers(content: string): string[] {
    const drivers = [];
    if (/real reason/i.test(content)) drivers.push('hidden_explanation');
    if (/most people don't/i.test(content)) drivers.push('exclusive_knowledge');
    if (/mechanism|pathway/i.test(content)) drivers.push('scientific_detail');
    if (/latest|discovered/i.test(content)) drivers.push('new_research');
    return drivers;
  }

  /**
   * 🔄 Fallback reply for errors
   */
  private getFallbackReply(target: ViralReplyTarget): ViralReply {
    return {
      success: false,
      content: "Research from Stanford suggests the mechanism behind this involves pathways most people don't consider. The 40% variance in results comes down to timing factors.",
      strategy: 'authority_addition',
      hook_type: 'additive',
      curiosity_score: 65,
      authority_score: 70,
      expected_clicks: 4,
      metadata: {
        reply_type: 'fallback',
        viral_elements: ['curiosity_gap', 'specific_data'],
        authority_markers: ['Stanford', '40%', 'research'],
        curiosity_drivers: ['hidden_explanation', 'exclusive_knowledge']
      }
    };
  }

  /**
   * 🎯 Execute real reply posting (integrates with existing bulletproof poster)
   */
  async postViralReply(target: ViralReplyTarget, reply: ViralReply): Promise<{
    success: boolean;
    replyId?: string;
    error?: string;
  }> {
    if (process.env.DRY_RUN === '1') {
      console.log(`🧪 DRY_RUN_REPLY: Would comment on @${target.username}'s tweet:`);
      console.log(`Tweet: "${target.content.substring(0, 60)}..."`);
      console.log(`Reply: "${reply.content}"`);
      console.log(`Strategy: ${reply.strategy} (${reply.expected_clicks} expected clicks)`);
      console.log('─'.repeat(60));
      return { success: true, replyId: `dry_run_reply_${Date.now()}` };
    }

    try {
      // Use existing bulletproof poster
      const { bulletproofPoster } = await import('../posting/bulletproofPoster');
      
      const result = await bulletproofPoster.postReply(reply.content, target.tweet_id);
      
      if (result.success) {
        console.log(`✅ VIRAL_REPLY_POSTED: ${reply.strategy} reply to @${target.username}`);
        console.log(`📊 Expected clicks: ${reply.expected_clicks}`);
        
        // Store for analytics
        await this.storeViralReply(target, reply, result.tweetId!);
        
        return { success: true, replyId: result.tweetId };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ VIRAL_REPLY_POST_ERROR:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 📊 Store viral reply for analytics
   */
  private async storeViralReply(target: ViralReplyTarget, reply: ViralReply, replyId: string): Promise<void> {
    try {
      // Import database client
      const { supabaseClient } = await import('../db/supabaseClient');
      
      const replyData = {
        tweet_id: replyId,
        parent_tweet_id: target.tweet_id,
        parent_username: target.username,
        content: reply.content,
        strategy: reply.strategy,
        hook_type: reply.hook_type,
        curiosity_score: reply.curiosity_score,
        authority_score: reply.authority_score,
        expected_clicks: reply.expected_clicks,
        viral_elements: reply.metadata.viral_elements,
        authority_markers: reply.metadata.authority_markers,
        posted_at: new Date().toISOString()
      };

      const result = await supabaseClient.safeInsert('viral_replies', replyData);
      
      if (result.success) {
        console.log('📊 VIRAL_REPLY_STORED: Reply analytics saved');
      } else {
        console.warn('⚠️ VIRAL_REPLY_STORAGE_WARNING:', result.error?.message);
      }

    } catch (error) {
      console.error('❌ VIRAL_REPLY_STORAGE_ERROR:', error);
    }
  }
}

export default ViralReplyEngine;
