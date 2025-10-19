/**
 * 🎯 MULTI-OPTION GENERATOR
 * 
 * Generates multiple content options in parallel
 * Allows AI judge to pick the BEST option
 * 
 * Strategy: Generate 5 variations from different generators
 * Then let AI critic select the winner
 */

import { generateProvocateurContent } from '../generators/provocateurGenerator';
import { generateStorytellerContent } from '../generators/storytellerGenerator';
import { generateContrarianContent } from '../generators/contrarianGenerator';
import { generateDataNerdContent } from '../generators/dataNerdGenerator';
import { generateMythBusterContent } from '../generators/mythBusterGenerator';
import { generateInterestingContent } from '../generators/interestingContentGenerator';
import { generateCoachContent } from '../generators/coachGenerator';
import { generateThoughtLeaderContent } from '../generators/thoughtLeaderGenerator';

export interface ContentOption {
  content: string | string[];
  format: 'single' | 'thread';
  generator_name: string;
  confidence: number;
  raw_content: string; // For judging
}

export interface GenerationConfig {
  topic: string;
  format: 'single' | 'thread';
  generators?: string[]; // Which generators to use (default: top 5)
  research?: { finding: string; source: string; mechanism: string; };
}

/**
 * Main multi-option generation class
 */
export class MultiOptionGenerator {
  private static instance: MultiOptionGenerator;
  
  static getInstance(): MultiOptionGenerator {
    if (!this.instance) {
      this.instance = new MultiOptionGenerator();
    }
    return this.instance;
  }
  
  /**
   * Generate multiple content options in parallel
   */
  async generateOptions(config: GenerationConfig): Promise<ContentOption[]> {
    const { topic, format, generators, research } = config;
    
    // Default to top 5 performing generators if not specified
    const selectedGenerators = generators || [
      'provocateur',
      'contrarian',
      'storyteller',
      'mythBuster',
      'dataNerd'
    ];
    
    console.log(`🎯 MULTI_OPTION_GEN: Generating ${selectedGenerators.length} options in parallel...`);
    
    // Generate all options in parallel
    const generationPromises = selectedGenerators.map(async (generatorName) => {
      try {
        const startTime = Date.now();
        const result = await this.generateWithGenerator(generatorName, { topic, format, research });
        const duration = Date.now() - startTime;
        
        console.log(`  ✓ ${generatorName}: Generated in ${duration}ms (confidence: ${result.confidence})`);
        
        return {
          ...result,
          generator_name: generatorName
        };
      } catch (error: any) {
        console.error(`  ✗ ${generatorName}: Failed - ${error.message}`);
        return null;
      }
    });
    
    // Wait for all generations
    const results = await Promise.all(generationPromises);
    
    // Filter out failures
    const validOptions = results.filter((r): r is ContentOption => r !== null);
    
    console.log(`✅ MULTI_OPTION_GEN: ${validOptions.length}/${selectedGenerators.length} options generated successfully`);
    
    return validOptions;
  }
  
  /**
   * Generate content using specific generator
   */
  private async generateWithGenerator(
    generatorName: string,
    params: { topic: string; format: 'single' | 'thread'; research?: any }
  ): Promise<ContentOption> {
    const { topic, format, research } = params;
    
    let result;
    
    switch (generatorName) {
      case 'provocateur':
        result = await generateProvocateurContent({ topic, format, research });
        break;
      case 'storyteller':
        result = await generateStorytellerContent({ topic, format, research });
        break;
      case 'contrarian':
        result = await generateContrarianContent({ topic, format, research });
        break;
      case 'dataNerd':
        result = await generateDataNerdContent({ topic, format, research });
        break;
      case 'mythBuster':
        result = await generateMythBusterContent({ topic, format, research });
        break;
      case 'interesting':
        result = await generateInterestingContent({ topic, format, research });
        break;
      case 'coach':
        result = await generateCoachContent({ topic, format, research });
        break;
      case 'thoughtLeader':
        result = await generateThoughtLeaderContent({ topic, format, research });
        break;
      default:
        throw new Error(`Unknown generator: ${generatorName}`);
    }
    
    // Extract raw content string for judging
    const rawContent = Array.isArray(result.content) 
      ? result.content.join(' ') 
      : result.content;
    
    return {
      content: result.content,
      format: result.format,
      generator_name: generatorName,
      confidence: result.confidence,
      raw_content: rawContent
    };
  }
}

/**
 * Export singleton instance
 */
export const multiOptionGenerator = MultiOptionGenerator.getInstance();

