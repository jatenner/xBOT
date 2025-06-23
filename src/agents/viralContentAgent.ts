import { openaiClient } from '../utils/openaiClient';
import { formatTweet } from '../utils/formatTweet';

/**
 * 🔥 VIRAL CONTENT AGENT
 * 
 * Fixes the critical engagement issues identified in audit:
 * - Stops repetitive content (50% duplicates)
 * - Adds personality and humor
 * - Creates follow-worthy value
 * - Implements viral engagement hooks
 */
export class ViralContentAgent {
  
  private recentContentHashes: Set<string> = new Set();
  private maxRecentContent = 50;
  
  /**
   * Generate viral content that people actually want to follow
   */
  async generateViralTweet(): Promise<{
    success: boolean;
    content?: string;
    type?: string;
    engagement_potential?: number;
    error?: string;
  }> {
    
    // Select viral content type with weighted distribution
    const contentType = this.selectViralContentType();
    
    console.log(`🔥 Generating ${contentType} content for maximum engagement...`);
    
    try {
      let content: string;
      
      switch (contentType) {
        case 'hot_take':
          content = await this.generateHotTake();
          break;
        case 'insider_info':
          content = await this.generateInsiderInfo();
          break;
        case 'humor':
          content = await this.generateHumor();
          break;
        case 'breaking_news':
          content = await this.generateBreakingNews();
          break;
        case 'thread_starter':
          content = await this.generateThreadStarter();
          break;
        case 'controversy':
          content = await this.generateControversy();
          break;
        default:
          content = await this.generateHotTake();
      }
      
      // Ensure content is unique
      if (!this.isContentUnique(content)) {
        console.log('🔄 Content too similar, regenerating...');
        // Try once more with different type
        const altType = this.selectViralContentType();
        content = await this.generateContentByType(altType);
      }
      
      // Track this content
      this.trackContent(content);
      
      const formatted = formatTweet(content);
      const engagementPotential = this.calculateEngagementPotential(content, contentType);
      
      return {
        success: true,
        content: formatted.content || content,
        type: contentType,
        engagement_potential: engagementPotential
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Viral generation failed'
      };
    }
  }
  
  /**
   * Select content type with emphasis on high-engagement formats
   */
  private selectViralContentType(): string {
    const weightedTypes = [
      { type: 'hot_take', weight: 25 },      // Controversial = high engagement
      { type: 'humor', weight: 20 },         // Relatable = shareable  
      { type: 'insider_info', weight: 20 },  // Exclusive = follow value
      { type: 'controversy', weight: 15 },   // Debate = replies
      { type: 'thread_starter', weight: 10 }, // Threads = viral potential
      { type: 'breaking_news', weight: 10 }  // Urgency = retweets
    ];
    
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const item of weightedTypes) {
      cumulative += item.weight;
      if (random <= cumulative) {
        return item.type;
      }
    }
    
    return 'hot_take'; // Default fallback
  }
  
  /**
   * Generate controversial hot takes that spark engagement
   */
  private async generateHotTake(): Promise<string> {
    const hotTakePrompts = [
      `Write a controversial but defensible hot take about AI in healthcare. Format: "🔥 Hot take: [bold claim]. Here's why this [industry impact] is happening faster than expected..." Include specific data. Under 240 chars.`,
      
      `Create a contrarian opinion about digital health trends. Use format: "💣 Unpopular opinion: [controversial statement]. The data backs this up:" Include surprising statistics. Bold tone, under 240 chars.`,
      
      `Generate a bold prediction about health tech that will surprise people. Format: "⚡ Bold prediction: [specific prediction with timeline]. Here's why:" Include compelling reasoning. Under 240 chars.`
    ];
    
    const prompt = hotTakePrompts[Math.floor(Math.random() * hotTakePrompts.length)];
    
    return await openaiClient.generateCompletion(prompt, {
      maxTokens: 80,
      temperature: 0.9 // High creativity for hot takes
    }) || this.getHotTakeFallback();
  }
  
  /**
   * Generate insider information that provides follow value
   */
  private async generateInsiderInfo(): Promise<string> {
    const insiderPrompts = [
      `Write insider information about health tech industry. Format: "💡 Here's what [big company] doesn't want you to know about [technology]..." Include specific insights that make people want to follow for more. Under 240 chars.`,
      
      `Create exclusive behind-the-scenes content. Format: "🎯 I just left a meeting with [industry] executives. They're scared of..." Include specific concerns and implications. Authoritative tone, under 240 chars.`,
      
      `Generate venture capital insider info. Format: "💰 VCs are secretly funding this [technology] before it goes public:" Include specific market insights and timing. Under 240 chars.`
    ];
    
    const prompt = insiderPrompts[Math.floor(Math.random() * insiderPrompts.length)];
    
    return await openaiClient.generateCompletion(prompt, {
      maxTokens: 85,
      temperature: 0.8
    }) || this.getInsiderFallback();
  }
  
  /**
   * Generate relatable humor that gets shared
   */
  private async generateHumor(): Promise<string> {
    const humorPrompts = [
      `Write funny, relatable content about health tech. Format: "😂 My [device]: '[advice]' Me: *[contradictory action]* 'No.'" Make it specifically about health/fitness technology. Relatable and shareable. Under 240 chars.`,
      
      `Create humorous observations about AI in healthcare. Format: "🤖 AI: [impressive capability]. Also AI: [funny mistake or limitation]" Focus on the irony of advanced health tech. Under 240 chars.`,
      
      `Generate self-deprecating humor about health tracking. Focus on the gap between what devices expect vs reality. Include emojis, make it shareable. Under 240 chars.`
    ];
    
    const prompt = humorPrompts[Math.floor(Math.random() * humorPrompts.length)];
    
    return await openaiClient.generateCompletion(prompt, {
      maxTokens: 75,
      temperature: 0.9 // High creativity for humor
    }) || this.getHumorFallback();
  }
  
  /**
   * Generate breaking news style content
   */
  private async generateBreakingNews(): Promise<string> {
    const newsPrompts = [
      `Write urgent breaking news about health tech. Format: "🚨 JUST IN: [company/technology] just [major development] that will change everything" Include specific impact and implications. Urgent tone, under 240 chars.`,
      
      `Create breaking news about regulatory approvals. Format: "⚡ BREAKING: FDA just approved [technology] that will [major impact]" Include market implications and patient benefits. Under 240 chars.`,
      
      `Generate urgent industry disruption news. Format: "🔔 ALERT: This [innovation] just made [traditional method] obsolete" Include specific numbers and timeline. Under 240 chars.`
    ];
    
    const prompt = newsPrompts[Math.floor(Math.random() * newsPrompts.length)];
    
    return await openaiClient.generateCompletion(prompt, {
      maxTokens: 80,
      temperature: 0.7
    }) || this.getBreakingNewsFallback();
  }
  
  /**
   * Generate thread starters for viral threads
   */
  private async generateThreadStarter(): Promise<string> {
    const threadPrompts = [
      `Write a thread starter about health tech predictions. Format: "🧵 Thread: [number] [topic] that will blow your mind" Make it compelling enough that people want to see the full thread. Under 240 chars.`,
      
      `Create a thread starter about industry fears. Format: "🧵 Why [group] are terrified of [technology] (and they should be)" Include hint at explosive revelations. Under 240 chars.`,
      
      `Generate analysis thread starter. Format: "🧵 I analyzed [big number] [data source]. Here's what I found:" Tease surprising discoveries. Under 240 chars.`
    ];
    
    const prompt = threadPrompts[Math.floor(Math.random() * threadPrompts.length)];
    
    return await openaiClient.generateCompletion(prompt, {
      maxTokens: 75,
      temperature: 0.8
    }) || this.getThreadStarterFallback();
  }
  
  /**
   * Generate controversial content that drives debates
   */
  private async generateControversy(): Promise<string> {
    const controversyPrompts = [
      `Write a controversial but defensible claim about telemedicine or digital health. Format should be provocative but backed by logic. Include specific viewpoint that will spark debate. Under 240 chars.`,
      
      `Create a counter-narrative about popular health tech. Challenge common assumptions with specific reasoning. Make it thought-provoking enough to generate replies and debate. Under 240 chars.`,
      
      `Generate a contrarian view about AI replacing healthcare workers. Include specific timeline and reasoning that people will want to argue with or defend. Under 240 chars.`
    ];
    
    const prompt = controversyPrompts[Math.floor(Math.random() * controversyPrompts.length)];
    
    return await openaiClient.generateCompletion(prompt, {
      maxTokens: 80,
      temperature: 0.8
    }) || this.getControversyFallback();
  }
  
  /**
   * Generate content by specific type (for regeneration)
   */
  private async generateContentByType(type: string): Promise<string> {
    switch (type) {
      case 'hot_take': return await this.generateHotTake();
      case 'insider_info': return await this.generateInsiderInfo();
      case 'humor': return await this.generateHumor();
      case 'breaking_news': return await this.generateBreakingNews();
      case 'thread_starter': return await this.generateThreadStarter();
      case 'controversy': return await this.generateControversy();
      default: return await this.generateHotTake();
    }
  }
  
  /**
   * Check if content is unique enough
   */
  private isContentUnique(content: string): boolean {
    const hash = this.generateContentHash(content);
    return !this.recentContentHashes.has(hash);
  }
  
  /**
   * Generate content hash for uniqueness checking
   */
  private generateContentHash(content: string): string {
    return content.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 100);
  }
  
  /**
   * Track content to prevent repetition
   */
  private trackContent(content: string): void {
    const hash = this.generateContentHash(content);
    this.recentContentHashes.add(hash);
    
    if (this.recentContentHashes.size > this.maxRecentContent) {
      const oldest = this.recentContentHashes.values().next().value;
      this.recentContentHashes.delete(oldest);
    }
  }
  
  /**
   * Calculate engagement potential based on content analysis
   */
  private calculateEngagementPotential(content: string, type: string): number {
    let score = 50; // Base score
    
    // Type bonuses
    const typeMultipliers = {
      'hot_take': 1.4,
      'controversy': 1.3,
      'humor': 1.2,
      'insider_info': 1.1,
      'thread_starter': 1.15,
      'breaking_news': 1.1
    };
    
    score *= typeMultipliers[type] || 1.0;
    
    // Content analysis bonuses
    if (content.includes('🔥') || content.includes('💣')) score += 10;
    if (content.includes('?')) score += 5;
    if (/\d+%|\d+\.\d+%/.test(content)) score += 8;
    if (content.includes('🧵')) score += 12;
    if (content.includes('🚨') || content.includes('BREAKING')) score += 8;
    if (content.length > 200) score += 5;
    if (content.includes('😂') || content.includes('🤖')) score += 7;
    
    return Math.min(Math.round(score), 100);
  }
  
  /**
   * High-quality fallback content for each type
   */
  private getHotTakeFallback(): string {
    const fallbacks = [
      "🔥 Hot take: AI will replace radiologists before it replaces nurses. Here's why: Emotional intelligence beats pattern recognition when patients are scared.",
      "💣 Unpopular opinion: Your fitness tracker is making you less healthy by turning exercise into work. The data backs this up: stress responses increase 40%.",
      "⚡ Bold prediction: By 2027, your pharmacist will have more diagnostic power than your doctor. Here's the regulatory timeline making this inevitable."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  private getInsiderFallback(): string {
    const fallbacks = [
      "💡 Here's what Big Pharma doesn't want you to know: AI drug discovery is 90% cheaper. They're buying startups to control the timeline.",
      "🎯 I just left a meeting with healthcare executives. They're terrified of one specific AI company that patients haven't heard of yet.",
      "💰 VCs are secretly funding sleep tech before Apple announces their play. The wearables wars are about to get interesting."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  private getHumorFallback(): string {
    const fallbacks = [
      "😂 My Apple Watch: 'Time to stand!' Me, lying in bed with the flu: 'Read the room, Karen.' 🤖📱",
      "🤖 AI: Can diagnose cancer from a photo. Also AI: Thinks my dog is having a heart attack because I put the fitness tracker on him.",
      "📱 My phone knows I'm about to get sick before I do. Great, now even my technology is judging my life choices."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  private getBreakingNewsFallback(): string {
    const fallbacks = [
      "🚨 JUST IN: FDA approves at-home blood tests that are more accurate than hospital labs. The $50B diagnostics industry just got disrupted.",
      "⚡ BREAKING: This AI can predict heart attacks 5 years before they happen. 89% accuracy. Your doctor doesn't know about it yet.",
      "🔔 ALERT: New brain implant lets paralyzed patients control computers with 99% accuracy. This changes everything we know about disabilities."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  private getThreadStarterFallback(): string {
    const fallbacks = [
      "🧵 Thread: 7 health tech predictions that will blow your mind (and make you rich if you invest now)",
      "🧵 Why doctors are terrified of AI (spoiler: it's not what you think)",
      "🧵 I analyzed 1000 health startups. Here's the pattern that predicts which ones will 100x"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  private getControversyFallback(): string {
    const fallbacks = [
      "Controversial take: Telemedicine is making healthcare worse, not better. We're optimizing for convenience over actual care quality.",
      "🔥 Unpopular truth: Most health apps are digital placebos. The only thing they're curing is investor FOMO.",
      "Hot take: AI diagnosis is overhyped. We're solving the wrong problem. Doctors don't need better pattern recognition; they need more time with patients."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

export const viralContentAgent = new ViralContentAgent(); 