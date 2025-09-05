/**
 * 🚨 EMERGENCY CONTENT DIVERSITY FIX
 * 
 * IMMEDIATE SOLUTION for repetitive GLP-1 content issue
 * Unifies all content storage systems and forces diversity
 */

import { getSupabaseClient } from '../db/index';

export interface EmergencyDiversityResult {
  shouldBlock: boolean;
  reason?: string;
  alternativeTopic?: string;
  diversityScore: number;
}

export class EmergencyContentDiversityFix {
  private static instance: EmergencyContentDiversityFix;
  
  public static getInstance(): EmergencyContentDiversityFix {
    if (!EmergencyContentDiversityFix.instance) {
      EmergencyContentDiversityFix.instance = new EmergencyContentDiversityFix();
    }
    return EmergencyContentDiversityFix.instance;
  }

  /**
   * 🚨 EMERGENCY DIVERSITY CHECK - checks ALL storage tables
   */
  public async emergencyDiversityCheck(content: string): Promise<EmergencyDiversityResult> {
    console.log('🚨 EMERGENCY_DIVERSITY: Checking all tables for repetitive content...');
    
    try {
      const supabase = getSupabaseClient();
      
      // Check ALL possible tables where content might be stored
      const [learningPosts, unifiedPosts, contentFingerprints] = await Promise.all([
        this.checkLearningPosts(supabase, content),
        this.checkUnifiedPosts(supabase, content), 
        this.checkContentFingerprints(supabase, content)
      ]);

      // Combine all recent content from all tables
      const allRecentContent = [
        ...learningPosts,
        ...unifiedPosts,
        ...contentFingerprints
      ];

      console.log(`🔍 EMERGENCY_CHECK: Found ${allRecentContent.length} recent posts across all tables`);

      // Check for GLP-1 repetition specifically
      const glp1Check = this.checkGLP1Repetition(content, allRecentContent);
      if (glp1Check.shouldBlock) {
        return glp1Check;
      }

      // Check for general repetition
      const generalCheck = this.checkGeneralRepetition(content, allRecentContent);
      
      return generalCheck;

    } catch (error: any) {
      console.error('❌ EMERGENCY_DIVERSITY_ERROR:', error.message);
      // If we can't check, be conservative and suggest variety
      return {
        shouldBlock: false,
        reason: 'Database check failed, allowing content but recommending variety',
        alternativeTopic: this.getRandomAlternativeTopic(),
        diversityScore: 50
      };
    }
  }

  /**
   * 🔍 Check learning_posts table
   */
  private async checkLearningPosts(supabase: any, content: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('learning_posts')
        .select('content')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      
      return data?.map((p: any) => p.content) || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 🔍 Check unified_posts table
   */
  private async checkUnifiedPosts(supabase: any, content: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('unified_posts')
        .select('content')
        .gte('createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('createdAt', { ascending: false })
        .limit(20);
      
      return data?.map((p: any) => p.content) || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 🔍 Check content_fingerprints table
   */
  private async checkContentFingerprints(supabase: any, content: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('content_fingerprints')
        .select('normalized_content')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      
      return data?.map((p: any) => p.normalized_content) || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 🚨 SPECIFIC GLP-1 REPETITION CHECK
   */
  private checkGLP1Repetition(content: string, recentContent: string[]): EmergencyDiversityResult {
    const contentLower = content.toLowerCase();
    
    // Check if content is about GLP-1
    const isGLP1Content = contentLower.includes('glp-1') || 
                         contentLower.includes('glp1') ||
                         contentLower.includes('semaglutide') ||
                         contentLower.includes('ozempic') ||
                         contentLower.includes('wegovy');

    if (isGLP1Content) {
      // Check how many recent posts were also about GLP-1
      const recentGLP1Count = recentContent.filter(recent => {
        const recentLower = recent.toLowerCase();
        return recentLower.includes('glp-1') || 
               recentLower.includes('glp1') ||
               recentLower.includes('semaglutide') ||
               recentLower.includes('ozempic') ||
               recentLower.includes('wegovy');
      }).length;

      console.log(`🔍 GLP1_CHECK: Current content is GLP-1 related, found ${recentGLP1Count} recent GLP-1 posts`);

      if (recentGLP1Count >= 2) {
        return {
          shouldBlock: true,
          reason: `BLOCKED: Already posted ${recentGLP1Count} GLP-1 related posts recently. Need variety!`,
          alternativeTopic: this.getRandomAlternativeTopic(),
          diversityScore: 0
        };
      }
    }

    return { shouldBlock: false, diversityScore: 70 };
  }

  /**
   * 🔍 General repetition check
   */
  private checkGeneralRepetition(content: string, recentContent: string[]): EmergencyDiversityResult {
    if (recentContent.length === 0) {
      return { shouldBlock: false, diversityScore: 100 };
    }

    const contentLower = content.toLowerCase();
    const contentWords = contentLower.split(/\s+/).filter(w => w.length > 3);

    let maxSimilarity = 0;
    let mostSimilarContent = '';

    // Check similarity with each recent post
    for (const recent of recentContent) {
      const recentLower = recent.toLowerCase();
      const recentWords = recentLower.split(/\s+/).filter(w => w.length > 3);
      
      // Calculate word overlap percentage
      const commonWords = contentWords.filter(word => recentWords.includes(word));
      const similarity = commonWords.length / Math.max(contentWords.length, recentWords.length);
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarContent = recent.substring(0, 100);
      }
    }

    console.log(`📊 SIMILARITY_CHECK: Max similarity ${(maxSimilarity * 100).toFixed(1)}%`);

    // Block if >50% similar to any recent post
    if (maxSimilarity > 0.5) {
      return {
        shouldBlock: true,
        reason: `BLOCKED: ${(maxSimilarity * 100).toFixed(1)}% similar to recent post: "${mostSimilarContent}..."`,
        alternativeTopic: this.getRandomAlternativeTopic(),
        diversityScore: Math.round((1 - maxSimilarity) * 100)
      };
    }

    return {
      shouldBlock: false,
      diversityScore: Math.round((1 - maxSimilarity) * 100)
    };
  }

  /**
   * 🎯 Get random alternative topic to suggest
   */
  private getRandomAlternativeTopic(): string {
    const alternatives = [
      'circadian rhythm optimization',
      'mitochondrial health protocols',
      'gut microbiome diversity',
      'cold exposure therapy',
      'heat shock proteins',
      'autophagy enhancement',
      'NAD+ boosting strategies',
      'muscle protein synthesis timing',
      'cognitive enhancement protocols',
      'stress hormesis techniques',
      'blue light management',
      'EMF protection strategies',
      'breathwork optimization',
      'fasting-mimicking protocols',
      'longevity gene activation',
      'inflammatory pathway modulation',
      'neurotransmitter optimization',
      'metabolic flexibility training',
      'hormone optimization',
      'cellular regeneration'
    ];

    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  /**
   * 📝 Store content across ALL systems to keep them in sync
   */
  public async storeSynchronizedContent(content: string, tweetId: string): Promise<void> {
    console.log('📝 SYNCHRONIZED_STORAGE: Storing in all content tracking systems...');
    
    try {
      const supabase = getSupabaseClient();
      const timestamp = new Date().toISOString();

      // Store in learning_posts table (for diversity tracker)
      await supabase.from('learning_posts').insert({
        content: content,
        tweet_id: tweetId,
        created_at: timestamp
      });

      // Store in unified_posts table (for unified data manager)
      await supabase.from('unified_posts').upsert({
        postId: tweetId,
        content: content,
        contentType: content.includes('\n\n') ? 'thread' : 'single',
        postedAt: timestamp,
        createdAt: timestamp,
        lastUpdated: timestamp
      });

      // Store in content_fingerprints table (for novelty guard)
      const normalized = content.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      await supabase.from('content_fingerprints').insert({
        post_id: tweetId,
        content_hash: this.hashContent(normalized),
        normalized_content: normalized,
        opening_words: normalized.split(' ').slice(0, 5).join(' '),
        created_at: timestamp
      });

      console.log('✅ SYNCHRONIZED_STORAGE: Content stored in all tracking systems');

    } catch (error: any) {
      console.error('❌ SYNCHRONIZED_STORAGE_ERROR:', error.message);
    }
  }

  /**
   * 🔨 Simple hash function
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
}

// Export singleton
export const emergencyDiversityFix = EmergencyContentDiversityFix.getInstance();
