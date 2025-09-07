/**
 * 🎭 HUMAN VOICE ENGINE
 * 
 * Creates authentic, data-driven content that sounds genuinely human
 * - Learns from engagement patterns to optimize voice
 * - Eliminates corporate/AI language patterns  
 * - Diverse content types with natural conversation flow
 * - No hashtags, purely conversational human style
 */

import { OpenAI } from 'openai';
import { admin as supabase } from '../lib/supabaseClients';

interface VoicePattern {
  id: string;
  pattern_type: 'opener' | 'transition' | 'insight' | 'story' | 'question' | 'observation';
  text_pattern: string;
  engagement_score: number;
  follower_conversion: number;
  usage_count: number;
  last_used: string;
}

interface ContentStyle {
  name: string;
  description: string;
  voice_patterns: string[];
  engagement_multiplier: number;
  frequency_weight: number;
}

interface HumanVoiceResult {
  content: string;
  style_used: string;
  voice_patterns_applied: string[];
  predicted_engagement: number;
  authenticity_score: number;
}

export class HumanVoiceEngine {
  private static instance: HumanVoiceEngine;
  private voicePatterns: VoicePattern[] = [];
  private contentStyles: ContentStyle[] = [];
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.initializeHumanStyles();
  }

  public static getInstance(): HumanVoiceEngine {
    if (!HumanVoiceEngine.instance) {
      HumanVoiceEngine.instance = new HumanVoiceEngine();
    }
    return HumanVoiceEngine.instance;
  }

  /**
   * 🎭 Initialize authentic human voice styles
   */
  private initializeHumanStyles(): void {
    this.contentStyles = [
      {
        name: 'research_enthusiast',
        description: 'Someone passionate about diving deep into health research',
        voice_patterns: [
          'Been diving deep into {topic} research and found something interesting',
          'The latest studies on {topic} show something most people miss',
          'Here\'s what the research actually says about {topic}',
          'Found this fascinating study on {topic} that changes everything',
          'The science behind {topic} is more complex than you think',
          'New research on {topic} contradicts what we thought we knew',
          'This {topic} study has implications nobody\'s talking about'
        ],
        engagement_multiplier: 1.8,
        frequency_weight: 0.25
      },
      {
        name: 'truth_seeker',
        description: 'Someone who cuts through health myths and misinformation',
        voice_patterns: [
          'Let\'s talk about the {topic} myths everyone believes',
          'The truth about {topic} is different than what you\'ve heard',
          'Here\'s what\'s really happening with {topic}',
          'Most advice about {topic} misses this crucial point',
          'The {topic} information you\'re getting is incomplete',
          'What they don\'t tell you about {topic}',
          'The reality of {topic} is more nuanced than people think'
        ],
        engagement_multiplier: 1.9,
        frequency_weight: 0.20
      },
      {
        name: 'practical_optimizer',
        description: 'Someone focused on actionable health improvements',
        voice_patterns: [
          'Here\'s a simple {topic} change that made a real difference',
          'This {topic} approach actually works - here\'s why',
          'Tried this {topic} method and the results surprised me',
          'Simple {topic} optimization that most people overlook',
          'This {topic} strategy is easier than you think',
          'Found a better way to approach {topic}',
          'This {topic} insight changed how I think about health'
        ],
        engagement_multiplier: 1.7,
        frequency_weight: 0.25
      },
      {
        name: 'curious_investigator',
        description: 'Someone who questions common health assumptions',
        voice_patterns: [
          'Ever wonder why {topic} advice varies so much?',
          'Something doesn\'t add up about {topic}',
          'Been questioning the standard advice on {topic}',
          'Why does everyone say different things about {topic}?',
          'The {topic} advice you hear everywhere might be wrong',
          'Started questioning everything I thought I knew about {topic}',
          'What if we\'ve been thinking about {topic} all wrong?'
        ],
        engagement_multiplier: 1.6,
        frequency_weight: 0.15
      },
      {
        name: 'evidence_based_advocate',
        description: 'Someone who focuses on evidence-based health information',
        voice_patterns: [
          'The evidence on {topic} tells a different story',
          'When you look at the actual data on {topic}',
          'The research on {topic} reveals something unexpected',
          'Evidence-based {topic} approach that actually works',
          'What the studies really show about {topic}',
          'The data on {topic} doesn\'t support what most people believe',
          'Here\'s what peer-reviewed research says about {topic}'
        ],
        engagement_multiplier: 1.8,
        frequency_weight: 0.15
      }
    ];
  }

  /**
   * 🧠 Load voice patterns from database with engagement data
   */
  private async loadVoicePatterns(): Promise<void> {
    try {
      // Using imported supabase admin client
      const { data, error } = await supabase
        .from('voice_patterns')
        .select('*')
        .order('engagement_score', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('⚠️ VOICE_ENGINE: Failed to load patterns, using defaults');
        return;
      }

      if (data && data.length > 0) {
        this.voicePatterns = data;
        console.log(`✅ VOICE_ENGINE: Loaded ${data.length} voice patterns from learning data`);
      }
    } catch (error) {
      console.warn('⚠️ VOICE_ENGINE: Pattern loading failed, using defaults');
    }
  }

  /**
   * 🎯 Select optimal content style based on engagement data
   */
  private selectOptimalStyle(): ContentStyle {
    // Weight selection based on performance data
    const totalWeight = this.contentStyles.reduce((sum, style) => 
      sum + (style.frequency_weight * style.engagement_multiplier), 0
    );

    let randomValue = Math.random() * totalWeight;
    
    for (const style of this.contentStyles) {
      randomValue -= (style.frequency_weight * style.engagement_multiplier);
      if (randomValue <= 0) {
        return style;
      }
    }

    return this.contentStyles[0]; // fallback
  }

  /**
   * 🎭 Generate authentic human voice content
   */
  public async generateHumanContent(params: {
    topic: string;
    format: 'single' | 'thread';
    context?: string;
    targetLength?: number;
  }): Promise<HumanVoiceResult> {
    console.log(`🎭 HUMAN_VOICE: Generating ${params.format} content about "${params.topic}"`);

    await this.loadVoicePatterns();
    const selectedStyle = this.selectOptimalStyle();

    const humanPrompt = this.buildHumanPrompt(params, selectedStyle);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getHumanSystemPrompt()
          },
          {
            role: 'user',
            content: humanPrompt
          }
        ],
        temperature: 0.9, // Higher creativity for more human variation
        max_tokens: params.format === 'thread' ? 1500 : 400,
        presence_penalty: 0.6, // Encourage novel expressions
        frequency_penalty: 0.8 // Avoid repetitive language
      });

      const generatedContent = response.choices[0]?.message?.content || '';
      
      // Calculate authenticity score based on human indicators
      const authenticityScore = this.calculateAuthenticityScore(generatedContent);
      
      // Predict engagement based on style and patterns
      const predictedEngagement = this.predictEngagement(generatedContent, selectedStyle);

      // Extract voice patterns that were applied
      const appliedPatterns = this.extractAppliedPatterns(generatedContent, selectedStyle);

      const result: HumanVoiceResult = {
        content: generatedContent,
        style_used: selectedStyle.name,
        voice_patterns_applied: appliedPatterns,
        predicted_engagement: predictedEngagement,
        authenticity_score: authenticityScore
      };

      console.log(`✅ HUMAN_VOICE: Generated ${selectedStyle.name} style content`);
      console.log(`🎯 Authenticity: ${authenticityScore}% | Predicted engagement: ${predictedEngagement}`);

      return result;

    } catch (error) {
      console.error('❌ HUMAN_VOICE_ERROR:', error);
      throw new Error(`Human voice generation failed: ${error}`);
    }
  }

  /**
   * 🎯 System prompt for authentic human voice
   */
  private getHumanSystemPrompt(): string {
    return `You are a real person sharing genuine insights about health and wellness. Write like you're texting a close friend who shares your interests.

AUTHENTIC HUMAN VOICE RULES:
✅ Write like you're genuinely curious and sharing discoveries
✅ Use natural, conversational language with personality
✅ Share personal observations and "aha moments"
✅ Include specific details that show real experience
✅ Sound like someone who actually tried things and learned
✅ Use contractions, casual language, incomplete thoughts sometimes
✅ Express genuine surprise, skepticism, or excitement

❌ BANNED AI/CORPORATE LANGUAGE:
- "Many people struggle with..." (fake concern)
- "It's important to..." (preachy tone)
- "Research shows..." (academic voice)
- "boost energy and focus" (generic benefits)
- "journey to wellness" (buzzword fluff)
- "game-changer" "life-hack" "optimize" (overused terms)
- ANY hashtags or emojis
- "dive deep" "let's explore" (AI tells)
- "small changes make big differences" (cliche)

VOICE PATTERNS TO USE:
- Personal discoveries: "I noticed..." "Realized..." "Found out..."
- Casual observations: "Weird thing about..." "Never knew that..."
- Real experiences: "Been doing this..." "Tried it for..." "Works for me..."
- Honest reactions: "Skeptical at first..." "Surprised me..." "Who knew..."
- Friend-to-friend: "You know how..." "Remember when..." "Think about it..."

CONTENT SHOULD FEEL LIKE:
- A text message to a friend who gets it
- Someone who actually experiments and learns
- Natural curiosity and genuine insights
- Real person, not content creator or influencer

NO HASHTAGS. NO EMOJIS. NO CORPORATE SPEAK. Just genuine human voice.`;
  }

  /**
   * 📝 Build human-style prompt
   */
  private buildHumanPrompt(params: any, style: ContentStyle): string {
    const voiceExample = style.voice_patterns[Math.floor(Math.random() * style.voice_patterns.length)]
      .replace('{topic}', params.topic);

    return `Write ${params.format === 'single' ? 'a single tweet (240 chars max)' : 'a 4-6 tweet thread'} about: ${params.topic}

VOICE STYLE: ${style.description}
VOICE EXAMPLE: "${voiceExample}"

REQUIREMENTS:
- Sound like ${style.description}
- NO hashtags, NO emojis, NO corporate language
- Natural conversational flow
- Specific, actionable insights
- Personal touch and authenticity
- ${params.format === 'thread' ? 'Each tweet 100-240 characters' : 'Single tweet under 240 characters'}

${params.context ? `CONTEXT: ${params.context}` : ''}

Write content that sounds like a real person genuinely sharing something interesting they discovered.`;
  }

  /**
   * 🔍 Calculate authenticity score
   */
  private calculateAuthenticityScore(content: string): number {
    let score = 100;

    // Deduct for AI/corporate language patterns
    const corporatePatterns = [
      /many people/i, /it's important/i, /research shows/i, /boost energy/i,
      /journey to/i, /game.?changer/i, /life.?hack/i, /optimize/i, /dive deep/i,
      /let's explore/i, /#\w+/, /small changes make/i, /wellness journey/i
    ];

    const personalPatterns = [
      /I noticed/i, /I realized/i, /been doing/i, /tried it/i, /found out/i,
      /weird thing/i, /never knew/i, /who knew/i, /think about/i, /you know how/i
    ];

    // Deduct for corporate patterns
    corporatePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score -= 15;
      }
    });

    // Add for personal patterns
    personalPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        score += 5;
      }
    });

    // Deduct for hashtags
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    score -= hashtagCount * 20;

    // Check for contractions (more human)
    const contractions = /\b(don't|won't|can't|isn't|wasn't|haven't|wouldn't|shouldn't)\b/gi;
    const contractionCount = (content.match(contractions) || []).length;
    score += contractionCount * 3;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 📊 Predict engagement based on patterns
   */
  private predictEngagement(content: string, style: ContentStyle): number {
    let baseScore = 20; // Base engagement prediction

    // Apply style multiplier
    baseScore *= style.engagement_multiplier;

    // Check for high-engagement patterns
    const highEngagementPatterns = [
      /never knew/i, /weird thing/i, /nobody talks about/i, /industry secret/i,
      /tried.*for.*days/i, /changed my mind/i, /the hard way/i
    ];

    highEngagementPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        baseScore += 10;
      }
    });

    // Length optimization (Twitter sweet spots)
    const contentLength = content.length;
    if (contentLength >= 140 && contentLength <= 200) {
      baseScore += 5; // Optimal length bonus
    }

    // Question bonus (engagement driver)
    if (content.includes('?')) {
      baseScore += 8;
    }

    // Specificity bonus (numbers, percentages, timeframes)
    const specificityPatterns = /\b\d+(\.\d+)?%|\b\d+\s+(days?|weeks?|months?|years?)|\b\d+x\b/g;
    const specificityCount = (content.match(specificityPatterns) || []).length;
    baseScore += specificityCount * 5;

    return Math.round(Math.min(100, baseScore));
  }

  /**
   * 🔍 Extract applied voice patterns
   */
  private extractAppliedPatterns(content: string, style: ContentStyle): string[] {
    const appliedPatterns: string[] = [];

    style.voice_patterns.forEach(pattern => {
      const patternRegex = new RegExp(pattern.replace('{topic}', '.*'), 'i');
      if (patternRegex.test(content)) {
        appliedPatterns.push(pattern);
      }
    });

    return appliedPatterns;
  }

  /**
   * 📊 Record performance for learning
   */
  public async recordPerformance(content: string, engagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    followers_gained: number;
  }): Promise<void> {
    try {
      // Using imported supabase admin client
      
      const engagementRate = engagement.impressions > 0 
        ? (engagement.likes + engagement.retweets + engagement.replies) / engagement.impressions 
        : 0;

      const followerConversion = engagement.impressions > 0
        ? engagement.followers_gained / engagement.impressions
        : 0;

      await supabase.from('human_voice_performance').insert({
        content,
        engagement_rate: engagementRate,
        follower_conversion: followerConversion,
        likes: engagement.likes,
        retweets: engagement.retweets,
        replies: engagement.replies,
        impressions: engagement.impressions,
        followers_gained: engagement.followers_gained,
        created_at: new Date().toISOString()
      });

      console.log(`📊 HUMAN_VOICE: Recorded performance data for learning`);
    } catch (error) {
      console.warn('⚠️ HUMAN_VOICE: Failed to record performance:', error);
    }
  }

  /**
   * 🧠 Update voice patterns based on performance
   */
  public async updateVoicePatternsFromData(): Promise<void> {
    try {
      // Using imported supabase admin client
      
      // Get high-performing content for pattern extraction
      const { data: highPerformers } = await supabase
        .from('human_voice_performance')
        .select('content, engagement_rate, follower_conversion')
        .gte('engagement_rate', 0.05) // 5%+ engagement rate
        .gte('follower_conversion', 0.001) // 0.1%+ follower conversion
        .order('follower_conversion', { ascending: false })
        .limit(20);

      if (highPerformers && highPerformers.length > 0) {
        console.log(`🧠 HUMAN_VOICE: Analyzing ${highPerformers.length} high-performing posts for patterns`);
        
        // Extract successful patterns and update frequency weights
        this.analyzeSuccessfulPatterns(highPerformers);
        
        console.log(`✅ HUMAN_VOICE: Updated voice patterns based on performance data`);
      }
    } catch (error) {
      console.warn('⚠️ HUMAN_VOICE: Pattern update failed:', error);
    }
  }

  /**
   * 🔍 Analyze successful content patterns
   */
  private analyzeSuccessfulPatterns(highPerformers: any[]): void {
    const patternSuccessMap = new Map<string, { count: number; avgEngagement: number }>();

    highPerformers.forEach(post => {
      this.contentStyles.forEach(style => {
        style.voice_patterns.forEach(pattern => {
          const patternRegex = new RegExp(pattern.replace('{topic}', '.*'), 'i');
          if (patternRegex.test(post.content)) {
            const existing = patternSuccessMap.get(pattern) || { count: 0, avgEngagement: 0 };
            existing.count++;
            existing.avgEngagement = (existing.avgEngagement + post.engagement_rate) / 2;
            patternSuccessMap.set(pattern, existing);
          }
        });
      });
    });

    // Update style weights based on successful patterns
    this.contentStyles.forEach(style => {
      let styleSuccessScore = 0;
      let patternCount = 0;

      style.voice_patterns.forEach(pattern => {
        const success = patternSuccessMap.get(pattern);
        if (success) {
          styleSuccessScore += success.avgEngagement * success.count;
          patternCount++;
        }
      });

      if (patternCount > 0) {
        const avgSuccess = styleSuccessScore / patternCount;
        // Gradually adjust frequency weights based on performance
        style.frequency_weight = Math.min(0.5, Math.max(0.1, style.frequency_weight + (avgSuccess * 0.1)));
        style.engagement_multiplier = Math.min(2.0, Math.max(0.8, style.engagement_multiplier + (avgSuccess * 0.2)));
      }
    });

    console.log(`🎯 HUMAN_VOICE: Updated ${this.contentStyles.length} style weights based on performance`);
  }
}
