/**
 * 🚀 FOLLOWER GROWTH CONTENT ENGINE
 * 
 * Specialized system for creating content that specifically drives follower growth
 * Focus: Viral health content that makes people think "I need to follow this account"
 */

import { getOpenAIService } from '../services/openAIService';
import { admin as supabase } from '../lib/supabaseClients';

interface FollowerGrowthContent {
  content: string | string[];
  contentType: 'news_reaction' | 'myth_buster' | 'insider_secret' | 'quick_tip' | 'question_bait' | 'controversy' | 'case_study';
  viralPotential: number; // 0-100
  followPotential: number; // 0-100 (how likely to gain followers)
  engagementType: 'shares' | 'saves' | 'replies' | 'likes';
  audience: 'fitness' | 'longevity' | 'nutrition' | 'mental_health' | 'biohacking';
  format: 'single' | 'thread';
}

export class FollowerGrowthContentEngine {
  private static instance: FollowerGrowthContentEngine;

  private constructor() {}

  public static getInstance(): FollowerGrowthContentEngine {
    if (!FollowerGrowthContentEngine.instance) {
      FollowerGrowthContentEngine.instance = new FollowerGrowthContentEngine();
    }
    return FollowerGrowthContentEngine.instance;
  }

  /**
   * 🎯 GENERATE HIGH-FOLLOW-POTENTIAL CONTENT
   */
  public async generateFollowerMagnetContent(context?: {
    trendingTopic?: string;
    targetAudience?: string;
    contentGoal?: 'viral' | 'authority' | 'engagement';
  }): Promise<FollowerGrowthContent> {

    const contentTypes = [
      {
        type: 'news_reaction' as const,
        prompt: this.getNewsReactionPrompt(context?.trendingTopic),
        followPotential: 85,
        description: 'Expert take on trending health news'
      },
      {
        type: 'myth_buster' as const,
        prompt: this.getMythBusterPrompt(),
        followPotential: 90,
        description: 'Debunk common health myths with shocking truth'
      },
      {
        type: 'insider_secret' as const,
        prompt: this.getInsiderSecretPrompt(),
        followPotential: 95,
        description: 'Exclusive knowledge from expensive courses/experts'
      },
      {
        type: 'quick_tip' as const,
        prompt: this.getQuickTipPrompt(),
        followPotential: 70,
        description: 'Instantly actionable health hack'
      },
      {
        type: 'question_bait' as const,
        prompt: this.getQuestionBaitPrompt(),
        followPotential: 75,
        description: 'Thought-provoking question that drives replies'
      },
      {
        type: 'controversy' as const,
        prompt: this.getControversyPrompt(),
        followPotential: 92,
        description: 'Contrarian take that challenges beliefs'
      },
      {
        type: 'case_study' as const,
        prompt: this.getCaseStudyPrompt(),
        followPotential: 80,
        description: 'Real transformation story with protocol'
      }
    ];

    // AI-driven content type selection based on performance data
    const selectedType = await this.selectOptimalContentType(contentTypes, context);
    
    console.log(`🎯 FOLLOWER_ENGINE: Generating ${selectedType.type} content (${selectedType.followPotential}% follow potential)`);

    const openaiService = getOpenAIService();
    
    try {
      const response = await openaiService.chatCompletion([
        {
          role: 'system',
          content: `You are a viral health influencer who gains 1000+ followers per post. Your content makes people think "Holy shit, I NEED to follow this account for more secrets like this!"

FOLLOWER PSYCHOLOGY:
- People follow accounts that share EXCLUSIVE knowledge they can't get elsewhere
- They want to feel like insiders getting privileged information
- They follow for content that makes them look smart when they share it
- They want immediate, actionable results they can try today

VIRAL CONTENT FORMULA:
1. Hook with shocking contradiction or exclusive angle
2. Reveal surprising mechanism most people don't know
3. Give exact protocol with specific numbers/timing
4. Explain why it works (physiological mechanism)
5. Add authority/credibility signal
6. End with subtle follow-worthy tease

OUTPUT REQUIREMENTS:
- Return valid JSON only
- Content must be 100-250 characters per tweet
- Include specific mechanisms, numbers, protocols
- Sound like exclusive insider knowledge
- No generic health advice or obvious tips`
        },
        {
          role: 'user',
          content: selectedType.prompt
        }
      ], {
        temperature: 0.8,
        maxTokens: 800,
        requestType: 'follower_growth_content'
      });

      const rawContent = response.content || response.choices?.[0]?.message?.content;
      if (!rawContent || rawContent.trim() === '') {
        console.error('❌ FOLLOWER_ENGINE: OpenAI returned empty response');
        console.error('🔍 DEBUG: Full response:', JSON.stringify(response, null, 2));
        
        // Try fallback content generation
        console.log('🔄 FOLLOWER_ENGINE: Attempting fallback content generation...');
        return this.generateFallbackContent(context?.trendingTopic || 'health optimization');
      }

      let generatedData;
      try {
        generatedData = JSON.parse(rawContent);
      } catch (parseError) {
        console.error('❌ FOLLOWER_ENGINE: JSON parse failed:', parseError);
        console.error('Raw content:', rawContent);
        throw new Error('Failed to parse OpenAI response as JSON');
      }

      // Validate that we have actual content
      if (!generatedData.content && !generatedData.tweets) {
        console.error('❌ FOLLOWER_ENGINE: No content or tweets in response:', generatedData);
        throw new Error('No content or tweets in parsed response');
      }
      
      return {
        content: generatedData.content || generatedData.tweets,
        contentType: selectedType.type,
        viralPotential: generatedData.viral_score || 85,
        followPotential: selectedType.followPotential,
        engagementType: generatedData.engagement_type || 'shares',
        audience: generatedData.audience || 'fitness',
        format: Array.isArray(generatedData.content || generatedData.tweets) ? 'thread' : 'single'
      };

    } catch (error) {
      console.error('❌ FOLLOWER_ENGINE: Content generation failed:', error);
      
      // Fallback to high-performing template
      return this.getFallbackContent(selectedType.type);
    }
  }

  /**
   * 📰 NEWS REACTION PROMPT - Expert take on trending topics
   */
  private getNewsReactionPrompt(trendingTopic?: string): string {
    const topic = trendingTopic || 'recent health study';
    
    return `Create expert commentary on this trending health topic: "${topic}"

ANGLE: Position yourself as the expert who can explain what others can't
HOOK: "Everyone's talking about [topic] but they're missing the most important part:"
STRUCTURE: 
1. What everyone got wrong about this news
2. The real mechanism/implication they missed  
3. Exact action people should take based on this
4. Why most people won't do it (but smart followers will)

Make people think: "Finally, someone who actually understands this stuff!"

Return JSON: {"content": ["tweet1", "tweet2", ...], "viral_score": 85, "engagement_type": "shares", "audience": "health_conscious"}`;
  }

  /**
   * 🔥 MYTH BUSTER PROMPT - Challenge popular beliefs
   */
  private getMythBusterPrompt(): string {
    const myths = [
      'drinking 8 glasses of water daily',
      'breakfast being the most important meal',
      'cardio being best for fat loss',
      'supplements being necessary for health',
      'eating late causing weight gain',
      'stretching preventing injury',
      'detox diets cleaning your body',
      'organic food being healthier'
    ];

    const selectedMyth = myths[Math.floor(Math.random() * myths.length)];

    return `Debunk this health myth: "${selectedMyth}"

VIRAL FORMULA:
HOOK: "95% of people believe [myth] but science proves it's completely wrong. Here's what actually works:"
STRUCTURE:
1. The shocking truth about why this myth is harmful
2. What actually happens in your body (mechanism)
3. The real protocol backed by research
4. Why doctors/experts don't correct this myth

Make it feel like exclusive knowledge that makes followers look smart.

Return JSON: {"content": ["tweet1", "tweet2", ...], "viral_score": 90, "engagement_type": "shares", "audience": "fitness"}`;
  }

  /**
   * 💎 INSIDER SECRET PROMPT - Exclusive expensive knowledge
   */
  private getInsiderSecretPrompt(): string {
    return `Share an expensive health secret that sounds like it came from a $5000 course.

INSIDER ANGLES:
- "Spent $20K learning this from top biohackers..."
- "This protocol is used by Navy SEALs but never published..."
- "Learned this from a $500/hour functional medicine doctor..."
- "Silicon Valley executives pay $10K/month for this..."

STRUCTURE:
1. Expensive source credibility
2. The secret technique/protocol
3. Exact implementation with numbers
4. Why it's not mainstream (big pharma, etc.)
5. Results timeline

Return JSON: {"content": "single tweet or thread", "viral_score": 95, "engagement_type": "saves", "audience": "biohacking"}`;
  }

  /**
   * ⚡ QUICK TIP PROMPT - Instantly actionable hack
   */
  private getQuickTipPrompt(): string {
    return `Create a 30-second health hack with immediate noticeable results.

REQUIREMENTS:
- Something people can try RIGHT NOW
- Results visible/felt within minutes or hours
- Specific instructions with exact timing/amounts
- Surprising mechanism most people don't know
- Hook: "Try this 30-second hack. You'll feel the difference immediately:"

EXAMPLES:
- Breathing technique for instant energy
- Food timing for better sleep
- Posture hack for pain relief
- Eye exercise for focus

Return JSON: {"content": "single tweet", "viral_score": 75, "engagement_type": "likes", "audience": "productivity"}`;
  }

  /**
   * ❓ QUESTION BAIT PROMPT - Drive engagement
   */
  private getQuestionBaitPrompt(): string {
    return `Create a health question that drives massive replies and engagement.

QUESTION TYPES:
- "What's the weirdest health hack that actually works for you?"
- "Which 'healthy' food do you think is secretly harmful?"
- "What health advice did you ignore that you wish you hadn't?"
- "What's one thing your doctor never told you that changed your health?"

Make it personal, controversial, and something everyone has an opinion on.

Return JSON: {"content": "single tweet question", "viral_score": 70, "engagement_type": "replies", "audience": "general"}`;
  }

  /**
   * 🔥 CONTROVERSY PROMPT - Contrarian take
   */
  private getControversyPrompt(): string {
    return `Create a contrarian health take that challenges mainstream advice.

CONTRARIAN ANGLES:
- "Everyone says [popular advice] but it's actually destroying your [health aspect]"
- "The supplement industry doesn't want you to know [truth]"
- "Your gym trainer is wrong about [fitness belief]"
- "Doctors recommend [common advice] but research shows [opposite]"

STRUCTURE:
1. Bold contrarian statement
2. Why mainstream advice is wrong
3. The real science/mechanism
4. What to do instead

Return JSON: {"content": ["tweet1", "tweet2", ...], "viral_score": 92, "engagement_type": "shares", "audience": "fitness"}`;
  }

  /**
   * 📚 CASE STUDY PROMPT - Transformation story
   */
  private getCaseStudyPrompt(): string {
    return `Create a transformation case study with exact protocol.

STORY STRUCTURE:
1. "Client came to me with [specific problem]"
2. "Tried everything: [list of failed attempts]"
3. "Then we discovered [unique insight/protocol]"
4. "Results: [specific improvements with numbers/timeline]"
5. "The protocol: [exact steps followers can copy]"

Make it feel real and replicable. Include specific data points.

Return JSON: {"content": ["tweet1", "tweet2", ...], "viral_score": 80, "engagement_type": "saves", "audience": "transformation"}`;
  }

  /**
   * 🎯 SELECT OPTIMAL CONTENT TYPE
   */
  private async selectOptimalContentType(
    contentTypes: any[], 
    context?: any
  ): Promise<any> {
    // For now, use simple weighted random selection
    // TODO: Integrate with learning data to select based on recent performance
    
    const weights = contentTypes.map(ct => ct.followPotential);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < contentTypes.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return contentTypes[i];
      }
    }
    
    return contentTypes[0]; // Fallback
  }

  /**
   * 🆘 FALLBACK CONTENT
   */
  private getFallbackContent(contentType: string): FollowerGrowthContent {
    const fallbacks = {
      news_reaction: "New study shows 8 glasses of water daily might be too much. Your kidneys can only process 0.8-1L per hour. Drinking more creates cellular stress and depletes electrolytes. Better: Drink to thirst + add sea salt.",
      myth_buster: "Everyone thinks breakfast is essential but Japanese studies show 16-hour fasting increases growth hormone by 300%. Your body enters repair mode after 12 hours fasted. Skip breakfast, gain metabolic flexibility.",
      insider_secret: "Navy SEALs use box breathing: 4 counts in, 4 hold, 4 out, 4 hold. Activates parasympathetic nervous system in 60 seconds. Reduces cortisol, improves decision-making under stress.",
      quick_tip: "Press your tongue to roof of mouth for 30 seconds. Activates vagus nerve, instantly reduces anxiety. Works because tongue pressure stimulates cranial nerve pathways to brain stem.",
      question_bait: "What's the weirdest health hack that actually works for you? Mine: Cold water on wrists drops body temp by 2°F in minutes. Wrists have superficial blood vessels that cool your entire circulatory system.",
      controversy: "Everyone says cardio burns fat but it actually makes you fatter long-term. Cardio increases cortisol, decreases muscle mass, slows metabolism. Strength training + walking burns more fat sustainably.",
      case_study: "Client lost 40lbs in 90 days without counting calories. Secret: Ate protein first at every meal. Protein increases thermic effect by 30%, reduces ghrelin hunger hormone. Simple but powerful protocol."
    };

    return {
      content: fallbacks[contentType as keyof typeof fallbacks] || fallbacks.quick_tip,
      contentType: contentType as any,
      viralPotential: 80,
      followPotential: 85,
      engagementType: 'likes',
      audience: 'fitness',
      format: 'single'
    };
  }

  /**
   * 📊 STORE PERFORMANCE DATA
   */
  public async storeContentPerformance(
    content: FollowerGrowthContent,
    performance: {
      likes: number;
      retweets: number;
      replies: number;
      followers_gained: number;
      engagement_rate: number;
    }
  ): Promise<void> {
    try {
      await supabase
        .from('follower_growth_content')
        .insert({
          content_type: content.contentType,
          content: typeof content.content === 'string' ? content.content : content.content.join(' || '),
          predicted_viral: content.viralPotential,
          predicted_follow: content.followPotential,
          actual_likes: performance.likes,
          actual_retweets: performance.retweets,
          actual_replies: performance.replies,
          followers_gained: performance.followers_gained,
          engagement_rate: performance.engagement_rate,
          format: content.format,
          audience: content.audience,
          created_at: new Date()
        });
      
      console.log('📊 FOLLOWER_ENGINE: Performance data stored for learning');
      
    } catch (error) {
      console.error('❌ FOLLOWER_ENGINE: Failed to store performance:', error);
    }
  }

  /**
   * Generate fallback content when OpenAI fails
   */
  private generateFallbackContent(topic: string): any {
    console.log('🚨 FOLLOWER_ENGINE: Using fallback content generation');
    
    const fallbackContent = [
      `Most people get ${topic} completely wrong. Here's what actually works:`,
      `The ${topic} industry doesn't want you to know this simple trick.`,
      `I discovered this ${topic} secret after 10 years of research.`,
      `This ${topic} method changed everything for my clients.`
    ];
    
    const selectedContent = fallbackContent[Math.floor(Math.random() * fallbackContent.length)];
    
    return {
      content: [selectedContent],
      viralPotential: 6,
      expectedFollowers: 10,
      strategy: 'Fallback Content',
      postingTime: 'immediate',
      reasoning: 'Fallback due to OpenAI API failure'
    };
  }
}

export const followerGrowthEngine = FollowerGrowthContentEngine.getInstance();
