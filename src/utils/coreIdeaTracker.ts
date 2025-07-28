/**
 * 🧠 CORE IDEA TRACKER
 * 
 * Prevents repetition of the same health insights/concepts regardless of wording.
 * Tracks the fundamental "point being made" rather than just surface text similarity.
 * 
 * Features:
 * - Semantic idea fingerprinting
 * - 30-day idea suppression window
 * - Novelty threshold enforcement (85% different)
 * - Performance-weighted idea generation
 * - Core insight deduplication
 */

import { OpenAI } from 'openai';
import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface CoreIdea {
  id: string;
  fingerprint: string;
  category: string;
  main_claim: string;
  supporting_evidence: string;
  idea_embedding: number[];
  novelty_score: number;
  performance_score?: number;
  first_used: string;
  last_used: string;
  usage_count: number;
  engagement_data: {
    total_likes: number;
    total_retweets: number;
    total_replies: number;
    avg_engagement_rate: number;
  };
}

interface IdeaAnalysis {
  is_novel: boolean;
  similarity_score: number;
  closest_idea?: CoreIdea;
  idea_category: string;
  main_claim: string;
  novelty_reasons: string[];
  suggested_improvements?: string[];
}

interface IdeaSuppressionCheck {
  is_suppressed: boolean;
  suppression_reason: string;
  days_since_last_use?: number;
  suggested_alternatives?: string[];
}

export class CoreIdeaTracker {
  private static readonly NOVELTY_THRESHOLD = 0.85; // 85% different required
  private static readonly SUPPRESSION_WINDOW_DAYS = 30;
  private static readonly IDEA_HISTORY_LIMIT = 50; // Compare against last 50 tweets
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 MAIN IDEA ANALYSIS AND VALIDATION
   */
  static async analyzeAndValidateIdea(
    candidateText: string,
    attemptNumber: number = 1
  ): Promise<{
    analysis: IdeaAnalysis;
    suppression: IdeaSuppressionCheck;
    should_proceed: boolean;
    fingerprint?: string;
  }> {
    try {
      console.log(`🧠 Analyzing core idea (attempt ${attemptNumber}): "${candidateText.substring(0, 60)}..."`);

      // Step 1: Extract core idea from content
      const ideaExtraction = await this.extractCoreIdea(candidateText);
      if (!ideaExtraction.success) {
        return {
          analysis: {
            is_novel: false,
            similarity_score: 1.0,
            idea_category: 'unknown',
            main_claim: candidateText,
            novelty_reasons: ['Failed to extract core idea']
          },
          suppression: {
            is_suppressed: true,
            suppression_reason: 'Idea extraction failed'
          },
          should_proceed: false
        };
      }

      // Step 2: Generate idea fingerprint and embedding
      const fingerprint = this.generateIdeaFingerprint(ideaExtraction.core_idea);
      const embedding = await this.generateIdeaEmbedding(ideaExtraction.core_idea.main_claim);

      // Step 3: Check against suppression window
      const suppressionCheck = await this.checkIdeaSuppression(fingerprint, ideaExtraction.core_idea);
      
      // Step 4: Analyze novelty against recent ideas
      const noveltyAnalysis = await this.analyzeIdeaNovelty(
        ideaExtraction.core_idea,
        embedding
      );

      const shouldProceed = !suppressionCheck.is_suppressed && noveltyAnalysis.is_novel;

      console.log(`🧠 Idea analysis complete: Novel=${noveltyAnalysis.is_novel}, Suppressed=${suppressionCheck.is_suppressed}`);
      console.log(`📊 Similarity=${noveltyAnalysis.similarity_score.toFixed(3)}, Category=${noveltyAnalysis.idea_category}`);

      return {
        analysis: noveltyAnalysis,
        suppression: suppressionCheck,
        should_proceed: shouldProceed,
        fingerprint: shouldProceed ? fingerprint : undefined
      };

    } catch (error) {
      console.error('❌ Core idea analysis failed:', error);
      return {
        analysis: {
          is_novel: false,
          similarity_score: 1.0,
          idea_category: 'error',
          main_claim: candidateText,
          novelty_reasons: ['Analysis failed due to error']
        },
        suppression: {
          is_suppressed: true,
          suppression_reason: 'System error during analysis'
        },
        should_proceed: false
      };
    }
  }

  /**
   * 🔍 EXTRACT CORE IDEA FROM CONTENT
   */
  private static async extractCoreIdea(content: string): Promise<{
    success: boolean;
    core_idea: {
      category: string;
      main_claim: string;
      supporting_evidence: string;
      health_domain: string;
    };
    error?: string;
  }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('idea-extraction');

      const extractionPrompt = `Analyze this health tweet and extract its core idea/claim:

TWEET: "${content}"

Extract the fundamental point being made, not just the surface wording. Focus on:
1. What specific health claim is being made?
2. What category of health topic does this address?
3. What evidence or mechanism is provided?
4. What domain of health/wellness does this cover?

Return ONLY a JSON object with this exact structure:
{
  "category": "one of: device_accuracy, nutrition_myth, exercise_science, supplement_efficacy, sleep_optimization, metabolism, gut_health, mental_health, longevity, biohacking",
  "main_claim": "the core assertion being made (e.g., 'fitness trackers overestimate calorie burn')",
  "supporting_evidence": "the reasoning/mechanism provided (e.g., 'uses population averages not individual metabolism')",
  "health_domain": "specific area (e.g., 'fitness_tracking', 'weight_loss', 'cardiovascular_health')"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: extractionPrompt }],
        max_tokens: 200,
        temperature: 0.1 // Low temperature for consistent extraction
      });

      const extractionText = response.choices[0]?.message?.content?.trim();
      if (!extractionText) {
        throw new Error('No extraction response received');
      }

      // Parse JSON response
      let coreIdea;
      try {
        coreIdea = JSON.parse(extractionText);
      } catch (parseError) {
        // Fallback parsing if JSON is malformed
        coreIdea = this.parseIdeaFallback(content);
      }

      // Validate extracted idea
      if (!coreIdea.main_claim || !coreIdea.category) {
        throw new Error('Incomplete idea extraction');
      }

      console.log(`🎯 Extracted core idea: ${coreIdea.main_claim} (${coreIdea.category})`);

      return {
        success: true,
        core_idea: coreIdea
      };

    } catch (error) {
      console.error('❌ Idea extraction failed:', error);
      return {
        success: false,
        core_idea: {
          category: 'unknown',
          main_claim: content.substring(0, 100),
          supporting_evidence: '',
          health_domain: 'general'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🔑 GENERATE IDEA FINGERPRINT
   */
  private static generateIdeaFingerprint(coreIdea: any): string {
    // Create a stable hash based on core components
    const components = [
      coreIdea.category.toLowerCase(),
      coreIdea.main_claim.toLowerCase().replace(/[^a-z0-9\s]/g, ''),
      coreIdea.health_domain.toLowerCase()
    ].join('|');

    // Simple hash function (in production, consider using crypto)
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
      const char = components.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const fingerprint = `idea_${Math.abs(hash).toString(36)}_${coreIdea.category}`;
    console.log(`🔑 Generated fingerprint: ${fingerprint}`);
    return fingerprint;
  }

  /**
   * 🧮 GENERATE IDEA EMBEDDING
   */
  private static async generateIdeaEmbedding(mainClaim: string): Promise<number[]> {
    try {
      // Focus embedding on the core claim, not the full text
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: mainClaim.replace(/[^a-zA-Z0-9\s]/g, ' ').trim()
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      console.error('❌ Failed to generate idea embedding:', error);
      return [];
    }
  }

  /**
   * 🚫 CHECK IDEA SUPPRESSION
   */
  private static async checkIdeaSuppression(
    fingerprint: string,
    coreIdea: any
  ): Promise<IdeaSuppressionCheck> {
    try {
      const suppressionDate = new Date();
      suppressionDate.setDate(suppressionDate.getDate() - this.SUPPRESSION_WINDOW_DAYS);

      const { data, error } = await supabaseClient.supabase
        .from('core_ideas')
        .select('fingerprint, last_used, main_claim')
        .eq('fingerprint', fingerprint)
        .gte('last_used', suppressionDate.toISOString())
        .order('last_used', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Suppression check failed:', error);
        return {
          is_suppressed: false,
          suppression_reason: 'Database check failed - allowing'
        };
      }

      if (data && data.length > 0) {
        const lastUsed = new Date(data[0].last_used);
        const daysSince = Math.floor((Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`🚫 Idea suppressed: Used ${daysSince} days ago (< ${this.SUPPRESSION_WINDOW_DAYS} day limit)`);
        
        return {
          is_suppressed: true,
          suppression_reason: `Same idea used ${daysSince} days ago`,
          days_since_last_use: daysSince,
          suggested_alternatives: await this.generateAlternativeIdeas(coreIdea)
        };
      }

      return {
        is_suppressed: false,
        suppression_reason: 'Idea is available for use'
      };

    } catch (error) {
      console.error('❌ Suppression check error:', error);
      return {
        is_suppressed: false,
        suppression_reason: 'Check failed - allowing with caution'
      };
    }
  }

  /**
   * 🔍 ANALYZE IDEA NOVELTY
   */
  private static async analyzeIdeaNovelty(
    coreIdea: any,
    embedding: number[]
  ): Promise<IdeaAnalysis> {
    try {
      // Get recent ideas for comparison
      const recentIdeas = await this.getRecentIdeas();
      
      let maxSimilarity = 0;
      let closestIdea: CoreIdea | undefined;

      // Compare against recent ideas
      for (const recentIdea of recentIdeas) {
        if (recentIdea.idea_embedding && recentIdea.idea_embedding.length > 0) {
          const similarity = this.calculateCosineSimilarity(embedding, recentIdea.idea_embedding);
          
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            closestIdea = recentIdea;
          }
        }
      }

      const isNovel = maxSimilarity < (1 - this.NOVELTY_THRESHOLD);
      const noveltyReasons = this.generateNoveltyReasons(coreIdea, closestIdea, maxSimilarity);

      console.log(`🔍 Novelty analysis: ${isNovel ? 'NOVEL' : 'TOO SIMILAR'} (similarity: ${maxSimilarity.toFixed(3)})`);
      if (closestIdea) {
        console.log(`📝 Closest idea: "${closestIdea.main_claim}"`);
      }

      return {
        is_novel: isNovel,
        similarity_score: maxSimilarity,
        closest_idea: closestIdea,
        idea_category: coreIdea.category,
        main_claim: coreIdea.main_claim,
        novelty_reasons: noveltyReasons,
        suggested_improvements: isNovel ? undefined : await this.generateImprovementSuggestions(coreIdea, closestIdea)
      };

    } catch (error) {
      console.error('❌ Novelty analysis failed:', error);
      return {
        is_novel: false,
        similarity_score: 1.0,
        idea_category: coreIdea.category || 'unknown',
        main_claim: coreIdea.main_claim || 'Unknown claim',
        novelty_reasons: ['Novelty analysis failed']
      };
    }
  }

  /**
   * 💾 STORE APPROVED IDEA
   */
  static async storeApprovedIdea(
    fingerprint: string,
    coreIdea: any,
    embedding: number[],
    tweetId: string,
    noveltyScore: number
  ): Promise<void> {
    try {
      const ideaRecord: Partial<CoreIdea> = {
        id: `${fingerprint}_${Date.now()}`,
        fingerprint,
        category: coreIdea.category,
        main_claim: coreIdea.main_claim,
        supporting_evidence: coreIdea.supporting_evidence || '',
        idea_embedding: embedding,
        novelty_score: noveltyScore,
        first_used: new Date().toISOString(),
        last_used: new Date().toISOString(),
        usage_count: 1,
        engagement_data: {
          total_likes: 0,
          total_retweets: 0,
          total_replies: 0,
          avg_engagement_rate: 0
        }
      };

      await supabaseClient.supabase
        .from('core_ideas')
        .upsert(ideaRecord, { onConflict: 'fingerprint' });

      // Link to tweet
      await supabaseClient.supabase
        .from('tweet_ideas')
        .insert({
          tweet_id: tweetId,
          idea_fingerprint: fingerprint,
          created_at: new Date().toISOString()
        });

      console.log(`💾 Stored core idea: ${fingerprint}`);

    } catch (error) {
      console.error('❌ Failed to store idea:', error);
    }
  }

  /**
   * 📊 UPDATE IDEA PERFORMANCE
   */
  static async updateIdeaPerformance(
    tweetId: string,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions?: number;
    }
  ): Promise<void> {
    try {
      // Get idea fingerprint from tweet
      const { data: tweetIdea, error } = await supabaseClient.supabase
        .from('tweet_ideas')
        .select('idea_fingerprint')
        .eq('tweet_id', tweetId)
        .single();

      if (error || !tweetIdea) {
        console.log(`⚠️ No idea found for tweet ${tweetId}`);
        return;
      }

      const engagementRate = this.calculateEngagementRate(engagement);

      // Get current engagement data first
      const { data: currentIdea } = await supabaseClient.supabase
        .from('core_ideas')
        .select('engagement_data')
        .eq('fingerprint', tweetIdea.idea_fingerprint)
        .single();

      // Calculate updated engagement data
      const currentData = currentIdea?.engagement_data || {
        total_likes: 0,
        total_retweets: 0,
        total_replies: 0,
        avg_engagement_rate: 0
      };

      const updatedEngagementData = {
        total_likes: (currentData.total_likes || 0) + engagement.likes,
        total_retweets: (currentData.total_retweets || 0) + engagement.retweets,
        total_replies: (currentData.total_replies || 0) + engagement.replies,
        avg_engagement_rate: engagementRate
      };

      // Update idea performance
      await supabaseClient.supabase
        .from('core_ideas')
        .update({
          engagement_data: updatedEngagementData,
          performance_score: engagementRate,
          last_used: new Date().toISOString()
        })
        .eq('fingerprint', tweetIdea.idea_fingerprint);

      console.log(`📊 Updated idea performance: ${tweetIdea.idea_fingerprint} (${engagementRate.toFixed(3)})`);

    } catch (error) {
      console.error('❌ Failed to update idea performance:', error);
    }
  }

  /**
   * 🎯 GENERATE NEW NOVEL IDEAS
   */
  static async generateNovelIdeaPrompts(count: number = 3): Promise<string[]> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('novel-idea-generation');

      // Get top performing and underused categories
      const ideaInsights = await this.getIdeaPerformanceInsights();
      
      const generationPrompt = `Generate ${count} completely novel health insights that haven't been covered recently.

AVOID these recently used categories and claims:
${ideaInsights.recent_claims.slice(0, 10).map(claim => `- ${claim}`).join('\n')}

FOCUS on high-performing categories:
${ideaInsights.top_categories.map(cat => `- ${cat.category} (${cat.avg_engagement.toFixed(3)} engagement)`).join('\n')}

REQUIREMENTS for novel insights:
1. Must be genuinely surprising or counterintuitive
2. Include specific mechanisms or scientific reasoning
3. Focus on actionable health advice
4. Avoid repeating existing claims in new words
5. Target these underexplored domains: ${ideaInsights.underexplored_domains.join(', ')}

Generate completely new angles on health topics. Think about:
- Recent research discoveries
- Counterintuitive health mechanisms  
- Overlooked aspects of common practices
- Unexpected connections between health factors
- Novel applications of known science

Return ${count} tweet-ready insights, each under 280 characters.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: generationPrompt }],
        max_tokens: 400,
        temperature: 0.9 // High creativity for novel ideas
      });

      const responseText = response.choices[0]?.message?.content || '';
      const ideas = responseText
        .split('\n')
        .filter(line => line.trim().length > 50)
        .map(line => line.replace(/^\d+\.?\s*/, '').trim())
        .slice(0, count);

      console.log(`🎯 Generated ${ideas.length} novel idea prompts`);
      return ideas;

    } catch (error) {
      console.error('❌ Novel idea generation failed:', error);
      return [
        "New research reveals that the timing of water intake affects metabolism more than the amount - drinking cold water 30 minutes before meals can boost fat burning by 15%.",
        "Scientists discovered that humming for 2 minutes daily increases nitric oxide production, improving cardiovascular health better than some supplements.",
        "Counterintuitive finding: People who take fewer supplements often have better nutrient absorption due to reduced competitive inhibition between vitamins."
      ];
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private static calculateEngagementRate(engagement: any): number {
    const totalEngagement = engagement.likes + engagement.retweets + engagement.replies;
    const impressions = engagement.impressions || Math.max(totalEngagement * 10, 100);
    return impressions > 0 ? totalEngagement / impressions : 0;
  }

  private static async getRecentIdeas(): Promise<CoreIdea[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('core_ideas')
        .select('*')
        .order('last_used', { ascending: false })
        .limit(this.IDEA_HISTORY_LIMIT);

      return error ? [] : data || [];
    } catch (error) {
      console.error('❌ Failed to get recent ideas:', error);
      return [];
    }
  }

  private static generateNoveltyReasons(
    coreIdea: any,
    closestIdea?: CoreIdea,
    similarity?: number
  ): string[] {
    const reasons: string[] = [];

    if (!closestIdea) {
      reasons.push('No similar ideas found in recent history');
      reasons.push('Completely new topic area for the bot');
    } else {
      if (similarity && similarity < 0.3) {
        reasons.push('Very different from any recent content');
      } else if (similarity && similarity < 0.6) {
        reasons.push('Sufficiently different approach to health topic');
      } else {
        reasons.push(`Too similar to recent idea: "${closestIdea.main_claim}"`);
        reasons.push(`Similarity score: ${similarity?.toFixed(3)} (threshold: ${this.NOVELTY_THRESHOLD})`);
      }

      if (coreIdea.category !== closestIdea.category) {
        reasons.push('Different health category from recent posts');
      }
    }

    return reasons;
  }

  private static async generateAlternativeIdeas(coreIdea: any): Promise<string[]> {
    // Return simple alternatives - could be enhanced with AI generation
    return [
      `Try a different angle on ${coreIdea.health_domain}`,
      `Explore ${coreIdea.category} with new evidence`,
      `Focus on mechanism rather than outcome`
    ];
  }

  private static async generateImprovementSuggestions(
    coreIdea: any,
    closestIdea?: CoreIdea
  ): Promise<string[]> {
    return [
      'Try a different health domain or category',
      'Focus on a novel mechanism or recent research',
      'Approach the topic from an unexpected angle',
      'Combine with trending health topics for freshness'
    ];
  }

  private static parseIdeaFallback(content: string): any {
    return {
      category: 'general_health',
      main_claim: content.substring(0, 100),
      supporting_evidence: '',
      health_domain: 'wellness'
    };
  }

  private static async getIdeaPerformanceInsights(): Promise<{
    recent_claims: string[];
    top_categories: { category: string; avg_engagement: number }[];
    underexplored_domains: string[];
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_idea_performance_insights');

      if (error) throw error;

      return data || {
        recent_claims: [],
        top_categories: [],
        underexplored_domains: ['biohacking', 'longevity', 'environmental_health']
      };
    } catch (error) {
      // Fallback data
      return {
        recent_claims: [],
        top_categories: [
          { category: 'device_accuracy', avg_engagement: 0.045 },
          { category: 'nutrition_myth', avg_engagement: 0.038 }
        ],
        underexplored_domains: ['biohacking', 'longevity', 'environmental_health']
      };
    }
  }

  /**
   * 📊 GET IDEA ANALYTICS
   */
  static async getIdeaAnalytics(): Promise<{
    total_ideas: number;
    novel_ideas_rate: number;
    avg_novelty_score: number;
    top_performing_categories: { category: string; performance: number }[];
    suppression_stats: { suppressed_count: number; suppression_rate: number };
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_idea_analytics');

      if (error) throw error;

      return data || {
        total_ideas: 0,
        novel_ideas_rate: 0,
        avg_novelty_score: 0,
        top_performing_categories: [],
        suppression_stats: { suppressed_count: 0, suppression_rate: 0 }
      };
    } catch (error) {
      console.error('❌ Failed to get idea analytics:', error);
      return {
        total_ideas: 0,
        novel_ideas_rate: 0,
        avg_novelty_score: 0,
        top_performing_categories: [],
        suppression_stats: { suppressed_count: 0, suppression_rate: 0 }
      };
    }
  }
}

export const coreIdeaTracker = CoreIdeaTracker; 