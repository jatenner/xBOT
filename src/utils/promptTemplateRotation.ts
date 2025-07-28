/**
 * 🔁 PROMPT TEMPLATE ROTATION WITH TONE & TIME AWARENESS
 * 
 * Manages intelligent rotation of prompt templates based on tone, time of day,
 * and usage history. Prevents overuse and ensures content variety.
 * 
 * Features:
 * - Tone categorization (friendly, controversial, scientific, personal)
 * - Time-based template selection (morning, afternoon, evening)
 * - 14-day usage history tracking
 * - Performance-based template prioritization
 * - Intelligent fallback when preferred templates are overused
 */

import { supabaseClient } from './supabaseClient';

interface EnhancedPromptTemplate {
  id: string;
  name: string;
  template: string;
  tone: 'friendly' | 'controversial' | 'scientific' | 'personal';
  contentType: 'tip' | 'fact' | 'myth_bust' | 'insight' | 'question';
  timePreference: 'morning' | 'afternoon' | 'evening' | 'any';
  performanceScore: number;
  usageCount: number;
  lastUsed?: string;
  active: boolean;
}

interface TemplateSelectionOptions {
  preferredTone?: string;
  contentType?: string;
  currentHour?: number;
  excludeRecentlyUsed?: boolean;
  minPerformanceScore?: number;
}

interface TemplateSelectionResult {
  success: boolean;
  template?: EnhancedPromptTemplate;
  selectionReason?: string;
  error?: string;
}

interface ToneUsageStats {
  tone: string;
  usageCount: number;
  lastUsed: string;
  avgPerformance: number;
}

export class PromptTemplateRotation {
  private static readonly ROTATION_WINDOW_DAYS = 14;
  private static readonly MIN_HOURS_BETWEEN_SAME_TEMPLATE = 12;
  private static readonly TONE_BALANCE_THRESHOLD = 0.4; // Max 40% of recent usage for any tone

  /**
   * 🎯 SELECT OPTIMAL TEMPLATE (Enhanced with Fallbacks)
   */
  static async getOptimalTemplate(options: TemplateSelectionOptions = {}): Promise<TemplateSelectionResult> {
    try {
      const currentHour = options.currentHour || new Date().getHours();
      console.log(`🔁 Selecting optimal template for hour ${currentHour}...`);

      // Get recent tone usage to avoid overuse
      const recentToneUsage = await this.getRecentToneUsage();
      const overusedTones = this.identifyOverusedTones(recentToneUsage);

      // Try database function first
      const { data, error } = await supabaseClient.supabase
        .rpc('get_optimal_prompt_template', {
          current_hour: currentHour,
          recent_tones: overusedTones.length > 0 ? overusedTones : null
        });

      if (error) {
        console.error('❌ Template selection query failed:', error);
        console.log('🔄 Using fallback template selection...');
        return await this.getFallbackTemplate(options);
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No optimal template found - using fallback');
        return await this.getFallbackTemplate(options);
      }

      const selectedTemplate = this.mapDatabaseToInterface(data[0]);
      
      // Validate the template has required fields
      if (!selectedTemplate || !selectedTemplate.template || !selectedTemplate.template.trim()) {
        console.log('⚠️ Invalid template data - using fallback');
        return await this.getFallbackTemplate(options);
      }

      console.log(`✅ Selected template: "${selectedTemplate.name}" (${selectedTemplate.tone}, ${selectedTemplate.timePreference})`);

      return {
        success: true,
        template: selectedTemplate,
        selectionReason: `Optimal for ${this.getTimeOfDay(currentHour)}, tone: ${selectedTemplate.tone}`
      };

    } catch (error) {
      console.error('❌ Template selection error:', error);
      console.log('🔄 Using emergency fallback...');
      return await this.getFallbackTemplate(options);
    }
  }

  /**
   * 📊 GET RECENT TONE USAGE STATISTICS
   */
  private static async getRecentToneUsage(): Promise<ToneUsageStats[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.ROTATION_WINDOW_DAYS);

      const { data, error } = await supabaseClient.supabase
        .from('prompt_rotation_history')
        .select('tone, performance_score, time_used')
        .gte('time_used', cutoffDate.toISOString())
        .order('time_used', { ascending: false });

      if (error || !data) {
        console.log('⚠️ Could not fetch tone usage stats');
        return [];
      }

      // Group by tone and calculate stats
      const toneStats: { [key: string]: { count: number; scores: number[]; lastUsed: string } } = {};
      
      data.forEach(record => {
        if (!toneStats[record.tone]) {
          toneStats[record.tone] = { count: 0, scores: [], lastUsed: record.time_used };
        }
        toneStats[record.tone].count++;
        if (record.performance_score) {
          toneStats[record.tone].scores.push(record.performance_score);
        }
        if (record.time_used > toneStats[record.tone].lastUsed) {
          toneStats[record.tone].lastUsed = record.time_used;
        }
      });

      return Object.entries(toneStats).map(([tone, stats]) => ({
        tone,
        usageCount: stats.count,
        lastUsed: stats.lastUsed,
        avgPerformance: stats.scores.length > 0 
          ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length 
          : 0
      }));

    } catch (error) {
      console.error('❌ Failed to get tone usage stats:', error);
      return [];
    }
  }

  /**
   * 🚫 IDENTIFY OVERUSED TONES
   */
  private static identifyOverusedTones(toneUsage: ToneUsageStats[]): string[] {
    const totalUsage = toneUsage.reduce((sum, tone) => sum + tone.usageCount, 0);
    
    if (totalUsage === 0) return [];

    return toneUsage
      .filter(tone => tone.usageCount / totalUsage > this.TONE_BALANCE_THRESHOLD)
      .map(tone => tone.tone);
  }

  /**
   * 🔄 RECORD TEMPLATE USAGE
   */
  static async recordTemplateUsage(
    templateId: string,
    tweetId: string,
    performanceScore?: number
  ): Promise<void> {
    try {
      // Get template details
      const { data: templateData, error: templateError } = await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('tone, content_type')
        .eq('id', templateId)
        .single();

      if (templateError || !templateData) {
        console.error('❌ Could not find template for recording usage:', templateId);
        return;
      }

      // Record in usage history
      await supabaseClient.supabase
        .from('prompt_rotation_history')
        .insert({
          template_id: templateId,
          tone: templateData.tone,
          content_type: templateData.content_type,
          tweet_id: tweetId,
          performance_score: performanceScore || 0,
          time_used: new Date().toISOString()
        });

      // Update template usage count and last used
      await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .update({
          usage_count: supabaseClient.supabase.raw('usage_count + 1'),
          last_used: new Date().toISOString()
        })
        .eq('id', templateId);

      console.log(`📝 Recorded template usage: ${templateId} for tweet ${tweetId}`);

    } catch (error) {
      console.error('❌ Failed to record template usage:', error);
    }
  }

  /**
   * 📈 UPDATE TEMPLATE PERFORMANCE
   */
  static async updateTemplatePerformance(
    tweetId: string,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions?: number;
    }
  ): Promise<void> {
    try {
      // Get template ID from usage history
      const { data: usageData, error: usageError } = await supabaseClient.supabase
        .from('prompt_rotation_history')
        .select('template_id, id')
        .eq('tweet_id', tweetId)
        .single();

      if (usageError || !usageData) {
        console.log(`⚠️ No template usage found for tweet ${tweetId}`);
        return;
      }

      // Calculate engagement score
      const totalEngagement = engagement.likes + engagement.retweets + engagement.replies;
      const impressions = engagement.impressions || Math.max(totalEngagement * 10, 100);
      const engagementRate = impressions > 0 ? totalEngagement / impressions : 0;

      // Update performance in usage history
      await supabaseClient.supabase
        .from('prompt_rotation_history')
        .update({ performance_score: engagementRate })
        .eq('id', usageData.id);

      // Update template's overall performance score (weighted average)
      const { data: templateData } = await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('performance_score, usage_count')
        .eq('id', usageData.template_id)
        .single();

      if (templateData) {
        const currentScore = templateData.performance_score || 0;
        const usageCount = templateData.usage_count || 1;
        
        // Weighted average with slight bias toward recent performance
        const newScore = ((currentScore * (usageCount - 1)) + (engagementRate * 1.2)) / usageCount;

        await supabaseClient.supabase
          .from('enhanced_prompt_templates')
          .update({
            performance_score: Math.min(1.0, Math.max(0.0, newScore))
          })
          .eq('id', usageData.template_id);

        console.log(`📈 Updated template ${usageData.template_id} performance: ${newScore.toFixed(3)}`);
      }

    } catch (error) {
      console.error('❌ Failed to update template performance:', error);
    }
  }

  /**
   * 🎯 GET TEMPLATES BY CRITERIA
   */
  static async getTemplatesByCriteria(criteria: {
    tone?: string;
    contentType?: string;
    timePreference?: string;
    minPerformanceScore?: number;
    active?: boolean;
  }): Promise<EnhancedPromptTemplate[]> {
    try {
      let query = supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('*')
        .eq('active', criteria.active !== false);

      if (criteria.tone) {
        query = query.eq('tone', criteria.tone);
      }

      if (criteria.contentType) {
        query = query.eq('content_type', criteria.contentType);
      }

      if (criteria.timePreference) {
        query = query.or(`time_preference.eq.${criteria.timePreference},time_preference.eq.any`);
      }

      if (criteria.minPerformanceScore) {
        query = query.gte('performance_score', criteria.minPerformanceScore);
      }

      const { data, error } = await query.order('performance_score', { ascending: false });

      if (error) {
        console.error('❌ Template query failed:', error);
        return [];
      }

      return (data || []).map(template => this.mapDatabaseToInterface(template));

    } catch (error) {
      console.error('❌ Template criteria search failed:', error);
      return [];
    }
  }

  /**
   * 🛡️ ROBUST FALLBACK TEMPLATE SYSTEM
   */
  private static async getFallbackTemplate(options: TemplateSelectionOptions = {}): Promise<TemplateSelectionResult> {
    try {
      console.log('🛡️ Getting fallback template...');

      // Try to get any active template from database
      const { data: activeTemplates, error } = await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('*')
        .eq('active', true)
        .limit(5);

      if (!error && activeTemplates && activeTemplates.length > 0) {
        // Pick a random active template
        const randomTemplate = activeTemplates[Math.floor(Math.random() * activeTemplates.length)];
        const template = this.mapDatabaseToInterface(randomTemplate);
        
        if (template && template.template && template.template.trim()) {
          console.log(`✅ Using random active template: ${template.name}`);
          return {
            success: true,
            template,
            selectionReason: 'Random active template (fallback)'
          };
        }
      }

      // Emergency hardcoded template if database fails
      console.log('🚨 Using emergency hardcoded template');
      const emergencyTemplate: EnhancedPromptTemplate = {
        id: 'emergency_template',
        name: 'Emergency Health Tip',
        template: 'Health tip: {health_fact} This simple change can make a big difference in your wellness journey. What health goal are you working on today? #HealthTip #Wellness',
        tone: 'friendly',
        contentType: 'tip',
        timePreference: 'any',
        performanceScore: 0.5, // Placeholder, will be updated
        usageCount: 0, // Placeholder, will be updated
        active: true
      };

      return {
        success: true,
        template: emergencyTemplate,
        selectionReason: 'Emergency hardcoded template'
      };

    } catch (error) {
      console.error('❌ Fallback template selection failed:', error);
      
      // Absolute last resort - minimal template
      const lastResortTemplate: EnhancedPromptTemplate = {
        id: 'last_resort',
        name: 'Minimal Health Content',
        template: 'Quick health reminder: Stay hydrated, get enough sleep, and move your body daily. Small habits lead to big changes! #Health #Wellness',
        tone: 'friendly',
        contentType: 'tip',
        timePreference: 'any',
        performanceScore: 0.5, // Placeholder, will be updated
        usageCount: 0, // Placeholder, will be updated
        active: true
      };

      return {
        success: true,
        template: lastResortTemplate,
        selectionReason: 'Last resort template'
      };
    }
  }

  /**
   * 🕐 GET TIME OF DAY PREFERENCE
   */
  private static getTimeOfDay(hour: number): string {
    if (hour >= 6 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 17) return 'afternoon';
    if (hour >= 18 && hour <= 23) return 'evening';
    return 'late_night';
  }

  /**
   * 📊 GET ROTATION ANALYTICS
   */
  static async getRotationAnalytics(): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    toneDistribution: { tone: string; count: number; avgPerformance: number }[];
    recentUsage: number;
    topPerformingTemplates: { id: string; name: string; performance: number }[];
  }> {
    try {
      // Get template counts
      const { data: templateData } = await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('id, name, tone, performance_score, active');

      const totalTemplates = templateData?.length || 0;
      const activeTemplates = templateData?.filter(t => t.active).length || 0;

      // Calculate tone distribution
      const toneStats: { [key: string]: { count: number; scores: number[] } } = {};
      templateData?.forEach(template => {
        if (!toneStats[template.tone]) {
          toneStats[template.tone] = { count: 0, scores: [] };
        }
        toneStats[template.tone].count++;
        if (template.performance_score > 0) {
          toneStats[template.tone].scores.push(template.performance_score);
        }
      });

      const toneDistribution = Object.entries(toneStats).map(([tone, stats]) => ({
        tone,
        count: stats.count,
        avgPerformance: stats.scores.length > 0 
          ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length 
          : 0
      }));

      // Get recent usage (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: recentData } = await supabaseClient.supabase
        .from('prompt_rotation_history')
        .select('id')
        .gte('time_used', weekAgo.toISOString());

      const recentUsage = recentData?.length || 0;

      // Top performing templates
      const topPerformingTemplates = (templateData || [])
        .filter(t => t.active && t.performance_score > 0)
        .sort((a, b) => b.performance_score - a.performance_score)
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          name: t.name,
          performance: t.performance_score
        }));

      return {
        totalTemplates,
        activeTemplates,
        toneDistribution,
        recentUsage,
        topPerformingTemplates
      };

    } catch (error) {
      console.error('❌ Failed to get rotation analytics:', error);
      return {
        totalTemplates: 0,
        activeTemplates: 0,
        toneDistribution: [],
        recentUsage: 0,
        topPerformingTemplates: []
      };
    }
  }

  /**
   * 🧹 CLEANUP OLD USAGE HISTORY
   */
  static async cleanupOldUsageHistory(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.ROTATION_WINDOW_DAYS);

      const { data, error } = await supabaseClient.supabase
        .from('prompt_rotation_history')
        .delete()
        .lt('time_used', cutoffDate.toISOString());

      const deletedCount = data?.length || 0;
      console.log(`🧹 Cleaned up ${deletedCount} old usage records (older than ${this.ROTATION_WINDOW_DAYS} days)`);

      return deletedCount;

    } catch (error) {
      console.error('❌ Failed to cleanup usage history:', error);
      return 0;
    }
  }

  /**
   * 🗺️ ENHANCED DATABASE TO INTERFACE MAPPING
   */
  private static mapDatabaseToInterface(dbTemplate: any): EnhancedPromptTemplate | null {
    try {
      if (!dbTemplate) {
        console.log('⚠️ Empty database template provided');
        return null;
      }

      // Validate required fields
      if (!dbTemplate.id || !dbTemplate.template || typeof dbTemplate.template !== 'string') {
        console.log('⚠️ Invalid template structure:', dbTemplate);
        return null;
      }

      const template: EnhancedPromptTemplate = {
        id: dbTemplate.id,
        name: dbTemplate.name || 'Unnamed Template',
        template: dbTemplate.template.trim(),
        tone: dbTemplate.tone || 'neutral',
        contentType: dbTemplate.content_type || 'general',
        timePreference: dbTemplate.time_preference || 'any',
        performanceScore: dbTemplate.performance_score || 0,
        usageCount: dbTemplate.usage_count || 0,
        active: dbTemplate.active !== false
      };

      // Final validation
      if (template.template.length < 10) {
        console.log('⚠️ Template too short, likely invalid');
        return null;
      }

      return template;

    } catch (error) {
      console.error('❌ Error mapping database template:', error);
      return null;
    }
  }

  /**
   * 🔍 EXTRACT PLACEHOLDERS FROM TEMPLATE (ENHANCED SAFETY)
   */
  private static extractPlaceholders(template: string): string[] {
    try {
      // Enhanced validation to prevent undefined.match errors
      if (!template || typeof template !== 'string' || template.trim() === '') {
        return [];
      }

      // Additional safety check for null/undefined
      const safeTemplate = String(template);
      const matches = safeTemplate.match(/\{([^}]+)\}/g);
      
      if (!matches || !Array.isArray(matches)) {
        return [];
      }

      return matches.map(match => {
        try {
          return match.replace(/[{}]/g, '');
        } catch (replaceError) {
          console.warn('⚠️ Error processing placeholder:', match);
          return '';
        }
      }).filter(placeholder => placeholder.length > 0);
      
    } catch (error) {
      console.error('❌ Error extracting placeholders:', error);
      return [];
    }
  }

  /**
   * 🎨 GET TONE RECOMMENDATIONS
   */
  static async getToneRecommendations(currentHour: number): Promise<{
    recommendedTones: string[];
    avoidTones: string[];
    reasoning: string;
  }> {
    try {
      const recentToneUsage = await this.getRecentToneUsage();
      const overusedTones = this.identifyOverusedTones(recentToneUsage);
      const timeOfDay = this.getTimeOfDay(currentHour);

      // Time-based tone preferences
      const timeBasedPreferences: { [key: string]: string[] } = {
        morning: ['friendly', 'scientific'],
        afternoon: ['friendly', 'personal'],
        evening: ['controversial', 'scientific'],
        late_night: ['personal', 'scientific']
      };

      const preferredTones = timeBasedPreferences[timeOfDay] || ['friendly'];
      const recommendedTones = preferredTones.filter(tone => !overusedTones.includes(tone));

      return {
        recommendedTones: recommendedTones.length > 0 ? recommendedTones : ['friendly'],
        avoidTones: overusedTones,
        reasoning: `${timeOfDay} prefers ${preferredTones.join(', ')}; avoiding overused: ${overusedTones.join(', ')}`
      };

    } catch (error) {
      return {
        recommendedTones: ['friendly'],
        avoidTones: [],
        reasoning: 'Error getting recommendations - using default'
      };
    }
  }
}

export const promptTemplateRotation = PromptTemplateRotation; 