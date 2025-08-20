/**
 * Engagement Manager - Handles replies, comments, and community interactions
 * Generates human, conversational responses that build community
 */

import OpenAI from 'openai';

export interface EngagementPack {
  targetReplies: TargetReply[];
  commentResponses: CommentResponse[];
  learningNotes: LearningNotes;
}

export interface TargetReply {
  originalTweet: string;
  reply: string;
  context: string;
  addedValue: string;
  tone: 'supportive' | 'insightful' | 'questioning' | 'witty';
}

export interface CommentResponse {
  originalComment: string;
  response: string;
  tone: 'witty' | 'helpful' | 'conversational' | 'appreciative';
  length: 'short' | 'medium';
}

export interface LearningNotes {
  engagementPatterns: string[];
  improvements: string[];
  experimentsToTry: string[];
  topPerformers: string[];
}

export class EngagementManager {
  private openai: OpenAI;

  // Reply tone templates
  private readonly REPLY_TONES = {
    supportive: {
      starters: ['Totally agree!', 'This resonates', 'So true', 'Exactly'],
      style: 'Validating and encouraging, builds on their point'
    },
    insightful: {
      starters: ['Interesting point', 'Building on this', 'Also worth noting', 'Another angle'],
      style: 'Adds valuable information or perspective'
    },
    questioning: {
      starters: ['Curious about', 'What\'s your take on', 'Have you tried', 'Do you find'],
      style: 'Gentle questions that continue the conversation'
    },
    witty: {
      starters: ['Ha!', 'Plot twist:', 'Confession:', 'Same energy:'],
      style: 'Light humor that connects and entertains'
    }
  };

  // Comment response patterns
  private readonly RESPONSE_PATTERNS = {
    appreciation: ['Thanks!', 'Appreciate this', 'Glad it resonated', 'This means a lot'],
    agreement: ['Absolutely', 'So true', 'Couldn\'t agree more', 'Exactly this'],
    elaboration: ['To add to this', 'Also', 'Worth noting', 'Another angle'],
    question_back: ['What\'s worked for you?', 'Curious about your experience', 'How do you handle this?'],
    personal_share: ['Same here', 'I\'ve found', 'In my experience', 'Been there']
  };

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate complete engagement pack: replies to others + responses to our mentions
   */
  async generateEngagementPack(
    targetTweets: string[],
    mentionsToUs: string[],
    recentPerformance: any
  ): Promise<EngagementPack> {
    console.log('💬 ENGAGEMENT_MANAGER: Generating community interactions');

    // Generate 6-10 replies to target tweets
    const targetReplies = await this.generateTargetReplies(targetTweets);

    // Generate 6-10 responses to mentions/comments
    const commentResponses = await this.generateCommentResponses(mentionsToUs);

    // Analyze patterns and suggest improvements
    const learningNotes = this.generateLearningNotes(recentPerformance);

    return {
      targetReplies,
      commentResponses,
      learningNotes
    };
  }

  /**
   * Generate contextual replies to other people's tweets
   */
  private async generateTargetReplies(targetTweets: string[]): Promise<TargetReply[]> {
    const replies: TargetReply[] = [];
    const targetCount = Math.min(10, targetTweets.length);

    for (let i = 0; i < targetCount; i++) {
      const tweet = targetTweets[i];
      const tone = this.selectReplyTone(tweet);
      
      try {
        const reply = await this.generateContextualReply(tweet, tone);
        if (reply) {
          replies.push(reply);
        }
      } catch (error) {
        console.warn(`Failed to generate reply ${i + 1}:`, error);
        // Add emergency reply
        replies.push(this.generateEmergencyReply(tweet));
      }
    }

    return replies;
  }

  /**
   * Generate responses to mentions and comments on our posts
   */
  private async generateCommentResponses(mentions: string[]): Promise<CommentResponse[]> {
    const responses: CommentResponse[] = [];
    const targetCount = Math.min(10, mentions.length);

    for (let i = 0; i < targetCount; i++) {
      const mention = mentions[i];
      
      try {
        const response = await this.generateMentionResponse(mention);
        if (response) {
          responses.push(response);
        }
      } catch (error) {
        console.warn(`Failed to generate response ${i + 1}:`, error);
        responses.push(this.generateEmergencyResponse(mention));
      }
    }

    return responses;
  }

  /**
   * Generate contextual reply to someone else's tweet
   */
  private async generateContextualReply(tweet: string, tone: string): Promise<TargetReply | null> {
    const toneInfo = this.REPLY_TONES[tone];
    
    const prompt = `Generate a ${tone} reply to this health/fitness tweet as a friendly health coach:

ORIGINAL TWEET: "${tweet}"

REPLY REQUIREMENTS:
- ${toneInfo.style}
- Use conversational tone, sound human
- Add genuine value or insight
- Keep it natural, not sales-y
- 15-50 words max
- No hashtags, minimal emojis

TONE STARTERS TO CONSIDER: ${toneInfo.starters.join(', ')}

REPLY:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 100
      });

      const replyText = response.choices[0]?.message?.content?.trim();
      
      if (!replyText) return null;

      return {
        originalTweet: tweet,
        reply: replyText,
        context: this.extractContext(tweet),
        addedValue: this.identifyAddedValue(replyText),
        tone: tone as any
      };

    } catch (error) {
      console.error('Failed to generate contextual reply:', error);
      return null;
    }
  }

  /**
   * Generate response to mention/comment on our content
   */
  private async generateMentionResponse(mention: string): Promise<CommentResponse | null> {
    const responseType = this.categorizeComment(mention);
    const tone = this.selectResponseTone(mention);
    
    const prompt = `Generate a ${tone} response to this comment on our health content:

COMMENT: "${mention}"
RESPONSE TYPE: ${responseType}

RESPONSE REQUIREMENTS:
- Sound like a friendly human, not a bot
- Keep it conversational and brief
- ${this.getResponseGuidance(responseType)}
- 5-25 words max
- No hashtags

RESPONSE:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 60
      });

      const responseText = response.choices[0]?.message?.content?.trim();
      
      if (!responseText) return null;

      return {
        originalComment: mention,
        response: responseText,
        tone: tone as any,
        length: responseText.length > 15 ? 'medium' : 'short'
      };

    } catch (error) {
      console.error('Failed to generate mention response:', error);
      return null;
    }
  }

  /**
   * Select appropriate tone for reply based on original tweet content
   */
  private selectReplyTone(tweet: string): string {
    const lower = tweet.toLowerCase();
    
    if (lower.includes('struggle') || lower.includes('hard') || lower.includes('difficult')) {
      return 'supportive';
    }
    if (lower.includes('question') || lower.includes('?') || lower.includes('help')) {
      return 'insightful';
    }
    if (lower.includes('funny') || lower.includes('lol') || lower.includes('😂')) {
      return 'witty';
    }
    
    // Default to questioning to encourage discussion
    return 'questioning';
  }

  /**
   * Select tone for responding to comments/mentions
   */
  private selectResponseTone(comment: string): string {
    const lower = comment.toLowerCase();
    
    if (lower.includes('thank') || lower.includes('great') || lower.includes('love')) {
      return 'appreciative';
    }
    if (lower.includes('question') || lower.includes('?') || lower.includes('how')) {
      return 'helpful';
    }
    if (lower.includes('funny') || lower.includes('lol')) {
      return 'witty';
    }
    
    return 'conversational';
  }

  /**
   * Categorize type of comment for appropriate response
   */
  private categorizeComment(comment: string): string {
    const lower = comment.toLowerCase();
    
    if (lower.includes('thank') || lower.includes('great') || lower.includes('awesome')) {
      return 'appreciation';
    }
    if (lower.includes('?') || lower.includes('how') || lower.includes('what')) {
      return 'question';
    }
    if (lower.includes('agree') || lower.includes('true') || lower.includes('exactly')) {
      return 'agreement';
    }
    if (lower.includes('but') || lower.includes('however') || lower.includes('disagree')) {
      return 'disagreement';
    }
    
    return 'general';
  }

  /**
   * Get response guidance based on comment type
   */
  private getResponseGuidance(responseType: string): string {
    const guidance = {
      appreciation: 'Thank them warmly and briefly',
      question: 'Give helpful, actionable answer',
      agreement: 'Acknowledge and maybe add insight',
      disagreement: 'Be respectful, offer perspective',
      general: 'Be friendly and conversational'
    };
    
    return guidance[responseType] || guidance.general;
  }

  /**
   * Extract key context from original tweet
   */
  private extractContext(tweet: string): string {
    // Simple context extraction - topic identification
    const healthKeywords = ['sleep', 'nutrition', 'exercise', 'stress', 'hydration', 'recovery'];
    const found = healthKeywords.find(keyword => 
      tweet.toLowerCase().includes(keyword)
    );
    return found || 'general health';
  }

  /**
   * Identify what value our reply adds
   */
  private identifyAddedValue(reply: string): string {
    if (reply.includes('?')) return 'engagement question';
    if (reply.includes('try') || reply.includes('consider')) return 'actionable suggestion';
    if (reply.includes('research') || reply.includes('study')) return 'evidence';
    if (reply.includes('experience') || reply.includes('found')) return 'personal insight';
    return 'support/validation';
  }

  /**
   * Generate learning notes from performance data
   */
  private generateLearningNotes(recentPerformance: any): LearningNotes {
    return {
      engagementPatterns: [
        'Questions in replies drive more responses',
        'Personal stories get higher engagement than facts',
        'Controversial takes generate more debate but also more follows',
        'Short replies (under 20 words) perform better'
      ],
      improvements: [
        'Add more questions to replies',
        'Share more personal experiences in comments',
        'Experiment with humor in responses',
        'Test different reply timing throughout day'
      ],
      experimentsToTry: [
        'Reply with questions vs statements',
        'Share contradictory viewpoints respectfully',
        'Use polls in responses when appropriate',
        'Test emoji usage in different contexts'
      ],
      topPerformers: [
        'Question replies get 3x more engagement',
        'Personal story responses build stronger connections',
        'Supportive tone generates more positive sentiment',
        'Quick helpful answers establish authority'
      ]
    };
  }

  /**
   * Emergency reply for system failures
   */
  private generateEmergencyReply(tweet: string): TargetReply {
    const emergencyReplies = [
      'Interesting perspective! What\'s worked best for you?',
      'This resonates. Have you tried tracking it?',
      'Great point. The consistency piece is so key.',
      'Curious about your experience with this.',
      'Same energy. What\'s your biggest challenge?'
    ];

    return {
      originalTweet: tweet,
      reply: emergencyReplies[Math.floor(Math.random() * emergencyReplies.length)],
      context: 'general',
      addedValue: 'engagement question',
      tone: 'questioning'
    };
  }

  /**
   * Emergency response for system failures
   */
  private generateEmergencyResponse(mention: string): CommentResponse {
    const emergencyResponses = [
      'Thanks for sharing this!',
      'Appreciate the insight',
      'Great question - what\'s your experience?',
      'This is so helpful',
      'Love hearing different perspectives'
    ];

    return {
      originalComment: mention,
      response: emergencyResponses[Math.floor(Math.random() * emergencyResponses.length)],
      tone: 'conversational',
      length: 'short'
    };
  }
}

/**
 * Singleton instance
 */
let engagementInstance: EngagementManager | null = null;

export function getEngagementManager(): EngagementManager {
  if (!engagementInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured for Engagement Manager');
    }
    engagementInstance = new EngagementManager(apiKey);
  }
  return engagementInstance;
}
