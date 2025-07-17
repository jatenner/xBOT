/**
 * 🔥 ADDICTION VIRAL ENGINE
 * ========================
 * 
 * Core engine that makes @SignalAndSynapse addictive through:
 * 1. Dynamic posting frequency (3-20 posts/day based on performance)
 * 2. Psychological addiction hooks (dopamine, FOMO, cliffhangers)
 * 3. Real-time trend jacking and viral opportunity detection
 * 4. Engagement-based learning and adaptation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';

interface ViralConfig {
  // Addiction Psychology
  viralHookPercentage: number;
  controversyPercentage: number;
  addictionHookPercentage: number;
  cliffhangerPercentage: number;
  
  // Dynamic Posting
  basePosts: number;
  maxPosts: number;
  minPosts: number;
  
  // Performance Thresholds
  viralThresholdLikes: number;
  viralThresholdRetweets: number;
  
  // Learning Settings
  learningFrequency: number; // minutes
  trendMonitoringFrequency: number; // minutes
}

interface EngagementData {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  timestamp: Date;
  content: string;
  isViral: boolean;
}

interface AddictionHook {
  hook: string;
  type: 'cliffhanger' | 'fomo' | 'curiosity_gap' | 'controversy' | 'insider_secret';
  performanceScore: number;
  usageCount: number;
}

export class AddictionViralEngine {
  private config: ViralConfig | null = null;
  private addictionHooks: AddictionHook[] = [];
  private recentEngagement: EngagementData[] = [];
  private currentMomentumScore: number = 0;
  private lastLearningUpdate: Date = new Date();
  private viralOpportunities: string[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('🔥 Addiction Viral Engine initializing...');
    
    try {
      await this.loadConfig();
      await this.loadAddictionHooks();
      await this.loadRecentEngagement();
      this.calculateMomentumScore();
      
      console.log('✅ Addiction Viral Engine ready for maximum engagement');
    } catch (error) {
      console.error('❌ Failed to initialize Addiction Viral Engine:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', [
        'viral_hook_percentage', 'controversy_percentage', 'addiction_hook_percentage',
        'cliffhanger_percentage', 'base_posts_per_day', 'max_posts_per_day', 'min_posts_per_day',
        'viral_threshold_likes', 'viral_threshold_retweets', 'engagement_learning_frequency',
        'trend_monitoring_frequency'
      ]);

    const configMap = new Map(configs?.map(c => [c.key, c.value]) || []);

    this.config = {
      viralHookPercentage: parseInt(configMap.get('viral_hook_percentage') || '70'),
      controversyPercentage: parseInt(configMap.get('controversy_percentage') || '30'),
      addictionHookPercentage: parseInt(configMap.get('addiction_hook_percentage') || '60'),
      cliffhangerPercentage: parseInt(configMap.get('cliffhanger_percentage') || '40'),
      basePosts: parseInt(configMap.get('base_posts_per_day') || '8'),
      maxPosts: parseInt(configMap.get('max_posts_per_day') || '20'),
      minPosts: parseInt(configMap.get('min_posts_per_day') || '3'),
      viralThresholdLikes: parseInt(configMap.get('viral_threshold_likes') || '50'),
      viralThresholdRetweets: parseInt(configMap.get('viral_threshold_retweets') || '10'),
      learningFrequency: parseInt(configMap.get('engagement_learning_frequency') || '30'),
      trendMonitoringFrequency: parseInt(configMap.get('trend_monitoring_frequency') || '15')
    };

    console.log('🎯 Viral config loaded:', this.config);
  }

  private async loadAddictionHooks(): Promise<void> {
    const { data: hooks } = await supabase
      .from('bot_config')
      .select('key, value')
      .like('key', 'addiction_hook_%');

    this.addictionHooks = hooks?.map(h => ({
      hook: h.value,
      type: this.determineHookType(h.value),
      performanceScore: 0,
      usageCount: 0
    })) || [];

    console.log(`🎪 Loaded ${this.addictionHooks.length} addiction hooks`);
  }

  private determineHookType(hook: string): AddictionHook['type'] {
    if (hook.includes('Thread:') || hook.includes('(1/')) return 'cliffhanger';
    if (hook.includes('don\'t want you to know') || hook.includes('secret')) return 'insider_secret';
    if (hook.includes('BREAKING') || hook.includes('shocked')) return 'fomo';
    if (hook.includes('Controversial') || hook.includes('Unpopular')) return 'controversy';
    return 'curiosity_gap';
  }

  private async loadRecentEngagement(): Promise<void> {
    const { data: tweets } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    this.recentEngagement = tweets?.map(tweet => ({
      likes: tweet.likes || 0,
      retweets: tweet.retweets || 0,
      replies: tweet.replies || 0,
      impressions: tweet.impressions || 0,
      timestamp: new Date(tweet.created_at),
      content: tweet.content || '',
      isViral: (tweet.likes || 0) >= this.config!.viralThresholdLikes
    })) || [];

    console.log(`📊 Loaded ${this.recentEngagement.length} recent engagement data points`);
  }

  private calculateMomentumScore(): void {
    if (this.recentEngagement.length === 0) {
      this.currentMomentumScore = 0;
      return;
    }

    // Calculate momentum based on recent performance
    const last24Hours = this.recentEngagement.filter(
      e => Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const avgLikes = last24Hours.reduce((sum, e) => sum + e.likes, 0) / last24Hours.length;
    const avgRetweets = last24Hours.reduce((sum, e) => sum + e.retweets, 0) / last24Hours.length;
    const viralCount = last24Hours.filter(e => e.isViral).length;

    // Momentum score 0-100
    this.currentMomentumScore = Math.min(100, 
      (avgLikes * 2) + (avgRetweets * 10) + (viralCount * 25)
    );

    console.log(`⚡ Current momentum score: ${this.currentMomentumScore}/100`);
  }

  /**
   * 🎯 CORE METHOD: Determine how many posts to make today
   */
  public async getDynamicPostingFrequency(): Promise<number> {
    if (!this.config) await this.loadConfig();
    
    this.calculateMomentumScore();
    
    let postsToday = this.config!.basePosts;

    // Scale based on momentum
    if (this.currentMomentumScore > 80) {
      postsToday = this.config!.maxPosts; // 20 posts - ride the wave!
    } else if (this.currentMomentumScore > 60) {
      postsToday = Math.floor(this.config!.basePosts * 1.5); // 12 posts
    } else if (this.currentMomentumScore > 40) {
      postsToday = this.config!.basePosts; // 8 posts - normal
    } else if (this.currentMomentumScore > 20) {
      postsToday = Math.floor(this.config!.basePosts * 0.75); // 6 posts
    } else {
      postsToday = this.config!.minPosts; // 3 posts - low engagement mode
    }

    // Detect viral opportunities and boost posting
    const viralOpportunitiesDetected = await this.detectViralOpportunities();
    if (viralOpportunitiesDetected > 0) {
      postsToday = Math.min(this.config!.maxPosts, postsToday + viralOpportunitiesDetected * 2);
      console.log(`🚀 Viral opportunities detected: +${viralOpportunitiesDetected * 2} posts`);
    }

    console.log(`📊 Dynamic posting frequency: ${postsToday} posts (momentum: ${this.currentMomentumScore})`);
    
    // Store decision for tracking
    await this.recordPostingDecision(postsToday, this.currentMomentumScore);
    
    return postsToday;
  }

  /**
   * 🎪 CORE METHOD: Generate addiction-optimized content
   */
  public async generateAddictiveContent(topic?: string): Promise<string> {
    if (!this.config) await this.loadConfig();
    
    // Select hook based on performance and addiction strategy
    const selectedHook = this.selectOptimalHook();
    const contentType = this.determineContentType();
    
    const prompt = this.buildAddictionPrompt(selectedHook, contentType, topic);
    
    try {
      const content = await openaiClient.generateCompletion(prompt, {
        model: 'gpt-4o-mini',
        maxTokens: 280,
        temperature: 0.8
      });
      
      // Track hook usage
      await this.trackHookUsage(selectedHook.hook, content);
      
      console.log(`🎯 Generated ${contentType} content with ${selectedHook.type} hook`);
      
      return content;
    } catch (error) {
      console.error('❌ Error generating addictive content:', error);
      return selectedHook.hook; // Fallback to raw hook
    }
  }

  private selectOptimalHook(): AddictionHook {
    // Use performance-based selection with some randomness
    const sortedHooks = [...this.addictionHooks].sort((a, b) => 
      (b.performanceScore - b.usageCount * 0.1) - (a.performanceScore - a.usageCount * 0.1)
    );
    
    // Select from top 5 performing hooks with weighted randomness
    const topHooks = sortedHooks.slice(0, 5);
    const weights = topHooks.map((_, i) => Math.max(1, 5 - i));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < topHooks.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return topHooks[i];
      }
    }
    
    return topHooks[0] || this.addictionHooks[0];
  }

  private determineContentType(): string {
    const rand = Math.random() * 100;
    
    if (rand < this.config!.controversyPercentage) return 'controversial';
    if (rand < this.config!.controversyPercentage + 25) return 'trend_jacking';
    if (rand < this.config!.controversyPercentage + 40) return 'insider_secrets';
    if (rand < this.config!.controversyPercentage + 55) return 'cliffhanger_thread';
    if (rand < this.config!.controversyPercentage + 70) return 'hot_take';
    
    return 'curiosity_gap';
  }

  private buildAddictionPrompt(hook: AddictionHook, contentType: string, topic?: string): string {
    const topicContext = topic ? `Topic focus: ${topic}\n` : '';
    
    return `You are creating ADDICTIVE healthcare content for @SignalAndSynapse that makes people come back for more.

${topicContext}
Hook to use: "${hook.hook}"
Content type: ${contentType}

ADDICTION PSYCHOLOGY RULES:
1. Use dopamine triggers (curiosity gaps, cliffhangers, FOMO)
2. Create strong emotional reactions (surprise, controversy, insider knowledge)
3. End with hooks that make people want to follow for more
4. Use accessible language - NO academic jargon
5. Make it shareable and debate-worthy

BANNED PHRASES: "BREAKTHROUGH:", "Research shows", "Studies indicate", "According to research"

REQUIRED ELEMENTS:
- Start with the provided hook
- Include healthcare expertise but make it accessible
- End with engagement driver (question, cliffhanger, or controversial statement)
- Keep under 280 characters including the hook

Generate ONE addictive tweet that healthcare professionals will obsess over:`;
  }

  private async trackHookUsage(hook: string, generatedContent: string): Promise<void> {
    const hookIndex = this.addictionHooks.findIndex(h => h.hook === hook);
    if (hookIndex >= 0) {
      this.addictionHooks[hookIndex].usageCount++;
    }

    // Store usage for performance tracking
    await supabase.from('content_performance').insert({
      hook_used: hook,
      content: generatedContent,
      generated_at: new Date().toISOString(),
      performance_score: 0 // Will be updated when engagement data comes in
    });
  }

  /**
   * 🔍 CORE METHOD: Detect viral opportunities from trends
   */
  private async detectViralOpportunities(): Promise<number> {
    // This would integrate with Twitter trends API or news sources
    // For now, simulate viral opportunity detection
    
    const opportunities = [
      'AI healthcare breakthrough',
      'Healthcare data privacy scandal',
      'New FDA approval controversy',
      'Healthcare cost crisis',
      'Medical device recall'
    ];
    
    // Simulate trend detection (in real implementation, this would check actual trends)
    const detectedOpportunities = opportunities.filter(() => Math.random() < 0.1); // 10% chance each
    
    this.viralOpportunities = detectedOpportunities;
    
    if (detectedOpportunities.length > 0) {
      console.log(`🚨 Viral opportunities detected: ${detectedOpportunities.join(', ')}`);
    }
    
    return detectedOpportunities.length;
  }

  /**
   * 📈 CORE METHOD: Learn from engagement and adapt strategy
   */
  public async performLearningUpdate(): Promise<void> {
    const now = new Date();
    const timeSinceLastUpdate = now.getTime() - this.lastLearningUpdate.getTime();
    
    if (timeSinceLastUpdate < this.config!.learningFrequency * 60 * 1000) {
      return; // Not time for learning update yet
    }

    console.log('🧠 Performing learning update...');
    
    try {
      // Update engagement data
      await this.loadRecentEngagement();
      
      // Update hook performance scores
      await this.updateHookPerformance();
      
      // Adapt strategy based on what's working
      await this.adaptStrategy();
      
      this.lastLearningUpdate = now;
      
      console.log('✅ Learning update complete');
    } catch (error) {
      console.error('❌ Learning update failed:', error);
    }
  }

  private async updateHookPerformance(): Promise<void> {
    const { data: performances } = await supabase
      .from('content_performance')
      .select('*')
      .gte('generated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    for (const performance of performances || []) {
      const hookIndex = this.addictionHooks.findIndex(h => h.hook === performance.hook_used);
      if (hookIndex >= 0) {
        // Update performance score based on engagement
        const engagementScore = (performance.likes || 0) * 1 + 
                              (performance.retweets || 0) * 5 + 
                              (performance.replies || 0) * 3;
        
        this.addictionHooks[hookIndex].performanceScore = 
          (this.addictionHooks[hookIndex].performanceScore + engagementScore) / 2;
      }
    }
  }

  private async adaptStrategy(): Promise<void> {
    // Find best performing content types and hooks
    const viralContent = this.recentEngagement.filter(e => e.isViral);
    
    if (viralContent.length > 0) {
      console.log(`🚀 ${viralContent.length} viral posts detected - adapting strategy`);
      
      // Increase frequency of successful patterns
      // This would analyze what made content viral and adjust config accordingly
    }
  }

  private async recordPostingDecision(postsPlanned: number, momentumScore: number): Promise<void> {
    await supabase.from('posting_decisions').insert({
      date: new Date().toISOString().split('T')[0],
      posts_planned: postsPlanned,
      momentum_score: momentumScore,
      reasoning: `Dynamic frequency based on momentum score ${momentumScore}`
    });
  }

  /**
   * 🎯 PUBLIC METHOD: Get next posting time using addiction psychology
   */
  public getNextPostingTime(): Date {
    const now = new Date();
    
    // Use variable ratio schedule for addiction
    const baseInterval = this.currentMomentumScore > 60 ? 2 : 3; // hours
    const randomVariation = Math.random() * 0.5 - 0.25; // ±15 minutes
    const nextPostMinutes = (baseInterval + randomVariation) * 60;
    
    return new Date(now.getTime() + nextPostMinutes * 60 * 1000);
  }

  /**
   * 🔥 PUBLIC METHOD: Check if we should post now based on addiction timing
   */
  public shouldPostNow(): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    // Prime addiction times (when people check phones most)
    const primeHours = [7, 8, 12, 17, 18, 20, 21];
    const isPrimeTime = primeHours.includes(hour);
    
    // Higher posting probability during momentum and prime time
    const baseChance = this.currentMomentumScore > 60 ? 0.3 : 0.1;
    const primeTimeBonus = isPrimeTime ? 0.2 : 0;
    const viralOpportunityBonus = this.viralOpportunities.length > 0 ? 0.3 : 0;
    
    const postingChance = Math.min(0.8, baseChance + primeTimeBonus + viralOpportunityBonus);
    
    return Math.random() < postingChance;
  }
}

// Export singleton instance
export const addictionViralEngine = new AddictionViralEngine(); 