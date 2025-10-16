/**
 * Meta-Learning System
 * 
 * Tracks patterns BEYOND just "type performed well":
 * - Topic clusters (which topics work together)
 * - Voice elements (what writing style resonates)
 * - Engagement triggers (what makes people reply)
 * - Viral mechanics (what gets shared)
 * - Time optimization (when to post what)
 */

import { getSupabaseClient } from '../db';

export interface TopicPerformance {
  topic: string;
  posts_count: number;
  avg_followers_gained: number;
  avg_engagement: number;
  success_rate: number;
  best_paired_with: string[]; // Topics that work well together
}

export interface VoiceElement {
  element: string;
  description: string;
  presence_count: number;
  avg_performance: number;
  examples: string[];
}

export interface EngagementTrigger {
  trigger_type: string;
  description: string;
  reply_rate: number;
  examples: string[];
}

export interface ViralMechanic {
  mechanic: string;
  retweet_rate: number;
  share_coefficient: number;
  examples: string[];
}

export interface MetaInsights {
  top_topics: TopicPerformance[];
  effective_voice_elements: VoiceElement[];
  engagement_triggers: EngagementTrigger[];
  viral_mechanics: ViralMechanic[];
  time_patterns: { hour: number; avg_performance: number }[];
}

export class MetaLearning {
  private static instance: MetaLearning;
  
  // In-memory tracking (will be persisted to DB)
  private topicPerformance: Map<string, TopicPerformance> = new Map();
  private voiceElements: VoiceElement[] = [];
  private engagementTriggers: EngagementTrigger[] = [];
  private viralMechanics: ViralMechanic[] = [];
  
  private constructor() {
    this.initializeDefaults();
  }
  
  public static getInstance(): MetaLearning {
    if (!MetaLearning.instance) {
      MetaLearning.instance = new MetaLearning();
    }
    return MetaLearning.instance;
  }
  
  /**
   * Learn from a post's performance
   */
  public async learnFromPost(data: {
    content: string;
    topic: string;
    followers_gained: number;
    engagement_rate: number;
    reply_count: number;
    retweet_count: number;
    posted_hour: number;
  }): Promise<void> {
    
    console.log(`[META_LEARNING] 📊 Learning from post: ${data.topic}`);
    
    // Update topic performance
    await this.updateTopicPerformance(data);
    
    // Analyze voice elements
    await this.analyzeVoiceElements(data.content, data.engagement_rate);
    
    // Detect engagement triggers
    if (data.reply_count > 3) {
      await this.detectEngagementTriggers(data.content, data.reply_count);
    }
    
    // Detect viral mechanics
    if (data.retweet_count > 5) {
      await this.detectViralMechanics(data.content, data.retweet_count);
    }
    
    console.log('[META_LEARNING] ✅ Meta patterns updated');
  }
  
  /**
   * Get insights for content generation
   */
  public async getMetaInsights(): Promise<MetaInsights> {
    const topTopics = Array.from(this.topicPerformance.values())
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained)
      .slice(0, 5);
    
    const effectiveVoice = this.voiceElements
      .sort((a, b) => b.avg_performance - a.avg_performance)
      .slice(0, 5);
    
    return {
      top_topics: topTopics,
      effective_voice_elements: effectiveVoice,
      engagement_triggers: this.engagementTriggers,
      viral_mechanics: this.viralMechanics,
      time_patterns: [] // Will be populated as data accumulates
    };
  }
  
  /**
   * Get recommended topic based on meta-learning
   */
  public async getRecommendedTopic(): Promise<string> {
    if (this.topicPerformance.size === 0) {
      return 'health_optimization'; // Default
    }
    
    const topTopics = Array.from(this.topicPerformance.values())
      .filter(t => t.success_rate > 0.3)
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained);
    
    if (topTopics.length === 0) {
      return 'health_optimization';
    }
    
    // 70% exploit best, 30% explore others
    if (Math.random() < 0.7) {
      return topTopics[0].topic;
    } else {
      const randomIndex = Math.floor(Math.random() * Math.min(3, topTopics.length));
      return topTopics[randomIndex].topic;
    }
  }
  
  private async updateTopicPerformance(data: {
    topic: string;
    followers_gained: number;
    engagement_rate: number;
  }): Promise<void> {
    
    const existing = this.topicPerformance.get(data.topic);
    
    if (existing) {
      // Update running averages
      const weight = 0.3;
      existing.posts_count += 1;
      existing.avg_followers_gained = 
        existing.avg_followers_gained * (1 - weight) + data.followers_gained * weight;
      existing.avg_engagement = 
        existing.avg_engagement * (1 - weight) + data.engagement_rate * weight;
      existing.success_rate = 
        existing.success_rate * (1 - weight) + (data.followers_gained > 5 ? 1 : 0) * weight;
    } else {
      // Create new entry
      this.topicPerformance.set(data.topic, {
        topic: data.topic,
        posts_count: 1,
        avg_followers_gained: data.followers_gained,
        avg_engagement: data.engagement_rate,
        success_rate: data.followers_gained > 5 ? 1 : 0,
        best_paired_with: []
      });
    }
  }
  
  private async analyzeVoiceElements(content: string, performance: number): Promise<void> {
    // Detect voice elements in content
    const elements = [
      { name: 'uses_statistics', pattern: /\d+%|\d+x|\d+ (people|studies)/ },
      { name: 'asks_questions', pattern: /\?/ },
      { name: 'uses_contrarian', pattern: /actually|wrong|myth|contrary/ },
      { name: 'tells_story', pattern: /I |my |story|experience/ },
      { name: 'uses_authority', pattern: /research|study|science|data/ },
      { name: 'conversational', pattern: /you |your |we / }
    ];
    
    for (const element of elements) {
      if (element.pattern.test(content)) {
        const existing = this.voiceElements.find(v => v.element === element.name);
        
        if (existing) {
          const weight = 0.3;
          existing.presence_count += 1;
          existing.avg_performance = 
            existing.avg_performance * (1 - weight) + performance * weight;
        } else {
          this.voiceElements.push({
            element: element.name,
            description: element.name.replace(/_/g, ' '),
            presence_count: 1,
            avg_performance: performance,
            examples: [content.substring(0, 100)]
          });
        }
      }
    }
  }
  
  private async detectEngagementTriggers(content: string, replies: number): Promise<void> {
    // Detect what triggered replies
    const triggers = [
      { type: 'asks_question', pattern: /\?$/, rate: replies / 10 },
      { type: 'controversial_claim', pattern: /wrong|myth|actually/, rate: replies / 10 },
      { type: 'personal_story', pattern: /I |my /, rate: replies / 10 },
      { type: 'calls_for_action', pattern: /try|test|do/, rate: replies / 10 }
    ];
    
    for (const trigger of triggers) {
      if (trigger.pattern.test(content)) {
        const existing = this.engagementTriggers.find(t => t.trigger_type === trigger.type);
        
        if (existing) {
          const weight = 0.3;
          existing.reply_rate = existing.reply_rate * (1 - weight) + trigger.rate * weight;
        } else {
          this.engagementTriggers.push({
            trigger_type: trigger.type,
            description: trigger.type.replace(/_/g, ' '),
            reply_rate: trigger.rate,
            examples: [content.substring(0, 100)]
          });
        }
      }
    }
  }
  
  private async detectViralMechanics(content: string, retweets: number): Promise<void> {
    // Detect what made content viral
    const mechanics = [
      { mechanic: 'surprising_stat', pattern: /\d+%/, coefficient: retweets / 10 },
      { mechanic: 'controversy', pattern: /wrong|myth/, coefficient: retweets / 10 },
      { mechanic: 'thread_format', pattern: /🧵|thread/, coefficient: retweets / 10 },
      { mechanic: 'actionable_value', pattern: /how to|here\'s/, coefficient: retweets / 10 }
    ];
    
    for (const mech of mechanics) {
      if (mech.pattern.test(content)) {
        const existing = this.viralMechanics.find(v => v.mechanic === mech.mechanic);
        
        if (existing) {
          const weight = 0.3;
          existing.share_coefficient = 
            existing.share_coefficient * (1 - weight) + mech.coefficient * weight;
        } else {
          this.viralMechanics.push({
            mechanic: mech.mechanic,
            retweet_rate: retweets,
            share_coefficient: mech.coefficient,
            examples: [content.substring(0, 100)]
          });
        }
      }
    }
  }
  
  private initializeDefaults(): void {
    // Start with some default voice elements
    this.voiceElements = [
      {
        element: 'uses_statistics',
        description: 'Includes specific numbers and statistics',
        presence_count: 0,
        avg_performance: 0.5,
        examples: []
      },
      {
        element: 'uses_authority',
        description: 'References research, studies, or data',
        presence_count: 0,
        avg_performance: 0.5,
        examples: []
      },
      {
        element: 'conversational',
        description: 'Uses "you", "your", "we" - conversational tone',
        presence_count: 0,
        avg_performance: 0.5,
        examples: []
      }
    ];
    
    // Default engagement triggers
    this.engagementTriggers = [
      {
        trigger_type: 'asks_question',
        description: 'Ends with question',
        reply_rate: 0.5,
        examples: []
      },
      {
        trigger_type: 'controversial_claim',
        description: 'Makes contrarian or controversial claim',
        reply_rate: 0.7,
        examples: []
      }
    ];
    
    // Default viral mechanics
    this.viralMechanics = [
      {
        mechanic: 'surprising_stat',
        retweet_rate: 0.6,
        share_coefficient: 0.5,
        examples: []
      },
      {
        mechanic: 'actionable_value',
        retweet_rate: 0.7,
        share_coefficient: 0.6,
        examples: []
      }
    ];
  }
}

export const getMetaLearning = () => MetaLearning.getInstance();

