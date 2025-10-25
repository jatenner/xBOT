/**
 * CONTENT ORCHESTRATOR - THE BRAIN
 * Coordinates all systems to generate natural, diverse content
 */

import { generateContrarianContent } from '../generators/contrarianGenerator';
import { generateDataNerdContent } from '../generators/dataNerdGenerator';
import { generateStorytellerContent } from '../generators/storytellerGenerator';
import { generateCoachContent } from '../generators/coachGenerator';
import { generateExplorerContent } from '../generators/explorerGenerator';
import { generateThoughtLeaderContent } from '../generators/thoughtLeaderGenerator';
import { generateMythBusterContent } from '../generators/mythBusterGenerator';
import { generateNewsReporterContent } from '../generators/newsReporterGenerator';
import { generatePhilosopherContent } from '../generators/philosopherGenerator';
import { generateProvocateurContent } from '../generators/provocateurGenerator';

import { getPostHistory } from '../memory/postHistory';
import { getNarrativeEngine } from '../memory/narrativeEngine';
import { getConversationTracker } from '../memory/conversationTracker';

import { getResearchCurator } from '../research/researchCurator';

import { getPersonalityScheduler, GeneratorType } from '../scheduling/personalityScheduler';
import { getImperfectionInjector } from '../chaos/imperfectionInjector';

// DYNAMIC TOPIC GENERATION
import { getDynamicTopicGenerator } from '../intelligence/dynamicTopicGenerator';

// AI-DRIVEN SYSTEMS
import { getStrategyDiscoveryEngine } from '../ai-core/strategyDiscoveryEngine';

// PHASE 1: Quality & Viral Optimization
import { calculateViralPotential, meetsViralThreshold, getImprovementSuggestions } from '../learning/viralScoring';
import { formatForTwitter, validateContentQuality, isTooGeneric } from '../content/contentFormatter';

// PHASE 2: Learning & Attribution
import { initializePostAttribution } from '../learning/engagementAttribution';

export interface OrchestratedContent {
  content: string | string[];
  format: 'single' | 'thread';
  metadata: {
    generator_used: GeneratorType;
    topic: string;
    has_research: boolean;
    narrative_type?: string;
    chaos_applied: boolean;
    viral_score?: number;
    quality_score?: number;
    hook_pattern?: string;
  };
  confidence: number;
}

export class ContentOrchestrator {
  private static instance: ContentOrchestrator;
  
  private constructor() {}
  
  public static getInstance(): ContentOrchestrator {
    if (!ContentOrchestrator.instance) {
      ContentOrchestrator.instance = new ContentOrchestrator();
    }
    return ContentOrchestrator.instance;
  }
  
  /**
   * MAIN ORCHESTRATION - Generates content using all systems
   */
  async generateContent(params?: {
    topicHint?: string;
    formatHint?: 'single' | 'thread';
  }): Promise<OrchestratedContent> {
    
    console.log('[ORCHESTRATOR] 🧠 Starting AI-driven content generation...');
    
    // STEP 0: Get AI strategy insights (cached, doesn't hit API every time)
    const strategyEngine = getStrategyDiscoveryEngine();
    const aiAdvice = await strategyEngine.getContentAdvice().catch(() => '');
    if (aiAdvice) {
      console.log(`[ORCHESTRATOR] 🤖 AI Strategy: ${aiAdvice.substring(0, 100)}...`);
    }
    
    // STEP 1: Load recent posts into memory
    const postHistory = getPostHistory();
    await postHistory.loadRecentPosts(30);
    console.log('[ORCHESTRATOR] 📚 Loaded post history');
    
    // STEP 2: Check for chaos injection (20% chance)
    const chaosInjector = getImperfectionInjector();
    const chaosDecision = chaosInjector.shouldInjectChaos();
    
    if (chaosDecision.shouldBreakRules) {
      console.log(`[ORCHESTRATOR] ${chaosDecision.reasoning}`);
    }
    
    // STEP 3: Select generator dynamically (with chaos override + TRUE diversity)
    const scheduler = getPersonalityScheduler();
    const selection = scheduler.selectGenerator();
    
    // ✅ FIXED: Let scheduler pick generator (all 12 have equal chance to rotate)
    // No more forcing 50% to 'contrarian' - that caused repetitive academic tone!
    const generator: GeneratorType = chaosDecision.override?.generator || selection.generator;
    const formatRaw = chaosDecision.override?.format || params?.formatHint || selection.format;
    const format: 'single' | 'thread' = formatRaw === 'auto' 
      ? (Math.random() < 0.6 ? 'single' : 'thread') 
      : formatRaw as 'single' | 'thread';
    
    console.log(`[ORCHESTRATOR] 🎭 Generator: ${generator}, Format: ${format}`);
    console.log(`[ORCHESTRATOR] 💡 ${selection.reasoning}`);
    
    // STEP 4: Select topic (with diversity check)
    let topic = chaosDecision.override?.topic || params?.topicHint || await this.selectDiverseTopic();
    
    // Check if topic was recently covered
    if (postHistory.wasTopicRecentlyCovered(topic, 10)) {
      console.log(`[ORCHESTRATOR] ⚠️ Topic "${topic}" recently covered, diversifying...`);
      topic = await this.selectDiverseTopic(topic); // Get different topic
    }
    
    console.log(`[ORCHESTRATOR] 📝 Topic: ${topic}`);
    
    // STEP 5: Check for narrative opportunity
    const narrativeEngine = getNarrativeEngine();
    const narrativeOpp = await narrativeEngine.findNarrativeOpportunities(topic);
    const narrativeContext = narrativeEngine.getNarrativeContext(narrativeOpp);
    
    if (narrativeOpp) {
      console.log(`[ORCHESTRATOR] 🔗 Narrative: ${narrativeOpp.type} - ${narrativeOpp.suggestion}`);
    }
    
    // STEP 6: Curate research
    const researchCurator = getResearchCurator();
    const research = researchCurator.curateResearch(topic, true);
    
    if (research.hasResearch) {
      console.log(`[ORCHESTRATOR] 🔬 Research: ${research.source}`);
    }
    
    // STEP 7: Generate content with selected generator
    let generatedContent;
    
    if (useSmartEngine) {
      // Use the SMART ENGINE (makes connections, has insights, builds context)
      const { smartContentEngine } = await import('../intelligence/smartContentEngine');
      const smart = await smartContentEngine.generateUniqueSmartContent({
        topic,
        format: format as 'single' | 'thread',
        research: research.hasResearch ? research : undefined,
        maxRetries: 3 // Try up to 3 times to avoid duplicates
      });
      
      generatedContent = {
        content: smart.content,
        format: smart.format,
        confidence: smart.confidence
      };
      
      console.log(`[ORCHESTRATOR] 🧠 SMART content generated (insight: ${smart.metadata.insight_level}/10)`);
      console.log(`[ORCHESTRATOR] 💡 Connection: ${smart.metadata.connection_made}`);
      console.log(`[ORCHESTRATOR] 🎯 Builds on: ${smart.metadata.builds_on.join(', ') || 'new topic'}`);
    } else {
      // Use traditional personality generator
      generatedContent = await this.callGenerator(generator, {
        topic,
        format: format as 'single' | 'thread',
        research: research.hasResearch ? research : undefined,
        narrativeContext
      });
    }
    
    // STEP 7.25: VALIDATE SUBSTANCE (NO HOLLOW QUESTIONS OR TITLES!)
    try {
      const { validateContentSubstance } = await import('../validators/substanceValidator');
      const substanceCheck = validateContentSubstance(generatedContent.content);
      
      if (!substanceCheck.isValid) {
        console.error(`[ORCHESTRATOR] ❌ HOLLOW CONTENT REJECTED: ${substanceCheck.reason}`);
        console.error(`[ORCHESTRATOR]    Content: "${Array.isArray(generatedContent.content) ? generatedContent.content[0] : generatedContent.content}"`);
        throw new Error(`Content lacks substance: ${substanceCheck.reason}`);
      }
      
      console.log(`[ORCHESTRATOR] ✅ Content has substance (score: ${substanceCheck.score}/100)`);
    } catch (substanceError: any) {
      console.error('[ORCHESTRATOR] ❌ Content substance validation failed');
      throw substanceError; // Reject this content, force retry
    }
    
    // STEP 7.5: HUMANIZE CONTENT (Make it sound like a real person!)
    try {
      const { humanizeContent } = await import('../generators/humanVoiceFilter');
      generatedContent.content = await humanizeContent(generatedContent.content);
      console.log('[ORCHESTRATOR] 🗣️ Content humanized - now sounds like a real person');
    } catch (humanizeError: any) {
      console.warn('[ORCHESTRATOR] ⚠️ Humanization failed, using original:', humanizeError.message);
    }
    
    // STEP 8: Apply human touch (meta-commentary)
    const humanTouch = chaosInjector.getHumanTouch();
    if (humanTouch && typeof generatedContent.content === 'string') {
      generatedContent.content = `${humanTouch} ${generatedContent.content}`;
      console.log(`[ORCHESTRATOR] 👤 Added human touch: ${humanTouch}`);
    }
    
    // === PHASE 1: VIRAL OPTIMIZATION & QUALITY ===
    console.log('[ORCHESTRATOR] 🎯 Applying viral optimization...');
    
    // Format for Twitter readability
    let finalContent = formatForTwitter(generatedContent.content);
    
    // Calculate viral potential score
    const viralScore = calculateViralPotential(finalContent);
    console.log(`[ORCHESTRATOR] 📊 Viral Score: ${viralScore.total_score}/100`);
    viralScore.breakdown.forEach(b => console.log(`  ${b}`));
    
    // Quality gate: reject if too generic
    const contentText = Array.isArray(finalContent) ? finalContent.join(' ') : finalContent;
    if (isTooGeneric(contentText)) {
      console.error('[ORCHESTRATOR] ❌ Content too generic, will retry...');
      throw new Error('Content too generic - rejected by quality gate');
    }
    
    // Quality validation
    const quality = validateContentQuality(contentText);
    if (!quality.passed) {
      console.warn(`[ORCHESTRATOR] ⚠️ Quality issues (${quality.score}/100):`);
      quality.issues.forEach(i => console.warn(`  - ${i}`));
    }
    
    // DYNAMIC VIRAL THRESHOLD: Adapts based on followers + engagement
    const { getDynamicViralThreshold } = await import('../learning/viralScoring');
    const dynamicThreshold = await getDynamicViralThreshold();
    
    if (!meetsViralThreshold(viralScore, dynamicThreshold)) {
      console.error(`[ORCHESTRATOR] ❌ Viral score too low (<${dynamicThreshold}), rejected`);
      const suggestions = getImprovementSuggestions(viralScore);
      suggestions.forEach(s => console.error(`  ${s}`));
      throw new Error(`Viral score too low: ${viralScore.total_score}/${dynamicThreshold}`);
    }
    
    if (viralScore.total_score >= 70) {
      console.log('[ORCHESTRATOR] 🔥 HIGH VIRAL POTENTIAL - Prioritize posting!');
    }
    
    // STEP 9: Store in post history
    await postHistory.addPost({
      post_id: `temp_${Date.now()}`,
      content: Array.isArray(finalContent) 
        ? finalContent.join(' | ') 
        : finalContent,
      topic,
      generator_used: generator,
      created_at: new Date().toISOString()
    });
    
    console.log(`[ORCHESTRATOR] ✅ Content generated successfully`);
    
    return {
      content: finalContent,
      format: generatedContent.format,
      metadata: {
        generator_used: generator,
        topic,
        has_research: research.hasResearch,
        narrative_type: narrativeOpp?.type,
        chaos_applied: chaosDecision.shouldBreakRules,
        viral_score: viralScore.total_score,
        quality_score: quality.score,
        hook_pattern: viralScore.hook_score > 0 ? 'detected' : 'none'
      },
      confidence: Math.min((viralScore.total_score / 100) * 0.7 + (quality.score / 100) * 0.3, 0.95)
    };
  }
  
  /**
   * Call appropriate generator based on type
   */
  private async callGenerator(
    generatorType: GeneratorType,
    params: {
      topic: string;
      format: 'single' | 'thread';
      research?: any;
      narrativeContext?: string;
    }
  ) {
    // Add narrative context to topic if available
    const enrichedTopic = params.narrativeContext 
      ? `${params.topic}\n\n${params.narrativeContext}`
      : params.topic;
    
    switch (generatorType) {
      case 'contrarian':
        return await generateContrarianContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'data_nerd':
        return await generateDataNerdContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'storyteller':
        return await generateStorytellerContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'coach':
        return await generateCoachContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'explorer':
        return await generateExplorerContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'thought_leader':
        return await generateThoughtLeaderContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'myth_buster':
        return await generateMythBusterContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'news_reporter':
        return await generateNewsReporterContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'philosopher':
        return await generatePhilosopherContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      case 'provocateur':
        return await generateProvocateurContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
      
      default:
        // Fallback to thought leader
        return await generateThoughtLeaderContent({
          topic: enrichedTopic,
          format: params.format,
          research: params.research
        });
    }
  }
  
  /**
   * Select diverse topic (simplified - could be more sophisticated)
   */
  /**
   * 🤖 DYNAMIC TOPIC SELECTION
   * 
   * 70% of time: Use AI to generate unique topics dynamically
   * 30% of time: Use hardcoded safety topics (fallback + variety)
   * 
   * This gives us UNLIMITED content possibilities!
   */
  private async selectDiverseTopic(avoid?: string): Promise<string> {
    // ✅ 100% AI-DRIVEN TOPIC GENERATION - No hardcoded lists!
    // Let AI generate topics from its unlimited health knowledge
    
    try {
      console.log('[ORCHESTRATOR] 🤖 Using 100% AI-driven topic generation (no hardcoded lists)...');
      
      const dynamicGenerator = getDynamicTopicGenerator();
      
      // Get recent topics to avoid repetition
      const postHistory = getPostHistory();
      const recentTopics = postHistory.getRecentTopics ? postHistory.getRecentTopics(10) : [];
      
      // Generate unique topic - AI creates this from scratch!
      const dynamicTopic = await dynamicGenerator.generateTopic({
        recentTopics: avoid ? [...recentTopics, avoid] : recentTopics,
        preferTrending: Math.random() < 0.3 // 30% prefer trending topics
      });
      
      // Format topic string (combine topic + angle + dimension)
      const fullTopic = `${dynamicTopic.topic} (${dynamicTopic.dimension}: ${dynamicTopic.angle})`;
      
      console.log(`[ORCHESTRATOR] ✨ AI-generated topic: "${fullTopic}"`);
      console.log(`[ORCHESTRATOR] 🔥 Viral potential: ${dynamicTopic.viral_potential}`);
      
      return fullTopic;
      
    } catch (error: any) {
      console.error('[ORCHESTRATOR] ❌ AI topic generation failed:', error.message);
      
      // NO FALLBACK - If AI fails, throw error and system will retry
      throw new Error(`AI topic generation failed: ${error.message}. System will retry.`);
    }
  }
  
  /**
   * Update learning based on post performance
   */
  async updateLearning(
    generator: GeneratorType,
    followers_gained: number
  ): Promise<void> {
    const scheduler = getPersonalityScheduler();
    scheduler.updateGeneratorWeight(generator, followers_gained);
    
    console.log(`[ORCHESTRATOR] 📈 Updated ${generator} learning: +${followers_gained} followers`);
  }
}

export const getContentOrchestrator = () => ContentOrchestrator.getInstance();

