/**
 * IMPERFECTION INJECTOR (CHAOS AGENT)
 * Randomly breaks rules to make account feel human
 */

import { GeneratorType, FormatType } from '../scheduling/personalityScheduler';

export interface ChaosDecision {
  shouldBreakRules: boolean;
  type: 'wrong_generator' | 'random_topic' | 'off_script' | 'none';
  override?: {
    generator?: GeneratorType;
    format?: FormatType;
    topic?: string;
  };
  reasoning: string;
}

export class ImperfectionInjector {
  private static instance: ImperfectionInjector;
  
  private constructor() {}
  
  public static getInstance(): ImperfectionInjector {
    if (!ImperfectionInjector.instance) {
      ImperfectionInjector.instance = new ImperfectionInjector();
    }
    return ImperfectionInjector.instance;
  }
  
  /**
   * Decide if we should inject imperfection
   */
  shouldInjectChaos(): ChaosDecision {
    const roll = Math.random();
    
    // 80% normal behavior
    if (roll > 0.2) {
      return {
        shouldBreakRules: false,
        type: 'none',
        reasoning: 'Following schedule'
      };
    }
    
    // 20% CHAOS TIME!
    const chaosType = roll;
    
    if (chaosType < 0.08) {
      // 8% - Use wrong generator
      const randomGenerators: GeneratorType[] = ['contrarian', 'data_nerd', 'storyteller', 'coach', 'explorer', 'thought_leader'];
      const randomGen = randomGenerators[Math.floor(Math.random() * randomGenerators.length)];
      
      return {
        shouldBreakRules: true,
        type: 'wrong_generator',
        override: { generator: randomGen },
        reasoning: `🎲 CHAOS: Using ${randomGen} instead of scheduled generator`
      };
    }
    
    if (chaosType < 0.12) {
      // 4% - Random format switch
      const randomFormat: FormatType = Math.random() < 0.5 ? 'single' : 'thread';
      
      return {
        shouldBreakRules: true,
        type: 'off_script',
        override: { format: randomFormat },
        reasoning: `🎲 CHAOS: Switching to ${randomFormat} format`
      };
    }
    
    if (chaosType < 0.16) {
      // 4% - Completely random topic
      const randomTopics = [
        'productivity',
        'decision making',
        'habit formation',
        'creativity',
        'focus',
        'resilience'
      ];
      const randomTopic = randomTopics[Math.floor(Math.random() * randomTopics.length)];
      
      return {
        shouldBreakRules: true,
        type: 'random_topic',
        override: { topic: randomTopic },
        reasoning: `🎲 CHAOS: Random topic - ${randomTopic}`
      };
    }
    
    // 4% - Multiple overrides (maximum chaos!)
    const randomGenerators: GeneratorType[] = ['contrarian', 'data_nerd', 'storyteller', 'coach', 'explorer', 'thought_leader'];
    const randomGen = randomGenerators[Math.floor(Math.random() * randomGenerators.length)];
    const randomFormat: FormatType = Math.random() < 0.5 ? 'single' : 'thread';
    
    return {
      shouldBreakRules: true,
      type: 'off_script',
      override: { 
        generator: randomGen,
        format: randomFormat
      },
      reasoning: `🎲 MAXIMUM CHAOS: ${randomGen} + ${randomFormat} format`
    };
  }
  
  /**
   * Get human imperfection for content
   * (Could add typos, incomplete thoughts, etc.)
   */
  getHumanTouch(): string | null {
    const roll = Math.random();
    
    // 10% add meta-commentary
    if (roll < 0.1) {
      const metaComments = [
        'Been thinking about this a lot lately...',
        'Okay, enough about X. Let\'s talk about...',
        'Quick thought:',
        'This is interesting:',
        'Something I\'ve noticed:'
      ];
      return metaComments[Math.floor(Math.random() * metaComments.length)];
    }
    
    return null;
  }
}

export const getImperfectionInjector = () => ImperfectionInjector.getInstance();

