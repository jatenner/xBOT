/**
 * 🚀 NEXT-GEN AI UPGRADE INTEGRATION
 * Integrates all advanced AI systems into existing posting flow
 */

import { HyperIntelligentOrchestrator } from './hyperIntelligentOrchestrator';
import { ViralContentOrchestrator } from './viralContentOrchestrator';

export class NextGenAIUpgrade {
  private static instance: NextGenAIUpgrade;
  private hyperOrchestrator: HyperIntelligentOrchestrator;
  private originalOrchestrator: ViralContentOrchestrator;

  constructor() {
    this.hyperOrchestrator = HyperIntelligentOrchestrator.getInstance();
    this.originalOrchestrator = new ViralContentOrchestrator(process.env.OPENAI_API_KEY!);
  }

  public static getInstance(): NextGenAIUpgrade {
    if (!NextGenAIUpgrade.instance) {
      NextGenAIUpgrade.instance = new NextGenAIUpgrade();
    }
    return NextGenAIUpgrade.instance;
  }

  /**
   * 🧠 SMART CONTENT GENERATION
   * Automatically chooses between hyper-intelligent and standard generation
   */
  async generateSmartContent(
    topic?: string,
    format: 'single' | 'thread' = 'single'
  ): Promise<{
    content: string;
    threadParts?: string[];
    metadata: any;
    aiLevel: 'standard' | 'hyper-intelligent';
  }> {
    console.log(`🧠 SMART_AI: Analyzing optimal generation approach for "${topic || 'general health'}"`);

    // Determine if we should use hyper-intelligent generation
    const useHyperAI = await this.shouldUseHyperIntelligence(topic, format);

    if (useHyperAI) {
      console.log('🚀 ACTIVATING_HYPER_AI: Using advanced intelligence stack');
      const result = await this.hyperOrchestrator.generateHyperIntelligentContent(
        topic || 'health optimization',
        format
      );
      
      return {
        ...result,
        aiLevel: 'hyper-intelligent'
      };
    } else {
      console.log('⚡ USING_STANDARD_AI: Using enhanced viral orchestrator');
      const result = await this.originalOrchestrator.generateViralContent(format);
      
      return {
        content: result.content,
        threadParts: result.threadParts,
        metadata: result.metadata || {},
        aiLevel: 'standard'
      };
    }
  }

  /**
   * 🎯 DETERMINE OPTIMAL AI LEVEL
   * Smart logic to decide when to use hyper-intelligence
   */
  private async shouldUseHyperIntelligence(topic?: string, format?: string): Promise<boolean> {
    // Always use hyper-AI for threads (more complex content)
    if (format === 'thread') {
      console.log('🧵 THREAD_DETECTED: Auto-selecting hyper-intelligence');
      return true;
    }

    // Use hyper-AI for sophisticated topics
    if (topic) {
      const sophisticatedTopics = [
        'research', 'study', 'clinical', 'mechanism', 'biochemical', 
        'molecular', 'cellular', 'protocol', 'optimization', 'advanced',
        'biohacking', 'longevity', 'performance', 'elite'
      ];
      
      const isSophisticated = sophisticatedTopics.some(t => 
        topic.toLowerCase().includes(t)
      );
      
      if (isSophisticated) {
        console.log('🧬 SOPHISTICATED_TOPIC: Auto-selecting hyper-intelligence');
        return true;
      }
    }

    // Use hyper-AI 40% of the time for variety and quality
    const useHyper = Math.random() < 0.4;
    console.log(`🎲 RANDOM_SELECTION: ${useHyper ? 'Hyper-AI' : 'Standard'} (40% chance)`);
    return useHyper;
  }

  /**
   * 📊 GET AI SYSTEM STATUS
   * Returns status of all AI systems
   */
  getAISystemStatus(): {
    hyperIntelligenceActive: boolean;
    availableSystems: string[];
    sophisticationLevel: string;
  } {
    return {
      hyperIntelligenceActive: true,
      availableSystems: [
        'Multi-Model Ensemble',
        'Expert Persona System', 
        'Real-Time Trend Injection',
        'Emotional Intelligence Engine',
        'Hyper-Intelligent Orchestrator',
        'Viral Content Orchestrator'
      ],
      sophisticationLevel: 'Maximum'
    };
  }
}

// Export singleton instance
export const getNextGenAI = () => NextGenAIUpgrade.getInstance();
