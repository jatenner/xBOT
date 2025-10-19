/**
 * PRE-GENERATION INTELLIGENCE
 * Gathers deep research and multiple perspectives BEFORE content generation
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage, ResearchInsights, ContextInsights, Perspective } from './intelligenceTypes';
import { intelligenceConfig } from './intelligenceConfig';

export class PreGenerationIntelligence {
  private cache: Map<string, { data: IntelligencePackage; timestamp: Date }> = new Map();

  /**
   * Main entry point: Analyze topic and gather intelligence
   */
  async analyzeTopicIntelligence(topic: string): Promise<IntelligencePackage> {
    console.log(`🧠 PRE_GEN_INTELLIGENCE: Analyzing "${topic}"...`);

    // Check cache
    if (intelligenceConfig.preGeneration.cacheResults) {
      const cached = this.getCached(topic);
      if (cached) {
        console.log(`📦 Using cached intelligence for "${topic}"`);
        return cached;
      }
    }

    try {
      // Step 1: Research Analysis
      const research = await this.researchAnalysis(topic);
      console.log(`  ✅ Research: ${research.surprise_factor}`);

      // Step 2: Context Analysis
      const context = await this.contextAnalysis(topic, research);
      console.log(`  ✅ Context: Found ${context.gaps.length} narrative gaps`);

      // Step 3: Generate Multiple Perspectives
      const perspectives = await this.perspectiveGeneration(topic, research, context);
      console.log(`  ✅ Perspectives: Generated ${perspectives.length} unique angles`);

      const intelligence: IntelligencePackage = {
        topic,
        research,
        context,
        perspectives,
        generated_at: new Date()
      };

      // Cache result
      if (intelligenceConfig.preGeneration.cacheResults) {
        this.cache.set(topic, { data: intelligence, timestamp: new Date() });
      }

      return intelligence;

    } catch (error: any) {
      console.error(`❌ PRE_GEN_INTELLIGENCE failed for "${topic}":`, error.message);
      throw error;
    }
  }

  /**
   * AI Call 1: Deep Research Analysis
   */
  private async researchAnalysis(topic: string): Promise<ResearchInsights> {
    const prompt = `You are a research intelligence AI. Analyze this topic DEEPLY.

TOPIC: "${topic}"

ANALYZE step-by-step:
1. What do most people believe about this topic? (Common narrative)
2. What does scientific research actually show? (Evidence-based reality)
3. What's the most SURPRISING finding? (Unexpected/counterintuitive fact)
4. What do experts/specialists know that regular people don't? (Insider knowledge)
5. What's controversial or debated about this? (Conflicting views)

Think carefully about each question before answering.

Return JSON with:
{
  "common_belief": "What everyone thinks",
  "scientific_reality": "What research shows with specific data",
  "surprise_factor": "Most shocking/counterintuitive finding",
  "expert_insight": "What insiders know",
  "controversy": "What's debated or misunderstood"
}`;

    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: 'You are a research intelligence AI specializing in deep analysis.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'pre_gen_intelligence - research analysis',
      priority: 'medium'
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No research analysis returned');

    return JSON.parse(content);
  }

  /**
   * AI Call 2: Context Analysis
   */
  private async contextAnalysis(topic: string, research: ResearchInsights): Promise<ContextInsights> {
    const prompt = `You are a context intelligence AI. Analyze the CURRENT narrative around this topic.

TOPIC: "${topic}"
RESEARCH: ${JSON.stringify(research)}

ANALYZE:
1. What's the mainstream narrative right now? (What most content says)
2. What gaps exist in current coverage? (What's being overlooked)
3. What controversies or debates exist? (Where opinions diverge)
4. What's the trending angle? (What would resonate now)

Return JSON with:
{
  "current_narrative": "Mainstream take on this topic",
  "gaps": ["Gap 1", "Gap 2", "Gap 3"],
  "controversies": ["Debate 1", "Debate 2"],
  "trending_angle": "What angle would work best right now"
}`;

    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: 'You are a context intelligence AI specializing in narrative analysis.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'pre_gen_intelligence - context analysis',
      priority: 'medium'
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No context analysis returned');

    return JSON.parse(content);
  }

  /**
   * AI Call 3: Generate Multiple Perspectives
   */
  private async perspectiveGeneration(
    topic: string,
    research: ResearchInsights,
    context: ContextInsights
  ): Promise<Perspective[]> {
    const prompt = `You are a perspective intelligence AI. Generate MULTIPLE unique angles on this topic.

TOPIC: "${topic}"

RESEARCH:
- Common belief: ${research.common_belief}
- Reality: ${research.scientific_reality}
- Surprise: ${research.surprise_factor}
- Expert insight: ${research.expert_insight}

CONTEXT:
- Current narrative: ${context.current_narrative}
- Gaps: ${context.gaps.join(', ')}

GENERATE 3-5 UNIQUE PERSPECTIVES:

Each perspective should:
1. Challenge conventional thinking (contrarian angle)
2. Reveal hidden implications (what this really means)
3. Provide clear action hook (what to do about it)
4. Have appropriate controversy level (1-10, where 3-5 is ideal)
5. Be highly unique (not what everyone else is saying)

Return JSON array:
[
  {
    "angle": "The contrarian take or unique framing",
    "implication": "What this means for real people",
    "action_hook": "Specific thing someone can do",
    "controversy_level": 4,
    "uniqueness_score": 9
  },
  ...
]

Generate perspectives that make people think "Wow, I never thought about it that way."`;

    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: 'You are a perspective intelligence AI specializing in unique angle generation.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9, // High creativity
      response_format: { type: 'json_object' }
    }, {
      purpose: 'pre_gen_intelligence - perspective generation',
      priority: 'medium'
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No perspectives returned');

    const parsed = JSON.parse(content);
    return parsed.perspectives || parsed;
  }

  /**
   * Get cached intelligence if available and fresh
   */
  private getCached(topic: string): IntelligencePackage | null {
    const cached = this.cache.get(topic);
    if (!cached) return null;

    const ageMinutes = (Date.now() - cached.timestamp.getTime()) / 1000 / 60;
    if (ageMinutes > intelligenceConfig.preGeneration.cacheDurationMinutes) {
      this.cache.delete(topic);
      return null;
    }

    return cached.data;
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('🧠 Intelligence cache cleared');
  }
}

