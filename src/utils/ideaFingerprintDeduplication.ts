/**
 * 🔐 ENHANCED IDEA FINGERPRINT DEDUPLICATION SYSTEM (2024)
 * 
 * Advanced system for preventing conceptual duplication in health content.
 * Uses sophisticated GPT analysis to identify core health insights regardless of wording.
 * 
 * Enhanced Features:
 * - Multi-level GPT analysis: main concept + supporting claims
 * - Semantic similarity scoring between ideas
 * - Health-specific categorization and conflict detection
 * - Enhanced 60-day lookback with weighted scoring
 * - Cross-topic conceptual overlap detection
 * - Performance-based fingerprint refinement
 */

import { OpenAI } from 'openai';
import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface EnhancedIdeaFingerprint {
  primaryFingerprint: string;      // Main concept (e.g., "intermittent_fasting_autophagy")
  secondaryFingerprints: string[]; // Supporting concepts (e.g., ["cellular_cleanup", "longevity_benefits"])
  extractedConcept: string;        // Human readable core idea
  healthCategory: string;          // Specific health domain
  specificClaims: string[];        // Specific health claims made
  conceptLevel: 'basic' | 'intermediate' | 'advanced'; // Complexity level
  confidence: number;              // GPT extraction confidence
  noveltyScore?: number;           // Calculated novelty vs existing content
}

interface EnhancedFingerprintCheckResult {
  isAllowed: boolean;
  conflictInfo?: {
    isUsed: boolean;
    daysSinceUse: number;
    lastTweetId: string;
    similarityScore: number;       // 0-1 similarity to existing content
    conflictingConcepts: string[]; // Which specific concepts conflict
  };
  fingerprint?: EnhancedIdeaFingerprint;
  alternativeSuggestion?: string;  // Suggested way to make content unique
  error?: string;
}

interface HealthConceptExtractionResult {
  success: boolean;
  primaryFingerprint?: string;
  secondaryFingerprints?: string[];
  extractedConcept?: string;
  healthCategory?: string;
  specificClaims?: string[];
  conceptLevel?: 'basic' | 'intermediate' | 'advanced';
  confidence?: number;
  error?: string;
}

export class IdeaFingerprintDeduplication {
  private static readonly DEDUPLICATION_WINDOW_DAYS = 60;
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.7;
  private static readonly SIMILARITY_THRESHOLD = 0.8; // Higher threshold for health content
  private static readonly MAX_SECONDARY_CONCEPTS = 5;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 ENHANCED MAIN FINGERPRINT CHECK
   * Multi-dimensional analysis of health content concepts
   */
  static async checkIdeaFingerprint(content: string): Promise<EnhancedFingerprintCheckResult> {
    try {
      console.log(`🔐 Enhanced fingerprint analysis for: "${content.substring(0, 60)}..."`);

      // Step 1: Extract multi-dimensional health concept fingerprint
      const extractionResult = await this.extractHealthConceptFingerprint(content);
      
      if (!extractionResult.success) {
        return {
          isAllowed: true, // Allow if extraction fails to avoid blocking
          error: `Health concept extraction failed: ${extractionResult.error}`
        };
      }

      const ideaFingerprint: EnhancedIdeaFingerprint = {
        primaryFingerprint: extractionResult.primaryFingerprint!,
        secondaryFingerprints: extractionResult.secondaryFingerprints!,
        extractedConcept: extractionResult.extractedConcept!,
        healthCategory: extractionResult.healthCategory!,
        specificClaims: extractionResult.specificClaims!,
        conceptLevel: extractionResult.conceptLevel!,
        confidence: extractionResult.confidence!
      };

      // Step 2: Check confidence threshold
      if (ideaFingerprint.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
        console.log(`⚠️ Low extraction confidence (${ideaFingerprint.confidence.toFixed(2)}) - allowing post`);
        return {
          isAllowed: true,
          fingerprint: ideaFingerprint
        };
      }

      // Step 3: Enhanced conflict detection with similarity analysis
      const conflictCheck = await this.enhancedConflictDetection(ideaFingerprint);
      
      if (!conflictCheck.isAllowed) {
        console.log(`🚫 Enhanced conflict detected:`);
        console.log(`   Primary: "${ideaFingerprint.primaryFingerprint}"`);
        console.log(`   Similarity: ${(conflictCheck.conflictInfo!.similarityScore * 100).toFixed(1)}%`);
        console.log(`   Conflicting concepts: ${conflictCheck.conflictInfo!.conflictingConcepts.join(', ')}`);
        
        return conflictCheck;
      }

      // Step 4: Calculate novelty score
      ideaFingerprint.noveltyScore = await this.calculateNoveltyScore(ideaFingerprint);

      console.log(`✅ Enhanced fingerprint approved:`);
      console.log(`   Primary: "${ideaFingerprint.primaryFingerprint}"`);
      console.log(`   Category: ${ideaFingerprint.healthCategory}`);
      console.log(`   Novelty Score: ${(ideaFingerprint.noveltyScore * 100).toFixed(1)}%`);
      
      return {
        isAllowed: true,
        fingerprint: ideaFingerprint
      };

    } catch (error: any) {
      console.error('❌ Enhanced fingerprint check failed:', error);
      return {
        isAllowed: true, // Fail open to avoid blocking
        error: `Fingerprint analysis error: ${error.message}`
      };
    }
  }

  /**
   * 🧠 ENHANCED HEALTH CONCEPT EXTRACTION
   * Uses sophisticated GPT analysis for health content
   */
  private static async extractHealthConceptFingerprint(content: string): Promise<HealthConceptExtractionResult> {
    try {
      // Budget check before OpenAI call
      await emergencyBudgetLockdown.enforceBeforeAICall('enhanced-health-concept-extraction');

      const prompt = `You are a health content analysis expert. Analyze this health/wellness content and extract its core concepts for deduplication purposes.

CONTENT TO ANALYZE: "${content}"

Extract the following information:

1. PRIMARY_FINGERPRINT: Create a unique identifier for the main health concept (use snake_case, e.g., "intermittent_fasting_autophagy", "vitamin_d_deficiency_symptoms")

2. SECONDARY_FINGERPRINTS: List up to 5 supporting concepts mentioned (e.g., ["cellular_repair", "metabolic_health", "longevity_benefits"])

3. EXTRACTED_CONCEPT: Describe the core health insight in one clear sentence

4. HEALTH_CATEGORY: Choose from: nutrition, fitness, sleep, mental_health, supplements, longevity, disease_prevention, biohacking, metabolism, hormones

5. SPECIFIC_CLAIMS: List any specific health claims or facts mentioned (e.g., ["16 hour fast triggers autophagy", "improves insulin sensitivity"])

6. CONCEPT_LEVEL: Rate as basic, intermediate, or advanced based on complexity

7. CONFIDENCE: Rate 0.0-1.0 how confident you are in this analysis

Return ONLY valid JSON:
{
  "primaryFingerprint": "main_concept_identifier",
  "secondaryFingerprints": ["concept1", "concept2"],
  "extractedConcept": "One sentence description of core health insight",
  "healthCategory": "category_name",
  "specificClaims": ["claim1", "claim2"],
  "conceptLevel": "basic|intermediate|advanced",
  "confidence": 0.95
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1
      });

      const responseText = response.choices[0]?.message?.content?.trim();
      if (!responseText) {
        throw new Error('Empty response from GPT');
      }

      const analysis = JSON.parse(responseText);

      // Validate required fields
      if (!analysis.primaryFingerprint || !analysis.extractedConcept || !analysis.healthCategory) {
        throw new Error('Missing required fields in GPT response');
      }

      // Ensure arrays are properly formatted
      analysis.secondaryFingerprints = Array.isArray(analysis.secondaryFingerprints) 
        ? analysis.secondaryFingerprints.slice(0, this.MAX_SECONDARY_CONCEPTS)
        : [];
      
      analysis.specificClaims = Array.isArray(analysis.specificClaims) 
        ? analysis.specificClaims 
        : [];

      console.log(`🧠 Health concept extracted: "${analysis.primaryFingerprint}" (${analysis.healthCategory})`);
      
      return {
        success: true,
        ...analysis
      };

    } catch (error: any) {
      console.error('❌ Health concept extraction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔍 ENHANCED CONFLICT DETECTION WITH SIMILARITY ANALYSIS
   */
  private static async enhancedConflictDetection(fingerprint: EnhancedIdeaFingerprint): Promise<EnhancedFingerprintCheckResult> {
    try {
      // Get recent fingerprints from database
      if (!supabaseClient.supabase) {
        console.warn('⚠️ Supabase client not available - allowing post');
        return {
          isAllowed: true,
          fingerprint
        };
      }

      const { data: recentFingerprints, error } = await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .select('fingerprint, date_used, tweet_id, extracted_idea, topic_category')
        .gte('date_used', new Date(Date.now() - this.DEDUPLICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('date_used', { ascending: false });

      if (error) {
        console.error('❌ Database query failed:', error);
        return {
          isAllowed: true,
          error: 'Database conflict check failed'
        };
      }

      if (!recentFingerprints || recentFingerprints.length === 0) {
        return {
          isAllowed: true,
          fingerprint
        };
      }

      // Check for exact primary fingerprint match
      const exactMatch = recentFingerprints.find(rf => rf.fingerprint === fingerprint.primaryFingerprint);
      if (exactMatch) {
        const daysSince = Math.floor((Date.now() - new Date(exactMatch.date_used).getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          isAllowed: false,
          conflictInfo: {
            isUsed: true,
            daysSinceUse: daysSince,
            lastTweetId: exactMatch.tweet_id,
            similarityScore: 1.0,
            conflictingConcepts: [fingerprint.primaryFingerprint]
          },
          fingerprint,
          alternativeSuggestion: await this.generateAlternativeApproach(fingerprint)
        };
      }

      // Check for high similarity conflicts
      const highSimilarityConflicts = await this.findHighSimilarityConflicts(fingerprint, recentFingerprints);
      
      if (highSimilarityConflicts.length > 0) {
        const topConflict = highSimilarityConflicts[0];
        
        return {
          isAllowed: false,
          conflictInfo: {
            isUsed: true,
            daysSinceUse: topConflict.daysSince,
            lastTweetId: topConflict.tweetId,
            similarityScore: topConflict.similarity,
            conflictingConcepts: topConflict.conflictingConcepts
          },
          fingerprint,
          alternativeSuggestion: await this.generateAlternativeApproach(fingerprint)
        };
      }

      return {
        isAllowed: true,
        fingerprint
      };

    } catch (error: any) {
      console.error('❌ Enhanced conflict detection failed:', error);
      return {
        isAllowed: true, // Fail open
        error: `Conflict detection error: ${error.message}`
      };
    }
  }

  /**
   * 🔍 FIND HIGH SIMILARITY CONFLICTS
   */
  private static async findHighSimilarityConflicts(
    newFingerprint: EnhancedIdeaFingerprint, 
    recentFingerprints: any[]
  ): Promise<Array<{
    similarity: number;
    daysSince: number;
    tweetId: string;
    conflictingConcepts: string[];
  }>> {
    const conflicts: Array<{
      similarity: number;
      daysSince: number;
      tweetId: string;
      conflictingConcepts: string[];
    }> = [];

    for (const recent of recentFingerprints) {
      // Calculate similarity score
      let similarity = 0;
      const conflictingConcepts: string[] = [];

      // Check primary fingerprint similarity (weighted most heavily)
      const primarySimilarity = this.calculateStringsimilarity(
        newFingerprint.primaryFingerprint, 
        recent.fingerprint
      );
      
      if (primarySimilarity > 0.7) {
        similarity += primarySimilarity * 0.6; // 60% weight for primary
        conflictingConcepts.push(recent.fingerprint);
      }

      // Check secondary fingerprint overlaps (weighted less)
      for (const secondary of newFingerprint.secondaryFingerprints) {
        const secondarySimilarity = this.calculateStringsimilarity(secondary, recent.fingerprint);
        if (secondarySimilarity > 0.8) {
          similarity += secondarySimilarity * 0.1; // 10% weight per secondary
          conflictingConcepts.push(secondary);
        }
      }

      // Check health category match (adds to similarity)
      if (newFingerprint.healthCategory === recent.topic_category) {
        similarity += 0.1; // 10% boost for same category
      }

      // If high similarity, add to conflicts
      if (similarity >= this.SIMILARITY_THRESHOLD && conflictingConcepts.length > 0) {
        const daysSince = Math.floor((Date.now() - new Date(recent.date_used).getTime()) / (1000 * 60 * 60 * 24));
        
        conflicts.push({
          similarity,
          daysSince,
          tweetId: recent.tweet_id,
          conflictingConcepts
        });
      }
    }

    // Sort by similarity (highest first)
    return conflicts.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 📊 CALCULATE NOVELTY SCORE
   */
  private static async calculateNoveltyScore(fingerprint: EnhancedIdeaFingerprint): Promise<number> {
    try {
      // Get recent content from same health category
      const { data: recentInCategory, error } = await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .select('fingerprint')
        .eq('topic_category', fingerprint.healthCategory)
        .gte('date_used', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .limit(50);

      if (error || !recentInCategory) {
        return 0.8; // Default novelty score
      }

      if (recentInCategory.length === 0) {
        return 1.0; // Perfect novelty - first in category
      }

      // Calculate average similarity to recent content
      let totalSimilarity = 0;
      let comparisons = 0;

      for (const recent of recentInCategory) {
        const similarity = this.calculateStringsimilarity(fingerprint.primaryFingerprint, recent.fingerprint);
        totalSimilarity += similarity;
        comparisons++;
      }

      const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
      const noveltyScore = Math.max(0, 1 - avgSimilarity); // Invert similarity to get novelty

      return noveltyScore;

    } catch (error) {
      console.error('❌ Novelty score calculation failed:', error);
      return 0.6; // Default fallback score
    }
  }

  /**
   * 💾 STORE APPROVED FINGERPRINT
   */
  static async storeApprovedFingerprint(
    fingerprint: EnhancedIdeaFingerprint,
    tweetId: string,
    originalContent: string
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .insert({
          fingerprint: fingerprint.primaryFingerprint, // Store primary fingerprint
          tweet_id: tweetId,
          original_content: originalContent,
          extracted_idea: fingerprint.extractedConcept,
          topic_category: fingerprint.healthCategory,
          date_used: new Date().toISOString()
        });

      console.log(`💾 Stored enhanced fingerprint: ${fingerprint.primaryFingerprint} for tweet ${tweetId}`);

    } catch (error) {
      console.error('❌ Failed to store enhanced fingerprint:', error);
    }
  }

  /**
   * 📊 UPDATE FINGERPRINT PERFORMANCE
   */
  static async updateFingerprintPerformance(
    tweetId: string,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
    }
  ): Promise<void> {
    try {
      // Note: Performance tracking for fingerprints could be enhanced
      // by creating a separate performance table or updating existing records
      // For now, we'll track this in the tweet performance analysis system
      
      console.log(`📊 Performance data for tweet ${tweetId}: ${engagement.likes + engagement.retweets + engagement.replies} total engagement`);

    } catch (error) {
      console.error('❌ Failed to update fingerprint performance:', error);
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static cleanFingerprint(fingerprint: string): string {
    return fingerprint
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * 📈 GET FINGERPRINT ANALYTICS
   */
  static async getFingerprintAnalytics(): Promise<{
    totalFingerprints: number;
    recentConflicts: number;
    topCategories: { category: string; count: number }[];
    oldestFingerprint: string;
  }> {
    try {
      // Get total fingerprints
      const { data: totalData, error: totalError } = await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .select('id', { count: 'exact' });

      // Get recent conflicts (last 7 days)
      const { data: conflictData, error: conflictError } = await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .select('id', { count: 'exact' })
        .gte('date_used', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Get top categories
      const { data: categoryData, error: categoryError } = await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .select('topic_category')
        .gte('date_used', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Process category counts
      const categoryCounts: { [key: string]: number } = {};
      categoryData?.forEach(row => {
        categoryCounts[row.topic_category] = (categoryCounts[row.topic_category] || 0) + 1;
      });

      const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalFingerprints: totalData?.length || 0,
        recentConflicts: (totalData?.length || 0) - (conflictData?.length || 0),
        topCategories,
        oldestFingerprint: `${this.DEDUPLICATION_WINDOW_DAYS} days`
      };

    } catch (error) {
      console.error('❌ Failed to get fingerprint analytics:', error);
      return {
        totalFingerprints: 0,
        recentConflicts: 0,
        topCategories: [],
        oldestFingerprint: 'unknown'
      };
    }
  }

  /**
   * 🧹 CLEANUP OLD FINGERPRINTS
   */
  static async cleanupOldFingerprints(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.DEDUPLICATION_WINDOW_DAYS);

      const { data, error } = await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .delete()
        .lt('date_used', cutoffDate.toISOString());

      const deletedCount = data?.length || 0;
      console.log(`🧹 Cleaned up ${deletedCount} old fingerprints (older than ${this.DEDUPLICATION_WINDOW_DAYS} days)`);
      
      return deletedCount;

    } catch (error) {
      console.error('❌ Failed to cleanup old fingerprints:', error);
      return 0;
    }
  }

  /**
   * 🔄 GENERATE ALTERNATIVE APPROACH
   */
  private static async generateAlternativeApproach(fingerprint: EnhancedIdeaFingerprint): Promise<string> {
    try {
      const prompt = `You are a health content analysis expert. Given a health concept fingerprint, suggest a different way to express the same core idea to avoid duplication.

FINGERPRINT: "${fingerprint.primaryFingerprint}"

Suggest a variation or rephrase the core health insight in a way that is distinct from the provided fingerprint.

Examples:
- "Intermittent fasting boosts autophagy" → "Intermittent fasting promotes cellular cleanup"
- "Vitamin D deficiency causes fatigue" → "Vitamin D deficiency can lead to energy loss"
- "Cold water boosts metabolism" → "Drinking cold water can enhance metabolic rate"

Return ONLY the alternative phrasing as a string.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3
      });

      const alternative = response.choices[0]?.message?.content?.trim();
      if (!alternative) {
        throw new Error('No alternative suggestion received from GPT');
      }

      console.log(`💡 Alternative approach suggested: "${alternative}"`);
      return alternative;

    } catch (error: any) {
      console.error('❌ Failed to generate alternative approach:', error);
      return 'No alternative suggestion available.';
    }
  }

  /**
   * 🔄 CALCULATE STRING SIMILARITY
   */
  private static calculateStringsimilarity(str1: string, str2: string): number {
    const lowerStr1 = str1.toLowerCase();
    const lowerStr2 = str2.toLowerCase();

    // Simple tokenization (split by common delimiters)
    const tokens1 = lowerStr1.split(/[\s.,!?;]+/);
    const tokens2 = lowerStr2.split(/[\s.,!?;]+/);

    // Remove empty tokens
    const filteredTokens1 = tokens1.filter(token => token.length > 0);
    const filteredTokens2 = tokens2.filter(token => token.length > 0);

    // Convert to sets to find common words
    const set1 = new Set(filteredTokens1);
    const set2 = new Set(filteredTokens2);

    // Calculate Jaccard similarity
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
}

export const ideaFingerprintDeduplication = IdeaFingerprintDeduplication; 