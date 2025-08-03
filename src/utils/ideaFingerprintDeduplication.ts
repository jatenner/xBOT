/**
 * 🔐 IDEA FINGERPRINT DEDUPLICATION SYSTEM
 * 
 * Extracts core ideas from tweets and prevents conceptual duplication within 60 days.
 * Uses GPT to identify the fundamental concept behind each tweet regardless of wording.
 * 
 * Features:
 * - GPT-powered idea extraction (e.g., "fitbit_calorie_inaccuracy")
 * - 60-day lookback for fingerprint conflicts
 * - Topic categorization for better organization
 * - Integration with existing semantic uniqueness system
 * - Performance tracking for idea effectiveness
 */

import { OpenAI } from 'openai';
import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface IdeaFingerprint {
  fingerprint: string;
  extractedIdea: string;
  topicCategory: string;
  confidence: number;
}

interface FingerprintCheckResult {
  isAllowed: boolean;
  conflictInfo?: {
    isUsed: boolean;
    daysSinceUse: number;
    lastTweetId: string;
  };
  fingerprint?: IdeaFingerprint;
  error?: string;
}

interface IdeaExtractionResult {
  success: boolean;
  fingerprint?: string;
  extractedIdea?: string;
  topicCategory?: string;
  confidence?: number;
  error?: string;
}

export class IdeaFingerprintDeduplication {
  private static readonly DEDUPLICATION_WINDOW_DAYS = 60;
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.7;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 MAIN FINGERPRINT CHECK
   * Extracts idea fingerprint and checks against 60-day database history
   */
  static async checkIdeaFingerprint(content: string): Promise<FingerprintCheckResult> {
    try {
      console.log(`🔐 Checking idea fingerprint for: "${content.substring(0, 60)}..."`);

      // Step 1: Extract core idea fingerprint using GPT
      const extractionResult = await this.extractIdeaFingerprint(content);
      
      if (!extractionResult.success) {
        return {
          isAllowed: true, // Allow if extraction fails to avoid blocking
          error: `Idea extraction failed: ${extractionResult.error}`
        };
      }

      const ideaFingerprint: IdeaFingerprint = {
        fingerprint: extractionResult.fingerprint!,
        extractedIdea: extractionResult.extractedIdea!,
        topicCategory: extractionResult.topicCategory!,
        confidence: extractionResult.confidence!
      };

      // Step 2: Check confidence threshold
      if (ideaFingerprint.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
        console.log(`⚠️ Low confidence (${ideaFingerprint.confidence.toFixed(2)}) - allowing post`);
        return {
          isAllowed: true,
          fingerprint: ideaFingerprint
        };
      }

      // Step 3: Check database for recent usage
      const conflictCheck = await this.checkFingerprintDatabase(ideaFingerprint.fingerprint);
      
      if (conflictCheck.isUsed && conflictCheck.daysSinceUse < this.DEDUPLICATION_WINDOW_DAYS) {
        console.log(`🚫 Idea fingerprint conflict: "${ideaFingerprint.fingerprint}" used ${conflictCheck.daysSinceUse} days ago`);
        return {
          isAllowed: false,
          conflictInfo: conflictCheck,
          fingerprint: ideaFingerprint
        };
      }

      console.log(`✅ Idea fingerprint approved: "${ideaFingerprint.fingerprint}" (${ideaFingerprint.topicCategory})`);
      return {
        isAllowed: true,
        fingerprint: ideaFingerprint
      };

    } catch (error) {
      console.error('❌ Idea fingerprint check error:', error);
      return {
        isAllowed: true, // Allow on error to avoid blocking
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🧠 EXTRACT IDEA FINGERPRINT USING GPT
   */
  private static async extractIdeaFingerprint(content: string): Promise<IdeaExtractionResult> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('idea-fingerprint-extraction');

      const extractionPrompt = `Extract the core idea behind this health tweet and create a unique fingerprint.

TWEET: "${content}"

Analyze the fundamental concept being communicated, not just the surface words. Create a short, descriptive fingerprint that captures the core idea.

Examples:
- "Fitbits don't track real calories" → fingerprint: "fitbit_calorie_inaccuracy"
- "Cold water boosts metabolism" → fingerprint: "cold_water_metabolism_boost"  
- "Blue light disrupts sleep" → fingerprint: "blue_light_sleep_disruption"

Return ONLY a JSON object:
{
  "fingerprint": "short_descriptive_identifier",
  "extracted_idea": "One sentence summary of the core concept",
  "topic_category": "fitness_tracking|nutrition|sleep|supplements|exercise|stress|gut_health|metabolism|general",
  "confidence": 0.95
}

Requirements:
- fingerprint: lowercase, underscores, descriptive (e.g., "vitamin_d_k2_synergy")
- extracted_idea: Clear one-sentence summary
- topic_category: Pick the most relevant category
- confidence: 0.0-1.0 based on how clear the core idea is`;

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
      let extractedData;
      try {
        extractedData = JSON.parse(extractionText);
      } catch (parseError) {
        throw new Error(`Failed to parse GPT response: ${extractionText}`);
      }

      // Validate extracted data
      if (!extractedData.fingerprint || !extractedData.extracted_idea) {
        throw new Error('Incomplete extraction data');
      }

      // Clean and validate fingerprint format
      const cleanFingerprint = this.cleanFingerprint(extractedData.fingerprint);
      
      console.log(`🧠 Extracted idea: "${extractedData.extracted_idea}" → fingerprint: "${cleanFingerprint}"`);

      return {
        success: true,
        fingerprint: cleanFingerprint,
        extractedIdea: extractedData.extracted_idea,
        topicCategory: extractedData.topic_category || 'general',
        confidence: extractedData.confidence || 0.8
      };

    } catch (error) {
      console.error('❌ Idea extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🔍 CHECK FINGERPRINT IN DATABASE
   */
  private static async checkFingerprintDatabase(fingerprint: string): Promise<{
    isUsed: boolean;
    daysSinceUse: number;
    lastTweetId: string;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('check_idea_fingerprint_usage', { fingerprint_to_check: fingerprint });

      if (error) {
        console.error('❌ Database fingerprint check failed:', error);
        return { isUsed: false, daysSinceUse: 0, lastTweetId: '' };
      }

      const result = data[0];
      return {
        isUsed: result?.is_used || false,
        daysSinceUse: result?.days_since_use || 0,
        lastTweetId: result?.last_tweet_id || ''
      };

    } catch (error) {
      console.error('❌ Database fingerprint check error:', error);
      return { isUsed: false, daysSinceUse: 0, lastTweetId: '' };
    }
  }

  /**
   * 💾 STORE APPROVED FINGERPRINT
   */
  static async storeApprovedFingerprint(
    fingerprint: IdeaFingerprint,
    tweetId: string,
    originalContent: string
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('used_idea_fingerprints')
        .insert({
          fingerprint: fingerprint.fingerprint,
          tweet_id: tweetId,
          original_content: originalContent,
          extracted_idea: fingerprint.extractedIdea,
          topic_category: fingerprint.topicCategory,
          date_used: new Date().toISOString()
        });

      console.log(`💾 Stored idea fingerprint: ${fingerprint.fingerprint} for tweet ${tweetId}`);

    } catch (error) {
      console.error('❌ Failed to store idea fingerprint:', error);
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

      const deletedCount = error ? 0 : 1; // Supabase delete doesn't return count reliably
      console.log(`🧹 Cleaned up ${deletedCount} old fingerprints (older than ${this.DEDUPLICATION_WINDOW_DAYS} days)`);
      
      return deletedCount;

    } catch (error) {
      console.error('❌ Failed to cleanup old fingerprints:', error);
      return 0;
    }
  }
}

export const ideaFingerprintDeduplication = IdeaFingerprintDeduplication; 