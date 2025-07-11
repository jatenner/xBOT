/**
 * 🔥 VIRAL HEALTH THEME PAGE AGENT
 * 
 * Transforms the bot into a high-engagement health theme page.
 * Focus: Building massive audience through viral health content.
 * 
 * Content Strategy:
 * - Viral health tips and facts
 * - Breaking health news reactions
 * - Motivational health content
 * - Educational but accessible content
 * - Trending health topics
 * - Audience engagement tactics
 */

import { getBudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { supabaseClient } from '../utils/supabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';

export interface ViralHealthContent {
  content: string;
  contentType: 'health_tip' | 'breaking_news' | 'motivation' | 'fact' | 'trend_reaction' | 'educational';
  engagementHook: string;
  hashtags: string[];
  expectedEngagement: 'high' | 'medium' | 'viral';
  audienceTarget: 'general' | 'health_conscious' | 'trending';
}

export class ViralHealthThemeAgent {
  private openai = getBudgetAwareOpenAI();

  /**
   * 🔥 GENERATE VIRAL HEALTH CONTENT
   */
  async generateViralHealthContent(): Promise<ViralHealthContent> {
    try {
      // Check budget first
      await emergencyBudgetLockdown.enforceBeforeAICall('viral_health_content');

      // Get trending health topics
      const trendingTopics = await this.getTrendingHealthTopics();
      
      // Select content type based on engagement strategy
      const contentType = this.selectViralContentType();
      
      // Generate viral content
      const content = await this.createViralContent(contentType, trendingTopics);
      
      return content;

    } catch (error) {
      console.error('❌ Viral health content generation failed:', error);
      return this.getFallbackViralContent();
    }
  }

  /**
   * 🎯 SELECT VIRAL CONTENT TYPE
   */
  private selectViralContentType(): ViralHealthContent['contentType'] {
    const contentTypes: ViralHealthContent['contentType'][] = [
      'health_tip',     // 30% - "Did you know..."
      'breaking_news',  // 20% - "BREAKING:"
      'motivation',     // 20% - "Your health journey..."
      'fact',          // 15% - "Health fact that will blow your mind:"
      'trend_reaction', // 10% - "Everyone's talking about..."
      'educational'     // 5%  - "Here's why..."
    ];

    const weights = [30, 20, 20, 15, 10, 5];
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < contentTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return contentTypes[i];
      }
    }

    return 'health_tip'; // fallback
  }

  /**
   * 🔥 CREATE VIRAL CONTENT
   */
  private async createViralContent(
    contentType: ViralHealthContent['contentType'],
    trendingTopics: string[]
  ): Promise<ViralHealthContent> {
    const templates = this.getViralTemplates(contentType);
    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

    // Generate content using AI
    const prompt = this.buildViralPrompt(contentType, selectedTemplate, trendingTopics);
    
    const result = await this.openai.generateContent(
      prompt,
      'critical',
      'viral_health_content',
      { maxTokens: 150, temperature: 0.8 }
    );

    if (!result.success) {
      throw new Error('AI content generation failed');
    }

    // Extract content and create engagement elements
    const generatedContent = result.content!;
    const hashtags = this.generateEngagementHashtags(contentType, generatedContent);
    const hook = this.extractEngagementHook(generatedContent);

    return {
      content: generatedContent,
      contentType,
      engagementHook: hook,
      hashtags,
      expectedEngagement: this.calculateExpectedEngagement(contentType, generatedContent),
      audienceTarget: this.determineAudienceTarget(contentType)
    };
  }

  /**
   * 🎯 VIRAL CONTENT TEMPLATES
   */
  private getViralTemplates(contentType: ViralHealthContent['contentType']): string[] {
    const templates = {
      health_tip: [
        "💡 Health tip that changed my life: {tip}. Try this for 7 days and thank me later! 🙌",
        "🔥 Doctor's secret: {tip}. Most people don't know this simple trick! 👀",
        "✨ Did you know? {tip}. This will revolutionize your health routine! 💪",
        "🚨 Health hack alert: {tip}. Save this post - you'll need it! 📌",
        "⚡ Game-changer: {tip}. Why isn't everyone doing this? 🤔"
      ],
      breaking_news: [
        "🚨 BREAKING: New study reveals {news}. This changes everything! 📰",
        "📢 JUST IN: Scientists discover {news}. The health world is buzzing! 🔬",
        "⚡ TRENDING: {news} - and here's what it means for YOU! 👆",
        "🔥 VIRAL: Everyone's talking about {news}. Here's the real story: 📊",
        "💥 BOMBSHELL: {news}. Healthcare will never be the same! 🏥"
      ],
      motivation: [
        "💪 Your health journey reminder: {motivation}. You've got this! 🌟",
        "🌅 Monday motivation: {motivation}. Who's ready to level up? 🚀",
        "✨ Gentle reminder: {motivation}. Your future self will thank you! 💝",
        "🔥 Real talk: {motivation}. Stop making excuses, start making progress! 💯",
        "🌟 You need to hear this: {motivation}. Believe in yourself! 💖"
      ],
      fact: [
        "🤯 Mind-blowing health fact: {fact}. I can't believe this is real! 😱",
        "📚 Health fact that will amaze you: {fact}. Science is incredible! 🧬",
        "💡 Fact check: {fact}. Tag someone who needs to see this! 👇",
        "🔍 Hidden health truth: {fact}. Most doctors won't tell you this! 🤐",
        "⚡ Plot twist: {fact}. Everything you thought you knew... 🤔"
      ],
      trend_reaction: [
        "👀 Everyone's obsessed with {trend}, but here's what they're missing: {reaction} 🧵",
        "🔥 {trend} is trending, but let's talk about the real benefits: {reaction} 💯",
        "📱 Seeing {trend} everywhere? Here's the science behind it: {reaction} 🔬",
        "🤔 Hot take on {trend}: {reaction}. Agree or disagree? 💬",
        "⚡ {trend} explained: {reaction}. Save this for later! 📌"
      ],
      educational: [
        "📖 Health Education 101: {education}. Knowledge is power! 💪",
        "🧠 Let's break it down: {education}. Science made simple! 🔬",
        "📚 Health myth vs reality: {education}. The truth might surprise you! 😮",
        "🎓 Today's lesson: {education}. Your body will thank you! 💝",
        "💡 Health IQ boost: {education}. Share to spread awareness! 🌍"
      ]
    };

    return templates[contentType] || templates.health_tip;
  }

  /**
   * 🎯 BUILD VIRAL PROMPT
   */
  private buildViralPrompt(
    contentType: ViralHealthContent['contentType'],
    template: string,
    trendingTopics: string[]
  ): string {
    const trendingContext = trendingTopics.length > 0 
      ? `Current trending health topics: ${trendingTopics.join(', ')}`
      : '';

    const prompts = {
      health_tip: `Create a viral health tip that's practical, actionable, and surprising. Focus on something people can do TODAY. Make it shareable and engaging. ${trendingContext}

Template: ${template}

Requirements:
- Make it relatable to everyone
- Include specific, actionable advice
- Use engaging language that builds excitement
- Keep it under 200 characters for maximum shareability
- Focus on immediate benefits people can feel`,

      breaking_news: `Create content reacting to recent health news or studies. Make it feel urgent and important while being accurate. ${trendingContext}

Template: ${template}

Requirements:
- Reference a real or realistic health development
- Explain why it matters to regular people
- Create urgency without fear-mongering
- Make complex science accessible
- End with actionable takeaway`,

      motivation: `Create motivational health content that inspires action. Focus on overcoming common health challenges. ${trendingContext}

Template: ${template}

Requirements:
- Address common health struggles
- Be genuinely inspiring, not preachy
- Include relatable scenarios
- Encourage small, achievable steps
- Build confidence and hope`,

      fact: `Share an amazing, lesser-known health fact that will surprise people. Make it memorable and shareable. ${trendingContext}

Template: ${template}

Requirements:
- Share something genuinely surprising
- Make it easy to understand
- Include why it matters
- Make people want to share it
- Back it up with credible science`,

      trend_reaction: `React to a current health trend or viral health topic. Provide valuable insight or corrections. ${trendingContext}

Template: ${template}

Requirements:
- Reference a realistic current trend
- Provide expert-level insight
- Correct misconceptions if needed
- Add value beyond the trend
- Make people think differently`,

      educational: `Teach something valuable about health in an engaging way. Make complex topics simple. ${trendingContext}

Template: ${template}

Requirements:
- Simplify complex health concepts
- Use analogies people understand
- Provide practical applications
- Make learning fun and engaging
- Include memorable takeaways`
    };

    return prompts[contentType] || prompts.health_tip;
  }

  /**
   * 📊 GET TRENDING HEALTH TOPICS
   */
  private async getTrendingHealthTopics(): Promise<string[]> {
    try {
      // Get recent high-performing content from database
      if (!supabaseClient.supabase) return [];

      const { data } = await supabaseClient.supabase
        .from('tweets')
        .select('content, likes, retweets')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data) return [];

      // Extract trending topics from high-engagement content
      const trendingTopics = [];
      for (const tweet of data) {
        if ((tweet.likes || 0) + (tweet.retweets || 0) > 10) {
          // Extract key health terms (simplified)
          const healthTerms = this.extractHealthTerms(tweet.content);
          trendingTopics.push(...healthTerms);
        }
      }

      return [...new Set(trendingTopics)].slice(0, 5);

    } catch (error) {
      console.warn('Could not get trending topics:', error);
      return this.getDefaultTrendingTopics();
    }
  }

  /**
   * 🏷️ EXTRACT HEALTH TERMS
   */
  private extractHealthTerms(content: string): string[] {
    const healthKeywords = [
      'sleep', 'exercise', 'nutrition', 'stress', 'meditation', 'mental health',
      'immunity', 'heart health', 'weight loss', 'diabetes', 'wellness',
      'fitness', 'diet', 'hydration', 'supplements', 'gut health',
      'longevity', 'prevention', 'inflammation', 'antioxidants'
    ];

    const foundTerms = [];
    for (const keyword of healthKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        foundTerms.push(keyword);
      }
    }

    return foundTerms;
  }

  /**
   * 📈 DEFAULT TRENDING TOPICS
   */
  private getDefaultTrendingTopics(): string[] {
    return [
      'sleep optimization',
      'mental health awareness',
      'immune system boost',
      'stress management',
      'heart health'
    ];
  }

  /**
   * 🏷️ GENERATE ENGAGEMENT HASHTAGS
   */
  private generateEngagementHashtags(
    contentType: ViralHealthContent['contentType'],
    content: string
  ): string[] {
    const baseHashtags = ['#health', '#wellness'];
    
    const contentSpecificHashtags = {
      health_tip: ['#healthtips', '#wellnesstips', '#healthhacks'],
      breaking_news: ['#healthnews', '#breakthrough', '#science'],
      motivation: ['#motivation', '#healthjourney', '#wellness'],
      fact: ['#healthfacts', '#didyouknow', '#science'],
      trend_reaction: ['#trending', '#healthtrends', '#viral'],
      educational: ['#healthed', '#learnwithme', '#science']
    };

    const specificTags = contentSpecificHashtags[contentType] || contentSpecificHashtags.health_tip;
    
    // Add content-based hashtags
    const contentTags = [];
    if (content.toLowerCase().includes('sleep')) contentTags.push('#sleep');
    if (content.toLowerCase().includes('exercise')) contentTags.push('#fitness');
    if (content.toLowerCase().includes('mental')) contentTags.push('#mentalhealth');
    if (content.toLowerCase().includes('heart')) contentTags.push('#cardio');
    if (content.toLowerCase().includes('nutrition')) contentTags.push('#nutrition');

    return [...baseHashtags, ...specificTags, ...contentTags].slice(0, 5);
  }

  /**
   * 🎯 EXTRACT ENGAGEMENT HOOK
   */
  private extractEngagementHook(content: string): string {
    // Extract the first engaging phrase or question
    const hooks = content.match(/^[^.!?]*[.!?]/);
    return hooks ? hooks[0].trim() : content.substring(0, 50) + '...';
  }

  /**
   * 📊 CALCULATE EXPECTED ENGAGEMENT
   */
  private calculateExpectedEngagement(
    contentType: ViralHealthContent['contentType'],
    content: string
  ): 'high' | 'medium' | 'viral' {
    let score = 0;

    // Content type scoring
    const typeScores = {
      health_tip: 8,
      breaking_news: 9,
      motivation: 7,
      fact: 9,
      trend_reaction: 8,
      educational: 6
    };

    score += typeScores[contentType];

    // Content quality indicators
    if (content.includes('🔥') || content.includes('💥')) score += 2;
    if (content.includes('BREAKING') || content.includes('JUST IN')) score += 3;
    if (content.includes('?')) score += 1; // Questions drive engagement
    if (content.length < 200) score += 1; // Shorter content performs better
    if (content.includes('Tag someone') || content.includes('Share')) score += 2;

    if (score >= 12) return 'viral';
    if (score >= 8) return 'high';
    return 'medium';
  }

  /**
   * 🎯 DETERMINE AUDIENCE TARGET
   */
  private determineAudienceTarget(
    contentType: ViralHealthContent['contentType']
  ): 'general' | 'health_conscious' | 'trending' {
    const targeting = {
      health_tip: 'general',
      breaking_news: 'trending',
      motivation: 'general',
      fact: 'health_conscious',
      trend_reaction: 'trending',
      educational: 'health_conscious'
    };

    return targeting[contentType] as 'general' | 'health_conscious' | 'trending';
  }

  /**
   * 🆘 FALLBACK VIRAL CONTENT
   */
  private getFallbackViralContent(): ViralHealthContent {
    const fallbackTips = [
      "💡 Drink a glass of water before every meal. This simple trick can boost metabolism by 30% and help with weight management! 💧",
      "🔥 Take 3 deep breaths before eating. It activates your parasympathetic nervous system for better digestion! 🧘‍♀️",
      "✨ Walk for 10 minutes after meals. It can lower blood sugar by 30% and improve energy levels! 🚶‍♂️",
      "⚡ Sleep in a cool room (65-68°F). Your body burns more calories maintaining temperature while you sleep! 🌙",
      "💪 Do 10 squats before coffee. It kickstarts your metabolism and energy for the entire day! ☕"
    ];

    const randomTip = fallbackTips[Math.floor(Math.random() * fallbackTips.length)];

    return {
      content: randomTip,
      contentType: 'health_tip',
      engagementHook: randomTip.split('.')[0] + '.',
      hashtags: ['#health', '#wellness', '#healthtips'],
      expectedEngagement: 'high',
      audienceTarget: 'general'
    };
  }

  /**
   * 📊 TRACK VIRAL PERFORMANCE
   */
  async trackViralPerformance(content: ViralHealthContent, tweetId: string): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      await supabaseClient.supabase
        .from('viral_content_tracking')
        .insert({
          tweet_id: tweetId,
          content_type: content.contentType,
          expected_engagement: content.expectedEngagement,
          audience_target: content.audienceTarget,
          hashtags: content.hashtags,
          engagement_hook: content.engagementHook,
          created_at: new Date().toISOString()
        });

    } catch (error) {
      console.warn('Could not track viral performance:', error);
    }
  }
}

export const viralHealthThemeAgent = new ViralHealthThemeAgent(); 