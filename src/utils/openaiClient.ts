import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

export interface TweetGenerationOptions {
  includeSnap2HealthCTA?: boolean;
  replyToTweet?: {
    content: string;
    author: string;
  };
  style?: 'educational' | 'humorous' | 'thought-provoking' | 'technical';
}

export interface GeneratedContent {
  content: string;
  reasoning?: string;
  hasSnap2HealthCTA: boolean;
  confidence: number;
}

class OpenAIService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
        console.warn('⚠️  Running in test mode without OpenAI credentials');
        return;
      }
      throw new Error('Missing OpenAI API key in environment variables');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateTweet(options: { includeSnap2HealthCTA?: boolean; style?: string }): Promise<string> {
    if (!this.checkClient()) {
      return this.getFallbackTweet();
    }

    try {
      // Load persona and tweet prompt
             const persona = await fs.readFile(path.join(__dirname, '../prompts/persona.txt'), 'utf8');
       const tweetPrompt = await fs.readFile(path.join(__dirname, '../prompts/tweetPrompt.txt'), 'utf8');

      // Create professional, data-driven prompt
      const prompt = `${persona}\n\n${tweetPrompt}\n\nGenerate a professional health technology tweet that follows these strict formatting rules:

CRITICAL FORMATTING REQUIREMENTS:
- Use only straight quotes (") never smart quotes ("")
- Maximum 1 emoji total (or none)
- Include specific data/statistics
- Cite real institution (Stanford, MIT, Harvard, Nature, etc.)
- Use professional, authoritative language
- Structure information clearly
- Stay under 280 characters

${options.style ? `PREFERRED STYLE: ${options.style}` : ''}

Generate ONE professional tweet now:`;

      const completion = await this.client!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional health technology analyst. Generate authoritative, well-cited tweets with proper formatting. Use only straight quotes (") and minimal emojis. Focus on data, research, and credible sources.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.2,
      });

      let tweet = completion.choices[0]?.message?.content?.trim() || this.getFallbackTweet();
      
      // Clean up the generated tweet
      tweet = this.cleanTweetFormatting(tweet);

      // Add Snap2Health CTA if requested (disabled by default)
      if (options.includeSnap2HealthCTA) {
        tweet = this.addSnap2HealthCTA(tweet);
      }

      // Final validation and cleanup
      tweet = this.validateAndCleanTweet(tweet);

      console.log('✅ Generated professional tweet:', tweet);
      return tweet;

    } catch (error) {
      console.error('Error generating tweet:', error);
      return this.getFallbackTweet();
    }
  }

  async generateReply(originalTweet: { content: string; author: string }): Promise<GeneratedContent | null> {
    if (!this.client) {
      console.warn('OpenAI client not initialized (test mode)');
      return {
        content: `Interesting perspective! The data suggests there's more to explore here. What's your experience? 📊`,
        hasSnap2HealthCTA: false,
        confidence: 0.80,
      };
    }
    try {
      // TODO: Implement reply generation
      // 1. Load persona prompt from prompts/replyPrompt.txt
      // 2. Analyze original tweet context
      // 3. Generate contextual, engaging reply
      // 4. Ensure reply adds value to conversation
      
      const systemPrompt = await this.getReplyPersonaPrompt();
      const userPrompt = this.buildReplyPrompt(originalTweet);

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 120,
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No reply content generated');
      }

      // Check if content passes moderation
      const isModerated = await this.moderateContent(content);
      if (!isModerated) {
        console.warn('Generated reply failed moderation check');
        return null;
      }

      return {
        content,
        hasSnap2HealthCTA: false, // Replies typically don't include CTAs
        confidence: 0.80,
      };

    } catch (error) {
      console.error('Error generating reply:', error);
      return null;
    }
  }

  async moderateContent(content: string): Promise<boolean> {
    if (!this.client) {
      console.warn('OpenAI client not initialized (test mode) - allowing content');
      return true; // Allow all content in test mode
    }
    try {
      const moderation = await this.client.moderations.create({
        input: content,
      });

      const result = moderation.results[0];
      return !result.flagged;

    } catch (error) {
      console.error('Error moderating content:', error);
      // Err on the side of caution
      return false;
    }
  }

  private async getPersonaPrompt(): Promise<string> {
    // TODO: Load from prompts/tweetPrompt.txt
    return `You blend Harvard-level medical authority with Marc Andreessen's tech optimism,
Sam Altman's AGI futurism, David Sinclair's longevity focus, Gary Brecka's biomarker zeal,
and Duncan Trussell's cosmic humor.

Goals:
• Illuminate AI × health.
• Spark conversation (ask bold questions).
• Soft Snap2Health plug roughly every sixth tweet.

Style:
• 1-2 sentences or 4-6-bullet threads.
• Emojis sparingly: 🧠 🤖 🩺 ⏳ 💡 📊.
• Cite stats/anecdotes; never spam.`;
  }

  private async getReplyPersonaPrompt(): Promise<string> {
    // TODO: Load from prompts/replyPrompt.txt
    return `You are responding as the Snap2Health X-Bot with the same persona blend.
Keep replies concise, valuable, and engaging. Add to the conversation, don't just agree.
Use your expertise to provide unique insights on AI, health, longevity, and biohacking.`;
  }

  private buildTweetPrompt(options: TweetGenerationOptions): string {
    let prompt = 'Generate an original tweet that fits the persona and goals described. MUST include specific research citations (university studies, journal publications, specific data points with sources).';
    
    if (options.style) {
      prompt += ` Focus on being ${options.style}.`;
    }
    
    // Remove Snap2Health CTA for now
    // if (options.includeSnap2HealthCTA) {
    //   prompt += ' Include a subtle mention or reference to Snap2Health.';
    // }

    prompt += ' CRITICAL: Keep it under 250 characters. Cite specific studies, institutions, or research. NO vague claims or made-up statistics.';
    
    return prompt;
  }

  private buildReplyPrompt(originalTweet: { content: string; author: string }): string {
    return `Original tweet by @${originalTweet.author}: "${originalTweet.content}"

Generate a thoughtful reply that adds value to this conversation. Be helpful, insightful, and true to your persona.`;
  }

  async analyzeEngagement(tweetContent: string, metrics: { likes: number; retweets: number; replies: number }): Promise<{ insights: string; suggestions: string[] }> {
    try {
      // TODO: Implement engagement analysis for learning
      // 1. Analyze what made content successful/unsuccessful
      // 2. Provide insights for future content generation
      // 3. Suggest improvements or patterns to follow
      
      const engagementScore = metrics.likes + (metrics.retweets * 2) + (metrics.replies * 3);
      
      return {
        insights: `Engagement score: ${engagementScore}. TODO: Implement detailed analysis.`,
        suggestions: ['TODO: Implement learning suggestions based on performance']
      };
      
    } catch (error) {
      console.error('Error analyzing engagement:', error);
      return {
        insights: 'Analysis failed',
        suggestions: []
      };
    }
  }

  private checkClient(): boolean {
    return this.client !== null;
  }

  private getFallbackTweet(): string {
    return "Test tweet: AI is transforming healthcare. What's your take? 🤖";
  }

  private cleanTweetFormatting(tweet: string): string {
    // Remove any wrapper quotes around the entire tweet
    tweet = tweet.replace(/^["']|["']$/g, '');
    
    // Replace smart quotes with straight quotes
    tweet = tweet.replace(/[""]/g, '"');
    tweet = tweet.replace(/['']/g, "'");
    
    // Remove excessive emojis (keep max 1)
    const emojis = tweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
    if (emojis.length > 1) {
      // Keep only the first emoji
      const firstEmoji = emojis[0];
      tweet = tweet.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      tweet = tweet.trim() + ' ' + firstEmoji;
    }
    
    // Clean up spacing
    tweet = tweet.replace(/\s+/g, ' ').trim();
    
    return tweet;
  }

  private validateAndCleanTweet(tweet: string): string {
    // Ensure tweet length
    if (tweet.length > 280) {
      tweet = tweet.substring(0, 277) + '...';
    }
    
    // Ensure it doesn't start with quotes
    tweet = tweet.replace(/^["']/, '');
    
    // Ensure proper spacing around citations
    tweet = tweet.replace(/Source:\s*/g, '\n\nSource: ');
    tweet = tweet.replace(/Impact:\s*/g, '\nImpact: ');
    
    // Final cleanup
    tweet = tweet.trim();
    
    return tweet;
  }

  private addSnap2HealthCTA(tweet: string): string {
    // Implementation of adding Snap2Health CTA
    return tweet + ' - Learn more about Snap2Health at [Snap2Health Website]';
  }

  async generateInsights(prompt: string): Promise<string[]> {
    if (!this.checkClient()) {
      return ['Fallback insight: Focus on engagement trends', 'Consider posting during peak hours'];
    }

    try {
      const completion = await this.client!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a health technology analyst. Generate actionable insights based on the provided data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        return ['No insights generated'];
      }

      // Split response into individual insights
      return response.split('\n').filter(insight => insight.trim().length > 0);

    } catch (error) {
      console.error('Error generating insights:', error);
      return ['Error generating insights - using fallback'];
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    if (!this.checkClient()) {
      return 'Test response for prompt analysis';
    }

    try {
      const completion = await this.client!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an intelligent AI assistant analyzing health technology trends and data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || 'No response generated';

    } catch (error) {
      console.error('Error generating response:', error);
      return 'Error generating response';
    }
  }

  // Make client accessible for direct API calls when needed
  getClient(): OpenAI | null {
    return this.client;
  }
}

export const openaiClient = new OpenAIService(); 