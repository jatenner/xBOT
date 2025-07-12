/**
 * 🚀 VIRAL FOLLOWER GROWTH AGENT
 * 
 * MISSION: Transform from 0 followers to 10K+ through viral content strategy
 * 
 * STRATEGY:
 * 1. Controversial health takes that spark debates
 * 2. Personality-driven content that builds connection
 * 3. Trend-jacking with unique angles
 * 4. Community engagement that builds relationships
 * 5. Value-first content that gets saved/shared
 */

import { getBudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { supabaseClient } from '../utils/supabaseClient';
import { xClient } from '../utils/xClient';

interface ViralContent {
  content: string;
  contentType: 'controversial' | 'personality' | 'trend_jack' | 'value_bomb' | 'story';
  viralPotential: number;
  engagementHooks: string[];
  followTriggers: string[];
}

export class ViralFollowerGrowthAgent {
  private openai = getBudgetAwareOpenAI();
  
  // Viral content types that actually drive follows
  private viralContentTypes = {
    controversial: {
      weight: 0.3,
      description: "Hot takes that spark debates and discussions",
      examples: [
        "Unpopular opinion: Most health apps are making people less healthy",
        "The healthcare industry doesn't want you to know this...",
        "Why your doctor is probably wrong about [common belief]"
      ]
    },
    personality: {
      weight: 0.25,
      description: "Personal stories and behind-the-scenes content",
      examples: [
        "3 years ago I was told this was impossible. Today...",
        "The biggest mistake I made in health tech (and what I learned)",
        "What they don't teach you in medical school"
      ]
    },
    trend_jack: {
      weight: 0.2,
      description: "Hijacking trending topics with health angles",
      examples: [
        "Everyone's talking about AI, but here's what it means for your health",
        "The [trending topic] everyone missed about healthcare",
        "While you were distracted by [trend], this health breakthrough happened"
      ]
    },
    value_bomb: {
      weight: 0.15,
      description: "Actionable insights people want to save",
      examples: [
        "5 health metrics your doctor isn't checking (thread)",
        "The 30-second test that could save your life",
        "Free tools that are better than expensive health apps"
      ]
    },
    story: {
      weight: 0.1,
      description: "Compelling narratives that build emotional connection",
      examples: [
        "The patient who changed how I think about medicine",
        "This 90-year-old taught me more than medical school",
        "The day I realized everything I knew about health was wrong"
      ]
    }
  };

  /**
   * 🎯 MAIN VIRAL CONTENT GENERATION
   */
  async generateViralContent(): Promise<ViralContent> {
    console.log('🚀 === VIRAL FOLLOWER GROWTH AGENT ===');
    console.log('🎯 Mission: Create content that makes people hit FOLLOW');
    
    // Select viral content type
    const contentType = this.selectViralContentType();
    console.log(`🔥 Selected content type: ${contentType}`);
    
    // Generate viral content
    const content = await this.createViralContent(contentType);
    
    // Calculate viral potential
    const viralPotential = this.calculateViralPotential(content);
    
    // Extract engagement hooks
    const engagementHooks = this.extractEngagementHooks(content);
    
    // Identify follow triggers
    const followTriggers = this.identifyFollowTriggers(content);
    
    return {
      content,
      contentType,
      viralPotential,
      engagementHooks,
      followTriggers
    };
  }

  /**
   * 🔥 CREATE VIRAL CONTENT BY TYPE
   */
  private async createViralContent(type: keyof typeof this.viralContentTypes): Promise<string> {
    const prompts = {
      controversial: `Create a controversial health/medical take that will spark debate and make people want to follow for more hot takes.

Requirements:
- Start with "Unpopular opinion:" or "Hot take:" or "Nobody talks about this but..."
- Challenge conventional wisdom
- Be specific and bold
- Include a follow-worthy tease
- 280 characters max
- No hashtags (they kill reach)

Examples:
"Unpopular opinion: Your daily vitamins are probably making you poorer, not healthier. The $40B supplement industry doesn't want you to know what actually works. (Thread coming tomorrow)"

"Hot take: Most 'healthy' foods at Whole Foods are marketing scams. I spent 3 years researching this. Here's what I found..."

"Nobody talks about this but 90% of health advice is wrong. I've reviewed 1000+ studies. The real science is shocking."

Make it personal, controversial, and follow-worthy:`,

      personality: `Create personal, behind-the-scenes content that shows personality and makes people want to follow for more insider stories.

Requirements:
- Start with personal story hook
- Show vulnerability or surprise
- Include a lesson learned
- Tease future content
- 280 characters max
- No hashtags

Examples:
"3 years ago a patient told me something that changed everything. I thought I knew medicine. I was wrong. What she said next shocked me..."

"The biggest mistake I made as a doctor: trusting everything I learned in medical school. Real medicine happens in the trenches. Here's what they don't teach you..."

"Plot twist: The healthiest person I know does everything 'wrong' according to science. Their secret? Something nobody talks about..."

Make it personal and intriguing:`,

      trend_jack: `Create content that hijacks a current trend and gives it a unique health angle that makes people want to follow for more insights.

Requirements:
- Reference current trend/news
- Connect to health/medicine uniquely
- Provide contrarian or insider angle
- Be timely and relevant
- 280 characters max
- No hashtags

Examples:
"Everyone's obsessed with AI, but here's what they're missing: it's already diagnosing your health through your phone. The data is terrifying..."

"While everyone argues about [trending topic], a quiet revolution in medicine just happened. Nobody's talking about it. Here's why it matters..."

"The [trend] everyone missed: how it's secretly changing healthcare forever. I've been tracking this for months. The implications are huge..."

Make it timely and insider-knowledge focused:`,

      value_bomb: `Create high-value, actionable content that people want to save and share, making them follow for more valuable insights.

Requirements:
- Promise specific, actionable value
- Use numbers/specifics
- Include save/share trigger
- Tease thread or more content
- 280 characters max
- No hashtags

Examples:
"5 health metrics your doctor isn't checking (but should be). #3 predicted my patient's heart attack 2 years early. Save this thread..."

"The 30-second test that's more accurate than most expensive scans. I use this with every patient. Here's how to do it at home..."

"Free health tools that are better than $200/month apps. I've tested 50+ tools. These 3 actually work. Bookmark this..."

Make it valuable and actionable:`,

      story: `Create a compelling narrative that builds emotional connection and makes people want to follow for more stories.

Requirements:
- Start with compelling story hook
- Include emotional element
- Show transformation/revelation
- Connect to broader lesson
- 280 characters max
- No hashtags

Examples:
"The 90-year-old patient who taught me more than medical school. What she said about health changed everything I thought I knew..."

"This patient was 'hopeless' according to 5 doctors. 6 months later, they're running marathons. Here's what we did differently..."

"The day I realized everything I knew about medicine was wrong. A simple question from a child patient changed my entire approach..."

Make it emotionally compelling and transformative:`
    };

    const result = await this.openai.generateContent(
      prompts[type],
      'critical',
      'viral_follower_growth',
      { maxTokens: 200, temperature: 0.8 }
    );

    if (!result.success) {
      return this.getFallbackContent(type);
    }

    return result.content!;
  }

  /**
   * 🎯 SELECT VIRAL CONTENT TYPE
   */
  private selectViralContentType(): keyof typeof this.viralContentTypes {
    const random = Math.random();
    let cumulative = 0;
    
    for (const [type, config] of Object.entries(this.viralContentTypes)) {
      cumulative += config.weight;
      if (random < cumulative) {
        return type as keyof typeof this.viralContentTypes;
      }
    }
    
    return 'controversial'; // Default to most viral
  }

  /**
   * 📊 CALCULATE VIRAL POTENTIAL
   */
  private calculateViralPotential(content: string): number {
    let score = 0;
    
    // Controversial words boost viral potential
    const controversialWords = [
      'unpopular', 'hot take', 'nobody talks', 'wrong', 'shocking', 'secret',
      'mistake', 'scam', 'lie', 'truth', 'reality', 'plot twist'
    ];
    
    controversialWords.forEach(word => {
      if (content.toLowerCase().includes(word)) score += 10;
    });
    
    // Personal elements boost engagement
    const personalWords = [
      'i', 'me', 'my', 'years ago', 'patient', 'learned', 'realized',
      'changed', 'shocked', 'discovered'
    ];
    
    personalWords.forEach(word => {
      if (content.toLowerCase().includes(word)) score += 5;
    });
    
    // Specific numbers/details boost credibility
    const numberPattern = /\d+/g;
    const numbers = content.match(numberPattern);
    if (numbers) score += numbers.length * 3;
    
    // Questions boost engagement
    if (content.includes('?')) score += 8;
    
    // Cliffhangers boost follows
    const cliffhangers = ['here\'s what', 'here\'s why', 'what happened next', 'the secret'];
    cliffhangers.forEach(phrase => {
      if (content.toLowerCase().includes(phrase)) score += 15;
    });
    
    return Math.min(100, score);
  }

  /**
   * 🎯 EXTRACT ENGAGEMENT HOOKS
   */
  private extractEngagementHooks(content: string): string[] {
    const hooks: string[] = [];
    
    // Opening hooks
    const openingHooks = [
      'unpopular opinion', 'hot take', 'nobody talks', 'plot twist',
      'years ago', 'the day i', 'here\'s what', 'the secret'
    ];
    
    openingHooks.forEach(hook => {
      if (content.toLowerCase().includes(hook)) {
        hooks.push(`Opening: ${hook}`);
      }
    });
    
    // Emotional hooks
    const emotionalHooks = [
      'shocking', 'changed everything', 'wrong', 'mistake', 'learned',
      'realized', 'discovered', 'truth'
    ];
    
    emotionalHooks.forEach(hook => {
      if (content.toLowerCase().includes(hook)) {
        hooks.push(`Emotional: ${hook}`);
      }
    });
    
    return hooks;
  }

  /**
   * 👥 IDENTIFY FOLLOW TRIGGERS
   */
  private identifyFollowTriggers(content: string): string[] {
    const triggers: string[] = [];
    
    // Authority triggers
    if (content.includes('years') || content.includes('studied') || content.includes('research')) {
      triggers.push('Authority/Expertise');
    }
    
    // Insider knowledge triggers
    if (content.includes('secret') || content.includes('nobody talks') || content.includes('insider')) {
      triggers.push('Insider Knowledge');
    }
    
    // Controversy triggers
    if (content.includes('unpopular') || content.includes('hot take') || content.includes('wrong')) {
      triggers.push('Controversial Takes');
    }
    
    // Value triggers
    if (content.includes('how to') || content.includes('tools') || content.includes('tips')) {
      triggers.push('Valuable Content');
    }
    
    // Story triggers
    if (content.includes('patient') || content.includes('story') || content.includes('happened')) {
      triggers.push('Compelling Stories');
    }
    
    return triggers;
  }

  /**
   * 🚨 FALLBACK CONTENT
   */
  private getFallbackContent(type: keyof typeof this.viralContentTypes): string {
    const fallbacks = {
      controversial: "Unpopular opinion: Most health advice is designed to keep you sick, not healthy. The real science tells a different story...",
      personality: "3 years ago I thought I knew everything about health. One patient changed that forever. What they taught me shocked me...",
      trend_jack: "Everyone's talking about AI, but here's what they're missing about healthcare. The real revolution is happening quietly...",
      value_bomb: "5 health metrics your doctor never checks (but should). #3 saved my patient's life. Here's what to ask for...",
      story: "The patient who taught me more than medical school. What they said about healing changed everything I believed..."
    };
    
    return fallbacks[type];
  }

  /**
   * 📊 TRACK VIRAL PERFORMANCE
   */
  async trackViralPerformance(content: ViralContent, postId: string): Promise<void> {
    try {
      await supabaseClient.supabase?.from('viral_content_tracking').insert({
        post_id: postId,
        content_type: content.contentType,
        viral_potential: content.viralPotential,
        engagement_hooks: content.engagementHooks,
        follow_triggers: content.followTriggers,
        created_at: new Date().toISOString()
      });
      
      console.log(`📊 Tracked viral content: ${content.contentType} (${content.viralPotential}% viral potential)`);
    } catch (error) {
      console.warn('Failed to track viral performance:', error);
    }
  }
}

export const viralFollowerGrowthAgent = new ViralFollowerGrowthAgent(); 