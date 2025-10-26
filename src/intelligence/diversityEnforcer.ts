/**
 * 🎯 DIVERSITY ENFORCER
 * 
 * Enforces content diversity by tracking recent topics, angles, and tones.
 * Implements a rolling 10-post blacklist system:
 * - Last 10 topics are banned from repetition
 * - Last 10 angles are banned from repetition
 * - Last 10 tones are banned from repetition
 * 
 * This forces the AI to explore new combinations and prevents staleness.
 */

import { getSupabaseClient } from '../db/index';

export class DiversityEnforcer {
  private static instance: DiversityEnforcer;
  private supabase = getSupabaseClient();
  
  // Rolling blacklist window size (number of posts to track)
  private readonly BLACKLIST_WINDOW = 10;
  
  private constructor() {}
  
  public static getInstance(): DiversityEnforcer {
    if (!DiversityEnforcer.instance) {
      DiversityEnforcer.instance = new DiversityEnforcer();
    }
    return DiversityEnforcer.instance;
  }
  
  /**
   * Get last 10 topics (banned list)
   * These topics cannot be used until they fall off the list
   */
  async getLast10Topics(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('content_metadata')
        .select('raw_topic')
        .not('raw_topic', 'is', null) // Only get rows with topics
        .order('created_at', { ascending: false })
        .limit(this.BLACKLIST_WINDOW);
      
      if (error) {
        console.error('[DIVERSITY_ENFORCER] Error fetching topics:', error);
        return [];
      }
      
      const topics = (data || [])
        .map(d => d.raw_topic)
        .filter((topic): topic is string => !!topic);
      
      const uniqueTopics = [...new Set(topics)]; // Remove duplicates
      
      console.log(`[DIVERSITY_ENFORCER] 🚫 Last ${topics.length} topics (${uniqueTopics.length} unique) are BANNED:`);
      if (uniqueTopics.length > 0) {
        console.log(`   ${uniqueTopics.slice(0, 5).join(', ')}${uniqueTopics.length > 5 ? '...' : ''}`);
      } else {
        console.log('   (none yet - fresh start!)');
      }
      
      return topics; // Return all (including duplicates) so AI knows frequency
      
    } catch (error) {
      console.error('[DIVERSITY_ENFORCER] Exception fetching topics:', error);
      return [];
    }
  }
  
  /**
   * Get last 10 angles (banned list)
   * These angles cannot be used until they fall off the list
   */
  async getLast10Angles(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('content_metadata')
        .select('angle')
        .not('angle', 'is', null) // Only get rows with angles
        .order('created_at', { ascending: false })
        .limit(this.BLACKLIST_WINDOW);
      
      if (error) {
        console.error('[DIVERSITY_ENFORCER] Error fetching angles:', error);
        return [];
      }
      
      const angles = (data || [])
        .map(d => d.angle)
        .filter((angle): angle is string => !!angle);
      
      const uniqueAngles = [...new Set(angles)];
      
      console.log(`[DIVERSITY_ENFORCER] 🚫 Last ${angles.length} angles (${uniqueAngles.length} unique) are BANNED:`);
      if (uniqueAngles.length > 0) {
        console.log(`   ${uniqueAngles.slice(0, 5).join(', ')}${uniqueAngles.length > 5 ? '...' : ''}`);
      } else {
        console.log('   (none yet - fresh start!)');
      }
      
      return angles;
      
    } catch (error) {
      console.error('[DIVERSITY_ENFORCER] Exception fetching angles:', error);
      return [];
    }
  }
  
  /**
   * Get last 10 tones (banned list)
   * These tones cannot be used until they fall off the list
   */
  async getLast10Tones(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('content_metadata')
        .select('tone')
        .not('tone', 'is', null) // Only get rows with tones
        .order('created_at', { ascending: false })
        .limit(this.BLACKLIST_WINDOW);
      
      if (error) {
        console.error('[DIVERSITY_ENFORCER] Error fetching tones:', error);
        return [];
      }
      
      const tones = (data || [])
        .map(d => d.tone)
        .filter((tone): tone is string => !!tone);
      
      const uniqueTones = [...new Set(tones)];
      
      console.log(`[DIVERSITY_ENFORCER] 🚫 Last ${tones.length} tones (${uniqueTones.length} unique) are BANNED:`);
      if (uniqueTones.length > 0) {
        console.log(`   ${uniqueTones.slice(0, 5).join(', ')}${uniqueTones.length > 5 ? '...' : ''}`);
      } else {
        console.log('   (none yet - fresh start!)');
      }
      
      return tones;
      
    } catch (error) {
      console.error('[DIVERSITY_ENFORCER] Exception fetching tones:', error);
      return [];
    }
  }
  
  /**
   * Get comprehensive diversity summary
   * Shows current state of diversity across all dimensions
   */
  async getDiversitySummary(): Promise<void> {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 DIVERSITY STATUS (Last ${this.BLACKLIST_WINDOW} Posts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const [topics, angles, tones] = await Promise.all([
      this.getLast10Topics(),
      this.getLast10Angles(),
      this.getLast10Tones()
    ]);
    
    const uniqueTopics = new Set(topics).size;
    const uniqueAngles = new Set(angles).size;
    const uniqueTones = new Set(tones).size;
    
    const totalPosts = Math.max(topics.length, angles.length, tones.length);
    
    // Calculate diversity scores (higher is better)
    const topicDiversity = totalPosts > 0 ? (uniqueTopics / totalPosts) * 100 : 0;
    const angleDiversity = totalPosts > 0 ? (uniqueAngles / totalPosts) * 100 : 0;
    const toneDiversity = totalPosts > 0 ? (uniqueTones / totalPosts) * 100 : 0;
    
    // Overall diversity score (average of all dimensions)
    const overallDiversity = (topicDiversity + angleDiversity + toneDiversity) / 3;
    
    console.log(`
📌 TOPICS:
   Total: ${topics.length} | Unique: ${uniqueTopics} | Diversity: ${topicDiversity.toFixed(0)}%
   ${topics.length === 0 ? 'No topics yet' : `Most recent: "${topics[0]}"`}

📐 ANGLES:
   Total: ${angles.length} | Unique: ${uniqueAngles} | Diversity: ${angleDiversity.toFixed(0)}%
   ${angles.length === 0 ? 'No angles yet' : `Most recent: "${angles[0]}"`}

🎤 TONES:
   Total: ${tones.length} | Unique: ${uniqueTones} | Diversity: ${toneDiversity.toFixed(0)}%
   ${tones.length === 0 ? 'No tones yet' : `Most recent: "${tones[0]}"`}

⭐ OVERALL DIVERSITY SCORE: ${overallDiversity.toFixed(0)}/100
   ${this.getDiversityGrade(overallDiversity)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }
  
  /**
   * Helper: Get diversity grade
   */
  private getDiversityGrade(score: number): string {
    if (score >= 90) return '🟢 EXCELLENT - Maximum variety!';
    if (score >= 75) return '🟡 GOOD - Strong variety';
    if (score >= 60) return '🟠 FAIR - Some repetition';
    if (score >= 40) return '🔴 POOR - Too much repetition';
    return '⚫ CRITICAL - Severe repetition';
  }
  
  /**
   * Check if a specific topic is currently blacklisted
   * Useful for retry logic
   */
  async isTopicBlacklisted(topic: string): Promise<boolean> {
    const banned = await this.getLast10Topics();
    return banned.includes(topic);
  }
  
  /**
   * Check if a specific angle is currently blacklisted
   */
  async isAngleBlacklisted(angle: string): Promise<boolean> {
    const banned = await this.getLast10Angles();
    return banned.includes(angle);
  }
  
  /**
   * Check if a specific tone is currently blacklisted
   */
  async isToneBlacklisted(tone: string): Promise<boolean> {
    const banned = await this.getLast10Tones();
    return banned.includes(tone);
  }
}

/**
 * Singleton instance getter
 */
export function getDiversityEnforcer(): DiversityEnforcer {
  return DiversityEnforcer.getInstance();
}

