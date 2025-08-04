/**
 * 🔥 VIRAL HEALTH CONTENT GENERATOR
 * =================================
 * Specialized content generation for small health accounts
 * Focuses on controversial, engaging, and shareable health content
 */

import { openaiClient } from '../utils/openaiClient';

export interface ViralContentRequest {
  content_type: 'controversial_take' | 'myth_buster' | 'quick_tip' | 'research_surprise' | 'thread';
  controversy_level: 1 | 2 | 3 | 4 | 5; // 1=mild, 5=very controversial
  target_audience: 'general_health' | 'fitness' | 'nutrition' | 'biohacking' | 'wellness';
  engagement_goal: 'likes' | 'replies' | 'shares' | 'followers';
  max_length: number;
}

export interface ViralContentResponse {
  content: string;
  viral_score: number;
  engagement_hooks: string[];
  controversy_elements: string[];
  expected_reactions: string[];
  posting_strategy: string;
}

export class ViralHealthContentGenerator {
  private static instance: ViralHealthContentGenerator;

  private constructor() {}

  static getInstance(): ViralHealthContentGenerator {
    if (!ViralHealthContentGenerator.instance) {
      ViralHealthContentGenerator.instance = new ViralHealthContentGenerator();
    }
    return ViralHealthContentGenerator.instance;
  }

  /**
   * 🔥 GENERATE VIRAL HEALTH CONTENT
   */
  async generateViralContent(request: ViralContentRequest): Promise<ViralContentResponse> {
    try {
      const prompt = this.buildViralPrompt(request);
      
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.8 // Higher creativity for viral content
      });

      const generatedContent = completion.choices[0]?.message?.content || '';
      
      // Analyze the generated content
      const analysis = this.analyzeViralPotential(generatedContent);
      
      return {
        content: generatedContent,
        viral_score: analysis.viral_score,
        engagement_hooks: analysis.engagement_hooks,
        controversy_elements: analysis.controversy_elements,
        expected_reactions: analysis.expected_reactions,
        posting_strategy: analysis.posting_strategy
      };

    } catch (error) {
      console.error('❌ Failed to generate viral content:', error);
      throw error;
    }
  }

  /**
   * 🎯 BUILD VIRAL CONTENT PROMPT
   */
  private buildViralPrompt(request: ViralContentRequest): string {
    const controversyDescriptions = {
      1: 'mildly thought-provoking',
      2: 'moderately controversial',
      3: 'quite controversial but ethical',
      4: 'very controversial but educational',
      5: 'extremely controversial but truthful'
    };

    const contentTypeInstructions = {
      controversial_take: 'Create a controversial but truthful health opinion that challenges mainstream thinking',
      myth_buster: 'Debunk a popular health myth with surprising evidence',
      quick_tip: 'Share a quick, actionable health tip that most people don\'t know',
      research_surprise: 'Share surprising research findings that contradict popular beliefs',
      thread: 'Create a thread (1/X format) breaking down a complex health topic'
    };

    const audienceContext = {
      general_health: 'health-conscious individuals looking for practical advice',
      fitness: 'fitness enthusiasts and gym-goers',
      nutrition: 'people interested in diet and nutrition optimization',
      biohacking: 'biohackers and performance optimization enthusiasts',
      wellness: 'wellness practitioners and holistic health advocates'
    };

    return `Create a ${controversyDescriptions[request.controversy_level]} health ${request.content_type} for ${audienceContext[request.target_audience]}.

CONTENT TYPE: ${contentTypeInstructions[request.content_type]}

REQUIREMENTS:
- Target audience: ${request.target_audience}
- Controversy level: ${request.controversy_level}/5 (${controversyDescriptions[request.controversy_level]})
- Primary goal: Generate ${request.engagement_goal}
- Max length: ${request.max_length} characters
- Must include engagement hooks (questions, surprising statements, etc.)
- Should challenge conventional wisdom
- Include actionable elements when possible
- Be factually accurate but presented provocatively

SMALL ACCOUNT OPTIMIZATION:
- Write for an account with only 17 followers
- Focus on getting people to engage and follow
- Use attention-grabbing hooks
- Make it shareable and discussable
- Include elements that make people want to reply

FORMAT: Return only the tweet content, no explanations or metadata.`;
  }

  /**
   * 🤖 GET SYSTEM PROMPT
   */
  private getSystemPrompt(): string {
    return `You are a viral health content creator specializing in creating engaging, controversial, but educational health content for small Twitter accounts.

Your expertise:
- Health and wellness topics that generate engagement
- Controversial but truthful health takes
- Research-backed claims presented provocatively
- Content that drives replies, likes, and follows
- Optimization for accounts with small followings

Your style:
- Bold, attention-grabbing statements
- Question conventional wisdom
- Include surprising facts and research
- Use engagement hooks (questions, controversial statements)
- Keep content concise but powerful
- Focus on shareability and discussion potential

Your goal: Help small health accounts grow by creating content that people HAVE to engage with.

IMPORTANT: Always stay factually accurate while being provocative. Never give dangerous medical advice. Focus on general health, nutrition, fitness, and wellness topics.`;
  }

  /**
   * 📊 ANALYZE VIRAL POTENTIAL
   */
  private analyzeViralPotential(content: string): {
    viral_score: number;
    engagement_hooks: string[];
    controversy_elements: string[];
    expected_reactions: string[];
    posting_strategy: string;
  } {
    const hooks: string[] = [];
    const controversyElements: string[] = [];
    const reactions: string[] = [];
    let score = 0;

    // Engagement hooks analysis
    if (content.includes('?')) {
      hooks.push('Question format');
      score += 2;
    }
    
    if (content.toLowerCase().includes('what') || content.toLowerCase().includes('why') || content.toLowerCase().includes('how')) {
      hooks.push('W-question hook');
      score += 1.5;
    }

    if (content.toLowerCase().includes('secret') || content.toLowerCase().includes('hidden')) {
      hooks.push('Secret/hidden knowledge');
      score += 1.5;
    }

    // Controversy analysis
    const controversialTerms = [
      'doctor', 'doctors', 'medical', 'FDA', 'big pharma', 'pharmaceutical',
      'wrong', 'lie', 'myth', 'mistake', 'truth', 'exposed'
    ];

    for (const term of controversialTerms) {
      if (content.toLowerCase().includes(term)) {
        controversyElements.push(`Anti-establishment: ${term}`);
        score += 1;
      }
    }

    // Emotional triggers
    const emotionalWords = ['shocking', 'surprising', 'dangerous', 'powerful', 'amazing', 'incredible'];
    for (const word of emotionalWords) {
      if (content.toLowerCase().includes(word)) {
        hooks.push(`Emotional trigger: ${word}`);
        score += 0.5;
      }
    }

    // Predict reactions
    if (score >= 7) {
      reactions.push('Strong agreement from health enthusiasts');
      reactions.push('Pushback from mainstream health advocates');
      reactions.push('Requests for sources/studies');
      reactions.push('Shares from people who agree');
    } else if (score >= 5) {
      reactions.push('Moderate engagement');
      reactions.push('Some controversial replies');
      reactions.push('Interest in learning more');
    } else {
      reactions.push('Limited engagement');
      reactions.push('May need more controversy');
    }

    // Posting strategy
    let strategy = '';
    if (score >= 7) {
      strategy = 'Post during peak hours (8-9 AM or 7-8 PM) and engage actively with replies';
    } else if (score >= 5) {
      strategy = 'Good content, consider adding a follow-up thread for more engagement';
    } else {
      strategy = 'Consider adding more controversial elements or stronger hooks';
    }

    return {
      viral_score: Math.min(10, score),
      engagement_hooks: hooks,
      controversy_elements: controversyElements,
      expected_reactions: reactions,
      posting_strategy: strategy
    };
  }

  /**
   * 🔥 GENERATE CONTROVERSIAL HEALTH TAKES
   */
  async generateControversialTake(topic?: string): Promise<ViralContentResponse> {
    const topics = topic ? [topic] : [
      'The vitamin D industry is lying to you',
      'Why your doctor doesn\'t want you to fast',
      'The biggest nutrition myth that\'s making you sick',
      'What big pharma doesn\'t want you to know about sleep',
      'The exercise myth that\'s wasting your time',
      'Why 99% of supplements are useless',
      'The diet your doctor follows vs what they tell you',
      'What happens when you stop trusting medical advice'
    ];

    const selectedTopic = topics[Math.floor(Math.random() * topics.length)];

    return this.generateViralContent({
      content_type: 'controversial_take',
      controversy_level: 4,
      target_audience: 'general_health',
      engagement_goal: 'replies',
      max_length: 280
    });
  }

  /**
   * 🧵 GENERATE VIRAL HEALTH THREAD
   */
  async generateHealthThread(topic: string): Promise<{
    thread_tweets: string[];
    total_viral_score: number;
    engagement_strategy: string;
  }> {
    try {
      const threadPrompt = `Create a viral health thread about: ${topic}

THREAD REQUIREMENTS:
- 3-5 tweets in thread format (1/X, 2/X, etc.)
- Each tweet under 280 characters
- Controversial but educational
- Include surprising facts and research
- End with a call to action for engagement
- Optimize for small account (17 followers)

FORMAT: Return as numbered tweets (1/X, 2/X, etc.)`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: threadPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.8
      });

      const threadContent = completion.choices[0]?.message?.content || '';
      const tweets = this.parseThreadTweets(threadContent);
      
      let totalScore = 0;
      for (const tweet of tweets) {
        const analysis = this.analyzeViralPotential(tweet);
        totalScore += analysis.viral_score;
      }

      return {
        thread_tweets: tweets,
        total_viral_score: totalScore / tweets.length,
        engagement_strategy: 'Post thread during peak hours, engage with replies, pin the first tweet'
      };

    } catch (error) {
      console.error('❌ Failed to generate thread:', error);
      throw error;
    }
  }

  /**
   * 📝 PARSE THREAD TWEETS
   */
  private parseThreadTweets(content: string): string[] {
    const lines = content.split('\n').filter(line => line.trim());
    const tweets: string[] = [];

    for (const line of lines) {
      if (line.match(/^\d+\/\d+/) || line.match(/^\d+\./)) {
        tweets.push(line.trim());
      }
    }

    return tweets.length > 0 ? tweets : [content];
  }

  /**
   * ⚡ QUICK VIRAL TIP GENERATOR
   */
  async generateQuickTip(): Promise<ViralContentResponse> {
    const tipTopics = [
      '30-second health hack that doctors hate',
      'One weird trick to boost energy instantly',
      'The 5-minute routine that changes everything',
      'What to do first thing in the morning',
      'The bedtime habit of successful people',
      'How to tell if your body is aging faster',
      'The kitchen ingredient that works better than medicine'
    ];

    const selectedTopic = tipTopics[Math.floor(Math.random() * tipTopics.length)];

    return this.generateViralContent({
      content_type: 'quick_tip',
      controversy_level: 2,
      target_audience: 'general_health',
      engagement_goal: 'likes',
      max_length: 250
    });
  }
}

export const viralHealthContentGenerator = ViralHealthContentGenerator.getInstance();