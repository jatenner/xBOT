/**
 * Intelligent Content Selector
 * Chooses pillar, angle, spice level using exploit/explore strategy
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/environment';

export interface ContentSelection {
  pillar: string;
  angle: string;
  spice_level: number;
  topic: string;
  evidence_mode: string;
  reasoning: string;
}

export interface PerformanceData {
  pillar: string;
  angle: string;
  spice_level: number;
  quality_score: number;
  engagement_bucket: 'dead' | 'low' | 'medium' | 'high';
  follow_through_rate: number;
  posted_at: string;
  metadata?: {
    pillar: string;
    angle: string;
    spice_level: number;
    evidence_mode: string;
    selection_reasoning: string;
  };
}

export class ContentSelector {
  private static instance: ContentSelector;
  private supabase: any;

  // Content configuration
  private pillars = ['sleep', 'nutrition', 'habit design', 'cognition'];
  private angles = [
    'checklist', 'mistakes_with_fix', 'before_after', 'mini_case', 'heuristic_pack',
    'mechanism_deep_dive', 'contrarian_take', 'study_breakdown', 'quick_wins'
  ];
  private evidenceModes = ['mini-study', 'mechanism', 'case', 'checklist'];
  
  // Template distribution (weekly)
  private templateDistribution = {
    'checklist': 0.60,
    'mistakes_with_fix': 0.20, 
    'mini_case': 0.15,
    'contrarian_take': 0.05
  };

  private constructor() {
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  }

  public static getInstance(): ContentSelector {
    if (!ContentSelector.instance) {
      ContentSelector.instance = new ContentSelector();
    }
    return ContentSelector.instance;
  }

  /**
   * Select optimal content parameters using exploit/explore strategy
   */
  async selectContent(): Promise<ContentSelection> {
    try {
      console.log('🎯 Selecting optimal content parameters...');

      // Get recent performance data (last 14 days)
      const recentPerformance = await this.getRecentPerformance();
      
      // Check for pillar rotation constraints
      const lastPillar = await this.getLastPostedPillar();
      
      // Apply exploit/explore strategy
      const shouldExplore = Math.random() < 0.20; // 20% explore, 80% exploit
      
      let selection: ContentSelection;
      
      if (shouldExplore || recentPerformance.length < 5) {
        selection = await this.exploreNewCombination(lastPillar);
        console.log('🔍 EXPLORE: Trying new combination');
      } else {
        selection = await this.exploitBestCombination(recentPerformance, lastPillar);
        console.log('🎯 EXPLOIT: Using proven combination');
      }

      // Generate specific topic for selected pillar
      selection.topic = await this.generateTopicForPillar(selection.pillar, selection.angle);
      
      console.log(`✅ Selected: ${selection.pillar} | ${selection.angle} | spice=${selection.spice_level}`);
      console.log(`📝 Topic: ${selection.topic}`);
      console.log(`💡 Reasoning: ${selection.reasoning}`);

      return selection;

    } catch (error) {
      console.error('❌ Content selection failed, using fallback:', error);
      return this.getFallbackSelection();
    }
  }

  private async getRecentPerformance(): Promise<PerformanceData[]> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await this.supabase
      .from('posted_threads')
      .select('*')
      .gte('posted_at', since)
      .order('posted_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch performance data:', error);
      return [];
    }

    return data || [];
  }

  private async getLastPostedPillar(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('posted_threads')
      .select('metadata')
      .order('posted_at', { ascending: false })
      .limit(1);

    if (error || !data?.[0]?.metadata?.pillar) {
      return null;
    }

    return data[0].metadata.pillar;
  }

  private async exploreNewCombination(lastPillar: string | null): Promise<ContentSelection> {
    // Avoid same pillar back-to-back
    const availablePillars = this.pillars.filter(p => p !== lastPillar);
    const pillar = availablePillars[Math.floor(Math.random() * availablePillars.length)];
    
    // Pick random angle and spice level for exploration
    const angle = this.angles[Math.floor(Math.random() * this.angles.length)];
    const spice_level = Math.floor(Math.random() * 3) + 1; // 1-3
    const evidence_mode = this.evidenceModes[Math.floor(Math.random() * this.evidenceModes.length)];

    return {
      pillar,
      angle,
      spice_level,
      topic: '', // Will be filled later
      evidence_mode,
      reasoning: `Exploring new combination: ${pillar} + ${angle} (spice ${spice_level})`
    };
  }

  private async exploitBestCombination(performance: PerformanceData[], lastPillar: string | null): Promise<ContentSelection> {
    // Score combinations by engagement and follow-through
    const combinationScores = new Map<string, number>();

    performance.forEach(thread => {
      if (!thread.metadata?.pillar || !thread.metadata?.angle) return;

      const key = `${thread.metadata.pillar}:${thread.metadata.angle}:${thread.metadata.spice_level}`;
      const engagementScore = this.getEngagementScore(thread.engagement_bucket);
      const qualityBonus = (thread.quality_score - 90) / 10; // Bonus for scores >90
      const followThroughBonus = (thread.follow_through_rate || 0) * 10;
      
      const totalScore = engagementScore + qualityBonus + followThroughBonus;
      combinationScores.set(key, (combinationScores.get(key) || 0) + totalScore);
    });

    // Get top combinations, avoiding last pillar
    const sortedCombos = Array.from(combinationScores.entries())
      .sort(([,a], [,b]) => b - a)
      .filter(([key]) => {
        const pillar = key.split(':')[0];
        return pillar !== lastPillar;
      });

    if (sortedCombos.length === 0) {
      return this.exploreNewCombination(lastPillar);
    }

    // Pick from top 2 combinations
    const [bestCombo] = sortedCombos[Math.floor(Math.random() * Math.min(2, sortedCombos.length))];
    const [pillar, angle, spice_level] = bestCombo.split(':');
    const evidence_mode = this.evidenceModes[Math.floor(Math.random() * this.evidenceModes.length)];

    return {
      pillar,
      angle,
      spice_level: parseInt(spice_level),
      topic: '', // Will be filled later
      evidence_mode,
      reasoning: `Exploiting top performer: score ${combinationScores.get(bestCombo)?.toFixed(1)}`
    };
  }

  private getEngagementScore(bucket: string): number {
    switch (bucket) {
      case 'high': return 10;
      case 'medium': return 6;
      case 'low': return 3;
      case 'dead': return 0;
      default: return 2; // Unknown/pending
    }
  }

  private async generateTopicForPillar(pillar: string, angle: string): Promise<string> {
    const topicBank = {
      sleep: [
        'Sleep timing optimization for night owls',
        'Blue light myths and circadian science',
        'Sleep quality vs quantity debate',
        'Morning light exposure for better sleep',
        'Sleep debt recovery strategies',
        'Temperature regulation for deep sleep',
        'Caffeine timing and sleep latency',
        'Nap timing without ruining nighttime sleep'
      ],
      nutrition: [
        'Meal timing for metabolic health',
        'Protein distribution throughout the day',
        'Hydration myths and electrolyte balance',
        'Blood sugar stability techniques',
        'Micronutrient timing for absorption',
        'Intermittent fasting for busy professionals',
        'Post-workout nutrition windows',
        'Fiber intake for gut-brain connection'
      ],
      'habit design': [
        'Habit stacking for sustainable routines',
        'Environment design for automatic behaviors',
        'Motivation vs systems for lasting change',
        'Breaking bad habits with substitution',
        'Tracking habits without obsessing',
        'Social accountability for habit formation',
        'Dealing with habit disruptions while traveling',
        'Micro-habits that compound over months'
      ],
      cognition: [
        'Focus techniques for attention-deficit lifestyles',
        'Memory consolidation during downtime',
        'Decision fatigue and cognitive load management',
        'Deep work in an interruption-heavy world',
        'Stress response and cognitive performance',
        'Learning retention through spaced repetition',
        'Mental models for better decision making',
        'Cognitive recovery after intense mental work'
      ]
    };

    const topics = topicBank[pillar] || topicBank.sleep;
    const baseTopic = topics[Math.floor(Math.random() * topics.length)];

    // Modify topic based on angle
    switch (angle) {
      case 'mistakes_with_fix':
        return `Common mistakes in ${baseTopic.toLowerCase()}`;
      case 'contrarian_take':
        return `Why conventional wisdom about ${baseTopic.toLowerCase()} is wrong`;
      case 'study_breakdown':
        return `New research reveals the truth about ${baseTopic.toLowerCase()}`;
      case 'quick_wins':
        return `5-minute wins for ${baseTopic.toLowerCase()}`;
      default:
        return baseTopic;
    }
  }

  private getFallbackSelection(): ContentSelection {
    return {
      pillar: 'sleep',
      angle: 'checklist',
      spice_level: 2,
      topic: 'Sleep optimization for busy professionals',
      evidence_mode: 'mechanism',
      reasoning: 'Fallback selection - system error'
    };
  }

  /**
   * Store selection outcome for learning
   */
  async recordSelectionOutcome(
    selection: ContentSelection,
    threadData: any,
    engagementBucket: string,
    followThroughRate: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('content_selections')
        .insert({
          pillar: selection.pillar,
          angle: selection.angle,
          spice_level: selection.spice_level,
          evidence_mode: selection.evidence_mode,
          quality_score: threadData.qualityScore,
          engagement_bucket: engagementBucket,
          follow_through_rate: followThroughRate,
          root_tweet_id: threadData.rootId,
          selection_reasoning: selection.reasoning,
          posted_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to record selection outcome:', error);
      } else {
        console.log(`✅ Recorded selection outcome: ${selection.pillar}/${selection.angle} → ${engagementBucket}`);
      }
    } catch (error) {
      console.error('Error recording selection outcome:', error);
    }
  }
}
