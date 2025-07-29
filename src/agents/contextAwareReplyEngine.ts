/**
 * 🎯 CONTEXT-AWARE REPLY ENGINE
 * 
 * Generates intelligent, contextual replies to influencer tweets with:
 * - Real research citations
 * - Two-pass generation (initial + self-critique)
 * - Style adaptation based on influencer
 * - Similarity checks to avoid repetition
 */

import { ReplyTarget, replyTargetSelector } from '../strategy/replyTargetSelector';
import { realResearchFetcher } from './realResearchFetcher';
import { browserTweetPoster } from '../utils/browserTweetPoster';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { TOPIC_REPLY_STRATEGIES, getInfluencerByUsername } from '../config/influencers';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { AwarenessLogger } from '../utils/awarenessLogger';

export interface ReplyRequest {
  targetTweetId?: string; // Optional: use specific target
  preferredStyle?: 'supportive' | 'questioning' | 'contrarian' | 'educational';
  maxLength?: number;
  requireCitation?: boolean;
  experimental?: boolean;
}

export interface ReplyResult {
  success: boolean;
  replyContent?: string;
  replyTweetId?: string;
  targetTweet?: ReplyTarget;
  citationUsed?: any;
  confidence: number;
  generationMethod: string;
  metadata: {
    passesGenerated: number;
    similarityScore?: number;
    styleUsed: string;
    estimatedEngagement: number;
    riskAssessment: string;
  };
  error?: string;
}

export class ContextAwareReplyEngine {
  private static instance: ContextAwareReplyEngine;
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private isRunning = false;
  private repliesGenerated = 0;

  private constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  }

  static getInstance(): ContextAwareReplyEngine {
    if (!ContextAwareReplyEngine.instance) {
      ContextAwareReplyEngine.instance = new ContextAwareReplyEngine();
    }
    return ContextAwareReplyEngine.instance;
  }

  /**
   * 🎯 Generate and post intelligent reply
   */
  async generateContextualReply(request: ReplyRequest = {}): Promise<ReplyResult> {
    if (this.isRunning) {
      console.log('🎯 Reply engine already running, skipping...');
      return {
        success: false,
        confidence: 0,
        generationMethod: 'skipped',
        metadata: {
          passesGenerated: 0,
          styleUsed: 'none',
          estimatedEngagement: 0,
          riskAssessment: 'low'
        },
        error: 'Already running'
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🎯 === CONTEXT-AWARE REPLY GENERATION ===');

      // Check budget constraints
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        console.log('⚠️ Budget lockdown active, skipping reply generation');
        return this.createFailureResult('Budget lockdown active');
      }

      // Step 1: Select reply target
      const replyOpportunity = await replyTargetSelector.getBestReplyOpportunities();
      
      if (!replyOpportunity.selectedTarget) {
        console.log('⚠️ No suitable reply targets found');
        return this.createFailureResult(replyOpportunity.selectionReason);
      }

      const target = replyOpportunity.selectedTarget;
      console.log(`🎯 Target: @${target.author} - "${target.contentExcerpt}"`);

      // Step 2: Get relevant research citation
      const citation = await realResearchFetcher.fetchCitation(target.topicCategory);
      
      if (!citation && request.requireCitation) {
        console.log('⚠️ No citation available and citation required');
        return this.createFailureResult('Citation required but not available');
      }

      // Step 3: Two-pass generation
      const generatedReply = await this.generateTwoPassReply(target, citation, request);
      
      if (!generatedReply.success) {
        return this.createFailureResult(generatedReply.error || 'Generation failed');
      }

      // Step 4: Similarity check against recent replies
      const similarityCheck = await this.checkReplySimilarity(generatedReply.content, target.author);
      
      if (similarityCheck.tooSimilar) {
        console.log('⚠️ Reply too similar to recent replies, regenerating...');
        // TODO: Implement regeneration logic
        return this.createFailureResult('Reply too similar to recent content');
      }

      // Step 5: Post reply
      console.log('🐦 Posting contextual reply...');
      const postResult = await this.postReply(target, generatedReply.content);

      if (!postResult.success) {
        return this.createFailureResult(`Posting failed: ${postResult.error}`);
      }

      // Step 6: Record in database
      await this.recordReplyHistory(target, generatedReply.content, postResult.tweetId, citation);

      // Step 7: Mark target as replied to
      await replyTargetSelector.markAsRepliedTo(target.tweetId, postResult.tweetId);

      this.repliesGenerated++;
      const duration = Date.now() - startTime;

      console.log(`✅ Contextual reply posted successfully in ${duration}ms`);
      console.log(`   🎯 Target: @${target.author}`);
      console.log(`   💬 Reply: "${generatedReply.content}"`);
      console.log(`   🆔 Reply ID: ${postResult.tweetId}`);

      // Log success
      AwarenessLogger.logSystemState({
        currentTime: new Date(),
        timingState: { lastPostTime: 0, postCount24h: 1, maxDailyPosts: 10, minutesSinceLastPost: 0 },
        engagementContext: { multiplier: 1.0, description: 'reply posted', windowType: 'influencer' },
        decision: { action: 'contextual_reply_posted', priority: 8, reasoning: 'reply to influencer', expectedEngagement: target.engagementVelocity }
      });
      console.log('🎯 Contextual reply posted:', {
        targetAuthor: target.author,
        replyLength: generatedReply.content.length,
        citationUsed: citation?.id || null,
        confidence: replyOpportunity.confidence,
        duration
      });

      return {
        success: true,
        replyContent: generatedReply.content,
        replyTweetId: postResult.tweetId,
        targetTweet: target,
        citationUsed: citation,
        confidence: replyOpportunity.confidence,
        generationMethod: 'two_pass_with_citation',
        metadata: {
          passesGenerated: 2,
          similarityScore: similarityCheck.maxSimilarity,
          styleUsed: target.replyStyle,
          estimatedEngagement: replyOpportunity.estimatedReach * 0.05, // Estimate 5% of reach engages
          riskAssessment: replyOpportunity.riskLevel
        }
      };

    } catch (error) {
      console.error('❌ Context-aware reply generation failed:', error);
      return this.createFailureResult(`Generation error: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 🔄 Two-pass generation: initial + self-critique
   */
  private async generateTwoPassReply(
    target: ReplyTarget, 
    citation: any, 
    request: ReplyRequest
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // Pass 1: Generate initial reply
      const initialReply = await this.generateInitialReply(target, citation, request);
      
      if (!initialReply) {
        return { success: false, error: 'Initial generation failed' };
      }

      console.log(`📝 Initial reply: "${initialReply}"`);

      // Pass 2: Self-critique and refinement
      const refinedReply = await this.selfCritiqueAndRefine(initialReply, target, citation);
      
      if (!refinedReply) {
        // Fallback to initial if refinement fails
        console.log('⚠️ Refinement failed, using initial reply');
        return { success: true, content: initialReply };
      }

      console.log(`✨ Refined reply: "${refinedReply}"`);
      
      return { success: true, content: refinedReply };

    } catch (error) {
      console.error('❌ Two-pass generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📝 Generate initial reply
   */
  private async generateInitialReply(target: ReplyTarget, citation: any, request: ReplyRequest): Promise<string | null> {
    try {
      const influencer = getInfluencerByUsername(target.author);
      const replyStyle = request.preferredStyle || target.replyStyle;
      
      // Get template for this topic and style
      const topicKey = this.mapTopicToStrategyKey(target.topicCategory);
      const template = TOPIC_REPLY_STRATEGIES[topicKey]?.[replyStyle] || 
                      TOPIC_REPLY_STRATEGIES.nutrition.supportive;

      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(target, influencer, replyStyle);
      const userPrompt = this.buildUserPrompt(target, citation, template, request);

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt }
      ];

      const response = await this.budgetAwareOpenAI.createChatCompletion(messages, {
        priority: 'important',
        operationType: 'contextual_reply_generation',
        model: 'gpt-4o-mini',
        maxTokens: 150,
        temperature: 0.9, // Higher creativity for initial pass
        forTweetGeneration: true
      });

      if (!response?.success || !response?.response?.choices?.[0]?.message?.content) {
        throw new Error('No content generated from OpenAI');
      }

      return response.response.choices[0].message.content.trim();

    } catch (error) {
      console.error('❌ Initial reply generation failed:', error);
      return null;
    }
  }

  /**
   * 🔍 Self-critique and refine
   */
  private async selfCritiqueAndRefine(initialReply: string, target: ReplyTarget, citation: any): Promise<string | null> {
    try {
      const critiquePrompt = `
CRITIQUE & REFINE: You're an expert Twitter reply strategist. 

INITIAL REPLY: "${initialReply}"
TARGET TWEET: "${target.contentExcerpt}"
AUTHOR: @${target.author}

Critique the initial reply and provide a refined version that:
1. Sounds more natural and conversational
2. Better engages with the specific point made
3. Uses the citation more elegantly: "${citation?.citationText || 'No citation'}"
4. Stays under 200 characters
5. Avoids sounding robotic or templated

REFINED REPLY:`;

      const messages = [
        { role: 'user' as const, content: critiquePrompt }
      ];

      const response = await this.budgetAwareOpenAI.createChatCompletion(messages, {
        priority: 'important',
        operationType: 'reply_refinement',
        model: 'gpt-4o-mini',
        maxTokens: 100,
        temperature: 0.3, // Lower temperature for refinement
        forTweetGeneration: true
      });

      if (!response?.success || !response?.response?.choices?.[0]?.message?.content) {
        throw new Error('No refined content generated');
      }

      return response.response.choices[0].message.content.trim();

    } catch (error) {
      console.error('❌ Reply refinement failed:', error);
      return null;
    }
  }

  /**
   * 🎭 Build system prompt for reply generation
   */
  private buildSystemPrompt(target: ReplyTarget, influencer: any, replyStyle: string): string {
    return `You are an MD/PhD responding to @${target.author} on Twitter. 

INFLUENCER CONTEXT:
- Niche: ${influencer?.niche || 'health expert'}
- Style preference: ${replyStyle}
- Typical engagement: ${target.likeCount} likes

REPLY GUIDELINES:
- Be respectful and professional
- Reference specific points from their tweet
- Include relevant research/data when possible
- Keep under 200 characters
- Sound natural, not robotic
- ${replyStyle === 'supportive' ? 'Be encouraging and build on their point' : 
     replyStyle === 'questioning' ? 'Ask thoughtful follow-up questions' :
     replyStyle === 'contrarian' ? 'Respectfully offer alternative perspective' :
     'Provide educational context or additional information'}`;
  }

  /**
   * 📋 Build user prompt with context
   */
  private buildUserPrompt(target: ReplyTarget, citation: any, template: string, request: ReplyRequest): string {
    const citationText = citation ? citation.citationText : 'No specific citation available';
    
    return `REPLY TO: "${target.content}"

${citation ? `RESEARCH REFERENCE: ${citationText}` : ''}

TEMPLATE STYLE: ${template}

Generate a natural, engaging reply that:
1. References specific content from their tweet
2. ${citation ? 'Incorporates the research reference naturally' : 'Provides relevant insight'}
3. Feels conversational and authentic
4. Encourages further discussion

Maximum ${request.maxLength || 200} characters.`;
  }

  /**
   * 🔄 Map topic categories to strategy keys
   */
  private mapTopicToStrategyKey(topic: string): keyof typeof TOPIC_REPLY_STRATEGIES {
    if (topic.includes('nutrition') || topic.includes('diet')) return 'nutrition';
    if (topic.includes('exercise') || topic.includes('fitness')) return 'exercise';
    if (topic.includes('supplement') || topic.includes('vitamin')) return 'supplements';
    if (topic.includes('longevity') || topic.includes('aging')) return 'longevity';
    
    return 'nutrition'; // Default fallback
  }

  /**
   * 🔍 Check reply similarity to avoid repetition
   */
  private async checkReplySimilarity(content: string, targetAuthor: string): Promise<{
    tooSimilar: boolean;
    maxSimilarity: number;
  }> {
    try {
      if (!secureSupabaseClient.supabase) {
        return { tooSimilar: false, maxSimilarity: 0 };
      }

      // Get recent replies to this author
      const { data } = await secureSupabaseClient.supabase
        .from('reply_history')
        .select('reply_content')
        .eq('target_author', targetAuthor)
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(5);

      if (!data || data.length === 0) {
        return { tooSimilar: false, maxSimilarity: 0 };
      }

      // Simple similarity check (could be enhanced with embeddings)
      let maxSimilarity = 0;
      const contentWords = content.toLowerCase().split(' ');

      for (const reply of data) {
        const replyWords = reply.reply_content.toLowerCase().split(' ');
        const similarity = this.calculateWordSimilarity(contentWords, replyWords);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      const tooSimilar = maxSimilarity > 0.7; // 70% similarity threshold

      return { tooSimilar, maxSimilarity };

    } catch (error) {
      console.error('❌ Similarity check failed:', error);
      return { tooSimilar: false, maxSimilarity: 0 };
    }
  }

  /**
   * 📊 Calculate word-based similarity
   */
  private calculateWordSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 🐦 Post reply using browser automation
   */
  private async postReply(target: ReplyTarget, content: string): Promise<{
    success: boolean;
    tweetId?: string;
    error?: string;
  }> {
    try {
      console.log('🚀 POSTING REAL REPLY...');
      
      const { BrowserTweetPoster } = await import('../utils/browserTweetPoster');
      const poster = new BrowserTweetPoster();
      const result = await poster.postTweet(content);
      
      if (result.success) {
        console.log('✅ Reply posted successfully to real Twitter!');
        return {
          success: true,
          tweetId: result.tweet_id
        };
      } else {
        return {
          success: false,
          error: result.error || 'Posting failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async recordReplyHistory(target: ReplyTarget, content: string): Promise<void> {
    try {

      const replyData = {
        target_tweet_id: target.tweetId,
        target_author: target.author,
        target_content_excerpt: target.contentExcerpt,
        reply_tweet_id: replyTweetId,
        reply_content: content,
        citation_used: citation?.citationText || null,
        response_tone: target.replyStyle,
        engagement_received: {},
        posted_at: new Date().toISOString(),
        was_successful: false, // Will be updated based on engagement
        follow_back_received: false,
        similarity_to_previous: 0 // Could be calculated
      };

      const { error } = await secureSupabaseClient.supabase
        .from('reply_history')
        .insert(replyData);

      if (error) {
        console.error('❌ Failed to record reply history:', error);
      } else {
        console.log('✅ Reply history recorded');
      }
    } catch (error) {
      console.error('❌ Reply recording error:', error);
    }
  }

  /**
   * ❌ Create failure result
   */
  private createFailureResult(error: string): ReplyResult {
    return {
      success: false,
      confidence: 0,
      generationMethod: 'failed',
      metadata: {
        passesGenerated: 0,
        styleUsed: 'none',
        estimatedEngagement: 0,
        riskAssessment: 'high'
      },
      error
    };
  }

  /**
   * 📊 Get engine statistics
   */
  getEngineStats(): {
    repliesGenerated: number;
    isRunning: boolean;
  } {
    return {
      repliesGenerated: this.repliesGenerated,
      isRunning: this.isRunning
    };
  }
}

export const contextAwareReplyEngine = ContextAwareReplyEngine.getInstance();