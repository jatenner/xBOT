/**
 * 🔌 REPLY GENERATOR ADAPTER
 * Adapts the 12 content generators for reply mode
 * Same personalities, but responding to tweets instead of creating standalone content
 */

import { generateDataNerdContent } from './dataNerdGenerator';
import { generateCoachContent } from './coachGenerator';
import { generateMythBusterContent } from './mythBusterGenerator';
import { generateProvocateurContent } from './provocateurGenerator';
import { generateStorytellerContent } from './storytellerGenerator';
import { generatePhilosopherContent } from './philosopherGenerator';
import { generateThoughtLeaderContent } from './thoughtLeaderGenerator';
import { generateContrarianContent } from './contrarianGenerator';
import { generateExplorerContent } from './explorerGenerator';
import { generateNewsReporterContent } from './newsReporterGenerator';
import { generateCulturalBridgeContent } from './culturalBridgeGenerator';
import { generateInterestingContent } from './interestingContentGenerator';

export interface ReplyTarget {
  tweet_content: string;
  username: string;
  category: string;
  reply_angle?: string;
}

export interface ReplyResult {
  content: string;
  provides_value: boolean;
  not_spam: boolean;
  confidence: number;
  generator_used: string;
  visualFormat?: string;
}

/**
 * Generate a reply using the specified generator
 * Adapts the generator's personality for reply context
 */
export async function generateReplyWithGenerator(
  generatorName: string,
  target: ReplyTarget
): Promise<ReplyResult> {
  
  console.log(`[REPLY_ADAPTER] 🎭 Generating ${generatorName} reply to @${target.username}...`);
  
  // Build reply-specific topic that includes context
  const replyTopic = buildReplyTopic(target);
  
  try {
    let generated: any;
    
    switch (generatorName) {
      // ✅ SUPPORT BOTH NAMING CONVENTIONS (for backwards compatibility)
      case 'data_nerd':
      case 'dataNerd':
        generated = await generateDataNerdContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'coach':
        generated = await generateCoachContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'myth_buster':
      case 'mythBuster':
        generated = await generateMythBusterContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'provocateur':
        generated = await generateProvocateurContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'storyteller':
        generated = await generateStorytellerContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'philosopher':
        generated = await generatePhilosopherContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'thought_leader':
      case 'thoughtLeader':
        generated = await generateThoughtLeaderContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'contrarian':
        generated = await generateContrarianContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'explorer':
        generated = await generateExplorerContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'news_reporter':
      case 'newsReporter':
        generated = await generateNewsReporterContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'cultural_bridge':
      case 'culturalBridge':
        generated = await generateCulturalBridgeContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      case 'interesting':
        generated = await generateInterestingContent({
          topic: replyTopic,
          format: 'single'
        });
        break;
        
      default:
        throw new Error(`Unknown generator: ${generatorName}`);
    }
    
    // Extract content (handle both string and array)
    const content = Array.isArray(generated.content) 
      ? generated.content[0] 
      : generated.content;
    
    // Validate reply quality
    const quality = validateReplyQuality(content, target.tweet_content);
    
    console.log(`[REPLY_ADAPTER] ✅ ${generatorName} reply generated (${content.length} chars)`);
    
    return {
      content,
      provides_value: quality.value,
      not_spam: quality.not_spam,
      confidence: generated.confidence || 0.85,
      generator_used: generatorName,
      visualFormat: generated.visualFormat || null
    };
    
  } catch (error: any) {
    console.error(`[REPLY_ADAPTER] ❌ ${generatorName} failed:`, error.message);
    throw error; // Let caller handle fallback
  }
}

/**
 * Build reply-specific topic that signals to generator this is a response
 */
function buildReplyTopic(target: ReplyTarget): string {
  // Build a topic string that makes it OBVIOUS this is a reply
  const replyPrefix = `Respond to @${target.username}'s tweet`;
  const tweetContent = target.tweet_content.substring(0, 200); // Limit length
  const angleHint = target.reply_angle ? ` (${target.reply_angle})` : '';
  
  return `${replyPrefix}: "${tweetContent}"${angleHint}`;
}

/**
 * Validate that reply provides real value
 */
function validateReplyQuality(reply: string, original: string): {
  value: boolean;
  not_spam: boolean;
  score: number;
} {
  let score = 0;
  
  // Check for specific numbers/research/data
  const hasSpecifics = /\d+%|\d+ (study|research|people|hours|years)|research|study|data/i.test(reply);
  if (hasSpecifics) score += 0.4;
  
  // Check for substantive content (not just generic praise)
  const hasSubstance = reply.length > 80 && !/^(great|nice|awesome|interesting|love this|amazing)$/i.test(reply);
  if (hasSubstance) score += 0.3;
  
  // Check NOT spam
  const notSpam = !/check out|click here|follow me|my content|dm me|link in bio/i.test(reply);
  if (notSpam) score += 0.3;
  
  return {
    value: score >= 0.5,
    not_spam: notSpam,
    score: Math.min(1.0, score)
  };
}

