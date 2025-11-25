/**
 * PATTERN STORAGE
 * Helper functions for storing and retrieving content patterns
 */

import { createClient } from '@supabase/supabase-js';
import { ContentPatterns } from './patternExtractor';

export class PatternStorage {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  
  /**
   * Store patterns for a piece of content
   */
  async storePatterns(
    decisionId: string, 
    content: string, 
    patterns: ContentPatterns
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('content_patterns')
        .insert({
          decision_id: decisionId,
          content: content,
          patterns: patterns
        } as any); // Type assertion needed - table type not fully defined
      
      if (error) {
        console.error('Error storing patterns:', error);
        throw error;
      }
      
      console.log(`✅ Patterns stored for decision ${decisionId}`);
      
    } catch (error) {
      console.error('Failed to store patterns:', error);
      // Don't throw - pattern storage is not critical for content generation
    }
  }
  
  /**
   * Get recent patterns for analysis
   */
  async getRecentPatterns(limit: number = 5): Promise<ContentPatterns[]> {
    try {
      const { data, error } = await this.supabase
        .from('content_patterns')
        .select('patterns')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching recent patterns:', error);
        return [];
      }
      
      return (data || []).map((p: any) => p.patterns as ContentPatterns);
      
    } catch (error) {
      console.error('Failed to fetch recent patterns:', error);
      return [];
    }
  }
  
  /**
   * Get patterns for a specific decision
   */
  async getPatternsForDecision(decisionId: string): Promise<ContentPatterns | null> {
    try {
      const { data, error } = await this.supabase
        .from('content_patterns')
        .select('patterns')
        .eq('decision_id', decisionId)
        .single();
      
      if (error) {
        console.error('Error fetching patterns for decision:', error);
        return null;
      }
      
      return (data as any)?.patterns as ContentPatterns || null;
      
    } catch (error) {
      console.error('Failed to fetch patterns for decision:', error);
      return null;
    }
  }
  
  /**
   * Check if patterns exist for a decision
   */
  async hasPatterns(decisionId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('content_patterns')
        .select('id')
        .eq('decision_id', decisionId)
        .single();
      
      return !error && !!data;
      
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const patternStorage = new PatternStorage();
