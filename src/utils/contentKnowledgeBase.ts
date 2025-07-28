/**
 * 📚 CONTENT KNOWLEDGE BASE EXPANSION
 * 
 * Manages a curated library of 300+ health facts and insights for content generation.
 * Tracks usage, performance metrics, and intelligently selects unused ideas.
 * 
 * Features:
 * - Curated health facts database with topic categorization
 * - Usage tracking to prevent repeating ideas
 * - Performance scoring based on engagement metrics
 * - Intelligent selection based on topic relevance and performance
 * - Bulk import and management capabilities
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface KnowledgeBaseIdea {
  id: number;
  ideaText: string;
  topic: string;
  source: string;
  approved: boolean;
  used: boolean;
  performanceScore: number;
  usageCount: number;
  lastUsed?: string;
  difficultyLevel: 'basic' | 'intermediate' | 'advanced';
  factType: 'fact' | 'myth' | 'tip' | 'insight' | 'controversy';
  tags: string[];
}

interface IdeaSelectionOptions {
  topic?: string;
  factType?: string;
  difficultyLevel?: 'basic' | 'intermediate' | 'advanced';
  excludeUsed?: boolean;
  limit?: number;
  preferHighPerformance?: boolean;
}

interface IdeaUsageResult {
  success: boolean;
  idea?: KnowledgeBaseIdea;
  error?: string;
}

export class ContentKnowledgeBase {
  private static readonly DEFAULT_PERFORMANCE_SCORE = 0.5;
  private static readonly HIGH_PERFORMANCE_THRESHOLD = 0.7;

  /**
   * 🎯 GET UNUSED IDEA FOR CONTENT GENERATION
   */
  static async getUnusedIdea(options: IdeaSelectionOptions = {}): Promise<IdeaUsageResult> {
    try {
      console.log('📚 Selecting unused idea from knowledge base...');

      const {
        topic,
        factType,
        difficultyLevel,
        excludeUsed = true,
        limit = 1,
        preferHighPerformance = true
      } = options;

      // Use stored procedure for optimal selection
      const { data, error } = await supabaseClient.supabase
        .rpc('get_unused_knowledge_ideas', {
          topic_filter: topic,
          limit_count: Math.max(limit, 10) // Get more options for better selection
        });

      if (error) {
        console.error('❌ Knowledge base query failed:', error);
        return { success: false, error: error.message };
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No unused ideas found - checking used ideas with oldest usage');
        return await this.getLeastRecentlyUsedIdea(options);
      }

      // Filter by additional criteria if specified
      let filteredIdeas = data;
      
      if (factType) {
        filteredIdeas = filteredIdeas.filter((idea: any) => idea.fact_type === factType);
      }

      if (filteredIdeas.length === 0) {
        console.log('⚠️ No ideas match criteria - falling back to any unused idea');
        filteredIdeas = data;
      }

      // Select best idea based on performance if preferred
      let selectedIdea;
      if (preferHighPerformance && filteredIdeas.length > 1) {
        // Sort by performance score and add some randomization
        filteredIdeas.sort((a: any, b: any) => {
          const scoreA = a.performance_score + (Math.random() * 0.1);
          const scoreB = b.performance_score + (Math.random() * 0.1);
          return scoreB - scoreA;
        });
        selectedIdea = filteredIdeas[0];
      } else {
        // Random selection
        selectedIdea = filteredIdeas[Math.floor(Math.random() * filteredIdeas.length)];
      }

      console.log(`✅ Selected idea: "${selectedIdea.idea_text.substring(0, 60)}..." (${selectedIdea.topic})`);

      return {
        success: true,
        idea: this.mapDatabaseToInterface(selectedIdea)
      };

    } catch (error) {
      console.error('❌ Knowledge base selection error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 🔄 GET LEAST RECENTLY USED IDEA (fallback)
   */
  private static async getLeastRecentlyUsedIdea(options: IdeaSelectionOptions): Promise<IdeaUsageResult> {
    try {
      let query = supabaseClient.supabase
        .from('content_knowledge_base')
        .select('*')
        .eq('approved', true)
        .order('last_used', { ascending: true, nullsFirst: true })
        .order('usage_count', { ascending: true })
        .limit(10);

      if (options.topic) {
        query = query.eq('topic', options.topic);
      }

      if (options.factType) {
        query = query.eq('fact_type', options.factType);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return { success: false, error: 'No fallback ideas available' };
      }

      const selectedIdea = data[Math.floor(Math.random() * Math.min(3, data.length))]; // Pick from top 3 least used
      
      console.log(`🔄 Selected least recently used idea: "${selectedIdea.idea_text.substring(0, 60)}..."`);

      return {
        success: true,
        idea: this.mapDatabaseToInterface(selectedIdea)
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Fallback failed' };
    }
  }

  /**
   * ✅ MARK IDEA AS USED
   */
  static async markIdeaAsUsed(ideaId: number, tweetId: string): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('content_knowledge_base')
        .update({
          used: true,
          usage_count: supabaseClient.supabase.raw('usage_count + 1'),
          last_used: new Date().toISOString()
        })
        .eq('id', ideaId);

      console.log(`✅ Marked idea ${ideaId} as used for tweet ${tweetId}`);

    } catch (error) {
      console.error('❌ Failed to mark idea as used:', error);
    }
  }

  /**
   * 📊 UPDATE IDEA PERFORMANCE
   */
  static async updateIdeaPerformance(
    ideaId: number,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions?: number;
    }
  ): Promise<void> {
    try {
      // Calculate engagement score
      const totalEngagement = engagement.likes + engagement.retweets + engagement.replies;
      const impressions = engagement.impressions || Math.max(totalEngagement * 10, 100);
      const engagementRate = impressions > 0 ? totalEngagement / impressions : 0;

      // Update performance score (weighted average with existing score)
      const { data: currentData } = await supabaseClient.supabase
        .from('content_knowledge_base')
        .select('performance_score, usage_count')
        .eq('id', ideaId)
        .single();

      if (currentData) {
        const currentScore = currentData.performance_score || this.DEFAULT_PERFORMANCE_SCORE;
        const usageCount = currentData.usage_count || 1;
        
        // Weighted average: give more weight to recent performance
        const newScore = ((currentScore * (usageCount - 1)) + engagementRate) / usageCount;

        await supabaseClient.supabase
          .from('content_knowledge_base')
          .update({
            performance_score: Math.min(1.0, Math.max(0.0, newScore)) // Clamp between 0 and 1
          })
          .eq('id', ideaId);

        console.log(`📊 Updated idea ${ideaId} performance: ${newScore.toFixed(3)} (${totalEngagement} total engagement)`);
      }

    } catch (error) {
      console.error('❌ Failed to update idea performance:', error);
    }
  }

  /**
   * 📥 BULK IMPORT IDEAS
   */
  static async bulkImportIdeas(ideas: Partial<KnowledgeBaseIdea>[]): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      for (const idea of ideas) {
        try {
          if (!idea.ideaText || !idea.topic) {
            errors.push(`Skipped idea: missing required fields`);
            continue;
          }

          await supabaseClient.supabase
            .from('content_knowledge_base')
            .insert({
              idea_text: idea.ideaText,
              topic: idea.topic,
              source: idea.source || 'bulk_import',
              approved: idea.approved !== false,
              difficulty_level: idea.difficultyLevel || 'intermediate',
              fact_type: idea.factType || 'insight',
              tags: idea.tags || []
            });

          imported++;

        } catch (ideaError) {
          errors.push(`Failed to import idea: ${ideaError instanceof Error ? ideaError.message : 'Unknown error'}`);
        }
      }

      console.log(`📥 Bulk import complete: ${imported} ideas imported, ${errors.length} errors`);

      return {
        success: errors.length < ideas.length,
        imported,
        errors
      };

    } catch (error) {
      return {
        success: false,
        imported,
        errors: [...errors, error instanceof Error ? error.message : 'Bulk import failed']
      };
    }
  }

  /**
   * 🔄 RESET USAGE FLAGS (for periodic refresh)
   */
  static async resetUsageFlags(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await supabaseClient.supabase
        .from('content_knowledge_base')
        .update({ used: false })
        .lt('last_used', cutoffDate.toISOString())
        .select('id');

      const resetCount = data?.length || 0;
      console.log(`🔄 Reset usage flags for ${resetCount} ideas older than ${olderThanDays} days`);

      return resetCount;

    } catch (error) {
      console.error('❌ Failed to reset usage flags:', error);
      return 0;
    }
  }

  /**
   * 📊 GET KNOWLEDGE BASE ANALYTICS
   */
  static async getAnalytics(): Promise<{
    totalIdeas: number;
    usedIdeas: number;
    topPerformingTopics: { topic: string; avgScore: number; count: number }[];
    recentUsage: number;
    approvedIdeas: number;
  }> {
    try {
      // Get basic counts
      const { data: totalData } = await supabaseClient.supabase
        .from('content_knowledge_base')
        .select('id, used, approved, performance_score, topic, last_used');

      if (!totalData) {
        return {
          totalIdeas: 0,
          usedIdeas: 0,
          topPerformingTopics: [],
          recentUsage: 0,
          approvedIdeas: 0
        };
      }

      const usedIdeas = totalData.filter(idea => idea.used).length;
      const approvedIdeas = totalData.filter(idea => idea.approved).length;
      
      // Recent usage (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentUsage = totalData.filter(idea => 
        idea.last_used && new Date(idea.last_used) > weekAgo
      ).length;

      // Top performing topics
      const topicStats: { [key: string]: { scores: number[]; count: number } } = {};
      totalData.forEach(idea => {
        if (idea.performance_score > 0) {
          if (!topicStats[idea.topic]) {
            topicStats[idea.topic] = { scores: [], count: 0 };
          }
          topicStats[idea.topic].scores.push(idea.performance_score);
          topicStats[idea.topic].count++;
        }
      });

      const topPerformingTopics = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          avgScore: stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length,
          count: stats.count
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5);

      return {
        totalIdeas: totalData.length,
        usedIdeas,
        topPerformingTopics,
        recentUsage,
        approvedIdeas
      };

    } catch (error) {
      console.error('❌ Failed to get knowledge base analytics:', error);
      return {
        totalIdeas: 0,
        usedIdeas: 0,
        topPerformingTopics: [],
        recentUsage: 0,
        approvedIdeas: 0
      };
    }
  }

  /**
   * 🔍 SEARCH IDEAS BY TOPIC OR KEYWORD
   */
  static async searchIdeas(query: string, options: {
    includeUsed?: boolean;
    limit?: number;
  } = {}): Promise<KnowledgeBaseIdea[]> {
    try {
      const { includeUsed = false, limit = 20 } = options;

      let dbQuery = supabaseClient.supabase
        .from('content_knowledge_base')
        .select('*')
        .eq('approved', true)
        .limit(limit);

      if (!includeUsed) {
        dbQuery = dbQuery.eq('used', false);
      }

      // Search in idea_text, topic, and tags
      dbQuery = dbQuery.or(`idea_text.ilike.%${query}%,topic.ilike.%${query}%,tags.cs.["${query}"]`);

      const { data, error } = await dbQuery;

      if (error) {
        console.error('❌ Knowledge base search failed:', error);
        return [];
      }

      return (data || []).map(idea => this.mapDatabaseToInterface(idea));

    } catch (error) {
      console.error('❌ Knowledge base search error:', error);
      return [];
    }
  }

  /**
   * 🔧 HELPER METHOD TO MAP DATABASE TO INTERFACE
   */
  private static mapDatabaseToInterface(dbIdea: any): KnowledgeBaseIdea {
    return {
      id: dbIdea.id,
      ideaText: dbIdea.idea_text,
      topic: dbIdea.topic,
      source: dbIdea.source,
      approved: dbIdea.approved,
      used: dbIdea.used,
      performanceScore: dbIdea.performance_score || 0,
      usageCount: dbIdea.usage_count || 0,
      lastUsed: dbIdea.last_used,
      difficultyLevel: dbIdea.difficulty_level || 'intermediate',
      factType: dbIdea.fact_type || 'insight',
      tags: dbIdea.tags || []
    };
  }

  /**
   * 🎲 GET RANDOM HIGH-PERFORMING IDEA
   */
  static async getRandomHighPerformingIdea(topic?: string): Promise<IdeaUsageResult> {
    try {
      let query = supabaseClient.supabase
        .from('content_knowledge_base')
        .select('*')
        .eq('approved', true)
        .gte('performance_score', this.HIGH_PERFORMANCE_THRESHOLD)
        .limit(10);

      if (topic) {
        query = query.eq('topic', topic);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        console.log('⚠️ No high-performing ideas found, falling back to regular selection');
        return await this.getUnusedIdea({ topic });
      }

      const selectedIdea = data[Math.floor(Math.random() * data.length)];
      
      return {
        success: true,
        idea: this.mapDatabaseToInterface(selectedIdea)
      };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Selection failed' };
    }
  }
}

export const contentKnowledgeBase = ContentKnowledgeBase; 