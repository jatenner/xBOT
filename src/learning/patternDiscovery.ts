/**
 * Pattern Discovery Engine
 * Automatically discovers what makes content successful
 */

import { getSupabaseClient } from '../db/index';
import { EnhancedPerformanceData, ContentPattern } from './performanceTracker';

export interface DiscoveredPattern {
  id: string;
  type: 'content_structure' | 'timing' | 'topic_combination' | 'audience_behavior' | 'viral_element';
  description: string;
  confidence: number;
  impact_score: number; // How much this pattern improves performance
  sample_size: number;
  discovered_at: string;
  validation_status: 'discovered' | 'testing' | 'validated' | 'rejected';
  
  // Pattern specifics
  conditions: Record<string, any>; // What conditions trigger this pattern
  outcomes: {
    avg_engagement_lift: number;
    avg_follower_growth: number;
    success_rate: number;
  };
  
  // Usage recommendations
  recommendations: {
    when_to_use: string[];
    avoid_when: string[];
    optimal_frequency: string;
  };
}

export interface ContentInsight {
  insight_type: 'hook_optimization' | 'topic_timing' | 'format_selection' | 'audience_preference';
  title: string;
  description: string;
  actionable_advice: string;
  confidence: number;
  expected_improvement: string;
  supporting_data: {
    sample_size: number;
    performance_difference: number;
    statistical_significance: number;
  };
}

export class PatternDiscoveryEngine {
  private supabase = getSupabaseClient();
  private minSampleSize = 5; // Minimum posts needed to identify a pattern
  private minConfidence = 0.7; // Minimum confidence to consider pattern valid
  
  /**
   * Main pattern discovery process
   */
  async discoverPatterns(): Promise<DiscoveredPattern[]> {
    console.log('[PATTERN_DISCOVERY] 🔍 Starting pattern discovery analysis...');
    
    try {
      // Get recent performance data
      const performanceData = await this.getRecentPerformanceData();
      
      if (performanceData.length < this.minSampleSize) {
        console.log('[PATTERN_DISCOVERY] ⏸️ Insufficient data for pattern discovery');
        return [];
      }
      
      const patterns: DiscoveredPattern[] = [];
      
      // Discover different types of patterns
      patterns.push(...await this.discoverContentStructurePatterns(performanceData));
      patterns.push(...await this.discoverTimingPatterns(performanceData));
      patterns.push(...await this.discoverTopicCombinationPatterns(performanceData));
      patterns.push(...await this.discoverViralElementPatterns(performanceData));
      patterns.push(...await this.discoverAudienceBehaviorPatterns(performanceData));
      
      // Filter by confidence and impact
      const validPatterns = patterns.filter(p => 
        p.confidence >= this.minConfidence && 
        p.impact_score > 0.1 // At least 10% improvement
      );
      
      // Store discovered patterns
      for (const pattern of validPatterns) {
        await this.storeDiscoveredPattern(pattern);
      }
      
      console.log(`[PATTERN_DISCOVERY] ✅ Discovered ${validPatterns.length} high-confidence patterns`);
      return validPatterns;
      
    } catch (error: any) {
      console.error('[PATTERN_DISCOVERY] ❌ Error in pattern discovery:', error.message);
      return [];
    }
  }
  
  /**
   * Discover content structure patterns (hooks, evidence, format combinations)
   */
  private async discoverContentStructurePatterns(data: EnhancedPerformanceData[]): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];
    
    // Analyze hook + evidence combinations
    const hookEvidenceCombos = this.groupBy(data, (item) => `${item.hook_type}_${item.evidence_type}`);
    
    for (const [combo, posts] of Object.entries(hookEvidenceCombos)) {
      if (posts.length >= this.minSampleSize) {
        const avgPerformance = this.calculateAveragePerformance(posts);
        const overallAvg = this.calculateAveragePerformance(data);
        const improvement = (avgPerformance - overallAvg) / overallAvg;
        
        if (improvement > 0.1) { // 10% improvement threshold
          const [hookType, evidenceType] = combo.split('_');
          
          patterns.push({
            id: `content_structure_${combo}_${Date.now()}`,
            type: 'content_structure',
            description: `${hookType} hooks combined with ${evidenceType} evidence perform ${(improvement * 100).toFixed(1)}% better`,
            confidence: this.calculateConfidence(posts.length, improvement),
            impact_score: improvement,
            sample_size: posts.length,
            discovered_at: new Date().toISOString(),
            validation_status: 'discovered',
            conditions: {
              hook_type: hookType,
              evidence_type: evidenceType
            },
            outcomes: {
              avg_engagement_lift: improvement,
              avg_follower_growth: this.calculateFollowerGrowth(posts),
              success_rate: posts.filter(p => p.engagement_rate > overallAvg).length / posts.length
            },
            recommendations: {
              when_to_use: [`When creating ${hookType.replace('_', ' ')} content`, `When you have ${evidenceType.replace('_', ' ')} available`],
              avoid_when: ['When topic is oversaturated', 'During low-engagement hours'],
              optimal_frequency: posts.length > 10 ? 'High frequency (daily)' : 'Medium frequency (few times per week)'
            }
          });
        }
      }
    }
    
    // Analyze content length patterns
    const lengthPatterns = this.analyzeLengthPatterns(data);
    patterns.push(...lengthPatterns);
    
    // Analyze controversy + statistics combinations
    const controversyStats = data.filter(p => p.has_controversy && p.has_statistics);
    const nonControversyStats = data.filter(p => !p.has_controversy && p.has_statistics);
    
    if (controversyStats.length >= this.minSampleSize && nonControversyStats.length >= this.minSampleSize) {
      const controversyAvg = this.calculateAveragePerformance(controversyStats);
      const nonControversyAvg = this.calculateAveragePerformance(nonControversyStats);
      const improvement = (controversyAvg - nonControversyAvg) / nonControversyAvg;
      
      if (Math.abs(improvement) > 0.1) {
        patterns.push({
          id: `controversy_stats_${Date.now()}`,
          type: 'content_structure',
          description: `Controversial content with statistics performs ${(improvement * 100).toFixed(1)}% ${improvement > 0 ? 'better' : 'worse'}`,
          confidence: this.calculateConfidence(controversyStats.length + nonControversyStats.length, Math.abs(improvement)),
          impact_score: Math.abs(improvement),
          sample_size: controversyStats.length + nonControversyStats.length,
          discovered_at: new Date().toISOString(),
          validation_status: 'discovered',
          conditions: {
            has_controversy: improvement > 0,
            has_statistics: true
          },
          outcomes: {
            avg_engagement_lift: improvement,
            avg_follower_growth: this.calculateFollowerGrowth(improvement > 0 ? controversyStats : nonControversyStats),
            success_rate: improvement > 0 ? 0.8 : 0.4
          },
          recommendations: {
            when_to_use: improvement > 0 ? ['When debunking myths', 'When challenging common beliefs'] : ['When providing educational content', 'When building authority'],
            avoid_when: improvement > 0 ? ['When audience is sensitive', 'During crisis periods'] : ['When trying to go viral', 'When engagement is low'],
            optimal_frequency: improvement > 0 ? 'Medium frequency (2-3 times per week)' : 'High frequency (daily)'
          }
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Discover timing patterns (day of week, time of day, posting frequency)
   */
  private async discoverTimingPatterns(data: EnhancedPerformanceData[]): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];
    
    // Analyze day of week patterns
    const dayPatterns = this.groupBy(data, (item) => item.day_of_week.toString());
    const dayPerformances = Object.entries(dayPatterns).map(([day, posts]) => ({
      day: parseInt(day),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)],
      avgPerformance: this.calculateAveragePerformance(posts),
      sampleSize: posts.length
    })).filter(d => d.sampleSize >= 3);
    
    if (dayPerformances.length >= 3) {
      const bestDay = dayPerformances.reduce((best, current) => 
        current.avgPerformance > best.avgPerformance ? current : best
      );
      const worstDay = dayPerformances.reduce((worst, current) => 
        current.avgPerformance < worst.avgPerformance ? current : worst
      );
      
      const improvement = (bestDay.avgPerformance - worstDay.avgPerformance) / worstDay.avgPerformance;
      
      if (improvement > 0.2) { // 20% improvement threshold for timing
        patterns.push({
          id: `timing_day_${Date.now()}`,
          type: 'timing',
          description: `${bestDay.dayName} posts perform ${(improvement * 100).toFixed(1)}% better than ${worstDay.dayName}`,
          confidence: this.calculateConfidence(bestDay.sampleSize + worstDay.sampleSize, improvement),
          impact_score: improvement,
          sample_size: bestDay.sampleSize + worstDay.sampleSize,
          discovered_at: new Date().toISOString(),
          validation_status: 'discovered',
          conditions: {
            optimal_day: bestDay.day,
            avoid_day: worstDay.day
          },
          outcomes: {
            avg_engagement_lift: improvement,
            avg_follower_growth: this.calculateFollowerGrowth(dayPatterns[bestDay.day.toString()]),
            success_rate: 0.75
          },
          recommendations: {
            when_to_use: [`Schedule important content for ${bestDay.dayName}`, 'Use for high-priority posts'],
            avoid_when: [`Avoid ${worstDay.dayName} for crucial content`, 'Don\'t schedule during identified low-engagement days'],
            optimal_frequency: 'Apply to all scheduled content'
          }
        });
      }
    }
    
    // Analyze posting frequency patterns
    const frequencyPattern = await this.analyzePostingFrequency(data);
    if (frequencyPattern) {
      patterns.push(frequencyPattern);
    }
    
    return patterns;
  }
  
  /**
   * Discover topic combination patterns
   */
  private async discoverTopicCombinationPatterns(data: EnhancedPerformanceData[]): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];
    
    // Analyze topic saturation effects
    const topicSaturationData = data.filter(p => p.topic_saturation_effect !== undefined);
    const highSaturation = topicSaturationData.filter(p => p.topic_saturation_effect! < 0.8);
    const lowSaturation = topicSaturationData.filter(p => p.topic_saturation_effect! > 1.2);
    
    if (highSaturation.length >= 3 && lowSaturation.length >= 3) {
      const highSatAvg = this.calculateAveragePerformance(highSaturation);
      const lowSatAvg = this.calculateAveragePerformance(lowSaturation);
      const difference = (lowSatAvg - highSatAvg) / highSatAvg;
      
      if (difference > 0.15) {
        patterns.push({
          id: `topic_saturation_${Date.now()}`,
          type: 'topic_combination',
          description: `Fresh topics (low saturation) perform ${(difference * 100).toFixed(1)}% better than oversaturated topics`,
          confidence: this.calculateConfidence(highSaturation.length + lowSaturation.length, difference),
          impact_score: difference,
          sample_size: highSaturation.length + lowSaturation.length,
          discovered_at: new Date().toISOString(),
          validation_status: 'discovered',
          conditions: {
            topic_saturation_threshold: 0.8,
            prefer_fresh_topics: true
          },
          outcomes: {
            avg_engagement_lift: difference,
            avg_follower_growth: this.calculateFollowerGrowth(lowSaturation),
            success_rate: 0.7
          },
          recommendations: {
            when_to_use: ['When topic hasn\'t been covered recently', 'When introducing new health trends', 'For breakthrough research'],
            avoid_when: ['When topic was covered in last 7 days', 'When audience shows topic fatigue'],
            optimal_frequency: 'Monitor topic saturation before posting'
          }
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Discover viral element patterns
   */
  private async discoverViralElementPatterns(data: EnhancedPerformanceData[]): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];
    
    // Analyze viral coefficient patterns
    const highViral = data.filter(p => p.viral_coefficient > 0.3); // High retweet to like ratio
    const lowViral = data.filter(p => p.viral_coefficient < 0.1);
    
    if (highViral.length >= 3 && lowViral.length >= 3) {
      // Find common characteristics of viral content
      const viralCharacteristics = this.analyzeViralCharacteristics(highViral, lowViral);
      patterns.push(...viralCharacteristics);
    }
    
    return patterns;
  }
  
  /**
   * Discover audience behavior patterns
   */
  private async discoverAudienceBehaviorPatterns(data: EnhancedPerformanceData[]): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];
    
    // Analyze engagement decay patterns
    const fastDecay = data.filter(p => p.engagement_decay_rate > 0.5);
    const slowDecay = data.filter(p => p.engagement_decay_rate < 0.2);
    
    if (fastDecay.length >= 3 && slowDecay.length >= 3) {
      const decayPattern = this.analyzeEngagementDecay(fastDecay, slowDecay);
      if (decayPattern) {
        patterns.push(decayPattern);
      }
    }
    
    return patterns;
  }
  
  /**
   * Generate actionable insights from discovered patterns
   */
  async generateContentInsights(): Promise<ContentInsight[]> {
    const patterns = await this.getValidatedPatterns();
    const insights: ContentInsight[] = [];
    
    for (const pattern of patterns) {
      const insight = this.patternToInsight(pattern);
      if (insight) {
        insights.push(insight);
      }
    }
    
    return insights.sort((a, b) => b.expected_improvement.localeCompare(a.expected_improvement));
  }
  
  /**
   * Helper methods
   */
  private async getRecentPerformanceData(days: number = 30): Promise<EnhancedPerformanceData[]> {
    try {
      const { data, error } = await this.supabase
        .from('enhanced_performance')
        .select('*')
        .gte('posted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('posted_at', { ascending: false });
      
      if (error) {
        console.error('[PATTERN_DISCOVERY] Error fetching performance data:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[PATTERN_DISCOVERY] Error fetching performance data:', error);
      return [];
    }
  }
  
  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
  
  private calculateAveragePerformance(posts: EnhancedPerformanceData[]): number {
    if (posts.length === 0) return 0;
    return posts.reduce((sum, post) => sum + post.engagement_rate, 0) / posts.length;
  }
  
  private calculateFollowerGrowth(posts: EnhancedPerformanceData[]): number {
    if (posts.length === 0) return 0;
    return posts.reduce((sum, post) => sum + (post.audience_retention || 0), 0) / posts.length;
  }
  
  private calculateConfidence(sampleSize: number, effectSize: number): number {
    // Simple confidence calculation based on sample size and effect size
    const sampleConfidence = Math.min(0.95, sampleSize / 20);
    const effectConfidence = Math.min(0.95, effectSize * 2);
    return (sampleConfidence + effectConfidence) / 2;
  }
  
  private analyzeLengthPatterns(data: EnhancedPerformanceData[]): DiscoveredPattern[] {
    // Analyze optimal content length patterns
    const shortContent = data.filter(p => p.content_length < 100);
    const mediumContent = data.filter(p => p.content_length >= 100 && p.content_length < 200);
    const longContent = data.filter(p => p.content_length >= 200);
    
    const patterns: DiscoveredPattern[] = [];
    
    if (shortContent.length >= 3 && mediumContent.length >= 3 && longContent.length >= 3) {
      const performances = [
        { length: 'short', posts: shortContent, avg: this.calculateAveragePerformance(shortContent) },
        { length: 'medium', posts: mediumContent, avg: this.calculateAveragePerformance(mediumContent) },
        { length: 'long', posts: longContent, avg: this.calculateAveragePerformance(longContent) }
      ];
      
      const best = performances.reduce((best, current) => current.avg > best.avg ? current : best);
      const worst = performances.reduce((worst, current) => current.avg < worst.avg ? current : worst);
      
      const improvement = (best.avg - worst.avg) / worst.avg;
      
      if (improvement > 0.15) {
        patterns.push({
          id: `content_length_${Date.now()}`,
          type: 'content_structure',
          description: `${best.length} content (${best.length === 'short' ? '<100' : best.length === 'medium' ? '100-200' : '200+'} chars) performs ${(improvement * 100).toFixed(1)}% better`,
          confidence: this.calculateConfidence(best.posts.length + worst.posts.length, improvement),
          impact_score: improvement,
          sample_size: best.posts.length + worst.posts.length,
          discovered_at: new Date().toISOString(),
          validation_status: 'discovered',
          conditions: {
            optimal_length_category: best.length,
            avoid_length_category: worst.length
          },
          outcomes: {
            avg_engagement_lift: improvement,
            avg_follower_growth: this.calculateFollowerGrowth(best.posts),
            success_rate: 0.7
          },
          recommendations: {
            when_to_use: [`Aim for ${best.length} content length`, 'Optimize content length for engagement'],
            avoid_when: [`Avoid ${worst.length} content when possible`],
            optimal_frequency: 'Apply to all content'
          }
        });
      }
    }
    
    return patterns;
  }
  
  private async analyzePostingFrequency(data: EnhancedPerformanceData[]): Promise<DiscoveredPattern | null> {
    // Analyze if posting frequency affects performance
    // This would require more complex analysis of time gaps between posts
    // For now, return null - can be implemented later
    return null;
  }
  
  private analyzeViralCharacteristics(highViral: EnhancedPerformanceData[], lowViral: EnhancedPerformanceData[]): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];
    
    // Analyze hook types in viral vs non-viral content
    const viralHooks = this.groupBy(highViral, p => p.hook_type);
    const nonViralHooks = this.groupBy(lowViral, p => p.hook_type);
    
    for (const [hookType, viralPosts] of Object.entries(viralHooks)) {
      const nonViralPosts = nonViralHooks[hookType] || [];
      
      if (viralPosts.length >= 2 && nonViralPosts.length >= 2) {
        const viralRate = viralPosts.length / (viralPosts.length + nonViralPosts.length);
        
        if (viralRate > 0.7) { // 70% of this hook type goes viral
          patterns.push({
            id: `viral_hook_${hookType}_${Date.now()}`,
            type: 'viral_element',
            description: `${hookType.replace('_', ' ')} hooks have ${(viralRate * 100).toFixed(1)}% viral rate`,
            confidence: this.calculateConfidence(viralPosts.length + nonViralPosts.length, viralRate - 0.5),
            impact_score: viralRate - 0.5,
            sample_size: viralPosts.length + nonViralPosts.length,
            discovered_at: new Date().toISOString(),
            validation_status: 'discovered',
            conditions: {
              hook_type: hookType,
              viral_threshold: 0.3
            },
            outcomes: {
              avg_engagement_lift: viralRate - 0.5,
              avg_follower_growth: this.calculateFollowerGrowth(viralPosts),
              success_rate: viralRate
            },
            recommendations: {
              when_to_use: ['When aiming for viral content', 'For maximum reach'],
              avoid_when: ['When building authority', 'For educational content'],
              optimal_frequency: 'Use for 20-30% of content'
            }
          });
        }
      }
    }
    
    return patterns;
  }
  
  private analyzeEngagementDecay(fastDecay: EnhancedPerformanceData[], slowDecay: EnhancedPerformanceData[]): DiscoveredPattern | null {
    // Analyze what characteristics lead to sustained engagement
    const fastDecayAvg = this.calculateAveragePerformance(fastDecay);
    const slowDecayAvg = this.calculateAveragePerformance(slowDecay);
    
    if (slowDecayAvg > fastDecayAvg * 1.2) {
      return {
        id: `engagement_decay_${Date.now()}`,
        type: 'audience_behavior',
        description: `Content with slow engagement decay performs ${((slowDecayAvg / fastDecayAvg - 1) * 100).toFixed(1)}% better overall`,
        confidence: this.calculateConfidence(fastDecay.length + slowDecay.length, slowDecayAvg / fastDecayAvg - 1),
        impact_score: slowDecayAvg / fastDecayAvg - 1,
        sample_size: fastDecay.length + slowDecay.length,
        discovered_at: new Date().toISOString(),
        validation_status: 'discovered',
        conditions: {
          target_decay_rate: 'slow',
          avoid_decay_rate: 'fast'
        },
        outcomes: {
          avg_engagement_lift: slowDecayAvg / fastDecayAvg - 1,
          avg_follower_growth: this.calculateFollowerGrowth(slowDecay),
          success_rate: 0.8
        },
        recommendations: {
          when_to_use: ['For evergreen content', 'When building long-term authority'],
          avoid_when: ['For time-sensitive content', 'For viral attempts'],
          optimal_frequency: 'Mix with viral content for balance'
        }
      };
    }
    
    return null;
  }
  
  private async storeDiscoveredPattern(pattern: DiscoveredPattern): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('discovered_patterns')
        .upsert([pattern], { onConflict: 'id' });
      
      if (error) {
        console.error('[PATTERN_DISCOVERY] Error storing pattern:', error);
        return;
      }
      
      console.log(`[PATTERN_DISCOVERY] 💡 Pattern stored: ${pattern.description}`);
    } catch (error: any) {
      console.error('[PATTERN_DISCOVERY] Error storing pattern:', error.message);
    }
  }
  
  private async getValidatedPatterns(): Promise<DiscoveredPattern[]> {
    try {
      const { data, error } = await this.supabase
        .from('discovered_patterns')
        .select('*')
        .eq('validation_status', 'validated')
        .gte('confidence', 0.7)
        .order('impact_score', { ascending: false });
      
      if (error) {
        console.error('[PATTERN_DISCOVERY] Error fetching patterns:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[PATTERN_DISCOVERY] Error fetching patterns:', error);
      return [];
    }
  }
  
  private patternToInsight(pattern: DiscoveredPattern): ContentInsight | null {
    // Convert discovered pattern to actionable insight
    switch (pattern.type) {
      case 'content_structure':
        return {
          insight_type: 'hook_optimization',
          title: `Optimize Content Structure`,
          description: pattern.description,
          actionable_advice: pattern.recommendations.when_to_use[0] || 'Apply this pattern to improve engagement',
          confidence: pattern.confidence,
          expected_improvement: `${(pattern.impact_score * 100).toFixed(1)}% better engagement`,
          supporting_data: {
            sample_size: pattern.sample_size,
            performance_difference: pattern.impact_score,
            statistical_significance: pattern.confidence
          }
        };
        
      case 'timing':
        return {
          insight_type: 'topic_timing',
          title: `Optimize Posting Timing`,
          description: pattern.description,
          actionable_advice: pattern.recommendations.when_to_use[0] || 'Apply this timing pattern',
          confidence: pattern.confidence,
          expected_improvement: `${(pattern.impact_score * 100).toFixed(1)}% better engagement`,
          supporting_data: {
            sample_size: pattern.sample_size,
            performance_difference: pattern.impact_score,
            statistical_significance: pattern.confidence
          }
        };
        
      default:
        return null;
    }
  }
}

// Export singleton instance
export const patternDiscovery = new PatternDiscoveryEngine();
