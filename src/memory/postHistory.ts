/**
 * POST HISTORY
 * Tracks last 30 posts to avoid repetition and enable callbacks
 */

import { getSupabaseClient } from '../db';

export interface PostRecord {
  post_id: string;
  content: string;
  topic: string;
  generator_used: string;
  created_at: string;
  performance?: {
    followers_gained: number;
    engagement_rate: number;
  };
}

export class PostHistory {
  private static instance: PostHistory;
  private cache: PostRecord[] = [];
  
  private constructor() {}
  
  public static getInstance(): PostHistory {
    if (!PostHistory.instance) {
      PostHistory.instance = new PostHistory();
    }
    return PostHistory.instance;
  }
  
  /**
   * Load recent posts from database
   */
  async loadRecentPosts(limit: number = 30): Promise<PostRecord[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('content_decisions')
        .select('decision_id, content, generation_metadata, created_at, actual_performance')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error || !data) {
        console.log('[POST_HISTORY] Using cached history');
        return this.cache;
      }
      
      this.cache = data.map((d: any) => ({
        post_id: d.decision_id,
        content: d.content,
        topic: d.generation_metadata?.topic || 'unknown',
        generator_used: d.generation_metadata?.generator || 'unknown',
        created_at: d.created_at,
        performance: d.actual_performance
      }));
      
      return this.cache;
      
    } catch (error) {
      console.log('[POST_HISTORY] Error loading, using cache');
      return this.cache;
    }
  }
  
  /**
   * Add new post to history
   */
  async addPost(post: PostRecord): Promise<void> {
    this.cache.unshift(post);
    if (this.cache.length > 30) {
      this.cache = this.cache.slice(0, 30);
    }
  }
  
  /**
   * Check if topic was recently covered
   */
  wasTopicRecentlyCovered(topic: string, withinLast: number = 10): boolean {
    const recent = this.cache.slice(0, withinLast);
    return recent.some(p => p.topic.toLowerCase().includes(topic.toLowerCase()));
  }
  
  /**
   * Get generator usage stats
   */
  getGeneratorUsage(withinLast: number = 20): Record<string, number> {
    const recent = this.cache.slice(0, withinLast);
    const usage: Record<string, number> = {};
    
    recent.forEach(p => {
      usage[p.generator_used] = (usage[p.generator_used] || 0) + 1;
    });
    
    return usage;
  }
  
  /**
   * Get all recent posts
   */
  getRecentPosts(limit: number = 30): PostRecord[] {
    return this.cache.slice(0, limit);
  }
}

export const getPostHistory = () => PostHistory.getInstance();

