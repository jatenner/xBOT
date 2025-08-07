/**
 * 🎯 AUTONOMOUS CONTENT ORCHESTRATOR FOR @SignalAndSynapse
 * Master agent that coordinates enhanced content generation, thread posting, and learning loop
 */

import { enhancedContentGenerator, GeneratedPost } from './enhancedContentGenerator';
import { threadPostingAgent, ThreadPostResult } from './threadPostingAgent';
import { engagementLearningAgent, LearningInsights } from './engagementLearningAgent';
import { supabaseClient } from '../utils/supabaseClient';
import { ProductionEnvValidator } from '../utils/productionEnvValidator';

export interface PostingSession {
  id: string;
  session_start: string;
  posts_planned: number;
  posts_completed: number;
  total_engagement: number;
  avg_performance_score: number;
  insights_applied: string[];
  status: 'active' | 'completed' | 'paused';
}

export interface ContentPlan {
  optimal_format: 'short_tweet' | 'medium_thread' | 'full_thread';
  recommended_topic: string;
  best_posting_time: Date;
  expected_engagement: number;
  reasoning: string[];
}

export class AutonomousContentOrchestrator {
  private currentSession: PostingSession | null = null;
  private learningInsights: LearningInsights | null = null;
  private isActive = false;

  constructor() {
    this.loadLearningInsights();
  }

  /**
   * 🚀 MAIN ORCHESTRATION FUNCTION
   */
  async generateAndPost(topic?: string, forceFormat?: 'short_tweet' | 'medium_thread' | 'full_thread'): Promise<{
    success: boolean;
    generatedPost?: GeneratedPost;
    postResult?: ThreadPostResult;
    error?: string;
    contentPlan?: ContentPlan;
  }> {
    try {
      // 🚨 EMERGENCY DISABLED: This orchestrator was bypassing quality gates
      console.log('🚫 EMERGENCY: Autonomous Content Orchestrator completely disabled');
      console.log('⚠️ This system was orchestrating low-quality content generation');
      
      return {
        success: false,
        error: 'EMERGENCY: Content orchestration disabled for quality issues'
      };
    } catch (error) {
      console.error('❌ Autonomous content orchestration failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 📋 CREATE INTELLIGENT CONTENT PLAN
   */
  private async createContentPlan(topic?: string, forceFormat?: string): Promise<ContentPlan> {
    try {
      console.log('📋 Creating intelligent content plan based on learning insights...');

      // Get current learning insights
      await this.loadLearningInsights();

      // Determine optimal format
      let optimalFormat: 'short_tweet' | 'medium_thread' | 'full_thread';
      let reasoning: string[] = [];

      if (forceFormat) {
        optimalFormat = forceFormat as any;
        reasoning.push(`Format forced to: ${forceFormat}`);
      } else {
        // Use learning insights to determine optimal format
        optimalFormat = this.selectOptimalFormat();
        reasoning.push(`Selected ${optimalFormat} based on performance data`);
      }

      // Determine recommended topic
      const recommendedTopic = topic || this.selectOptimalTopic();
      reasoning.push(`Topic: ${recommendedTopic}`);

      // Determine best posting time
      const bestPostingTime = this.selectOptimalPostingTime();
      reasoning.push(`Optimal timing: ${bestPostingTime.toLocaleTimeString()}`);

      // Calculate expected engagement
      const expectedEngagement = this.calculateExpectedEngagement(optimalFormat, recommendedTopic);
      reasoning.push(`Expected engagement: ${(expectedEngagement || 0).toFixed(2)}%`);

      return {
        optimal_format: optimalFormat,
        recommended_topic: recommendedTopic,
        best_posting_time: bestPostingTime,
        expected_engagement: expectedEngagement,
        reasoning
      };

    } catch (error) {
      console.error('❌ Failed to create content plan:', error);
      
      // Return fallback plan
      return {
        optimal_format: 'short_tweet',
        recommended_topic: topic || 'AI and health research',
        best_posting_time: new Date(),
        expected_engagement: 2.5,
        reasoning: ['Fallback plan due to planning error']
      };
    }
  }

  /**
   * 🎯 SELECT OPTIMAL FORMAT BASED ON LEARNING DATA
   */
  private selectOptimalFormat(): 'short_tweet' | 'medium_thread' | 'full_thread' {
    try {
      if (!this.learningInsights?.top_performing_formats.length) {
        return 'short_tweet'; // Default fallback
      }

      // Get current context
      const now = new Date();
      const hourOfDay = now.getHours();
      const dayOfWeek = now.getDay();

      // Apply learned performance data
      const formatPerformance = this.learningInsights.top_performing_formats;
      let bestFormat = formatPerformance[0].format as 'short_tweet' | 'medium_thread' | 'full_thread';

      // Apply time-based modifiers from learning
      const optimalTimes = this.learningInsights.optimal_posting_times;
      const currentTimeSlot = optimalTimes.find(slot => 
        slot.hour === hourOfDay && 
        slot.day === now.toLocaleDateString('en-US', { weekday: 'long' })
      );

      if (currentTimeSlot) {
        // If this is an optimal time slot, use the best performing format
        bestFormat = formatPerformance[0].format as any;
      } else {
        // Off-peak hours - prefer shorter content
        if (hourOfDay < 9 || hourOfDay > 22) {
          bestFormat = 'short_tweet';
        }
      }

      console.log(`🎯 Selected format: ${bestFormat} (learned from ${formatPerformance.length} data points)`);
      return bestFormat;

    } catch (error) {
      console.error('❌ Format selection failed:', error);
      return 'short_tweet';
    }
  }

  /**
   * 📚 SELECT OPTIMAL TOPIC BASED ON TRENDING PERFORMANCE
   */
  private selectOptimalTopic(): string {
    try {
      if (!this.learningInsights?.trending_topics.length) {
        return 'AI and health research breakthrough';
      }

      const trendingTopics = this.learningInsights.trending_topics;
      const bestTopic = trendingTopics[0];

      // Create specific topic based on category
      const topicTemplates = {
        'ai_breakthrough': [
          'Latest AI breakthrough in healthcare',
          'AI-powered medical discovery',
          'Machine learning revolutionizing medicine'
        ],
        'longevity': [
          'New longevity research findings',
          'Anti-aging breakthrough study',
          'Lifespan extension breakthrough'
        ],
        'neuroscience': [
          'Brain research breakthrough',
          'Neuroscience discovery',
          'Cognitive enhancement research'
        ],
        'mental_health': [
          'Mental health research update',
          'Psychological wellbeing study',
          'Mental fitness breakthrough'
        ],
        'biotech': [
          'Biotechnology advancement',
          'Genetic engineering breakthrough',
          'Biomedical innovation'
        ],
        'health_science': [
          'Health science discovery',
          'Medical research finding',
          'Healthcare innovation'
        ]
      };

      const templates = topicTemplates[bestTopic.topic as keyof typeof topicTemplates] || topicTemplates.health_science;
      const selectedTopic = templates[Math.floor(Math.random() * templates.length)];

      console.log(`📚 Selected topic: ${selectedTopic} (trending performance: ${bestTopic.recent_performance.toFixed(2)}%)`);
      return selectedTopic;

    } catch (error) {
      console.error('❌ Topic selection failed:', error);
      return 'AI and health research breakthrough';
    }
  }

  /**
   * ⏰ SELECT OPTIMAL POSTING TIME
   */
  private selectOptimalPostingTime(): Date {
    try {
      const now = new Date();

      if (!this.learningInsights?.optimal_posting_times.length) {
        return now; // Post now if no learning data
      }

      const optimalTimes = this.learningInsights.optimal_posting_times;
      const today = now.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Find optimal times for today
      const todayOptimalTimes = optimalTimes.filter(slot => slot.day === today);
      
      if (todayOptimalTimes.length > 0) {
        // Find next optimal time slot
        const currentHour = now.getHours();
        const nextOptimalTime = todayOptimalTimes.find(slot => slot.hour > currentHour);
        
        if (nextOptimalTime) {
          const optimalDate = new Date(now);
          optimalDate.setHours(nextOptimalTime.hour, 0, 0, 0);
          return optimalDate;
        }
      }

      // Fallback to immediate posting
      return now;

    } catch (error) {
      console.error('❌ Optimal timing selection failed:', error);
      return new Date();
    }
  }

  /**
   * 📊 CALCULATE EXPECTED ENGAGEMENT
   */
  private calculateExpectedEngagement(format: string, topic: string): number {
    try {
      let baseEngagement = 2.5; // Base 2.5% engagement

      // Format modifier
      if (this.learningInsights?.top_performing_formats.length) {
        const formatData = this.learningInsights.top_performing_formats.find(f => f.format === format);
        if (formatData) {
          baseEngagement = Math.max(baseEngagement, formatData.avg_engagement);
        }
      }

      // Topic modifier
      if (this.learningInsights?.trending_topics.length) {
        const topicKeywords = topic.toLowerCase().split(' ');
        const relevantTopic = this.learningInsights.trending_topics.find(t => 
          topicKeywords.some(keyword => t.topic.toLowerCase().includes(keyword))
        );
        
        if (relevantTopic && relevantTopic.recent_performance > baseEngagement) {
          baseEngagement = relevantTopic.recent_performance;
        }
      }

      // Time modifier
      const now = new Date();
      const hourOfDay = now.getHours();
      
      if (this.learningInsights?.optimal_posting_times.length) {
        const currentTimeSlot = this.learningInsights.optimal_posting_times.find(slot => 
          slot.hour === hourOfDay
        );
        
        if (currentTimeSlot) {
          baseEngagement = Math.max(baseEngagement, currentTimeSlot.avg_engagement);
        }
      }

      return Math.min(baseEngagement, 10.0); // Cap at 10%

    } catch (error) {
      console.error('❌ Engagement calculation failed:', error);
      return 2.5;
    }
  }

  /**
   * 📊 SESSION MANAGEMENT
   */
  async startNewSession(): Promise<PostingSession> {
    try {
      // Create in-memory session (database operations simplified for production reliability)
      this.currentSession = {
        id: `session_${Date.now()}`,
        session_start: new Date().toISOString(),
        posts_planned: 5, // Plan for 5 posts per session
        posts_completed: 0,
        total_engagement: 0,
        avg_performance_score: 0,
        insights_applied: this.getAppliedInsights(),
        status: 'active'
      };
      
      console.log(`📊 Started new posting session: ${this.currentSession.id}`);
      
      return this.currentSession;

    } catch (error) {
      console.error('❌ Failed to start new session:', error);
      
      // Create fallback session
      this.currentSession = {
        id: `fallback_${Date.now()}`,
        session_start: new Date().toISOString(),
        posts_planned: 5,
        posts_completed: 0,
        total_engagement: 0,
        avg_performance_score: 0,
        insights_applied: [],
        status: 'active'
      };
      
      return this.currentSession;
    }
  }

  private async updateCurrentSession(generatedPost: GeneratedPost, postResult: ThreadPostResult): Promise<void> {
    try {
      if (!this.currentSession) {
        await this.startNewSession();
      }

      // Update session metrics
      this.currentSession!.posts_completed++;
      this.currentSession!.total_engagement += generatedPost.metadata.estimated_engagement;
      this.currentSession!.avg_performance_score = this.currentSession!.total_engagement / this.currentSession!.posts_completed;

      console.log(`📊 Session updated: ${this.currentSession!.posts_completed}/${this.currentSession!.posts_planned} posts completed`);

    } catch (error) {
      console.error('❌ Failed to update session:', error);
    }
  }

  /**
   * 🧠 LEARNING INSIGHTS MANAGEMENT
   */
  private async loadLearningInsights(): Promise<void> {
    try {
      this.learningInsights = await engagementLearningAgent.getCurrentLearningInsights();
      
      if (this.learningInsights) {
        console.log('🧠 Loaded learning insights for content optimization');
      } else {
        console.log('📚 No learning insights available yet - using defaults');
      }

    } catch (error) {
      console.error('❌ Failed to load learning insights:', error);
      this.learningInsights = null;
    }
  }

  private getAppliedInsights(): string[] {
    if (!this.learningInsights) return [];

    const insights: string[] = [];

    if (this.learningInsights.top_performing_formats.length > 0) {
      insights.push(`Using top format: ${this.learningInsights.top_performing_formats[0].format}`);
    }

    if (this.learningInsights.optimal_posting_times.length > 0) {
      insights.push(`Optimized timing based on ${this.learningInsights.optimal_posting_times.length} data points`);
    }

    if (this.learningInsights.best_content_styles.length > 0) {
      insights.push(`Using best style: ${this.learningInsights.best_content_styles[0].style}`);
    }

    return insights;
  }

  /**
   * 📊 GET ORCHESTRATION ANALYTICS
   */
  async getOrchestrationAnalytics(days: number = 7): Promise<{
    sessions_completed: number;
    total_posts: number;
    avg_engagement_rate: number;
    learning_improvements: number;
    top_performing_strategies: string[];
  }> {
    try {
      // Return analytics based on current session (simplified for production reliability)
      const currentSessionData = this.currentSession ? [this.currentSession] : [];
      
      return {
        sessions_completed: currentSessionData.filter(s => s.status === 'completed').length,
        total_posts: currentSessionData.reduce((sum, s) => sum + s.posts_completed, 0),
        avg_engagement_rate: currentSessionData.length > 0 ? 
          currentSessionData.reduce((sum, s) => sum + s.avg_performance_score, 0) / currentSessionData.length : 0,
        learning_improvements: this.calculateLearningImprovements(currentSessionData),
        top_performing_strategies: this.extractTopStrategies(currentSessionData)
      };

    } catch (error) {
      console.error('❌ Failed to get orchestration analytics:', error);
      return {
        sessions_completed: 0,
        total_posts: 0,
        avg_engagement_rate: 0,
        learning_improvements: 0,
        top_performing_strategies: []
      };
    }
  }

  private calculateLearningImprovements(sessions: PostingSession[]): number {
    if (sessions.length < 2) return 0;
    
    const firstSession = sessions[sessions.length - 1];
    const lastSession = sessions[0];
    
    const improvement = ((lastSession.avg_performance_score - firstSession.avg_performance_score) / firstSession.avg_performance_score) * 100;
    return Math.max(0, improvement);
  }

  private extractTopStrategies(sessions: PostingSession[]): string[] {
    const strategies = new Set<string>();
    
    sessions.forEach(session => {
      session.insights_applied.forEach(insight => strategies.add(insight));
    });

    return Array.from(strategies).slice(0, 5);
  }

  /**
   * 🎯 AUTO-POSTING SCHEDULER
   */
  async scheduleAutonomousPosting(intervalHours: number = 6): Promise<void> {
    try {
      console.log(`⏰ Scheduling autonomous posting every ${intervalHours} hours`);
      
      setInterval(async () => {
        if (!this.isActive) return;
        
        try {
          console.log('🤖 Autonomous posting triggered...');
          await this.generateAndPost();
        } catch (error) {
          console.error('❌ Autonomous posting failed:', error);
        }
      }, intervalHours * 60 * 60 * 1000);

      this.isActive = true;
      console.log('✅ Autonomous posting scheduler activated');

    } catch (error) {
      console.error('❌ Failed to schedule autonomous posting:', error);
    }
  }

  /**
   * 🛑 CONTROL METHODS
   */
  pauseAutonomousPosting(): void {
    this.isActive = false;
    console.log('⏸️ Autonomous posting paused');
  }

  resumeAutonomousPosting(): void {
    this.isActive = true;
    console.log('▶️ Autonomous posting resumed');
  }

  isAutonomousPostingActive(): boolean {
    return this.isActive;
  }
}

// Export singleton instance
export const autonomousContentOrchestrator = new AutonomousContentOrchestrator();