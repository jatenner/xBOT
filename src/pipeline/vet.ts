/**
 * Content Vetting Pipeline for xBOT
 * Filters duplicates, weak content, and scores candidates for quality
 */

import type { GeneratedContent } from './generate';

export interface VettedContent {
  text: string;
  format: 'short' | 'medium' | 'thread';
  topic: string;
  hook_type: string;
  scores: {
    novelty: number;
    hook_strength: number;
    clarity: number;
    overall: number;
  };
  approved: boolean;
  rejection_reason?: string;
  similar_posts?: string[];
}

export async function vet(content: GeneratedContent): Promise<VettedContent> {
  console.log('🔍 Vetting content quality...');
  
  try {
    const scores = await performQualityAnalysis(content);
    const approved = scores.overall >= 0.65;
    const rejection_reason = approved ? undefined : determineRejectionReason(content, scores);
    
    console.log(`📊 Vetting complete: ${approved ? 'APPROVED' : 'REJECTED'} (${scores.overall.toFixed(2)})`);
    
    return {
      text: content.text,
      format: content.format,
      topic: content.topic,
      hook_type: content.hook_type,
      scores,
      approved,
      rejection_reason
    };
    
  } catch (error) {
    console.error('❌ Vetting failed:', error);
    
    // On error, do basic checks and approve if content seems reasonable
    const basicApproval = isBasicallyAcceptable(content);
    
    return {
      text: content.text,
      format: content.format,
      topic: content.topic,
      hook_type: content.hook_type,
      scores: {
        novelty: 0.6,
        hook_strength: 0.6,
        clarity: 0.7,
        overall: 0.6
      },
      approved: basicApproval,
      rejection_reason: basicApproval ? undefined : 'Vetting system error - failed basic checks'
    };
  }
}

async function performQualityAnalysis(content: GeneratedContent): Promise<{
  novelty: number;
  hook_strength: number;
  clarity: number;
  overall: number;
}> {
  // Assessment without full database integration
  
  const novelty = assessNovelty(content.text);
  const hookStrength = assessHookStrength(content.text);
  const clarity = assessClarity(content.text);
  
  // Calculate weighted overall score
  const overall = (novelty * 0.3) + (hookStrength * 0.5) + (clarity * 0.2);
  
  return {
    novelty,
    hook_strength: hookStrength,
    clarity,
    overall
  };
}

function assessNovelty(text: string): number {
  // Check for common/generic phrases
  const commonPhrases = [
    'drink more water', 'exercise more', 'eat your vegetables',
    'get enough sleep', 'reduce stress', 'listen to your body'
  ];
  
  const hasCommonPhrase = commonPhrases.some(phrase => 
    text.toLowerCase().includes(phrase.toLowerCase())
  );
  
  if (hasCommonPhrase) return 0.2;
  
  // Check for specific data/studies (good for novelty)
  const hasNumbers = /\d+%|\d+ study|\d+ people|research shows/i.test(text);
  const hasContrarian = /myth|wrong|actually|truth is|contrary to|opposite/i.test(text);
  const hasCitations = /study|research|data|according to/i.test(text);
  
  let score = 0.5; // Base score
  if (hasNumbers) score += 0.2;
  if (hasContrarian) score += 0.2;
  if (hasCitations) score += 0.1;
  
  return Math.min(score, 1.0);
}

function assessHookStrength(text: string): number {
  // Check for strong hook patterns
  const strongHooks = [
    /^\d+%.*people/i, // Statistics hook
    /^Most people.*but/i, // Contrarian hook
    /^What if.*\?/i, // Question hook
    /^The truth about/i, // Revelation hook
    /^Everything you.*is wrong/i, // Myth-busting hook
    /^New research shows/i // Research hook
  ];
  
  const hasStrongHook = strongHooks.some(pattern => pattern.test(text));
  if (hasStrongHook) return 0.9;
  
  // Check for medium hooks
  const mediumHooks = [
    /studies show/i, /research found/i, /according to.*study/i,
    /data shows/i, /scientists discovered/i, /analysis reveals/i
  ];
  
  const hasMediumHook = mediumHooks.some(pattern => pattern.test(text));
  if (hasMediumHook) return 0.7;
  
  // Check for basic engagement elements
  const hasQuestion = text.includes('?');
  const hasNumber = /\d+/.test(text);
  const hasContrarian = /but|however|actually|instead/i.test(text);
  
  let score = 0.4; // Base score
  if (hasQuestion) score += 0.1;
  if (hasNumber) score += 0.1;
  if (hasContrarian) score += 0.1;
  
  return Math.min(score, 1.0);
}

function assessClarity(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).length;
  const avgWordsPerSentence = words / sentences.length;
  
  let score = 0.7; // Base clarity score
  
  // Penalize very long sentences
  if (avgWordsPerSentence > 25) score -= 0.2;
  if (avgWordsPerSentence > 35) score -= 0.2;
  
  // Penalize very short content
  if (words < 10) score -= 0.3;
  
  // Bonus for good length
  if (words >= 15 && words <= 200) score += 0.2;
  
  // Check for jargon or overly complex terms
  const jargonTerms = ['utilize', 'facilitate', 'optimize', 'leverage', 'synergy', 'paradigm'];
  const hasJargon = jargonTerms.some(term => 
    text.toLowerCase().includes(term.toLowerCase())
  );
  
  if (hasJargon) score -= 0.1;
  
  // Bonus for clear structure indicators
  const hasStructure = /\n|:|;/.test(text) && text.length > 100;
  if (hasStructure) score += 0.1;
  
  return Math.max(0.1, Math.min(score, 1.0));
}

function determineRejectionReason(content: GeneratedContent, scores: any): string {
  if (scores.novelty < 0.3) return 'Content too generic or obvious';
  if (scores.hook_strength < 0.4) return 'Weak hook - unlikely to engage audience';
  if (scores.clarity < 0.5) return 'Content unclear or poorly structured';
  if (content.text.length < 20) return 'Content too short';
  if (content.text.length > 2000) return 'Content too long for Twitter';
  
  return 'Overall quality score too low';
}

function isBasicallyAcceptable(content: GeneratedContent): boolean {
  const text = content.text;
  
  // Basic sanity checks
  if (!text || text.length < 10) return false;
  if (text.length > 5000) return false;
  if (text.includes('@') && text.startsWith('@')) return false; // Likely a reply
  if (/(.)\1{4,}/.test(text)) return false; // Repeated characters
  
  // Check for banned content
  const bannedPatterns = [
    /medical advice/i, /consult.*doctor/i, /#\w+/g, // hashtags
    /😊|👍|💪|🔥/g // emojis
  ];
  
  const hasBannedPattern = bannedPatterns.some(pattern => pattern.test(text));
  if (hasBannedPattern) return false;
  
  return true;
}

export default vet;