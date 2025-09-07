/**
 * 🎨 DIVERSE CONTENT GENERATOR
 * 
 * Creates varied, engaging content types that feel natural and human
 * - Stories, insights, observations, experiments, discoveries
 * - Data-driven content type selection
 * - Natural conversation flow without patterns
 * - Zero hashtags, maximum authenticity
 */

import { HumanVoiceEngine } from './humanVoiceEngine';
import { admin as supabase } from '../lib/supabaseClients';

interface ContentType {
  name: string;
  description: string;
  example_openers: string[];
  engagement_multiplier: number;
  frequency_weight: number;
  optimal_length: { min: number; max: number };
  best_times: number[]; // hours of day
}

interface TopicSource {
  category: string;
  source_type: 'trending' | 'research' | 'observation' | 'experiment' | 'discovery';
  topics: string[];
  freshness_hours: number;
}

interface DiverseContentResult {
  content: string;
  content_type: string;
  topic_source: string;
  human_voice_score: number;
  diversity_score: number;
  predicted_performance: {
    engagement_rate: number;
    follower_potential: number;
    viral_score: number;
  };
}

export class DiverseContentGenerator {
  private static instance: DiverseContentGenerator;
  private humanVoice: HumanVoiceEngine;
  private contentTypes: ContentType[] = [];
  private topicSources: TopicSource[] = [];
  private recentContentTypes: string[] = [];

  private constructor() {
    this.humanVoice = HumanVoiceEngine.getInstance();
    this.initializeContentTypes();
    this.initializeTopicSources();
  }

  public static getInstance(): DiverseContentGenerator {
    if (!DiverseContentGenerator.instance) {
      DiverseContentGenerator.instance = new DiverseContentGenerator();
    }
    return DiverseContentGenerator.instance;
  }

  /**
   * 🎨 Initialize diverse content types
   */
  private initializeContentTypes(): void {
    this.contentTypes = [
      {
        name: 'personal_discovery',
        description: 'Sharing a personal "aha moment" or discovery',
        example_openers: [
          'Just figured out why',
          'Finally understood',
          'Had this realization about',
          'Something clicked about',
          'Been wondering why'
        ],
        engagement_multiplier: 1.4,
        frequency_weight: 0.20,
        optimal_length: { min: 140, max: 200 },
        best_times: [8, 12, 17, 20]
      },
      {
        name: 'counterintuitive_insight',
        description: 'Sharing something that goes against common knowledge',
        example_openers: [
          'Turns out the opposite is true',
          'Everything I thought about X was wrong',
          'This completely flipped my understanding',
          'Nobody talks about how',
          'The real reason for'
        ],
        engagement_multiplier: 1.6,
        frequency_weight: 0.15,
        optimal_length: { min: 160, max: 220 },
        best_times: [9, 13, 18, 21]
      },
      {
        name: 'practical_experiment',
        description: 'Results from actually trying something',
        example_openers: [
          'Tried this for 30 days',
          'Been testing',
          'Experiment update:',
          'Results from doing',
          'What happened when I'
        ],
        engagement_multiplier: 1.5,
        frequency_weight: 0.18,
        optimal_length: { min: 150, max: 240 },
        best_times: [7, 11, 16, 19]
      },
      {
        name: 'curious_observation',
        description: 'Noticing patterns or asking genuine questions',
        example_openers: [
          'Noticed something weird about',
          'Anyone else notice that',
          'Been thinking about why',
          'Curious if others experience',
          'Strange pattern I keep seeing'
        ],
        engagement_multiplier: 1.2,
        frequency_weight: 0.15,
        optimal_length: { min: 120, max: 180 },
        best_times: [10, 14, 17, 22]
      },
      {
        name: 'myth_busting',
        description: 'Correcting common misconceptions with evidence',
        example_openers: [
          'That thing everyone believes about X',
          'Common myth:',
          'People keep saying X but',
          'Misconception I see everywhere:',
          'This widespread belief is wrong'
        ],
        engagement_multiplier: 1.7,
        frequency_weight: 0.12,
        optimal_length: { min: 170, max: 240 },
        best_times: [9, 15, 19, 21]
      },
      {
        name: 'story_insight',
        description: 'Short story that illustrates a deeper point',
        example_openers: [
          'Conversation with my doctor yesterday',
          'Friend told me something interesting',
          'Overheard this at the gym',
          'My experience with',
          'What I learned from'
        ],
        engagement_multiplier: 1.3,
        frequency_weight: 0.20,
        optimal_length: { min: 180, max: 250 },
        best_times: [8, 12, 18, 20]
      }
    ];
  }

  /**
   * 📚 Initialize topic sources
   */
  private initializeTopicSources(): void {
    this.topicSources = [
      {
        category: 'health_optimization',
        source_type: 'experiment',
        topics: [
          'sleep tracking accuracy', 'intermittent fasting variations', 'cold exposure protocols',
          'breathing techniques', 'supplement timing', 'exercise recovery methods',
          'stress management tools', 'circadian rhythm hacks', 'hydration strategies'
        ],
        freshness_hours: 24
      },
      {
        category: 'nutrition_science',
        source_type: 'research',
        topics: [
          'micronutrient absorption', 'gut microbiome patterns', 'meal timing effects',
          'food combination myths', 'metabolism misconceptions', 'inflammation triggers',
          'antioxidant effectiveness', 'protein synthesis timing', 'sugar alternatives'
        ],
        freshness_hours: 48
      },
      {
        category: 'mental_performance',
        source_type: 'discovery',
        topics: [
          'focus techniques', 'memory enhancement', 'cognitive load management',
          'decision fatigue prevention', 'creativity boosters', 'attention restoration',
          'flow state triggers', 'productivity myths', 'mental energy management'
        ],
        freshness_hours: 36
      },
      {
        category: 'body_science',
        source_type: 'observation',
        topics: [
          'posture effects', 'movement patterns', 'muscle recovery', 'joint health',
          'balance training', 'coordination improvements', 'flexibility myths',
          'strength training variables', 'mobility restrictions', 'pain patterns'
        ],
        freshness_hours: 72
      },
      {
        category: 'lifestyle_factors',
        source_type: 'trending',
        topics: [
          'technology health impacts', 'environmental toxins', 'light exposure effects',
          'social connection benefits', 'nature interaction', 'seasonal adjustments',
          'travel health hacks', 'workspace ergonomics', 'digital wellness'
        ],
        freshness_hours: 12
      }
    ];
  }

  /**
   * 🎯 Generate diverse content with optimal type selection
   */
  public async generateDiverseContent(params: {
    format: 'single' | 'thread';
    avoid_recent_patterns?: boolean;
    target_engagement?: 'high' | 'medium' | 'steady';
  }): Promise<DiverseContentResult> {
    console.log(`🎨 DIVERSE_CONTENT: Generating ${params.format} with ${params.target_engagement || 'medium'} engagement target`);

    // Select optimal content type based on performance and diversity
    const contentType = await this.selectOptimalContentType(params);
    
    // Select fresh topic from appropriate source
    const { topic, source } = await this.selectFreshTopic(contentType);
    
    // Generate human voice content
    const humanResult = await this.humanVoice.generateHumanContent({
      topic,
      format: params.format,
      context: `${contentType.description}. Use style: ${contentType.example_openers[Math.floor(Math.random() * contentType.example_openers.length)]}`,
      targetLength: contentType.optimal_length.max
    });

    // Calculate diversity score
    const diversityScore = this.calculateDiversityScore(contentType.name);
    
    // Predict performance
    const predictedPerformance = this.predictContentPerformance(humanResult, contentType);

    // Update tracking
    this.updateRecentContentTypes(contentType.name);

    const result: DiverseContentResult = {
      content: humanResult.content,
      content_type: contentType.name,
      topic_source: source.category,
      human_voice_score: humanResult.authenticity_score,
      diversity_score: diversityScore,
      predicted_performance: predictedPerformance
    };

    console.log(`✅ DIVERSE_CONTENT: Generated ${contentType.name} about ${topic}`);
    console.log(`🎯 Human Voice: ${humanResult.authenticity_score}% | Diversity: ${diversityScore}% | Predicted Engagement: ${predictedPerformance.engagement_rate}`);

    return result;
  }

  /**
   * 🎲 Select optimal content type for maximum diversity and engagement
   */
  private async selectOptimalContentType(params: any): Promise<ContentType> {
    const currentHour = new Date().getHours();
    
    // Load recent performance data
    await this.loadContentTypePerformance();
    
    // Filter out recently used types if diversity is requested
    let availableTypes = this.contentTypes;
    if (params.avoid_recent_patterns) {
      availableTypes = this.contentTypes.filter(type => 
        !this.recentContentTypes.slice(-3).includes(type.name)
      );
    }

    // Score each type based on multiple factors
    const scoredTypes = availableTypes.map(type => {
      let score = type.frequency_weight * 100;
      
      // Time optimization bonus
      if (type.best_times.includes(currentHour)) {
        score += 20;
      }
      
      // Engagement target bonus
      if (params.target_engagement === 'high' && type.engagement_multiplier > 1.4) {
        score += 25;
      } else if (params.target_engagement === 'steady' && type.engagement_multiplier >= 1.2 && type.engagement_multiplier <= 1.4) {
        score += 15;
      }
      
      // Diversity bonus (favor less recently used)
      const recentUsage = this.recentContentTypes.filter(used => used === type.name).length;
      score -= recentUsage * 10;
      
      return { type, score };
    });

    // Select based on weighted probability
    const totalScore = scoredTypes.reduce((sum, item) => sum + item.score, 0);
    let randomValue = Math.random() * totalScore;
    
    for (const item of scoredTypes) {
      randomValue -= item.score;
      if (randomValue <= 0) {
        return item.type;
      }
    }

    return scoredTypes[0]?.type || this.contentTypes[0];
  }

  /**
   * 📚 Select fresh topic from optimal source
   */
  private async selectFreshTopic(contentType: ContentType): Promise<{ topic: string; source: TopicSource }> {
    // Weight topic sources based on freshness and content type compatibility
    const compatibleSources = this.topicSources.filter(source => {
      // Different content types work better with different source types
      if (contentType.name === 'practical_experiment' && source.source_type === 'experiment') return true;
      if (contentType.name === 'myth_busting' && source.source_type === 'research') return true;
      if (contentType.name === 'curious_observation' && source.source_type === 'observation') return true;
      if (contentType.name === 'counterintuitive_insight' && source.source_type === 'discovery') return true;
      if (contentType.name === 'story_insight' && ['trending', 'observation'].includes(source.source_type)) return true;
      return true; // Allow all for personal_discovery
    });

    // Select random source and topic
    const selectedSource = compatibleSources[Math.floor(Math.random() * compatibleSources.length)] || this.topicSources[0];
    const selectedTopic = selectedSource.topics[Math.floor(Math.random() * selectedSource.topics.length)];

    return { topic: selectedTopic, source: selectedSource };
  }

  /**
   * 📊 Calculate diversity score based on recent content
   */
  private calculateDiversityScore(contentTypeName: string): number {
    const recentCount = this.recentContentTypes.slice(-10).filter(type => type === contentTypeName).length;
    const maxRecent = 10;
    
    // Higher score for more diverse selection
    const diversityScore = Math.max(0, 100 - (recentCount / maxRecent * 100));
    
    return Math.round(diversityScore);
  }

  /**
   * 🎯 Predict content performance
   */
  private predictContentPerformance(humanResult: any, contentType: ContentType): any {
    const baseEngagement = humanResult.predicted_engagement || 20;
    
    const adjustedEngagement = baseEngagement * contentType.engagement_multiplier;
    
    // Calculate follower potential based on content type and authenticity
    const followerPotential = (humanResult.authenticity_score / 100) * contentType.engagement_multiplier * 15;
    
    // Calculate viral score based on multiple factors
    const viralScore = Math.min(100, (adjustedEngagement * 0.6) + (humanResult.authenticity_score * 0.4));

    return {
      engagement_rate: Math.round(adjustedEngagement),
      follower_potential: Math.round(followerPotential),
      viral_score: Math.round(viralScore)
    };
  }

  /**
   * 📈 Update recent content type tracking
   */
  private updateRecentContentTypes(contentTypeName: string): void {
    this.recentContentTypes.push(contentTypeName);
    
    // Keep only last 15 for diversity tracking
    if (this.recentContentTypes.length > 15) {
      this.recentContentTypes = this.recentContentTypes.slice(-15);
    }
  }

  /**
   * 📊 Load content type performance data
   */
  private async loadContentTypePerformance(): Promise<void> {
    try {
      // Using imported supabase admin client
      
      const { data } = await supabase
        .from('content_type_performance')
        .select('content_type, avg_engagement_rate, avg_follower_conversion, usage_count')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('avg_engagement_rate', { ascending: false });

      if (data && data.length > 0) {
        // Update frequency weights based on performance
        data.forEach(performanceData => {
          const contentType = this.contentTypes.find(ct => ct.name === performanceData.content_type);
          if (contentType) {
            // Gradually adjust weights based on performance
            const performanceMultiplier = Math.max(0.5, Math.min(2.0, performanceData.avg_engagement_rate * 10));
            contentType.engagement_multiplier = (contentType.engagement_multiplier + performanceMultiplier) / 2;
            
            // Adjust frequency based on success
            const successScore = performanceData.avg_follower_conversion * 100;
            contentType.frequency_weight = Math.max(0.05, Math.min(0.4, 
              contentType.frequency_weight + (successScore * 0.01)
            ));
          }
        });
        
        console.log(`📊 DIVERSE_CONTENT: Updated ${data.length} content type performance weights`);
      }
    } catch (error) {
      console.warn('⚠️ DIVERSE_CONTENT: Failed to load performance data:', error);
    }
  }

  /**
   * 📝 Record content performance for learning
   */
  public async recordContentPerformance(
    contentType: string, 
    topicSource: string,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
      followers_gained: number;
    }
  ): Promise<void> {
    try {
      // Using imported supabase admin client
      
      const engagementRate = engagement.impressions > 0 
        ? (engagement.likes + engagement.retweets + engagement.replies) / engagement.impressions 
        : 0;

      const followerConversion = engagement.impressions > 0
        ? engagement.followers_gained / engagement.impressions
        : 0;

      await supabase.from('content_type_performance').insert({
        content_type: contentType,
        topic_source: topicSource,
        engagement_rate: engagementRate,
        follower_conversion: followerConversion,
        likes: engagement.likes,
        retweets: engagement.retweets,
        replies: engagement.replies,
        impressions: engagement.impressions,
        followers_gained: engagement.followers_gained,
        created_at: new Date().toISOString()
      });

      console.log(`📊 DIVERSE_CONTENT: Recorded performance for ${contentType} content type`);
    } catch (error) {
      console.warn('⚠️ DIVERSE_CONTENT: Failed to record performance:', error);
    }
  }

  /**
   * 🎯 Get content type recommendations based on time and recent performance
   */
  public getOptimalContentTypeForTime(hour: number): ContentType {
    const timeOptimizedTypes = this.contentTypes.filter(type => 
      type.best_times.includes(hour)
    ).sort((a, b) => b.engagement_multiplier - a.engagement_multiplier);

    return timeOptimizedTypes[0] || this.contentTypes[0];
  }

  /**
   * 📈 Get diversity stats
   */
  public getDiversityStats(): { 
    total_content_types: number; 
    recent_diversity_score: number; 
    most_used_type: string;
    least_used_type: string;
  } {
    const recentTypes = this.recentContentTypes.slice(-10);
    const typeCounts = new Map<string, number>();
    
    this.contentTypes.forEach(type => typeCounts.set(type.name, 0));
    recentTypes.forEach(type => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const sortedCounts = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
    const diversityScore = Math.round((new Set(recentTypes).size / this.contentTypes.length) * 100);

    return {
      total_content_types: this.contentTypes.length,
      recent_diversity_score: diversityScore,
      most_used_type: sortedCounts[0]?.[0] || 'none',
      least_used_type: sortedCounts[sortedCounts.length - 1]?.[0] || 'none'
    };
  }
}
