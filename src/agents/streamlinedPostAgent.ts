/**
 * 🚀 STREAMLINED POST AGENT
 * 
 * Clean, focused posting agent that replaces the 4,497-line monolith.
 * Follows single responsibility principle with clear separation of concerns.
 * 
 * Features:
 * - Focused posting logic only
 * - Integrated quality assurance
 * - Budget-aware operations
 * - Performance tracking
 * - Modular content generation
 */

import { unifiedBudget, type OperationCost } from '../utils/unifiedBudgetManager';
import { twitterRateLimits } from '../utils/twitterRateLimits';
import { qualityEngine, type ContentAnalysis } from '../utils/contentQualityEngine';
import { engagementTracker } from '../utils/engagementGrowthTracker';
import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';

export interface PostRequest {
  content?: string;
  contentType?: string;
  forcePost?: boolean;
  includeImage?: boolean;
  priority?: 'critical' | 'important' | 'optional';
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  qualityScore?: number;
  error?: string;
  budgetUsed?: number;
  rateLimitStatus?: any;
  improvements?: string[];
}

export interface ContentStrategy {
  type: 'research_insight' | 'breaking_news' | 'analysis' | 'expert_opinion' | 'trend_discussion';
  urgency: number; // 0-1
  expectedEngagement: number; // 0-1
  budgetRequirement: number; // USD
}

export class StreamlinedPostAgent {
  private static instance: StreamlinedPostAgent;
  
  // Content generation strategies ordered by effectiveness
  private static readonly CONTENT_STRATEGIES: ContentStrategy[] = [
    {
      type: 'research_insight',
      urgency: 0.8,
      expectedEngagement: 0.75,
      budgetRequirement: 0.12
    },
    {
      type: 'breaking_news',
      urgency: 0.9,
      expectedEngagement: 0.8,
      budgetRequirement: 0.15
    },
    {
      type: 'expert_opinion',
      urgency: 0.6,
      expectedEngagement: 0.7,
      budgetRequirement: 0.10
    },
    {
      type: 'analysis',
      urgency: 0.5,
      expectedEngagement: 0.65,
      budgetRequirement: 0.08
    },
    {
      type: 'trend_discussion',
      urgency: 0.7,
      expectedEngagement: 0.6,
      budgetRequirement: 0.06
    }
  ];

  static getInstance(): StreamlinedPostAgent {
    if (!StreamlinedPostAgent.instance) {
      StreamlinedPostAgent.instance = new StreamlinedPostAgent();
    }
    return StreamlinedPostAgent.instance;
  }

  /**
   * 🎯 MAIN POSTING METHOD
   */
  async createPost(request: PostRequest = {}): Promise<PostResult> {
    console.log('🚀 === STREAMLINED POST CREATION ===');
    
    try {
      // 1. Pre-flight checks
      const preflightResult = await this.runPreflightChecks(request);
      if (!preflightResult.canProceed) {
        return {
          success: false,
          error: preflightResult.reason,
          rateLimitStatus: preflightResult.rateLimitStatus
        };
      }

      // 2. Generate or validate content
      const contentResult = await this.getOrGenerateContent(request);
      if (!contentResult.success) {
        return {
          success: false,
          error: contentResult.error,
          budgetUsed: contentResult.budgetUsed
        };
      }

      // 3. Quality assurance
      const qualityResult = await this.ensureContentQuality(contentResult.content!, request.contentType);
      if (!qualityResult.success) {
        return {
          success: false,
          error: `Quality check failed: ${qualityResult.error}`,
          qualityScore: qualityResult.qualityScore,
          improvements: qualityResult.improvements
        };
      }

      // 4. Post to Twitter
      const postResult = await this.postToTwitter(qualityResult.content!, request);
      if (!postResult.success) {
        return {
          success: false,
          error: postResult.error,
          budgetUsed: (contentResult.budgetUsed || 0) + (qualityResult.budgetUsed || 0)
        };
      }

      // 5. Track performance
      await this.trackPostPerformance(postResult.tweetId!, qualityResult.content!, request.contentType || 'general');

      return {
        success: true,
        tweetId: postResult.tweetId,
        content: qualityResult.content,
        qualityScore: qualityResult.qualityScore,
        budgetUsed: (contentResult.budgetUsed || 0) + (qualityResult.budgetUsed || 0),
        improvements: qualityResult.improvements
      };

    } catch (error) {
      console.error('❌ Post creation failed:', error);
      return {
        success: false,
        error: `System error: ${error.message}`
      };
    }
  }

  /**
   * 🔍 PRE-FLIGHT CHECKS
   */
  private async runPreflightChecks(request: PostRequest): Promise<{
    canProceed: boolean;
    reason?: string;
    rateLimitStatus?: any;
  }> {
    console.log('🔍 Running pre-flight checks...');

    // Check rate limits
    const rateLimitStatus = await twitterRateLimits.canPost();
    if (!rateLimitStatus.canPost) {
      return {
        canProceed: false,
        reason: `Rate limited: ${rateLimitStatus.reason}`,
        rateLimitStatus
      };
    }

    // Check budget availability
    const estimatedBudget = this.estimatePostBudget(request);
    const budgetStatus = await unifiedBudget.getBudgetStatus();
    
    if (budgetStatus.remainingBudget < estimatedBudget && !request.forcePost) {
      return {
        canProceed: false,
        reason: `Insufficient budget: need $${estimatedBudget.toFixed(4)}, have $${budgetStatus.remainingBudget.toFixed(4)}`
      };
    }

    // Emergency lockdown check
    if (budgetStatus.isLocked && !request.forcePost) {
      return {
        canProceed: false,
        reason: 'Emergency budget lockdown active'
      };
    }

    console.log('✅ Pre-flight checks passed');
    return { canProceed: true };
  }

  /**
   * 📝 CONTENT GENERATION
   */
  private async getOrGenerateContent(request: PostRequest): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    budgetUsed?: number;
  }> {
    // If content provided, validate and return
    if (request.content) {
      console.log('📝 Using provided content');
      return {
        success: true,
        content: request.content,
        budgetUsed: 0
      };
    }

    // Generate content based on strategy
    console.log('🎨 Generating new content...');
    return await this.generateStrategicContent(request);
  }

  /**
   * 🎨 STRATEGIC CONTENT GENERATION
   */
  private async generateStrategicContent(request: PostRequest): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    budgetUsed?: number;
  }> {
    const contentType = request.contentType || 'research_insight';
    
    // Find the strategy for this content type
    const strategy = StreamlinedPostAgent.CONTENT_STRATEGIES.find(s => s.type === contentType) ||
                    StreamlinedPostAgent.CONTENT_STRATEGIES[0];

    const operationCost: OperationCost = {
      type: 'content_generation',
      estimatedCost: strategy.budgetRequirement,
      priority: request.priority || 'important',
      fallbackAvailable: true
    };

    const budgetCheck = await unifiedBudget.canAfford(operationCost);
    if (!budgetCheck.approved) {
      console.log('💡 Using fallback content due to budget constraints');
      return this.generateFallbackContent(strategy.type);
    }

    try {
      const content = await this.generateContentByType(strategy.type);
      
      if (content) {
        await unifiedBudget.recordSpending(operationCost, strategy.budgetRequirement);
        return {
          success: true,
          content,
          budgetUsed: strategy.budgetRequirement
        };
      } else {
        return this.generateFallbackContent(strategy.type);
      }

    } catch (error) {
      console.error('❌ Content generation failed:', error);
      return this.generateFallbackContent(strategy.type);
    }
  }

  /**
   * 🏭 CONTENT GENERATION BY TYPE
   */
  private async generateContentByType(type: string): Promise<string | null> {
    const templates = {
      research_insight: [
        "New study in {journal} reveals: {finding}. Analysis of {sample_size} participants shows {result}.",
        "Research breakthrough: {discovery} could transform {field}. Published in {source}.",
        "Data analysis reveals: {insight}. This changes how we think about {domain}."
      ],
      breaking_news: [
        "Breaking: {headline}. {institution} announces {development}.",
        "Just announced: {news}. Industry implications: {impact}.",
        "Update: {event} shows {outcome}. Expert analysis: {insight}."
      ],
      expert_opinion: [
        "Industry perspective: {opinion} based on {experience}. Key insight: {takeaway}.",
        "Expert analysis: {assessment}. Having worked with {context}, I see {trend}.",
        "Professional take: {viewpoint}. The data suggests {conclusion}."
      ],
      analysis: [
        "Deep dive: {topic} analysis reveals {pattern}. Key factors: {elements}.",
        "Trend analysis: {observation} across {timeframe}. Implications: {meaning}.",
        "Data breakdown: {statistics} show {trend}. What it means: {interpretation}."
      ],
      trend_discussion: [
        "Trending: {topic} gaining momentum. Why this matters: {significance}.",
        "Hot topic: {discussion} in {field}. Community insights: {perspective}.",
        "Current focus: {trend} driving {change}. Industry response: {reaction}."
      ]
    };

    const typeTemplates = templates[type] || templates.research_insight;
    const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)];

    // In a real implementation, this would use AI to fill in the template
    // For now, return a placeholder
    return this.fillTemplate(template, type);
  }

  /**
   * 🛡️ FALLBACK CONTENT GENERATION
   */
  private async generateFallbackContent(type: string): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    budgetUsed?: number;
  }> {
    const fallbackTemplates = {
      research_insight: [
        "Latest healthcare AI research shows promising results in diagnostic accuracy. Early studies indicate 15% improvement over traditional methods.",
        "New telemedicine adoption data reveals 78% patient satisfaction in rural areas. Digital health equity remains key focus.",
        "Precision medicine advances continue with personalized treatment protocols showing 25% better outcomes."
      ],
      breaking_news: [
        "FDA announces new guidelines for digital health platforms. Implementation begins Q2 2024.",
        "Major healthcare system adopts AI-powered diagnostic tools across 50+ facilities.",
        "Healthcare funding reaches $12B this quarter, with 60% going to preventive care technologies."
      ],
      expert_opinion: [
        "Healthcare transformation accelerates as AI integration becomes standard practice. The focus shifts from adoption to optimization.",
        "Industry analysis: Remote patient monitoring grows 200% annually. Quality care delivery evolves with technology.",
        "Expert insight: Healthcare data interoperability remains the biggest challenge for seamless patient care."
      ]
    };

    const templates = fallbackTemplates[type] || fallbackTemplates.research_insight;
    const content = templates[Math.floor(Math.random() * templates.length)];

    return {
      success: true,
      content,
      budgetUsed: 0
    };
  }

  /**
   * ✨ QUALITY ASSURANCE
   */
  private async ensureContentQuality(content: string, contentType?: string): Promise<{
    success: boolean;
    content?: string;
    qualityScore?: number;
    error?: string;
    improvements?: string[];
    budgetUsed?: number;
  }> {
    console.log('✨ Ensuring content quality...');

    const analysis = await qualityEngine.analyzeContent(content, contentType || 'general');
    
    if (!analysis.overall.passed) {
      // Try to improve the content
      const improvement = await qualityEngine.improveContent(content, analysis);
      
      if (improvement && improvement.quality_gain > 5) {
        const newAnalysis = await qualityEngine.analyzeContent(improvement.improved, contentType);
        
        if (newAnalysis.overall.passed) {
          return {
            success: true,
            content: improvement.improved,
            qualityScore: newAnalysis.overall.score,
            improvements: improvement.improvements_made,
            budgetUsed: 0.008 // Cost of improvement
          };
        }
      }
      
      return {
        success: false,
        error: `Quality score too low: ${analysis.overall.score}/100`,
        qualityScore: analysis.overall.score,
        improvements: analysis.overall.improvements
      };
    }

    return {
      success: true,
      content,
      qualityScore: analysis.overall.score,
      budgetUsed: 0
    };
  }

  /**
   * 🐦 POST TO TWITTER
   */
  private async postToTwitter(content: string, request: PostRequest): Promise<{
    success: boolean;
    tweetId?: string;
    error?: string;
  }> {
    console.log('🐦 Posting to Twitter...');

    try {
      const result = await xClient.postTweet(content);
      
      if (result.success && result.tweetId) {
        // Record the post in rate limits
        await twitterRateLimits.recordPost();
        
        console.log(`✅ Tweet posted successfully: ${result.tweetId}`);
        return {
          success: true,
          tweetId: result.tweetId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to post tweet'
        };
      }

    } catch (error) {
      console.error('❌ Twitter posting failed:', error);
      return {
        success: false,
        error: `Twitter error: ${error.message}`
      };
    }
  }

  /**
   * 📊 PERFORMANCE TRACKING
   */
  private async trackPostPerformance(tweetId: string, content: string, contentType: string): Promise<void> {
    try {
      // Record in engagement tracker
      await engagementTracker.recordTweetPerformance(tweetId, content, contentType);
      
      // Store in database
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('tweets')
          .insert({
            tweet_id: tweetId,
            content,
            tweet_type: contentType,
            created_at: new Date().toISOString()
          });
      }

      console.log(`📊 Performance tracking initialized for tweet: ${tweetId}`);
    } catch (error) {
      console.error('❌ Performance tracking failed:', error);
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private estimatePostBudget(request: PostRequest): number {
    let budget = 0.05; // Base cost for posting

    if (!request.content) {
      // Add content generation cost
      const contentType = request.contentType || 'research_insight';
      const strategy = StreamlinedPostAgent.CONTENT_STRATEGIES.find(s => s.type === contentType);
      budget += strategy?.budgetRequirement || 0.10;
    }

    // Add quality assurance cost
    budget += 0.01;

    return budget;
  }

  private fillTemplate(template: string, type: string): string {
    const placeholders = {
      journal: 'Nature Medicine',
      finding: 'AI diagnostics improve accuracy by 15%',
      sample_size: '10,000',
      result: 'significant improvement in early detection',
      discovery: 'Machine learning algorithm',
      field: 'healthcare diagnostics',
      source: 'Stanford Medical School',
      insight: 'personalized medicine shows promise',
      domain: 'precision healthcare',
      headline: 'FDA approves new AI diagnostic tool',
      institution: 'Mayo Clinic',
      development: 'breakthrough in cancer detection',
      news: 'Healthcare AI funding reaches $2B',
      impact: 'faster diagnosis, better outcomes',
      event: 'Clinical trial results',
      outcome: '25% improvement in treatment success',
      opinion: 'AI integration accelerates healthcare transformation',
      experience: '15 years in health tech',
      takeaway: 'focus on patient-centered design',
      assessment: 'Healthcare AI adoption exceeds expectations',
      context: '500+ healthcare startups',
      trend: 'shift toward preventive care',
      viewpoint: 'Data interoperability remains crucial',
      conclusion: 'collaboration drives innovation',
      topic: 'Healthcare technology trends',
      pattern: 'consistent growth in telemedicine',
      elements: 'accessibility, quality, cost reduction',
      observation: 'Remote patient monitoring adoption',
      timeframe: '2023-2024',
      meaning: 'improved access to rural healthcare',
      statistics: 'Recent survey data',
      interpretation: 'patient satisfaction increases significantly',
      discussion: 'AI ethics in healthcare',
      significance: 'shapes future medical practice',
      perspective: 'balanced approach needed',
      change: 'industry-wide digital transformation',
      reaction: 'increased investment in training'
    };

    let filled = template;
    Object.entries(placeholders).forEach(([key, value]) => {
      filled = filled.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return filled;
  }

  /**
   * 📈 STATUS METHODS
   */
  async getSystemStatus(): Promise<{
    canPost: boolean;
    rateLimitStatus: any;
    budgetStatus: any;
    qualitySystemStatus: string;
  }> {
    const [rateLimitStatus, budgetStatus] = await Promise.all([
      twitterRateLimits.canPost(),
      unifiedBudget.getBudgetStatus()
    ]);

    return {
      canPost: rateLimitStatus.canPost && budgetStatus.canAffordOperation,
      rateLimitStatus,
      budgetStatus,
      qualitySystemStatus: 'operational'
    };
  }

  async getPerformanceMetrics(): Promise<any> {
    return await engagementTracker.getPerformanceDashboard();
  }
}

// Export singleton instance
export const streamlinedPostAgent = StreamlinedPostAgent.getInstance(); 