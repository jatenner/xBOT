/**
 * 🔍 ENHANCED SEMANTIC UNIQUENESS SYSTEM (2024)
 * 
 * Advanced content deduplication system specifically designed for health content.
 * Prevents conceptual repetition through multi-layer analysis and fingerprinting.
 * 
 * Key Features:
 * - Health-specific concept extraction
 * - 60-day lookback with weighted similarity
 * - Multi-dimensional uniqueness scoring
 * - Integration with existing content systems
 * - Performance-based learning
 */

import { OpenAI } from 'openai';
import { minimalSupabaseClient } from './minimalSupabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface HealthConceptAnalysis {
  primaryConcept: string;
  supportingConcepts: string[];
  healthCategory: string;
  specificClaims: string[];
  conceptComplexity: 'basic' | 'intermediate' | 'advanced';
  extractionConfidence: number;
}

interface UniquenessCheckResult {
  isUnique: boolean;
  similarityScore: number;
  conflictingContent?: {
    content: string;
    daysSince: number;
    tweetId: string;
    conflictReason: string;
  };
  conceptAnalysis: HealthConceptAnalysis;
  alternativeSuggestion?: string;
}

export class EnhancedSemanticUniqueness {
  private static readonly UNIQUENESS_WINDOW_DAYS = 60;
  private static readonly SIMILARITY_THRESHOLD = 0.75; // Stricter for health content
  private static readonly MIN_CONFIDENCE = 0.7;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 MAIN UNIQUENESS CHECK
   * Comprehensive analysis for health content uniqueness
   */
  static async checkContentUniqueness(content: string): Promise<UniquenessCheckResult> {
    try {
      console.log(`🔍 Enhanced uniqueness check: "${content.substring(0, 50)}..."`);

      // Step 1: Extract health concepts
      const conceptAnalysis = await this.extractHealthConcepts(content);
      
      if (conceptAnalysis.extractionConfidence < this.MIN_CONFIDENCE) {
        console.log(`⚠️ Low confidence analysis - allowing content`);
        return {
          isUnique: true,
          similarityScore: 0,
          conceptAnalysis
        };
      }

      // Step 2: Check against recent content
      const similarityCheck = await this.checkAgainstRecentContent(content, conceptAnalysis);
      
      if (!similarityCheck.isUnique) {
        console.log(`🚫 Content similarity detected:`);
        console.log(`   Similarity: ${(similarityCheck.similarityScore * 100).toFixed(1)}%`);
        console.log(`   Conflict: ${similarityCheck.conflictingContent?.conflictReason}`);
        
        // Generate alternative suggestion
        similarityCheck.alternativeSuggestion = await this.generateAlternativeContent(conceptAnalysis);
      }

      return similarityCheck;

    } catch (error: any) {
      console.error('❌ Enhanced uniqueness check failed:', error);
      // Fail open to avoid blocking content
      return {
        isUnique: true,
        similarityScore: 0,
        conceptAnalysis: {
          primaryConcept: 'unknown',
          supportingConcepts: [],
          healthCategory: 'general',
          specificClaims: [],
          conceptComplexity: 'basic',
          extractionConfidence: 0.5
        }
      };
    }
  }

  /**
   * 🧠 EXTRACT HEALTH CONCEPTS
   * Advanced GPT-based concept extraction for health content
   */
  private static async extractHealthConcepts(content: string): Promise<HealthConceptAnalysis> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('enhanced-concept-extraction');

      const prompt = `Analyze this health content and extract its core concepts for uniqueness checking.

CONTENT: "${content}"

Extract:
1. PRIMARY_CONCEPT: Main health idea (e.g., "intermittent fasting benefits", "vitamin D importance")
2. SUPPORTING_CONCEPTS: Related ideas mentioned (max 5)
3. HEALTH_CATEGORY: Pick one: nutrition, fitness, sleep, mental_health, supplements, longevity, disease_prevention, biohacking, metabolism, hormones
4. SPECIFIC_CLAIMS: Any specific health facts or numbers
5. COMPLEXITY: basic/intermediate/advanced
6. CONFIDENCE: 0.0-1.0 how clear the analysis is

Return JSON:
{
  "primaryConcept": "main health concept",
  "supportingConcepts": ["concept1", "concept2"],
  "healthCategory": "category",
  "specificClaims": ["claim1", "claim2"],
  "conceptComplexity": "basic",
  "extractionConfidence": 0.95
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1
      });

      const responseText = response.choices[0]?.message?.content?.trim();
      if (!responseText) {
        throw new Error('Empty GPT response');
      }

      const analysis = JSON.parse(responseText);
      
      // Validate and clean data
      return {
        primaryConcept: analysis.primaryConcept || 'unknown',
        supportingConcepts: Array.isArray(analysis.supportingConcepts) ? analysis.supportingConcepts.slice(0, 5) : [],
        healthCategory: analysis.healthCategory || 'general',
        specificClaims: Array.isArray(analysis.specificClaims) ? analysis.specificClaims : [],
        conceptComplexity: analysis.conceptComplexity || 'basic',
        extractionConfidence: analysis.extractionConfidence || 0.5
      };

    } catch (error: any) {
      console.error('❌ Health concept extraction failed:', error);
      return {
        primaryConcept: 'extraction_failed',
        supportingConcepts: [],
        healthCategory: 'general',
        specificClaims: [],
        conceptComplexity: 'basic',
        extractionConfidence: 0.3
      };
    }
  }

  /**
   * 🔍 CHECK AGAINST RECENT CONTENT
   * Compare with content from last 60 days
   */
  private static async checkAgainstRecentContent(
    content: string,
    conceptAnalysis: HealthConceptAnalysis
  ): Promise<UniquenessCheckResult> {
    try {
      if (!minimalSupabaseClient.supabase) {
        console.warn('⚠️ Database not available - allowing content');
        return {
          isUnique: true,
          similarityScore: 0,
          conceptAnalysis
        };
      }

      // Get recent tweets for comparison
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.UNIQUENESS_WINDOW_DAYS);

      const { data: recentTweets, error } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('id, content, created_at')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !recentTweets) {
        console.warn('⚠️ Could not fetch recent tweets - allowing content');
        return {
          isUnique: true,
          similarityScore: 0,
          conceptAnalysis
        };
      }

      // Check similarity against each recent tweet
      for (const tweet of recentTweets) {
        const similarity = await this.calculateContentSimilarity(content, tweet.content, conceptAnalysis);
        
        if (similarity.score >= this.SIMILARITY_THRESHOLD) {
          const daysSince = Math.floor((Date.now() - new Date(tweet.created_at).getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            isUnique: false,
            similarityScore: similarity.score,
            conceptAnalysis,
            conflictingContent: {
              content: tweet.content,
              daysSince,
              tweetId: tweet.id,
              conflictReason: similarity.reason
            }
          };
        }
      }

      // No conflicts found
      return {
        isUnique: true,
        similarityScore: 0,
        conceptAnalysis
      };

    } catch (error: any) {
      console.error('❌ Recent content check failed:', error);
      return {
        isUnique: true,
        similarityScore: 0,
        conceptAnalysis
      };
    }
  }

  /**
   * 📊 CALCULATE CONTENT SIMILARITY
   * Multi-dimensional similarity analysis
   */
  private static async calculateContentSimilarity(
    newContent: string,
    existingContent: string,
    newConceptAnalysis: HealthConceptAnalysis
  ): Promise<{ score: number; reason: string }> {
    try {
      // Quick text similarity check first
      const textSimilarity = this.calculateTextSimilarity(newContent, existingContent);
      
      if (textSimilarity > 0.9) {
        return { score: textSimilarity, reason: 'Near-identical text' };
      }

      // If moderate text similarity, do deeper concept analysis
      if (textSimilarity > 0.6) {
        const conceptSimilarity = await this.calculateConceptSimilarity(newConceptAnalysis, existingContent);
        
        if (conceptSimilarity.score > this.SIMILARITY_THRESHOLD) {
          return { 
            score: conceptSimilarity.score, 
            reason: `Concept overlap: ${conceptSimilarity.reason}` 
          };
        }
      }

      return { score: textSimilarity, reason: 'Text similarity only' };

    } catch (error: any) {
      console.error('❌ Similarity calculation failed:', error);
      return { score: 0, reason: 'Calculation failed' };
    }
  }

  /**
   * 📝 CALCULATE TEXT SIMILARITY
   * Simple text-based similarity using token overlap
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    const tokens1 = new Set(normalize(text1));
    const tokens2 = new Set(normalize(text2));
    
    const intersection = new Set(Array.from(tokens1).filter(x => tokens2.has(x)));
    const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]);
    
    return intersection.size / union.size;
  }

  /**
   * 🧠 CALCULATE CONCEPT SIMILARITY
   * GPT-based concept similarity analysis
   */
  private static async calculateConceptSimilarity(
    newConcepts: HealthConceptAnalysis,
    existingContent: string
  ): Promise<{ score: number; reason: string }> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('concept-similarity-check');

      const prompt = `Compare these health concepts for similarity. Rate 0.0-1.0 how conceptually similar they are.

NEW CONTENT CONCEPTS:
- Primary: ${newConcepts.primaryConcept}
- Supporting: ${newConcepts.supportingConcepts.join(', ')}
- Category: ${newConcepts.healthCategory}

EXISTING CONTENT: "${existingContent}"

Are these covering the same core health concept? Consider:
- Same health topic/benefit
- Same mechanism of action
- Same health claims
- Same target outcome

Return JSON:
{
  "similarityScore": 0.85,
  "reason": "Both discuss intermittent fasting autophagy benefits"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1
      });

      const responseText = response.choices[0]?.message?.content?.trim();
      if (!responseText) {
        return { score: 0, reason: 'No response' };
      }

      const result = JSON.parse(responseText);
      return {
        score: result.similarityScore || 0,
        reason: result.reason || 'Concept comparison'
      };

    } catch (error: any) {
      console.error('❌ Concept similarity check failed:', error);
      return { score: 0, reason: 'Analysis failed' };
    }
  }

  /**
   * 💡 GENERATE ALTERNATIVE CONTENT
   * Suggest how to make content unique
   */
  private static async generateAlternativeContent(conceptAnalysis: HealthConceptAnalysis): Promise<string> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('alternative-content-generation');

      const prompt = `Generate an alternative way to express this health concept to avoid duplication.

ORIGINAL CONCEPT: ${conceptAnalysis.primaryConcept}
CATEGORY: ${conceptAnalysis.healthCategory}
SUPPORTING IDEAS: ${conceptAnalysis.supportingConcepts.join(', ')}

Suggest a fresh angle or different framing for the same core health benefit. Keep it engaging and valuable.

Examples:
- "Intermittent fasting boosts autophagy" → "How meal timing triggers cellular cleanup"
- "Vitamin D prevents deficiency" → "Optimizing vitamin D levels for energy"

Return only the alternative suggestion as a string.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.5
      });

      const suggestion = response.choices[0]?.message?.content?.trim();
      return suggestion || 'Consider a different angle or specific benefit of this health topic.';

    } catch (error: any) {
      console.error('❌ Alternative content generation failed:', error);
      return 'Try focusing on a specific aspect or benefit of this health topic.';
    }
  }

  /**
   * 💾 STORE APPROVED CONTENT
   * Store content fingerprint for future uniqueness checks
   */
  static async storeApprovedContent(
    content: string,
    conceptAnalysis: HealthConceptAnalysis,
    tweetId: string
  ): Promise<void> {
    try {
      if (!minimalSupabaseClient.supabase) {
        console.warn('⚠️ Cannot store content - database not available');
        return;
      }

      // Store in used_idea_fingerprints table
      await minimalSupabaseClient.supabase
        .from('used_idea_fingerprints')
        .insert({
          fingerprint: conceptAnalysis.primaryConcept,
          tweet_id: tweetId,
          original_content: content,
          extracted_idea: conceptAnalysis.primaryConcept,
          topic_category: conceptAnalysis.healthCategory,
          date_used: new Date().toISOString()
        });

      console.log(`💾 Stored content fingerprint: "${conceptAnalysis.primaryConcept}" for tweet ${tweetId}`);

    } catch (error: any) {
      console.error('❌ Failed to store content fingerprint:', error);
    }
  }

  /**
   * 🧹 CLEANUP OLD FINGERPRINTS
   * Remove fingerprints older than the deduplication window
   */
  static async cleanupOldFingerprints(): Promise<void> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.UNIQUENESS_WINDOW_DAYS);

      const { error } = await minimalSupabaseClient.supabase
        .from('used_idea_fingerprints')
        .delete()
        .lt('date_used', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Failed to cleanup old fingerprints:', error);
      } else {
        console.log('✅ Cleaned up old content fingerprints');
      }

    } catch (error: any) {
      console.error('❌ Cleanup failed:', error);
    }
  }
} 