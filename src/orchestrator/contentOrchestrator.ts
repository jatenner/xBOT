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

import { getPostHistory } from '../memory/postHistory';
import { getNarrativeEngine } from '../memory/narrativeEngine';
import { getConversationTracker } from '../memory/conversationTracker';

import { getResearchCurator } from '../research/researchCurator';

import { getPersonalityScheduler, GeneratorType } from '../scheduling/personalityScheduler';
import { getImperfectionInjector } from '../chaos/imperfectionInjector';

export interface OrchestratedContent {
  content: string | string[];
  format: 'single' | 'thread';
  metadata: {
    generator_used: GeneratorType;
    topic: string;
    has_research: boolean;
    narrative_type?: string;
    chaos_applied: boolean;
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
    
    console.log('[ORCHESTRATOR] 🧠 Starting content generation...');
    
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
    
    // STEP 3: Select personality for today (with chaos override)
    const scheduler = getPersonalityScheduler();
    const scheduledPersonality = scheduler.getAdjustedPersonality();
    
    const generator: GeneratorType = chaosDecision.override?.generator || scheduledPersonality.generator;
    const formatRaw = chaosDecision.override?.format || params?.formatHint || scheduledPersonality.format;
    const format: 'single' | 'thread' = formatRaw === 'auto' 
      ? (Math.random() < 0.6 ? 'single' : 'thread') 
      : formatRaw as 'single' | 'thread';
    
    console.log(`[ORCHESTRATOR] 🎭 Generator: ${generator}, Format: ${format}`);
    
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
    const generatedContent = await this.callGenerator(generator, {
      topic,
      format: format as 'single' | 'thread',
      research: research.hasResearch ? research : undefined,
      narrativeContext
    });
    
    // STEP 8: Apply human touch (meta-commentary)
    const humanTouch = chaosInjector.getHumanTouch();
    if (humanTouch && typeof generatedContent.content === 'string') {
      generatedContent.content = `${humanTouch} ${generatedContent.content}`;
      console.log(`[ORCHESTRATOR] 👤 Added human touch: ${humanTouch}`);
    }
    
    // STEP 9: Store in post history
    await postHistory.addPost({
      post_id: `temp_${Date.now()}`,
      content: Array.isArray(generatedContent.content) 
        ? generatedContent.content.join(' | ') 
        : generatedContent.content,
      topic,
      generator_used: generator,
      created_at: new Date().toISOString()
    });
    
    console.log(`[ORCHESTRATOR] ✅ Content generated successfully`);
    
    return {
      content: generatedContent.content,
      format: generatedContent.format,
      metadata: {
        generator_used: generator,
        topic,
        has_research: research.hasResearch,
        narrative_type: narrativeOpp?.type,
        chaos_applied: chaosDecision.shouldBreakRules
      },
      confidence: generatedContent.confidence
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
      
      default:
        // Fallback
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
  private async selectDiverseTopic(avoid?: string): Promise<string> {
    const topics = [
      'sleep optimization',
      'protein timing',
      'social connections',
      'stress management',
      'exercise timing',
      'circadian rhythm',
      'nutrition myths',
      'longevity strategies',
      'mental resilience',
      'cognitive performance',
      'habit formation',
      'metabolic health',
      'inflammation',
      'gut health',
      'hormonal balance'
    ];
    
    // Filter out avoided topic
    const available = avoid 
      ? topics.filter(t => !t.includes(avoid.toLowerCase()) && !avoid.toLowerCase().includes(t))
      : topics;
    
    return available[Math.floor(Math.random() * available.length)];
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

