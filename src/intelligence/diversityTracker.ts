/**
 * 🎨 DIVERSITY TRACKER
 * 
 * Multi-dimensional tracking to ensure content variety:
 * - Generator rotation (don't use same generator repeatedly)
 * - Topic diversity (semantic similarity checking)
 * - Angle variety (rotate approaches)
 * - Format balance (singles vs threads)
 * - Complexity variation (mix difficulty levels)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface DiversityMetrics {
  recentTopics: string[];           // Last 20 topics
  recentGenerators: string[];       // Last 10 generators used
  recentAngles: string[];           // Last 10 angles
  recentFormats: string[];          // Last 10 formats (single/thread)
  recentComplexity: number[];       // Last 10 complexity scores
}

export interface DiversityCheckResult {
  allowed: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface PostCandidate {
  topic: string;
  generator: string;
  angle?: string;
  format: 'single' | 'thread';
  complexity?: number;
}

export class DiversityTracker {
  private static instance: DiversityTracker;

  static getInstance(): DiversityTracker {
    if (!this.instance) {
      this.instance = new DiversityTracker();
    }
    return this.instance;
  }

  /**
   * Check if a content candidate is diverse enough
   */
  async checkDiversity(candidate: PostCandidate): Promise<DiversityCheckResult> {
    
    const recent = await this.getRecentMetrics();
    
    let score = 100;
    const reasons: string[] = [];
    const warnings: string[] = [];
    
    // 1. Generator rotation check
    const generatorCheck = this.checkGeneratorRotation(candidate.generator, recent.recentGenerators);
    score += generatorCheck.scoreDelta;
    if (generatorCheck.reason) reasons.push(generatorCheck.reason);
    if (generatorCheck.warning) warnings.push(generatorCheck.warning);
    
    // 2. Topic similarity check
    const topicCheck = await this.checkTopicSimilarity(candidate.topic, recent.recentTopics);
    score += topicCheck.scoreDelta;
    if (topicCheck.reason) reasons.push(topicCheck.reason);
    if (topicCheck.warning) warnings.push(topicCheck.warning);
    
    // 3. Angle variety check
    if (candidate.angle) {
      const angleCheck = this.checkAngleVariety(candidate.angle, recent.recentAngles);
      score += angleCheck.scoreDelta;
      if (angleCheck.reason) reasons.push(angleCheck.reason);
      if (angleCheck.warning) warnings.push(angleCheck.warning);
    }
    
    // 4. Format balance check
    const formatCheck = this.checkFormatBalance(candidate.format, recent.recentFormats);
    score += formatCheck.scoreDelta;
    if (formatCheck.reason) reasons.push(formatCheck.reason);
    if (formatCheck.warning) warnings.push(formatCheck.warning);
    
    // 5. Complexity variation check
    if (candidate.complexity) {
      const complexityCheck = this.checkComplexityVariation(candidate.complexity, recent.recentComplexity);
      score += complexityCheck.scoreDelta;
      if (complexityCheck.reason) reasons.push(complexityCheck.reason);
      if (complexityCheck.warning) warnings.push(complexityCheck.warning);
    }
    
    const allowed = score >= 60; // 60% threshold
    
    return {
      allowed,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      warnings
    };
  }

  /**
   * Record a post after it's been generated
   */
  async recordPost(post: {
    topic: string;
    generator: string;
    angle?: string;
    format: 'single' | 'thread';
    complexity?: number;
    contentText?: string;
  }): Promise<void> {
    
    console.log(`[DIVERSITY_TRACKER] 📝 Recording post: ${post.generator} / ${post.topic.substring(0, 40)}`);
    
    // This will be called after content is stored in database
    // The actual storage happens in the posting system
    // We just log here for tracking
  }

  /**
   * Get recent metrics from database
   */
  private async getRecentMetrics(): Promise<DiversityMetrics> {
    
    try {
      // Query last 20 posts from VIEW (which includes new columns from base table)
      const { data, error } = await supabase
        .from('content_metadata')
        .select('raw_topic, generator_type, content_angle, format_type, complexity_score')
        .not('posted_at', 'is', null) // Only posted content
        .order('posted_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error(`[DIVERSITY_TRACKER] Database error: ${error.message}`);
        return this.getEmptyMetrics();
      }
      
      if (!data || data.length === 0) {
        return this.getEmptyMetrics();
      }
      
      return {
        recentTopics: data.map(d => d.raw_topic || d.topic).filter(Boolean),
        recentGenerators: data.map(d => d.generator_type).filter(Boolean).slice(0, 10),
        recentAngles: data.map(d => d.content_angle).filter(Boolean).slice(0, 10),
        recentFormats: data.map(d => d.format_type || 'single').slice(0, 10),
        recentComplexity: data.map(d => d.complexity_score).filter(Boolean).slice(0, 10)
      };
      
    } catch (error: any) {
      console.error(`[DIVERSITY_TRACKER] Failed to get metrics: ${error.message}`);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Check generator rotation
   */
  private checkGeneratorRotation(
    generator: string, 
    recent: string[]
  ): { scoreDelta: number; reason?: string; warning?: string } {
    
    const lastThree = recent.slice(0, 3);
    
    if (lastThree.includes(generator)) {
      const lastUseIndex = lastThree.indexOf(generator);
      
      if (lastUseIndex === 0) {
        // Used in last post - high penalty
        return {
          scoreDelta: -40,
          reason: `Generator ${generator} used in last post`,
          warning: 'Excessive repetition'
        };
      } else if (lastUseIndex <= 2) {
        // Used in last 3 posts - moderate penalty
        return {
          scoreDelta: -25,
          reason: `Generator ${generator} used ${lastUseIndex + 1} posts ago`,
          warning: 'Recent repetition'
        };
      }
    }
    
    return { scoreDelta: 0 };
  }

  /**
   * Check topic similarity
   * For now, simple string comparison. Could enhance with embeddings.
   */
  private async checkTopicSimilarity(
    topic: string, 
    recentTopics: string[]
  ): Promise<{ scoreDelta: number; reason?: string; warning?: string }> {
    
    // Simple keyword overlap check
    const topicWords = topic.toLowerCase().split(' ').filter(w => w.length > 3);
    
    for (let i = 0; i < Math.min(10, recentTopics.length); i++) {
      const recentTopic = recentTopics[i];
      const recentWords = recentTopic.toLowerCase().split(' ').filter(w => w.length > 3);
      
      const overlap = topicWords.filter(w => recentWords.includes(w)).length;
      const similarity = overlap / Math.max(topicWords.length, recentWords.length);
      
      if (similarity > 0.7) {
        return {
          scoreDelta: -35,
          reason: `Topic too similar to post ${i + 1} ago`,
          warning: 'Topic overlap detected'
        };
      } else if (similarity > 0.5) {
        return {
          scoreDelta: -20,
          reason: `Topic somewhat similar to recent post`,
          warning: 'Moderate topic similarity'
        };
      }
    }
    
    return { scoreDelta: 0 };
  }

  /**
   * Check angle variety
   */
  private checkAngleVariety(
    angle: string, 
    recentAngles: string[]
  ): { scoreDelta: number; reason?: string; warning?: string } {
    
    const angleCount = recentAngles.filter(a => a === angle).length;
    
    if (angleCount >= 3) {
      return {
        scoreDelta: -30,
        reason: `Angle "${angle}" used ${angleCount} times in last 10 posts`,
        warning: 'Angle overuse'
      };
    } else if (angleCount >= 2) {
      return {
        scoreDelta: -15,
        reason: `Angle "${angle}" used ${angleCount} times recently`,
        warning: 'Angle repetition'
      };
    }
    
    return { scoreDelta: 0 };
  }

  /**
   * Check format balance
   */
  private checkFormatBalance(
    format: 'single' | 'thread', 
    recentFormats: string[]
  ): { scoreDelta: number; reason?: string; warning?: string } {
    
    const formatCount = recentFormats.filter(f => f === format).length;
    const balance = formatCount / recentFormats.length;
    
    // Target: 70% single, 30% thread
    const target = format === 'single' ? 0.7 : 0.3;
    const deviation = Math.abs(balance - target);
    
    if (deviation > 0.3) {
      return {
        scoreDelta: -20,
        reason: `Format imbalance: ${Math.round(balance * 100)}% ${format}`,
        warning: 'Format distribution off'
      };
    } else if (deviation > 0.2) {
      return {
        scoreDelta: -10,
        reason: `Slight format imbalance`,
        warning: 'Format trending'
      };
    }
    
    return { scoreDelta: 0 };
  }

  /**
   * Check complexity variation
   */
  private checkComplexityVariation(
    complexity: number, 
    recentComplexity: number[]
  ): { scoreDelta: number; reason?: string; warning?: string } {
    
    if (recentComplexity.length === 0) {
      return { scoreDelta: 0 };
    }
    
    const avgComplexity = recentComplexity.reduce((sum, c) => sum + c, 0) / recentComplexity.length;
    const variance = recentComplexity.reduce((sum, c) => sum + Math.pow(c - avgComplexity, 2), 0) / recentComplexity.length;
    
    // Low variance = all posts at same difficulty
    if (variance < 2) {
      // If adding similar complexity again, penalize
      if (Math.abs(complexity - avgComplexity) < 2) {
        return {
          scoreDelta: -15,
          reason: `All recent posts at similar complexity level`,
          warning: 'Complexity stagnation'
        };
      }
    }
    
    return { scoreDelta: 0 };
  }

  /**
   * Empty metrics for fallback
   */
  private getEmptyMetrics(): DiversityMetrics {
    return {
      recentTopics: [],
      recentGenerators: [],
      recentAngles: [],
      recentFormats: [],
      recentComplexity: []
    };
  }

  /**
   * Get diversity summary for logging
   */
  async getDiversitySummary(): Promise<string> {
    const metrics = await this.getRecentMetrics();
    
    const genDistribution = this.getDistribution(metrics.recentGenerators);
    const formatDistribution = this.getDistribution(metrics.recentFormats);
    
    return `
🎨 DIVERSITY SUMMARY (last 20 posts):
   Generators: ${genDistribution}
   Formats: ${formatDistribution}
   Angles: ${metrics.recentAngles.length} different angles
`.trim();
  }

  /**
   * Helper: Get distribution string
   */
  private getDistribution(items: string[]): string {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}(${count})`)
      .join(', ');
  }
}

/**
 * Export singleton
 */
export const diversityTracker = DiversityTracker.getInstance();

