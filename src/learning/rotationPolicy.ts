import { admin as supabase } from '../lib/supabaseClients';
import { kvGet, kvSet } from '../utils/kv';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface RotationConstraints {
  topic_cluster_max: number; // Max % for any topic cluster
  angle_max: number; // Max % for any content angle
  window_days: number; // Rolling window in days
}

export interface ContentCandidate {
  id: string;
  topic_cluster: string;
  angle: string;
  score: number;
  metadata?: any;
}

export interface RotationStats {
  topic_distribution: Record<string, number>;
  angle_distribution: Record<string, number>;
  total_posts: number;
  violations: string[];
}

/**
 * 🔄 TOPIC ROTATION POLICY
 * Enforces diversity constraints to prevent topic/angle saturation
 */
export class RotationPolicy {
  private static constraints: RotationConstraints = {
    topic_cluster_max: 0.35, // 35% max
    angle_max: 0.40, // 40% max  
    window_days: 7
  };

  /**
   * Get recent content distribution stats
   */
  static async getRecentDistribution(): Promise<RotationStats> {
    const windowStart = new Date(Date.now() - this.constraints.window_days * 24 * 60 * 60 * 1000);
    
    try {
      // Query recent posts with metadata
      const { data, error } = await supabase
        .from('unified_posts')
        .select('content_metadata')
        .gte('created_at', windowStart.toISOString())
        .not('content_metadata', 'is', null);

      if (error) throw error;

      const topicDist: Record<string, number> = {};
      const angleDist: Record<string, number> = {};
      let totalPosts = 0;

      for (const post of data || []) {
        const metadata = post.content_metadata as any;
        if (!metadata) continue;

        totalPosts++;
        
        // Count topic clusters
        const topic = metadata.topic || metadata.topic_cluster || 'unknown';
        topicDist[topic] = (topicDist[topic] || 0) + 1;
        
        // Count angles/hooks
        const angle = metadata.hook_type || metadata.angle || 'unknown';
        angleDist[angle] = (angleDist[angle] || 0) + 1;
      }

      // Convert counts to percentages
      const topicPercentages: Record<string, number> = {};
      const anglePercentages: Record<string, number> = {};
      
      for (const [topic, count] of Object.entries(topicDist)) {
        topicPercentages[topic] = count / Math.max(1, totalPosts);
      }
      
      for (const [angle, count] of Object.entries(angleDist)) {
        anglePercentages[angle] = count / Math.max(1, totalPosts);
      }

      // Check for violations
      const violations: string[] = [];
      
      for (const [topic, pct] of Object.entries(topicPercentages)) {
        if (pct > this.constraints.topic_cluster_max) {
          violations.push(`topic:${topic}:${(pct * 100).toFixed(1)}%`);
        }
      }
      
      for (const [angle, pct] of Object.entries(anglePercentages)) {
        if (pct > this.constraints.angle_max) {
          violations.push(`angle:${angle}:${(pct * 100).toFixed(1)}%`);
        }
      }

      return {
        topic_distribution: topicPercentages,
        angle_distribution: anglePercentages,
        total_posts: totalPosts,
        violations
      };
      
    } catch (err: any) {
      error(`ROTATION_STATS_ERROR: ${err.message}`);
      return {
        topic_distribution: {},
        angle_distribution: {},
        total_posts: 0,
        violations: []
      };
    }
  }

  /**
   * Check if a candidate would violate rotation constraints
   */
  static async wouldViolate(candidate: ContentCandidate, currentStats?: RotationStats): Promise<boolean> {
    const stats = currentStats || await this.getRecentDistribution();
    
    // Simulate adding this candidate
    const newTotal = stats.total_posts + 1;
    
    // Check topic constraint
    const currentTopicCount = (stats.topic_distribution[candidate.topic_cluster] || 0) * stats.total_posts;
    const newTopicPct = (currentTopicCount + 1) / newTotal;
    
    if (newTopicPct > this.constraints.topic_cluster_max) {
      return true;
    }
    
    // Check angle constraint
    const currentAngleCount = (stats.angle_distribution[candidate.angle] || 0) * stats.total_posts;
    const newAnglePct = (currentAngleCount + 1) / newTotal;
    
    if (newAnglePct > this.constraints.angle_max) {
      return true;
    }
    
    return false;
  }

  /**
   * Apply downweighting to candidates that would violate constraints
   */
  static async applyRotationWeights(candidates: ContentCandidate[]): Promise<ContentCandidate[]> {
    try {
      const stats = await this.getRecentDistribution();
      
      if (stats.violations.length > 0) {
        log(`ROTATION_VIOLATIONS: ${stats.violations.join(', ')}`);
      }
      
      const weighted = candidates.map(candidate => {
        let weight = 1.0;
        
        // Downweight oversaturated topics
        const topicPct = stats.topic_distribution[candidate.topic_cluster] || 0;
        if (topicPct > this.constraints.topic_cluster_max * 0.8) { // Start reducing at 80% of limit
          weight *= 0.3; // Heavy penalty
        } else if (topicPct > this.constraints.topic_cluster_max * 0.6) {
          weight *= 0.6; // Moderate penalty
        }
        
        // Downweight oversaturated angles
        const anglePct = stats.angle_distribution[candidate.angle] || 0;
        if (anglePct > this.constraints.angle_max * 0.8) {
          weight *= 0.3;
        } else if (anglePct > this.constraints.angle_max * 0.6) {
          weight *= 0.6;
        }
        
        return {
          ...candidate,
          score: candidate.score * weight,
          metadata: {
            ...candidate.metadata,
            rotation_weight: weight,
            topic_saturation: topicPct,
            angle_saturation: anglePct
          }
        };
      });
      
      // Sort by weighted score
      weighted.sort((a, b) => b.score - a.score);
      
      const penalized = weighted.filter(c => (c.metadata?.rotation_weight || 1) < 1).length;
      if (penalized > 0) {
        log(`ROTATION_APPLIED: ${penalized}/${candidates.length} candidates penalized`);
      }
      
      return weighted;
      
    } catch (err: any) {
      error(`ROTATION_WEIGHTS_ERROR: ${err.message}`);
      return candidates; // Return unmodified on error
    }
  }

  /**
   * Hard filter to remove candidates that would definitely violate
   */
  static async enforceRotation(candidates: ContentCandidate[]): Promise<ContentCandidate[]> {
    try {
      const stats = await this.getRecentDistribution();
      
      const filtered: ContentCandidate[] = [];
      const rejected: string[] = [];
      
      for (const candidate of candidates) {
        if (await this.wouldViolate(candidate, stats)) {
          rejected.push(`${candidate.topic_cluster}:${candidate.angle}`);
        } else {
          filtered.push(candidate);
        }
      }
      
      if (rejected.length > 0) {
        warn(`ROTATION_FILTERED: rejected ${rejected.length} candidates: ${rejected.join(', ')}`);
      }
      
      // If we filtered out everything, return top candidate with warning
      if (filtered.length === 0 && candidates.length > 0) {
        warn(`ROTATION_EMERGENCY: all candidates filtered, returning top scorer`);
        return [candidates[0]];
      }
      
      return filtered;
      
    } catch (err: any) {
      error(`ROTATION_ENFORCEMENT_ERROR: ${err.message}`);
      return candidates; // Return unmodified on error
    }
  }

  /**
   * Get rotation policy status for monitoring
   */
  static async getStatus(): Promise<{
    constraints: RotationConstraints;
    stats: RotationStats;
    health: 'healthy' | 'warning' | 'critical';
  }> {
    const stats = await this.getRecentDistribution();
    
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (stats.violations.length > 0) {
      health = 'critical';
    } else {
      // Check if approaching limits (80% of constraints)
      const approaching = Object.values(stats.topic_distribution).some(pct => pct > this.constraints.topic_cluster_max * 0.8) ||
                         Object.values(stats.angle_distribution).some(pct => pct > this.constraints.angle_max * 0.8);
      
      if (approaching) {
        health = 'warning';
      }
    }
    
    return {
      constraints: this.constraints,
      stats,
      health
    };
  }

  /**
   * Update rotation constraints (for tuning)
   */
  static updateConstraints(newConstraints: Partial<RotationConstraints>): void {
    this.constraints = { ...this.constraints, ...newConstraints };
    log(`ROTATION_CONSTRAINTS_UPDATED: ${JSON.stringify(this.constraints)}`);
  }
}
