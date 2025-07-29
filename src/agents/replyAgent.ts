import { openaiClient } from '../utils/openaiClient';
import { ScrapedTweet } from '../scraper/scrapeTweets';
import * as fs from 'fs';
import * as path from 'path';

// Reply generation result interface
export interface ReplyResult {
  success: boolean;
  reply: string;
  confidence: number;
  replyType: 'insightful' | 'clever' | 'supportive' | 'questioning' | 'corrective';
  originalTweet: string;
  author: string;
  estimatedEngagement: number;
  shouldPost: boolean;
  reason?: string;
  error?: string;
}

// Stealth patterns for human-like responses
interface StealthPattern {
  name: string;
  templates: string[];
  tonality: string;
  riskLevel: 'low' | 'medium' | 'high';
  usageCount: number;
  lastUsed: number;
}

export class ReplyAgent {
  private replyPatterns: StealthPattern[] = [];
  private recentReplies: Set<string> = new Set();
  private authorInteractions: Map<string, number> = new Map();
  private usageLogPath = path.join(process.cwd(), 'logs', 'reply-patterns.json');
  private readonly MAX_REPLIES_PER_AUTHOR = 2; // Per day
  private readonly PATTERN_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours
  private readonly MIN_CONFIDENCE = 0.7;

  constructor() {
    this.initializeStealthPatterns();
    this.loadUsageHistory();
    this.ensureLogsDirectory();
  }

  private ensureLogsDirectory(): void {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * 🎭 Initialize human-like response patterns for stealth
   */
  private initializeStealthPatterns(): void {
    this.replyPatterns = [
      {
        name: 'insightful_addition',
        templates: [
          "This is fascinating. {insight} - makes me think about {connection}.",
          "Great point! {insight}. I've noticed {observation} too.",
          "Exactly. {insight}. The nuance most people miss is {detail}.",
          "This connects to something I've been thinking about: {insight}. {elaboration}.",
          "Spot on. {insight}. There's also the angle of {perspective}."
        ],
        tonality: 'thoughtful',
        riskLevel: 'low',
        usageCount: 0,
        lastUsed: 0
      },
      {
        name: 'clever_observation',
        templates: [
          "Plot twist: {observation}. {reasoning}.",
          "The irony here is {observation}. {explanation}.",
          "What's wild is {observation} - completely changes the narrative.",
          "Here's what's interesting: {observation}. {implication}.",
          "The counterintuitive part: {observation}. {context}."
        ],
        tonality: 'witty',
        riskLevel: 'low',
        usageCount: 0,
        lastUsed: 0
      },
      {
        name: 'supportive_build',
        templates: [
          "This resonates. {agreement}. {personal_angle}.",
          "Absolutely. {validation}. {additional_perspective}.",
          "You're onto something important here. {expansion}.",
          "This is why {validation}. {supporting_evidence}.",
          "Yes! {enthusiasm}. {complementary_insight}."
        ],
        tonality: 'encouraging',
        riskLevel: 'low',
        usageCount: 0,
        lastUsed: 0
      },
      {
        name: 'curious_questioning',
        templates: [
          "Curious: {question}? {reasoning}.",
          "What do you think about {angle}? {context}.",
          "This makes me wonder: {question}. {exploration}.",
          "How does this factor in: {consideration}? {perspective}.",
          "I'm curious about {aspect}. {rationale}."
        ],
        tonality: 'inquisitive',
        riskLevel: 'medium',
        usageCount: 0,
        lastUsed: 0
      },
      {
        name: 'gentle_correction',
        templates: [
          "Mostly agree, though {nuance}. {clarification}.",
          "Great points, with one caveat: {correction}. {explanation}.",
          "This is largely true, except {exception}. {context}.",
          "I'd add that {perspective}. {reasoning}.",
          "Close, but {adjustment} might be more accurate. {justification}."
        ],
        tonality: 'diplomatic',
        riskLevel: 'high',
        usageCount: 0,
        lastUsed: 0
      }
    ];
  }

  /**
   * 📊 Load usage history for pattern rotation
   */
  private loadUsageHistory(): void {
    try {
      if (fs.existsSync(this.usageLogPath)) {
        const data = JSON.parse(fs.readFileSync(this.usageLogPath, 'utf8'));
        this.replyPatterns = data.patterns || this.replyPatterns;
        this.authorInteractions = new Map(data.authorInteractions || []);
      }
    } catch (error) {
      console.warn('⚠️ Could not load reply usage history:', error);
    }
  }

  /**
   * 💾 Save usage history for stealth tracking
   */
  private saveUsageHistory(): void {
    try {
      const data = {
        patterns: this.replyPatterns,
        authorInteractions: Array.from(this.authorInteractions.entries()),
        lastUpdated: Date.now()
      };
      fs.writeFileSync(this.usageLogPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('⚠️ Could not save reply usage history:', error);
    }
  }

  /**
   * 🎯 Generate clever, human-like reply to a tweet
   */
  async generateReply(tweet: ScrapedTweet): Promise<ReplyResult> {
    try {
      console.log(`🎭 Generating human-like reply for @${tweet.author.username}...`);

      // Security check: Author interaction limits
      const authorReplies = this.authorInteractions.get(tweet.author.username) || 0;
      if (authorReplies >= this.MAX_REPLIES_PER_AUTHOR) {
        return {
          success: false,
          reply: '',
          confidence: 0,
          replyType: 'clever',
          originalTweet: tweet.content,
          author: tweet.author.username,
          estimatedEngagement: 0,
          shouldPost: false,
          reason: `Too many recent replies to @${tweet.author.username} (${authorReplies}/${this.MAX_REPLIES_PER_AUTHOR})`
        };
      }

      // Security check: Avoid replying to our own tweets
      if (tweet.author.username.toLowerCase().includes('signal') || 
          tweet.author.username.toLowerCase().includes('synapse')) {
        return {
          success: false,
          reply: '',
          confidence: 0,
          replyType: 'clever',
          originalTweet: tweet.content,
          author: tweet.author.username,
          estimatedEngagement: 0,
          shouldPost: false,
          reason: 'Avoiding self-replies for stealth'
        };
      }

      // Select appropriate response pattern
      const pattern = this.selectOptimalPattern(tweet);
      
      // Generate contextual reply using GPT
      const replyContent = await this.generateContextualReply(tweet, pattern);
      
      // Validate reply quality and stealth
      const validation = this.validateReply(replyContent, tweet);
      
      if (!validation.isValid) {
        return {
          success: false,
          reply: '',
          confidence: 0,
          replyType: pattern.name as any,
          originalTweet: tweet.content,
          author: tweet.author.username,
          estimatedEngagement: 0,
          shouldPost: false,
          reason: validation.reason
        };
      }

      // Update usage tracking
      pattern.usageCount++;
      pattern.lastUsed = Date.now();
      this.authorInteractions.set(tweet.author.username, authorReplies + 1);
      this.saveUsageHistory();

      const estimatedEngagement = this.estimateEngagement(tweet, replyContent);
      
      console.log(`✅ Generated reply (${validation.confidence} confidence): "${replyContent.substring(0, 60)}..."`);
      
      return {
        success: true,
        reply: replyContent,
        confidence: validation.confidence,
        replyType: pattern.name as any,
        originalTweet: tweet.content,
        author: tweet.author.username,
        estimatedEngagement,
        shouldPost: validation.confidence >= this.MIN_CONFIDENCE,
        reason: validation.confidence >= this.MIN_CONFIDENCE ? 'High confidence reply' : 'Low confidence - needs review'
      };

    } catch (error) {
      console.error('❌ Failed to generate reply:', error);
      return {
        success: false,
        reply: '',
        confidence: 0,
        replyType: 'clever',
        originalTweet: tweet.content,
        author: tweet.author.username,
        estimatedEngagement: 0,
        shouldPost: false,
        error: error.message
      };
    }
  }

  /**
   * 🎨 Select optimal response pattern based on tweet content and stealth needs
   */
  private selectOptimalPattern(tweet: ScrapedTweet): StealthPattern {
    const now = Date.now();
    
    // Filter patterns based on cooldown and risk
    const availablePatterns = this.replyPatterns.filter(pattern => {
      const timeSinceUse = now - pattern.lastUsed;
      const isOnCooldown = timeSinceUse < this.PATTERN_COOLDOWN;
      const isOverused = pattern.usageCount > 5; // Max 5 uses per pattern per day
      
      return !isOnCooldown && !isOverused;
    });

    if (availablePatterns.length === 0) {
      // Reset usage if all patterns are exhausted
      this.replyPatterns.forEach(p => p.usageCount = 0);
      return this.replyPatterns[0];
    }

    // Select pattern based on tweet content
    const content = tweet.content.toLowerCase();
    
    if (content.includes('wrong') || content.includes('incorrect') || content.includes('false')) {
      return availablePatterns.find(p => p.name === 'gentle_correction') || availablePatterns[0];
    }
    
    if (content.includes('?') || content.includes('what') || content.includes('how')) {
      return availablePatterns.find(p => p.name === 'insightful_addition') || availablePatterns[0];
    }
    
    if (content.includes('breakthrough') || content.includes('discovery') || content.includes('study')) {
      return availablePatterns.find(p => p.name === 'clever_observation') || availablePatterns[0];
    }
    
    // Default to least used, lowest risk pattern
    return availablePatterns
      .filter(p => p.riskLevel === 'low')
      .sort((a, b) => a.usageCount - b.usageCount)[0] || availablePatterns[0];
  }

  /**
   * 🧠 Generate contextual reply using GPT with stealth prompting
   */
  private async generateContextualReply(tweet: ScrapedTweet, pattern: StealthPattern): Promise<string> {
    const template = pattern.templates[Math.floor(Math.random() * pattern.templates.length)];
    
    const stealthPrompt = `You are a knowledgeable health enthusiast having a natural conversation on Twitter. Reply to this tweet in a ${pattern.tonality} tone using this template structure: "${template}"

TWEET TO REPLY TO:
"${tweet.content}"
BY: @${tweet.author.username}

INSTRUCTIONS:
- Use the template structure but make it sound completely natural and human
- Fill in {variables} with relevant, insightful content
- NO hashtags unless the original tweet uses them naturally
- Keep it under 240 characters
- Sound like a real person, not a bot
- Be clever but never robotic or promotional
- Match the sophistication level of the original tweet
- Avoid generic phrases like "Great post!" or "Thanks for sharing!"

Generate only the reply text, no explanations:`;

    const reply = await openaiClient.generateCompletion(stealthPrompt);
    
    // Clean up the reply
    return this.cleanReply(reply);
  }

  /**
   * 🧹 Clean and humanize the reply
   */
  private cleanReply(reply: string): string {
    return reply
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\.$/, '') // Remove trailing period if it feels unnatural
      .substring(0, 270); // Ensure under Twitter limit
  }

  /**
   * ✅ Validate reply quality and stealth factors
   */
  private validateReply(reply: string, tweet: ScrapedTweet): { isValid: boolean; confidence: number; reason: string } {
    // Length check
    if (reply.length < 10) {
      return { isValid: false, confidence: 0, reason: 'Reply too short' };
    }
    
    if (reply.length > 270) {
      return { isValid: false, confidence: 0, reason: 'Reply too long' };
    }

    // Spam detection
    const spamIndicators = [
      'check out', 'click here', 'follow me', 'dm me', 'link in bio',
      'great post!', 'thanks for sharing!', 'so true!', 'this!', 'facts!',
      '💯', '🔥', '👍', '😍' // Common bot emoji
    ];
    
    const hasSpamIndicators = spamIndicators.some(indicator => 
      reply.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasSpamIndicators) {
      return { isValid: false, confidence: 0, reason: 'Contains spam indicators' };
    }

    // Repetition check
    if (this.recentReplies.has(reply.toLowerCase())) {
      return { isValid: false, confidence: 0, reason: 'Duplicate reply detected' };
    }

    // Add to recent replies (keep last 50)
    this.recentReplies.add(reply.toLowerCase());
    if (this.recentReplies.size > 50) {
      const firstReply = this.recentReplies.values().next().value;
      this.recentReplies.delete(firstReply);
    }

    // Calculate confidence based on content quality
    let confidence = 0.5;
    
    // Boost for sophisticated language
    if (reply.includes('mechanism') || reply.includes('nuance') || reply.includes('perspective')) {
      confidence += 0.2;
    }
    
    // Boost for questions or insights
    if (reply.includes('?') || reply.includes('interesting') || reply.includes('connection')) {
      confidence += 0.1;
    }
    
    // Boost for contextual relevance
    const tweetWords = tweet.content.toLowerCase().split(' ');
    const replyWords = reply.toLowerCase().split(' ');
    const overlap = tweetWords.filter(word => replyWords.includes(word)).length;
    confidence += Math.min(overlap * 0.05, 0.2);

    return {
      isValid: true,
      confidence: Math.min(confidence, 1.0),
      reason: 'Valid reply generated'
    };
  }

  /**
   * 📈 Estimate potential engagement for the reply
   */
  private estimateEngagement(tweet: ScrapedTweet, reply: string): number {
    let score = tweet.engagement.likes * 0.1; // Base on original tweet engagement
    
    // Boost for verified authors
    if (tweet.author.verified) score *= 1.5;
    
    // Boost for insightful replies
    if (reply.includes('?') || reply.length > 100) score *= 1.2;
    
    // Boost for trending topics
    if (tweet.content.includes('AI') || tweet.content.includes('health')) score *= 1.3;
    
    return Math.round(Math.min(score, 100));
  }

  /**
   * 🔄 Reset daily interaction limits (call this once per day)
   */
  resetDailyLimits(): void {
    this.authorInteractions.clear();
    this.replyPatterns.forEach(pattern => pattern.usageCount = 0);
    this.saveUsageHistory();
    console.log('✅ Daily reply limits reset');
  }

  /**
   * 📊 Get stealth statistics
   */
  getStealthStats(): any {
    return {
      patternsUsed: this.replyPatterns.map(p => ({ name: p.name, usageCount: p.usageCount })),
      authorInteractions: Array.from(this.authorInteractions.entries()),
      recentRepliesCount: this.recentReplies.size,
      totalRepliesGenerated: this.replyPatterns.reduce((sum, p) => sum + p.usageCount, 0)
    };
  }

  /**
   * 🤖 MAIN REPLY SYSTEM ORCHESTRATOR
   * This is the main method called by the scheduler every 60 minutes
   */
  async runReplySystem(): Promise<{
    success: boolean;
    tweetsFound: number;
    repliesGenerated: number;
    repliesPosted: number;
    errors: string[];
    summary: string;
  }> {
    // 🚨 EMERGENCY DISABLED: This was posting fake "Reply to tweet mock_tweet_..." content
    console.log('🚫 Reply Agent DISABLED - was posting fake content');
    return {
      success: false,
      tweetsFound: 0,
      repliesGenerated: 0,
      repliesPosted: 0,
      errors: ['System disabled - was posting fake content'],
      summary: 'Reply Agent disabled to prevent fake content posting'
    };
  }
}

// Export singleton instance
export const replyAgent = new ReplyAgent(); 