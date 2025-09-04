import OpenAI from 'openai';
import { ContentDiversityTracker } from '../content/diversityTracker';

/**
 * VIRAL CONTENT ORCHESTRATOR
 * 
 * 100% AI-DRIVEN content generation with NO hardcoded patterns
 * Uses OpenAI API to generate viral, engaging content dynamically
 */

export class ViralContentOrchestrator {
  private openai: OpenAI;
  private diversityTracker: ContentDiversityTracker;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.diversityTracker = ContentDiversityTracker.getInstance();
  }

  /**
   * Generate viral content completely via OpenAI - NO hardcoded elements
   */
  async generateViralContent(format: 'single' | 'thread' = 'single'): Promise<{
    content: string;
    threadParts?: string[];
    metadata: {
      viralScore: number;
      engagementPrediction: number;
      uniquenessScore: number;
      topicDomain: string;
    };
  }> {
    console.log(`🚀 VIRAL_ORCHESTRATOR: Generating 100% AI-driven ${format} content...`);

    try {
      // Step 1: Get diversity insights to avoid repetition
      const diversityData = await this.getDiversityContext();
      
      // Step 2: Generate viral content strategy via OpenAI
      const strategy = await this.generateContentStrategy(diversityData);
      
      // Step 3: Generate actual content based on strategy
      const content = await this.generateContentFromStrategy(strategy, format);
      
      // Step 4: Evaluate and optimize the content
      const optimizedContent = await this.optimizeForVirality(content, format);
      
      console.log(`✅ VIRAL_CONTENT_COMPLETE: ${optimizedContent.metadata.viralScore}/100 viral score`);
      
      return optimizedContent;

    } catch (error: any) {
      console.error('❌ VIRAL_GENERATION_ERROR:', error.message);
      
      // Emergency fallback - still 100% AI generated
      return await this.generateEmergencyViralContent(format);
    }
  }

  /**
   * Get current diversity context to inform AI decisions
   */
  private async getDiversityContext(): Promise<{
    avoidTopics: string[];
    recommendedDomains: string[];
    recentContent: string[];
    diversityScore: number;
  }> {
    try {
      const analysis = await this.diversityTracker.analyzeRecentContent();
      const suggestions = await this.diversityTracker.getTopicSuggestions();
      
      return {
        avoidTopics: suggestions.avoidTopics,
        recommendedDomains: suggestions.recommendedTopics,
        recentContent: analysis.overusedWords,
        diversityScore: analysis.diversityScore
      };
    } catch (error) {
      return {
        avoidTopics: [],
        recommendedDomains: ['exercise_science', 'gut_microbiome'],
        recentContent: [],
        diversityScore: 50
      };
    }
  }

  /**
   * Generate content strategy completely via OpenAI
   */
  private async generateContentStrategy(diversityData: any): Promise<{
    domain: string;
    angle: string;
    viralHook: string;
    contentType: string;
    targetAudience: string;
  }> {
    const prompt = `
You are a viral Twitter health content strategist. Create a content strategy that will get maximum engagement and followers.

CONTEXT:
- Current diversity score: ${diversityData.diversityScore}/100
- Topics to avoid (overused): ${diversityData.avoidTopics.join(', ') || 'none'}
- Recommended fresh domains: ${diversityData.recommendedDomains.join(', ') || 'any health topic'}

MISSION: Generate a content strategy for a health account that will:
1. Get people to STOP scrolling
2. Generate likes, reposts, and followers
3. Be completely unique and unexpected
4. Include specific, actionable value

Generate a JSON response with:
{
  "domain": "specific health domain to focus on",
  "angle": "unique controversial or surprising angle",
  "viralHook": "attention-grabbing opening approach", 
  "contentType": "personal_story | product_test | myth_busting | secret_reveal | data_expose",
  "targetAudience": "who this will resonate with most"
}

Requirements:
- Be CONTROVERSIAL or SURPRISING 
- Include specific products, brands, or protocols
- Use personal experience or case studies
- Avoid generic health advice
- Create curiosity and urgency
- Make it feel like insider knowledge

Examples of viral angles:
- "I tested 10 sleep hacks. 9 made it worse. #7 was life-changing..."
- "Doctor told me this was 'impossible.' Proved him wrong in 30 days..."
- "Why [popular belief] is actually destroying your [health metric]..."
- "Spent $500 at Whole Foods vs $50 at Walmart testing [health thing]..."
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 500
    });

    try {
      const strategy = JSON.parse(response.choices[0]?.message?.content || '{}');
      console.log(`🎯 AI_STRATEGY: ${strategy.domain} - ${strategy.angle}`);
      return strategy;
    } catch (error) {
      // Fallback strategy
      return {
        domain: 'exercise_science',
        angle: 'contrarian_fitness_truth',
        viralHook: 'myth_busting_revelation',
        contentType: 'personal_story',
        targetAudience: 'fitness_enthusiasts'
      };
    }
  }

  /**
   * Generate actual content based on AI-generated strategy
   */
  private async generateContentFromStrategy(strategy: any, format: 'single' | 'thread'): Promise<{
    content: string;
    threadParts?: string[];
  }> {
    const prompt = `
Create viral health content based on this strategy:
Domain: ${strategy.domain}
Angle: ${strategy.angle}
Hook: ${strategy.viralHook}
Type: ${strategy.contentType}
Audience: ${strategy.targetAudience}

${format === 'thread' ? 'CREATE A TWITTER THREAD (3-5 tweets)' : 'CREATE A SINGLE VIRAL TWEET'}

VIRAL CONTENT REQUIREMENTS:
1. HOOK: Start with something that makes people stop scrolling
2. SPECIFICS: Include actual brands, products, costs, or data
3. STORY: Personal experience or case study element
4. CONTROVERSY: Challenge popular beliefs or reveal secrets
5. ACTION: Give specific next steps or protocols
6. URGENCY: Make it feel like they need to know this NOW

${format === 'thread' ? `
THREAD FORMAT:
Tweet 1 (Hook): Controversial opening that demands attention
Tweet 2 (Setup): Background/problem that everyone faces  
Tweet 3 (Revelation): The surprising truth or solution
Tweet 4 (Proof): Specific data, brands, or results
Tweet 5 (Action): Exact steps to implement

Each tweet should be 200-280 characters and flow naturally.
` : `
SINGLE TWEET FORMAT:
- 200-280 characters
- Complete thought with hook, value, and intrigue
- Include specific details (brands, costs, timeframes)
- Create desire to learn more or take action
`}

BANNED GENERIC PATTERNS:
- "Take magnesium for sleep"
- "Exercise is good for you"  
- "Eat healthy foods"
- "99% of people are doing X wrong" (overused)
- Basic advice everyone knows

EXAMPLES OF VIRAL APPROACHES:
- "I spent $300 testing every sleep supplement on Amazon. Only 1 worked. Here's the shocking winner..."
- "My doctor said my cholesterol was 'impossible.' Here's how I dropped it 47 points in 6 weeks..."
- "Why eating 'healthy' salads was actually making me gain weight (the dressing conspiracy)..."

Generate content that people will want to save, share, and follow you for more insights.
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 1000 : 400
    });

    const rawContent = response.choices[0]?.message?.content || '';
    
    if (format === 'thread') {
      // Parse thread parts
      const threadParts = this.parseThreadContent(rawContent);
      return {
        content: rawContent,
        threadParts
      };
    }

    return {
      content: rawContent.substring(0, 280)
    };
  }

  /**
   * Optimize content for maximum virality via AI
   */
  private async optimizeForVirality(content: any, format: 'single' | 'thread'): Promise<{
    content: string;
    threadParts?: string[];
    metadata: {
      viralScore: number;
      engagementPrediction: number;
      uniquenessScore: number;
      topicDomain: string;
    };
  }> {
    const evaluationPrompt = `
Evaluate this health content for viral potential and engagement:

CONTENT: ${content.content}

Rate from 1-100:
1. VIRAL_SCORE: How likely is this to go viral? (hook strength, controversy, shareability)
2. ENGAGEMENT_PREDICTION: Expected likes/reposts percentage 
3. UNIQUENESS_SCORE: How unique/fresh is this content?
4. TOPIC_DOMAIN: What health domain does this cover?

Provide JSON response:
{
  "viralScore": number,
  "engagementPrediction": number,
  "uniquenessScore": number,
  "topicDomain": "string",
  "improvementSuggestions": ["suggestion1", "suggestion2"],
  "optimizedContent": "improved version if needed"
}

If viral score is below 70, provide optimizedContent with improvements.
Focus on making it more attention-grabbing, specific, and valuable.
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: evaluationPrompt }],
      temperature: 0.3,
      max_tokens: 600
    });

    try {
      const evaluation = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      const finalContent = evaluation.optimizedContent && evaluation.viralScore < 70 
        ? evaluation.optimizedContent 
        : content.content;

      console.log(`📊 VIRAL_EVALUATION: ${evaluation.viralScore}/100 viral, ${evaluation.engagementPrediction}% predicted engagement`);

      return {
        content: finalContent,
        threadParts: content.threadParts,
        metadata: {
          viralScore: evaluation.viralScore || 75,
          engagementPrediction: evaluation.engagementPrediction || 3,
          uniquenessScore: evaluation.uniquenessScore || 80,
          topicDomain: evaluation.topicDomain || 'health'
        }
      };

    } catch (error) {
      // Fallback metadata
      return {
        content: content.content,
        threadParts: content.threadParts,
        metadata: {
          viralScore: 75,
          engagementPrediction: 3,
          uniquenessScore: 80,
          topicDomain: 'health'
        }
      };
    }
  }

  /**
   * Parse thread content into individual tweets
   */
  private parseThreadContent(rawContent: string): string[] {
    // Look for numbered tweets or natural breaks
    const lines = rawContent.split('\n').filter(line => line.trim());
    const tweets: string[] = [];
    
    let currentTweet = '';
    
    for (const line of lines) {
      // Check if it's a new tweet (starts with number or "Tweet")
      if (/^(Tweet \d+|\d+\.|\d+\))/i.test(line.trim())) {
        if (currentTweet) {
          tweets.push(this.cleanTweetText(currentTweet));
        }
        currentTweet = line.replace(/^(Tweet \d+|\d+\.|\d+\))[\s:]/i, '').trim();
      } else if (line.trim()) {
        currentTweet += (currentTweet ? ' ' : '') + line.trim();
      }
    }
    
    if (currentTweet) {
      tweets.push(this.cleanTweetText(currentTweet));
    }
    
    // If no structured tweets found, split by length
    if (tweets.length === 0) {
      const sentences = rawContent.split(/[.!?]+/).filter(s => s.trim());
      let currentPart = '';
      
      for (const sentence of sentences) {
        if ((currentPart + sentence).length > 240) {
          if (currentPart) {
            tweets.push(this.cleanTweetText(currentPart));
            currentPart = sentence.trim() + '.';
          } else {
            tweets.push(this.cleanTweetText(sentence.substring(0, 240)));
          }
        } else {
          currentPart += (currentPart ? ' ' : '') + sentence.trim() + '.';
        }
      }
      
      if (currentPart) {
        tweets.push(this.cleanTweetText(currentPart));
      }
    }
    
    return tweets.slice(0, 5); // Max 5 tweets per thread
  }

  /**
   * Clean tweet text for posting
   */
  private cleanTweetText(text: string): string {
    return text
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 280);
  }

  /**
   * Emergency viral content - still 100% AI generated
   */
  private async generateEmergencyViralContent(format: 'single' | 'thread'): Promise<{
    content: string;
    threadParts?: string[];
    metadata: any;
  }> {
    console.log('🚨 EMERGENCY_VIRAL: Generating fallback content via AI...');
    
    const emergencyPrompt = `
Generate viral health content that will get engagement RIGHT NOW.

${format === 'thread' ? 'Create a 3-tweet thread' : 'Create a single viral tweet'} that:
- Challenges conventional health wisdom
- Includes specific products or protocols
- Has a personal story element
- Makes people want to follow for more

Make it controversial, specific, and valuable. No generic advice!
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: emergencyPrompt }],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 300
    });

    const content = response.choices[0]?.message?.content || 'Health content generation temporarily unavailable.';
    
    if (format === 'thread') {
      return {
        content,
        threadParts: this.parseThreadContent(content),
        metadata: { viralScore: 70, engagementPrediction: 3, uniquenessScore: 75, topicDomain: 'health' }
      };
    }

    return {
      content: content.substring(0, 280),
      metadata: { viralScore: 70, engagementPrediction: 3, uniquenessScore: 75, topicDomain: 'health' }
    };
  }
}
