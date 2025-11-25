/**
 * 🎭 HUMAN CONTENT ORCHESTRATOR
 * 
 * This replaces the rigid, formulaic content system with something that
 * actually feels human and varied, like a real person posting on Twitter.
 */

import { generateDynamicContent, injectContentChaos, StyleRotator } from '../generators/dynamicContentGenerator';

export interface HumanContentResult {
  content: string | string[];
  format: 'single' | 'thread';
  style: string;
  metadata: {
    approach: string;
    variety_score: number;
    human_like: boolean;
    chaos_injected: boolean;
  };
}

export class HumanContentOrchestrator {
  private static instance: HumanContentOrchestrator;
  
  public static getInstance(): HumanContentOrchestrator {
    if (!HumanContentOrchestrator.instance) {
      HumanContentOrchestrator.instance = new HumanContentOrchestrator();
    }
    return HumanContentOrchestrator.instance;
  }
  
  /**
   * 🎯 Generate truly human-like content
   */
  async generateHumanContent(params?: {
    topic?: string;
    forceFormat?: 'single' | 'thread';
    mood?: 'curious' | 'confident' | 'playful' | 'serious' | 'surprised' | 'thoughtful';
  }): Promise<HumanContentResult> {
    
    console.log('[HUMAN_ORCHESTRATOR] 🎭 Generating human-like content...');
    
    // 🎲 RANDOM DECISIONS (like a real human)
    // ✅ GRADUAL THREAD ROLLOUT: Starting at 5% (was disabled, targeting 15%)
    const threadChance = parseFloat(process.env.THREAD_PERCENTAGE || '5') / 100;
    const shouldCreateThread = params?.forceFormat === 'thread' || 
      (params?.forceFormat !== 'single' && Math.random() < threadChance);
    
    const moods = ['curious', 'confident', 'playful', 'serious', 'surprised', 'thoughtful'];
    const selectedMood = params?.mood || moods[Math.floor(Math.random() * moods.length)];
    
    const lengths = ['short', 'medium', 'long'];
    const selectedLength = lengths[Math.floor(Math.random() * lengths.length)];
    
    const angles = ['personal', 'research', 'practical', 'philosophical', 'controversial'];
    const selectedAngle = angles[Math.floor(Math.random() * angles.length)];
    
    // 🎨 Get next style (ensures variety)
    const nextStyle = StyleRotator.getNextStyle();
    
    console.log(`[HUMAN_ORCHESTRATOR] 🎯 Style: ${nextStyle}, Mood: ${selectedMood}, Format: ${shouldCreateThread ? 'thread' : 'single'}`);
    
    try {
      // Generate content with dynamic approach
      const result = await generateDynamicContent({
        topic: params?.topic,
        format: shouldCreateThread ? 'thread' : 'single',
        mood: selectedMood as any,
        length: selectedLength as any,
        angle: selectedAngle as any
      });
      
      // 🎲 Inject some chaos for variety
      let finalContent = result.content;
      let chaosInjected = false;
      
      if (typeof finalContent === 'string') {
        const originalContent = finalContent;
        finalContent = injectContentChaos(finalContent);
        chaosInjected = originalContent !== finalContent;
      } else if (Array.isArray(finalContent)) {
        // Inject chaos into first tweet of thread
        if (finalContent.length > 0) {
          const originalFirst = finalContent[0];
          finalContent[0] = injectContentChaos(originalFirst);
          chaosInjected = originalFirst !== finalContent[0];
        }
      }
      
      console.log(`[HUMAN_ORCHESTRATOR] ✅ Generated ${shouldCreateThread ? 'thread' : 'single'} content`);
      if (chaosInjected) {
        console.log('[HUMAN_ORCHESTRATOR] 🎲 Chaos injected for variety');
      }
      
      return {
        content: finalContent,
        format: shouldCreateThread ? 'thread' : 'single',
        style: result.style,
        metadata: {
          ...result.metadata,
          chaos_injected: chaosInjected
        }
      };
      
    } catch (error) {
      console.error('[HUMAN_ORCHESTRATOR] ❌ Content generation failed:', error);
      throw error;
    }
  }
  
  /**
   * 🎲 Generate content with specific personality
   */
  async generateWithPersonality(personality: 'enthusiast' | 'skeptic' | 'researcher' | 'practitioner'): Promise<HumanContentResult> {
    
    const personalityConfigs = {
      enthusiast: {
        mood: 'playful' as const,
        angle: 'personal' as const,
        length: 'medium' as const
      },
      skeptic: {
        mood: 'thoughtful' as const,
        angle: 'controversial' as const,
        length: 'long' as const
      },
      researcher: {
        mood: 'serious' as const,
        angle: 'research' as const,
        length: 'long' as const
      },
      practitioner: {
        mood: 'confident' as const,
        angle: 'practical' as const,
        length: 'medium' as const
      }
    };
    
    const config = personalityConfigs[personality];
    
    // Note: angle and length are not supported by generateHumanContent parameters
    // They're used internally by the personality configs but not passed as parameters
    return this.generateHumanContent({
      mood: config.mood
    });
  }
  
  /**
   * 🎯 Generate content based on time of day
   */
  async generateTimeBasedContent(): Promise<HumanContentResult> {
    const hour = new Date().getHours();
    
    let mood: 'curious' | 'confident' | 'playful' | 'serious' | 'surprised' | 'thoughtful';
    let angle: 'personal' | 'research' | 'practical' | 'philosophical' | 'controversial';
    
    if (hour >= 6 && hour < 10) {
      // Morning: practical, confident
      mood = 'confident';
      angle = 'practical';
    } else if (hour >= 10 && hour < 14) {
      // Midday: research, serious
      mood = 'serious';
      angle = 'research';
    } else if (hour >= 14 && hour < 18) {
      // Afternoon: curious, playful
      mood = 'playful';
      angle = 'personal';
    } else if (hour >= 18 && hour < 22) {
      // Evening: thoughtful, philosophical
      mood = 'thoughtful';
      angle = 'philosophical';
    } else {
      // Night: surprised, controversial
      mood = 'surprised';
      angle = 'controversial';
    }
    
    return this.generateHumanContent({
      mood
      // Note: angle is not a supported parameter for generateHumanContent
    });
  }
}

export const humanContentOrchestrator = HumanContentOrchestrator.getInstance();
