/**
 * 🎯 INTELLIGENT ORCHESTRATOR
 * Integrates the new multi-pass AI engine with existing systems
 * 
 * This replaces the old contentOrchestrator with a smarter version that:
 * - Uses multi-pass AI generation
 * - Learns from performance data
 * - Creates complete, helpful content
 * - Self-reviews and improves
 */

import { getIntelligentContentEngine } from '../ai/intelligentContentEngine';
import { getContentContextManager } from '../ai/contentContextManager';
import { getPostHistory } from '../memory/postHistory';
import { getNarrativeEngine } from '../memory/narrativeEngine';
import { validateContentQuality, formatForTwitter } from '../content/contentFormatter';
import { calculateViralPotential, meetsViralThreshold, getDynamicViralThreshold } from '../learning/viralScoring';

export interface IntelligentOrchestratedContent {
  content: string | string[];
  format: 'single' | 'thread';
  metadata: {
    angle: string;
    topic: string;
    qualityScore: number;
    viralScore: number;
    aiIterations: number;
    has_research: boolean;
    generator_used: string;
  };
  confidence: number;
}

export class IntelligentOrchestrator {
  private static instance: IntelligentOrchestrator;
  private contentEngine = getIntelligentContentEngine();
  private contextManager = getContentContextManager();

  public static getInstance(): IntelligentOrchestrator {
    if (!IntelligentOrchestrator.instance) {
      IntelligentOrchestrator.instance = new IntelligentOrchestrator();
    }
    return IntelligentOrchestrator.instance;
  }

  /**
   * Main entry point: Generate intelligent content
   */
  async generateIntelligentContent(params?: {
    topicHint?: string;
    formatHint?: 'single' | 'thread';
  }): Promise<IntelligentOrchestratedContent> {
    console.log('🎯 INTELLIGENT_ORCHESTRATOR: Starting intelligent generation...');

    try {
      // STEP 1: Load post history
      const postHistory = getPostHistory();
      await postHistory.loadRecentPosts(30);
      console.log('📚 Loaded post history');

      // STEP 2: Gather full context (performance, trends, etc.)
      const context = await this.contextManager.getFullContext();

      // STEP 3: Select topic (avoid repetition)
      let topic = params?.topicHint || await this.selectDiverseTopic(context);
      
      // Check if recently covered
      if (postHistory.wasTopicRecentlyCovered(topic, 10)) {
        console.log(`⚠️ Topic "${topic}" recently covered, selecting different one...`);
        topic = await this.selectDiverseTopic(context, [topic]);
      }

      console.log(`📝 Topic: ${topic}`);

      // STEP 4: Generate content with intelligent multi-pass system
      const generated = await this.contentEngine.generateIntelligentContent({
        topic,
        recentPosts: context.recentPosts,
        topPerformers: context.performanceInsights.topPerformers,
        recentFlops: context.performanceInsights.recentFlops,
        trendingTopics: context.trendingTopics
      });

      console.log(`✅ Content generated:`);
      console.log(`   Format: ${generated.format}`);
      console.log(`   Quality: ${generated.metadata.qualityScore}/10`);
      console.log(`   Angle: ${generated.metadata.angle}`);
      console.log(`   Iterations: ${generated.metadata.iterations}`);

      // STEP 5: Format for Twitter
      const formatted = formatForTwitter(generated.content);

      // STEP 6: Calculate viral potential
      const viralScore = calculateViralPotential(formatted);
      console.log(`📊 Viral Score: ${viralScore.total_score}/100`);

      // STEP 7: Quality gate check
      const dynamicThreshold = await getDynamicViralThreshold();
      
      if (!meetsViralThreshold(viralScore, dynamicThreshold)) {
        console.error(`❌ Viral score too low (<${dynamicThreshold})`);
        throw new Error(`Viral score below threshold: ${viralScore.total_score}/${dynamicThreshold}`);
      }

      if (viralScore.total_score >= 70) {
        console.log('🔥 HIGH VIRAL POTENTIAL');
      }

      // STEP 8: Additional quality validation
      const contentText = Array.isArray(formatted) ? formatted.join(' ') : formatted;
      const quality = validateContentQuality(contentText);
      
      if (!quality.passed) {
        console.warn(`⚠️ Quality issues (${quality.score}/100):`);
        quality.issues.forEach(i => console.warn(`  - ${i}`));
      }

      // STEP 9: Check for narrative opportunities
      const narrativeEngine = getNarrativeEngine();
      const narrativeOpp = await narrativeEngine.findNarrativeOpportunities(topic);
      
      if (narrativeOpp) {
        console.log(`🔗 Narrative opportunity: ${narrativeOpp.type}`);
      }

      // STEP 10: Store in post history
      await postHistory.addPost({
        post_id: `temp_${Date.now()}`,
        content: contentText,
        topic,
        generator_used: 'intelligent_engine',
        created_at: new Date().toISOString()
      });

      console.log('✅ INTELLIGENT_ORCHESTRATOR: Generation complete');

      return {
        content: formatted,
        format: generated.format,
        metadata: {
          angle: generated.metadata.angle,
          topic,
          qualityScore: generated.metadata.qualityScore,
          viralScore: viralScore.total_score,
          aiIterations: generated.metadata.iterations,
          has_research: true, // Intelligent engine always includes context
          generator_used: 'intelligent_engine'
        },
        confidence: Math.min(
          (generated.metadata.qualityScore / 10) * 0.6 + 
          (viralScore.total_score / 100) * 0.4,
          0.95
        )
      };
    } catch (error: any) {
      console.error('❌ INTELLIGENT_ORCHESTRATOR: Generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Select diverse topic (avoid repetition)
   */
  private async selectDiverseTopic(
    context: any,
    avoid: string[] = []
  ): Promise<string> {
    const recentTopics = [...context.recentTopics, ...avoid];
    const trending = context.trendingTopics.filter((t: string) => !recentTopics.includes(t));

    if (trending.length > 0) {
      // Pick from trending topics that haven't been covered
      const randomIndex = Math.floor(Math.random() * trending.length);
      return trending[randomIndex];
    }

    // NO HARDCODED FALLBACK TOPICS - use AI generation
    // This ensures unlimited creative freedom and no repetition
    console.log('[INTELLIGENT_ORCHESTRATOR] 🤖 No trending topics, using AI generation...');
    
    try {
      const { DynamicTopicGenerator } = await import('../intelligence/dynamicTopicGenerator');
      const topicGenerator = DynamicTopicGenerator.getInstance();
      
      const dynamicTopic = await topicGenerator.generateTopic({
        recentTopics: recentTopics,
        preferTrending: false
      });
      
      console.log(`[INTELLIGENT_ORCHESTRATOR] ✅ Generated: "${dynamicTopic.topic}"`);
      return dynamicTopic.topic;
      
    } catch (error: any) {
      console.error('[INTELLIGENT_ORCHESTRATOR] ❌ AI failed, delegating to content engine');
      
      // Ultimate fallback: generic prompt for content engine to be creative
      return 'Generate a completely unique health/wellness topic'
    }
  }
}

export const getIntelligentOrchestrator = () => IntelligentOrchestrator.getInstance();

