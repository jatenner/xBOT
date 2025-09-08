/**
 * Learning System Orchestrator for @SignalAndSynapse
 * Coordinates all learning components for intelligent content generation
 */

import AdvancedContentGenerator from '../ai/generate';
import ContentVetter from '../quality/vet';
import SelfLearningSystem from '../learn/learn';
import PeerScrapingSystem from '../intelligence/peer_scraper';
import AdaptiveContentPlanner from '../schedule/plan';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

export interface ContentRequest {
  urgency?: 'high' | 'medium' | 'low';
  format_preference?: 'short' | 'medium' | 'thread';
  topic_override?: string;
  dry_run?: boolean;
}

export interface GeneratedContent {
  id: string;
  text: string;
  format: string;
  topic: string;
  hook_type: string;
  scores: {
    novelty: number;
    hook_strength: number;
    clarity: number;
    overall: number;
  };
  reasoning: string;
  ready_to_post: boolean;
}

export class LearningSystemOrchestrator {
  private generator: AdvancedContentGenerator;
  private vetter: ContentVetter;
  private learner: SelfLearningSystem;
  private peerScraper: PeerScrapingSystem;
  private planner: AdaptiveContentPlanner;
  private supabase: any;
  private redis: Redis;

  constructor() {
    this.generator = new AdvancedContentGenerator();
    this.vetter = new ContentVetter();
    this.learner = new SelfLearningSystem();
    this.peerScraper = new PeerScrapingSystem();
    this.planner = new AdaptiveContentPlanner();
    
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Complete learning cycle: learn from data, plan content, generate, vet
   */
  async runCompleteLearningCycle(): Promise<void> {
    console.log('🚀 Starting complete learning cycle...\n');

    try {
      // Phase 1: Learning from data
      console.log('📊 Phase 1: Learning from performance data...');
      const insights = await this.learner.runLearningCycle();
      console.log(`✅ Learned from ${insights.top_performing_formats.length} top formats and ${insights.top_performing_topics.length} top topics\n`);

      // Phase 2: Peer intelligence gathering (run async, don't block)
      console.log('🕵️ Phase 2: Gathering peer intelligence...');
      this.peerScraper.runPeerScrapingCycle().catch(error => {
        console.error('Peer scraping failed:', error);
      });
      console.log('✅ Peer scraping initiated in background\n');

      // Phase 3: Adaptive planning
      console.log('📅 Phase 3: Generating adaptive content plan...');
      const weeklyPlan = await this.planner.generateWeeklyPlan(3); // 3 posts per day
      console.log(`✅ Generated ${weeklyPlan.length} content plans for the week\n`);

      // Phase 4: Generate content for immediate needs
      console.log('✨ Phase 4: Generating vetted content...');
      const readyContent = await this.generateVettedContent({
        urgency: 'medium'
      });
      
      if (readyContent) {
        console.log(`✅ Generated ready-to-post content: "${readyContent.text.substring(0, 100)}..."`);
        console.log(`📈 Quality scores: Novelty ${readyContent.scores.novelty.toFixed(2)}, Hook ${readyContent.scores.hook_strength.toFixed(2)}, Overall ${readyContent.scores.overall.toFixed(2)}\n`);
      } else {
        console.log('⚠️ No content passed quality thresholds\n');
      }

      console.log('🎉 Learning cycle completed successfully!');

    } catch (error) {
      console.error('❌ Learning cycle failed:', error);
      throw error;
    }
  }

  /**
   * Generate high-quality content using the full learning pipeline
   */
  async generateVettedContent(request: ContentRequest = {}): Promise<GeneratedContent | null> {
    try {
      // Get adaptive plan if no specific request
      const plan = request.format_preference || request.topic_override 
        ? null 
        : await this.planner.getNextPlannedContent();

      // Build generation request
      const generationRequest = {
        format: request.format_preference || plan?.format || 'short',
        topic: request.topic_override || plan?.topic,
        hook_type: plan?.hook_type,
        amplify_patterns: await this.getAmplifyPatterns(),
        avoid_patterns: await this.getAvoidPatterns()
      };

      console.log(`🎯 Generating ${generationRequest.format} content about ${generationRequest.topic || 'adaptive topic'}...`);

      // Generate candidates
      const candidates = await this.generator.generateCandidates(generationRequest);
      
      if (!candidates.length) {
        console.log('❌ No candidates generated');
        return null;
      }

      console.log(`📝 Generated ${candidates.length} candidates`);

      // Save candidates and get their IDs
      await this.generator.saveCandidates(candidates);
      
      // Get candidate IDs from database
      const { data: savedCandidates } = await this.supabase
        .from('content_candidates')
        .select('id, text, format, topic, hook_type')
        .eq('status', 'pending')
        .order('generated_at', { ascending: false })
        .limit(candidates.length);

      if (!savedCandidates?.length) {
        console.log('❌ Failed to save candidates');
        return null;
      }

      // Vet all candidates
      console.log('🔍 Vetting candidates...');
      let bestCandidate = null;
      let bestScore = 0;

      for (const candidate of savedCandidates) {
        try {
          const vettingResult = await this.vetter.vetCandidate(candidate.id);
          
          console.log(`📊 Candidate: ${vettingResult.scores.overall.toFixed(2)} overall (${vettingResult.approved ? 'APPROVED' : 'REJECTED'})`);
          
          if (vettingResult.approved && vettingResult.scores.overall > bestScore) {
            bestCandidate = {
              ...candidate,
              scores: vettingResult.scores,
              ready_to_post: true
            };
            bestScore = vettingResult.scores.overall;
          }
        } catch (error) {
          console.error(`Failed to vet candidate ${candidate.id}:`, error);
        }
      }

      if (bestCandidate) {
        // Mark as approved for posting
        await this.vetter.approveCandidateForPosting(bestCandidate.id);
        
        // Add reasoning from plan if available
        const reasoning = plan?.reasoning || 'AI-generated content based on learning patterns';
        
        return {
          ...bestCandidate,
          reasoning
        };
      }

      console.log('❌ No candidates passed vetting');
      return null;

    } catch (error) {
      console.error('Content generation failed:', error);
      return null;
    }
  }

  /**
   * Quick content generation for immediate posting needs
   */
  async generateQuickContent(format: 'short' | 'medium' | 'thread' = 'short'): Promise<GeneratedContent | null> {
    console.log(`⚡ Quick generation: ${format} format...`);
    
    return await this.generateVettedContent({
      format_preference: format,
      urgency: 'high'
    });
  }

  /**
   * Batch generate content for the queue
   */
  async generateContentBatch(count: number = 5): Promise<GeneratedContent[]> {
    console.log(`📦 Batch generating ${count} pieces of content...`);
    
    const results: GeneratedContent[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const content = await this.generateVettedContent({
          urgency: 'low'
        });
        
        if (content) {
          results.push(content);
          console.log(`✅ Generated ${i + 1}/${count}: ${content.format} about ${content.topic}`);
        } else {
          console.log(`⚠️ Failed to generate ${i + 1}/${count}`);
        }
        
        // Rate limiting between generations
        await this.delay(2000);
        
      } catch (error) {
        console.error(`Failed to generate content ${i + 1}:`, error);
      }
    }
    
    console.log(`📈 Batch complete: ${results.length}/${count} successful generations`);
    return results;
  }

  /**
   * Get patterns to amplify from latest recommendations
   */
  private async getAmplifyPatterns(): Promise<string[]> {
    try {
      const { data: recommendations } = await this.supabase
        .from('recommendations')
        .select('amplify_patterns')
        .order('generated_at', { ascending: false })
        .limit(1);

      return recommendations?.[0]?.amplify_patterns || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get patterns to avoid from latest recommendations
   */
  private async getAvoidPatterns(): Promise<string[]> {
    try {
      const { data: recommendations } = await this.supabase
        .from('recommendations')
        .select('avoid_patterns')
        .order('generated_at', { ascending: false })
        .limit(1);

      return recommendations?.[0]?.avoid_patterns || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Run daily learning maintenance
   */
  async runDailyMaintenance(): Promise<void> {
    console.log('🔧 Running daily learning maintenance...');

    try {
      // Update engagement metrics for recent posts
      await this.learner.runLearningCycle();
      
      // Clean up old candidates
      await this.cleanupOldCandidates();
      
      // Update pattern confidence scores
      await this.updatePatternPerformance();
      
      console.log('✅ Daily maintenance completed');
    } catch (error) {
      console.error('Daily maintenance failed:', error);
    }
  }

  /**
   * Clean up old content candidates
   */
  private async cleanupOldCandidates(): Promise<void> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    await this.supabase
      .from('content_candidates')
      .delete()
      .lt('generated_at', oneWeekAgo.toISOString())
      .neq('status', 'posted');
  }

  /**
   * Update pattern performance based on recent data
   */
  private async updatePatternPerformance(): Promise<void> {
    // This would involve analyzing recent post performance
    // and updating pattern confidence scores
    console.log('📊 Updating pattern performance metrics...');
    
    // Simplified implementation - in production this would be more sophisticated
    const { data: recentPosts } = await this.supabase
      .from('posts')
      .select('*')
      .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (recentPosts?.length) {
      console.log(`📈 Analyzed ${recentPosts.length} recent posts for pattern performance`);
    }
  }

  /**
   * Get system status and metrics
   */
  async getSystemStatus(): Promise<any> {
    try {
      const [
        { data: recentPosts },
        { data: candidates },
        { data: patterns },
        { data: peerPosts }
      ] = await Promise.all([
        this.supabase.from('posts').select('count').gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        this.supabase.from('content_candidates').select('count').eq('status', 'approved'),
        this.supabase.from('patterns').select('count').eq('status', 'active'),
        this.supabase.from('peer_posts').select('count').gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      return {
        posts_last_24h: recentPosts?.[0]?.count || 0,
        approved_candidates: candidates?.[0]?.count || 0,
        active_patterns: patterns?.[0]?.count || 0,
        peer_posts_last_24h: peerPosts?.[0]?.count || 0,
        system_health: 'operational',
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      return {
        system_health: 'error',
        error: error.message,
        last_updated: new Date().toISOString()
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default LearningSystemOrchestrator;
