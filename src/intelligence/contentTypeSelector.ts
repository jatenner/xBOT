/**
 * Content Type Selector - Phase 1: Content Type Diversity
 * 
 * Goes beyond 4 writing styles to provide 7+ distinct content TYPES
 * Uses Thompson Sampling to diversify content formats
 */

import { getSupabaseClient } from '../db';

export interface ContentType {
  type_id: string;
  name: string;
  description: string;
  format: 'single' | 'thread' | 'both';
  
  // Structure and characteristics
  typical_structure: string;
  typical_length: string; // characters or thread length
  hook_style: string;
  value_proposition: string;
  
  // Performance tracking
  success_rate: number; // % of posts that gain followers
  avg_follower_conversion: number; // Followers gained per post
  avg_engagement_rate: number;
  sample_size: number;
  
  // Usage guidance
  best_topics: string[];
  best_timing: string[];
  audience_appeal: string[];
}

export interface ContentTypeSelection {
  selectedType: ContentType;
  selectionReason: string;
  recentUsage: number;
  score: number;
}

export class ContentTypeSelector {
  private static instance: ContentTypeSelector;
  private contentTypes: ContentType[] = [];
  
  private constructor() {
    this.initializeContentTypes();
    // Load persisted performance data to override hardcoded values
    this.loadPersistedPerformance().catch(err => {
      console.warn('[CONTENT_TYPE] ⚠️ Could not load persisted performance:', err.message);
    });
  }
  
  public static getInstance(): ContentTypeSelector {
    if (!ContentTypeSelector.instance) {
      ContentTypeSelector.instance = new ContentTypeSelector();
    }
    return ContentTypeSelector.instance;
  }
  
  /**
   * Select optimal content type using Thompson Sampling
   */
  public async selectContentType(preferences?: {
    format?: 'single' | 'thread' | 'both';
    topic?: string;
    goal?: 'engagement' | 'followers' | 'authority';
  }): Promise<ContentTypeSelection> {
    
    console.log('[CONTENT_TYPE] 📋 Selecting optimal content type...');
    
    // Filter by preferences
    let candidates = this.contentTypes.filter(ct => {
      if (preferences?.format && preferences.format !== 'both') {
        if (ct.format !== 'both' && ct.format !== preferences.format) {
          return false;
        }
      }
      
      // Must have some track record
      if (ct.success_rate < 0.1) return false;
      
      return true;
    });
    
    if (candidates.length === 0) {
      candidates = this.contentTypes; // Fallback
    }
    
    // Get recent usage
    const recentUsage = await this.getRecentContentTypeUsage();
    
    // Score each content type
    const scoredTypes = candidates.map(ct => {
      // Base score weighted by goal
      let baseScore = 0;
      
      if (preferences?.goal === 'followers' || !preferences?.goal) {
        // Optimize for follower growth (default)
        baseScore = (ct.avg_follower_conversion * 0.7) + 
                   (ct.avg_engagement_rate * 100 * 0.2) +
                   (ct.success_rate * 100 * 0.1);
      } else if (preferences?.goal === 'engagement') {
        baseScore = (ct.avg_engagement_rate * 100 * 0.6) +
                   (ct.avg_follower_conversion * 0.3) +
                   (ct.success_rate * 100 * 0.1);
      } else if (preferences?.goal === 'authority') {
        baseScore = (ct.success_rate * 100 * 0.5) +
                   (ct.avg_follower_conversion * 0.3) +
                   (ct.avg_engagement_rate * 100 * 0.2);
      }
      
      // Recency penalty - VERY aggressive to ensure diversity
      const usageCount = recentUsage.filter(id => id === ct.type_id).length;
      const recencyPenalty = Math.pow(0.3, usageCount); // 0.3^n - extremely aggressive
      
      const finalScore = baseScore * recencyPenalty;
      
      return {
        type: ct,
        score: finalScore,
        usageCount
      };
    });
    
    // Sort by score
    scoredTypes.sort((a, b) => b.score - a.score);
    
    // Thompson Sampling: 70% exploit, 30% explore
    const random = Math.random();
    
    let selected: typeof scoredTypes[0];
    let selectionReason: string;
    
    if (random < 0.7 && scoredTypes.length > 0) {
      // Exploit: Use highest scoring type
      selected = scoredTypes[0];
      selectionReason = `Exploiting best performer (score: ${selected.score.toFixed(2)}, recent use: ${selected.usageCount})`;
    } else {
      // Explore: Weighted random from top candidates
      const topCandidates = scoredTypes.slice(0, Math.min(5, scoredTypes.length));
      const totalScore = topCandidates.reduce((sum, s) => sum + Math.max(s.score, 1), 0);
      const randomScore = Math.random() * totalScore;
      
      let cumulative = 0;
      selected = topCandidates[0]; // Default
      
      for (const candidate of topCandidates) {
        cumulative += Math.max(candidate.score, 1);
        if (randomScore <= cumulative) {
          selected = candidate;
          break;
        }
      }
      
      selectionReason = `Exploring alternative (score: ${selected.score.toFixed(2)})`;
    }
    
    console.log(`[CONTENT_TYPE] ✅ Selected: ${selected.type.name}`);
    console.log(`[CONTENT_TYPE] 📊 ${selectionReason}`);
    
    return {
      selectedType: selected.type,
      selectionReason,
      recentUsage: selected.usageCount,
      score: selected.score
    };
  }
  
  /**
   * Get all content types for inspection
   */
  public getAllContentTypes(): ContentType[] {
    return [...this.contentTypes];
  }
  
  /**
   * Update content type performance after a post
   */
  public async updateContentTypePerformance(
    type_id: string,
    followers_gained: number,
    engagement_rate: number,
    was_successful: boolean
  ): Promise<void> {
    
    const type = this.contentTypes.find(ct => ct.type_id === type_id);
    if (!type) return;
    
    // Update rolling averages
    const weight = 0.3; // Weight for new data
    
    type.avg_follower_conversion = 
      type.avg_follower_conversion * (1 - weight) + followers_gained * weight;
    
    type.avg_engagement_rate = 
      type.avg_engagement_rate * (1 - weight) + engagement_rate * weight;
    
    type.success_rate = 
      type.success_rate * (1 - weight) + (was_successful ? 1 : 0) * weight;
    
    type.sample_size += 1;
    
    console.log(`[CONTENT_TYPE] 📈 Updated ${type.name}: followers=${type.avg_follower_conversion.toFixed(1)}, engagement=${(type.avg_engagement_rate * 100).toFixed(1)}%, success=${(type.success_rate * 100).toFixed(0)}%`);
    
    // Store to database for persistence
    await this.storeContentTypePerformance(type);
  }
  
  /**
   * Initialize the 7 content types
   */
  private initializeContentTypes(): void {
    this.contentTypes = [
      {
        type_id: 'fact_bomb',
        name: 'Fact Bomb',
        description: 'Single surprising statistic or fact',
        format: 'single',
        typical_structure: 'Surprising fact + brief mechanism/implication',
        typical_length: '150-250 chars',
        hook_style: 'Shock value, counterintuitive',
        value_proposition: 'Quick insight, memorable',
        success_rate: 0.35,
        avg_follower_conversion: 8.5,
        avg_engagement_rate: 0.045,
        sample_size: 12,
        best_topics: ['sleep science', 'nutrition myths', 'body facts'],
        best_timing: ['morning', 'lunch break'],
        audience_appeal: ['casual learners', 'science enthusiasts']
      },
      {
        type_id: 'case_study',
        name: 'Case Study / Story',
        description: 'Real-world story with transformation',
        format: 'both',
        typical_structure: 'Problem → Intervention → Result → Lesson',
        typical_length: 'Single: 250 chars, Thread: 4-5 tweets',
        hook_style: 'Relatable problem, dramatic transformation',
        value_proposition: 'Proof it works, relatability',
        success_rate: 0.48,
        avg_follower_conversion: 16.2,
        avg_engagement_rate: 0.072,
        sample_size: 8,
        best_topics: ['weight loss', 'sleep improvement', 'energy optimization'],
        best_timing: ['evening', 'weekend'],
        audience_appeal: ['beginners', 'skeptics', 'action-takers']
      },
      {
        type_id: 'thread_education',
        name: 'Educational Thread',
        description: 'Step-by-step guide or framework',
        format: 'thread',
        typical_structure: 'Hook + 5-7 steps + summary',
        typical_length: '6-8 tweets',
        hook_style: 'Promise complete knowledge',
        value_proposition: 'Comprehensive, actionable',
        success_rate: 0.52,
        avg_follower_conversion: 21.7,
        avg_engagement_rate: 0.089,
        sample_size: 6,
        best_topics: ['optimization protocols', 'habit formation', 'biohacking'],
        best_timing: ['Sunday evening', 'Tuesday evening'],
        audience_appeal: ['serious learners', 'biohackers', 'optimizers']
      },
      {
        type_id: 'news_reaction',
        name: 'News Reaction',
        description: 'Commentary on recent study or news',
        format: 'both',
        typical_structure: 'News + Analysis + Implication + Action',
        typical_length: 'Single: 250 chars, Thread: 3-4 tweets',
        hook_style: 'Timely, urgent, breaking news',
        value_proposition: 'Current, relevant, expert take',
        success_rate: 0.41,
        avg_follower_conversion: 14.3,
        avg_engagement_rate: 0.068,
        sample_size: 7,
        best_topics: ['new research', 'health trends', 'policy changes'],
        best_timing: ['morning', 'breaking news times'],
        audience_appeal: ['news followers', 'early adopters']
      },
      {
        type_id: 'study_breakdown',
        name: 'Study Breakdown',
        description: 'Deep dive into research with implications',
        format: 'thread',
        typical_structure: 'Study intro + methodology + findings + practical takeaways',
        typical_length: '5-7 tweets',
        hook_style: 'Authority, scientific credibility',
        value_proposition: 'Expert analysis, actionable science',
        success_rate: 0.46,
        avg_follower_conversion: 18.9,
        avg_engagement_rate: 0.078,
        sample_size: 5,
        best_topics: ['longevity research', 'metabolism studies', 'neuroscience'],
        best_timing: ['weekday evenings', 'Sunday'],
        audience_appeal: ['science-minded', 'biohackers', 'health professionals']
      },
      {
        type_id: 'quick_tip',
        name: 'Quick Actionable Tip',
        description: 'Single specific, immediately applicable advice',
        format: 'single',
        typical_structure: 'Problem + specific solution + why it works',
        typical_length: '180-240 chars',
        hook_style: 'Immediate value, practical',
        value_proposition: 'Can do it today, simple',
        success_rate: 0.38,
        avg_follower_conversion: 11.2,
        avg_engagement_rate: 0.053,
        sample_size: 15,
        best_topics: ['daily habits', 'quick fixes', 'life hacks'],
        best_timing: ['morning', 'lunch', 'evening'],
        audience_appeal: ['busy professionals', 'beginners', 'action-takers']
      },
      {
        type_id: 'controversy',
        name: 'Controversial Take',
        description: 'Contrarian opinion with evidence',
        format: 'both',
        typical_structure: 'Controversial claim + evidence + mechanism + conclusion',
        typical_length: 'Single: 250 chars, Thread: 4-6 tweets',
        hook_style: 'Provocative, challenges conventional wisdom',
        value_proposition: 'Thought-provoking, memorable, shareable',
        success_rate: 0.44,
        avg_follower_conversion: 19.8,
        avg_engagement_rate: 0.095,
        sample_size: 9,
        best_topics: ['diet myths', 'supplement truth', 'exercise misconceptions'],
        best_timing: ['Monday morning', 'Wednesday afternoon'],
        audience_appeal: ['contrarians', 'debate enjoyers', 'truth-seekers']
      }
    ];
  }
  
  /**
   * Get recent content type usage (last 20 posts)
   */
  private async getRecentContentTypeUsage(): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('posted_decisions')
        .select('posted_at, content')
        .order('posted_at', { ascending: false })
        .limit(20);
      
      if (error || !data) {
        return [];
      }
      
      return data
        .map((d: any) => d.generation_metadata?.content_type_id)
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Store content type performance to database
   */
  private async storeContentTypePerformance(type: ContentType): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('content_type_performance')
        .upsert({
          type_id: type.type_id,
          success_rate: type.success_rate,
          avg_follower_conversion: type.avg_follower_conversion,
          avg_engagement_rate: type.avg_engagement_rate,
          sample_size: type.sample_size,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      // Table might not exist yet, that's okay
      console.log('[CONTENT_TYPE] ⏭️ Could not persist to DB (table may not exist)');
    }
  }
  
  /**
   * Load persisted performance data from database
   * This replaces hardcoded values with learned metrics
   */
  private async loadPersistedPerformance(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      const { data: persistedData, error } = await supabase
        .from('content_type_performance')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error || !persistedData || persistedData.length === 0) {
        console.log('[CONTENT_TYPE] ℹ️ No persisted performance data found, using initial values');
        return;
      }
      
      // Update each content type with persisted data
      let updatedCount = 0;
      for (const persisted of persistedData) {
        const type = this.contentTypes.find(ct => ct.type_id === persisted.type_id);
        if (type && persisted) {
          type.success_rate = Number(persisted.success_rate || 0);
          type.avg_follower_conversion = Number(persisted.avg_follower_conversion || 0);
          type.avg_engagement_rate = Number(persisted.avg_engagement_rate || 0);
          type.sample_size = Number(persisted.sample_size || 0);
          updatedCount++;
        }
      }
      
      console.log(`[CONTENT_TYPE] ✅ Loaded persisted performance for ${updatedCount} content types`);
      const topPerformer = this.contentTypes.sort((a, b) => b.avg_follower_conversion - a.avg_follower_conversion)[0];
      console.log(`[CONTENT_TYPE] 📊 Top performer: ${topPerformer.name} (${topPerformer.avg_follower_conversion.toFixed(1)} followers/post)`);
    } catch (error: any) {
      console.error('[CONTENT_TYPE] ❌ Error loading persisted performance:', error.message);
    }
  }
}

export const getContentTypeSelector = () => ContentTypeSelector.getInstance();

