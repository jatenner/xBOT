/**
 * Quality Gate for xBOT
 * Blocks weak content from being posted
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { ContentScores } from '../ai/content/scoring';
import { QUALITY_STANDARDS } from '../ai/content/policies';
import OpenAI from 'openai';

export interface QualityGateResult {
  approved: boolean;
  blockReasons: string[];
  confidence: number;
  metadata: {
    duplicateCheck: boolean;
    qualityScores: ContentScores;
    similarityScore?: number;
  };
}

export interface ContentCandidate {
  content: string;
  tweets?: string[];
  format: 'single' | 'thread';
  topic: string;
  scores: ContentScores;
}

export class QualityGate {
  private supabase: any;
  private redis: Redis;
  private openai: OpenAI;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Evaluate content against quality gates
   */
  async evaluateContent(candidate: ContentCandidate): Promise<QualityGateResult> {
    console.log(`🚪 QUALITY_GATE: Evaluating ${candidate.format} content for topic "${candidate.topic}"`);
    
    const blockReasons: string[] = [];
    let confidence = 1.0;

    // Gate 1: Quality Score Thresholds
    const qualityBlocks = this.checkQualityThresholds(candidate.scores);
    blockReasons.push(...qualityBlocks);

    // Gate 2: Duplicate/Near-Duplicate Check
    const duplicateResult = await this.checkDuplicates(candidate);
    if (!duplicateResult.passed) {
      blockReasons.push(duplicateResult.reason);
    }

    // Gate 3: Content Safety and Policy Check
    const safetyBlocks = await this.checkContentSafety(candidate);
    blockReasons.push(...safetyBlocks);

    // Calculate confidence based on how close scores are to thresholds
    confidence = this.calculateConfidence(candidate.scores, blockReasons.length === 0);

    const approved = blockReasons.length === 0;

    // Log rejection if blocked
    if (!approved) {
      await this.logRejection(candidate, blockReasons);
    }

    console.log(`${approved ? '✅' : '❌'} QUALITY_GATE: ${approved ? 'APPROVED' : 'BLOCKED'} - ${blockReasons.length} issues`);
    
    if (!approved) {
      console.log(`📋 Block reasons: ${blockReasons.join(', ')}`);
    }

    return {
      approved,
      blockReasons,
      confidence,
      metadata: {
        duplicateCheck: duplicateResult.passed,
        qualityScores: candidate.scores,
        similarityScore: duplicateResult.similarityScore
      }
    };
  }

  /**
   * Check quality score thresholds
   */
  private checkQualityThresholds(scores: ContentScores): string[] {
    const blocks: string[] = [];

    if (scores.hookScore < QUALITY_STANDARDS.hookScore.minimum) {
      blocks.push(`Hook score too low: ${scores.hookScore.toFixed(2)} < ${QUALITY_STANDARDS.hookScore.minimum}`);
    }

    if (scores.clarityScore < QUALITY_STANDARDS.clarityScore.minimum) {
      blocks.push(`Clarity score too low: ${scores.clarityScore.toFixed(2)} < ${QUALITY_STANDARDS.clarityScore.minimum}`);
    }

    if (scores.noveltyScore < QUALITY_STANDARDS.noveltyScore.minimum) {
      blocks.push(`Novelty score too low: ${scores.noveltyScore.toFixed(2)} < ${QUALITY_STANDARDS.noveltyScore.minimum}`);
    }

    if (scores.structureScore < QUALITY_STANDARDS.structureScore.minimum) {
      blocks.push(`Structure score too low: ${scores.structureScore.toFixed(2)} < ${QUALITY_STANDARDS.structureScore.minimum}`);
    }

    return blocks;
  }

  /**
   * Check for duplicates and near-duplicates
   */
  private async checkDuplicates(candidate: ContentCandidate): Promise<{
    passed: boolean;
    reason: string;
    similarityScore?: number;
  }> {
    try {
      // Get recent posts from last 72 hours
      const cutoffTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      
      const { data: recentPosts } = await this.supabase
        .from('posts')
        .select('text, content')
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!recentPosts || recentPosts.length === 0) {
        return { passed: true, reason: '' };
      }

      const candidateText = candidate.content.toLowerCase();

      // Check for exact matches
      for (const post of recentPosts) {
        const postText = (post.text || post.content || '').toLowerCase();
        
        if (postText === candidateText) {
          return { 
            passed: false, 
            reason: 'Exact duplicate detected',
            similarityScore: 1.0
          };
        }
      }

      // Check for near-duplicates using embeddings
      const nearDuplicateResult = await this.checkNearDuplicatesWithEmbeddings(
        candidate.content,
        recentPosts.map(p => p.text || p.content || '')
      );

      if (!nearDuplicateResult.passed) {
        return nearDuplicateResult;
      }

      // Simple similarity check as fallback
      const maxSimilarity = this.calculateMaxSimpleSimilarity(candidateText, recentPosts);
      
      if (maxSimilarity > 0.8) {
        return {
          passed: false,
          reason: `High similarity detected: ${(maxSimilarity * 100).toFixed(1)}%`,
          similarityScore: maxSimilarity
        };
      }

      return { passed: true, reason: '' };

    } catch (error) {
      console.warn('⚠️ Duplicate check failed, allowing content:', error);
      return { passed: true, reason: 'Duplicate check failed, allowing' };
    }
  }

  /**
   * Check near-duplicates using OpenAI embeddings
   */
  private async checkNearDuplicatesWithEmbeddings(
    candidateText: string,
    recentTexts: string[]
  ): Promise<{ passed: boolean; reason: string; similarityScore?: number }> {
    
    try {
      // Generate embedding for candidate
      const candidateResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: candidateText
      });

      const candidateEmbedding = candidateResponse.data[0].embedding;

      // Check similarity against recent posts (sample to avoid rate limits)
      const sampleTexts = recentTexts.slice(0, 10); // Check last 10 posts
      
      for (const text of sampleTexts) {
        if (!text || text.length < 10) continue;

        const textResponse = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text
        });

        const textEmbedding = textResponse.data[0].embedding;
        const similarity = this.cosineSimilarity(candidateEmbedding, textEmbedding);

        if (similarity > 0.85) {
          return {
            passed: false,
            reason: `Near-duplicate detected: ${(similarity * 100).toFixed(1)}% similarity`,
            similarityScore: similarity
          };
        }
      }

      return { passed: true, reason: '' };

    } catch (error) {
      console.warn('⚠️ Embedding similarity check failed:', error);
      return { passed: true, reason: 'Embedding check failed, allowing' };
    }
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate simple text similarity as fallback
   */
  private calculateMaxSimpleSimilarity(candidateText: string, recentPosts: any[]): number {
    let maxSimilarity = 0;

    for (const post of recentPosts) {
      const postText = (post.text || post.content || '').toLowerCase();
      
      if (postText.length < 10) continue;

      const similarity = this.simpleSimilarity(candidateText, postText);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Simple Jaccard similarity for text
   */
  private simpleSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Check content safety and policy compliance
   */
  private async checkContentSafety(candidate: ContentCandidate): Promise<string[]> {
    const blocks: string[] = [];
    const content = candidate.content.toLowerCase();

    // Check for banned phrases/topics
    const bannedPhrases = [
      'medical advice', 'diagnose', 'cure', 'treatment', 'prescription',
      'guaranteed results', 'miracle cure', 'breakthrough cure',
      'lose weight fast', 'detox', 'cleanse', 'toxins'
    ];

    for (const phrase of bannedPhrases) {
      if (content.includes(phrase.toLowerCase())) {
        blocks.push(`Contains banned phrase: "${phrase}"`);
      }
    }

    // Check for first-person violations (should be caught earlier but double-check)
    const firstPersonViolations = [
      'i tried', 'my experience', 'worked for me', 'my journey',
      'i found', 'i discovered', 'my results', 'personally'
    ];

    for (const violation of firstPersonViolations) {
      if (content.includes(violation)) {
        blocks.push(`Contains first-person language: "${violation}"`);
      }
    }

    // Check for vague claims
    const vagueClaims = [
      'amazing results', 'crazy difference', 'game changer',
      'who knew', 'turns out', 'you won\'t believe'
    ];

    for (const claim of vagueClaims) {
      if (content.includes(claim)) {
        blocks.push(`Contains vague claim: "${claim}"`);
      }
    }

    return blocks;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(scores: ContentScores, approved: boolean): number {
    if (!approved) {
      return 0.1; // Low confidence for rejected content
    }

    // Calculate how far above minimum thresholds the scores are
    const hookMargin = (scores.hookScore - QUALITY_STANDARDS.hookScore.minimum) / QUALITY_STANDARDS.hookScore.minimum;
    const clarityMargin = (scores.clarityScore - QUALITY_STANDARDS.clarityScore.minimum) / QUALITY_STANDARDS.clarityScore.minimum;
    const noveltyMargin = (scores.noveltyScore - QUALITY_STANDARDS.noveltyScore.minimum) / QUALITY_STANDARDS.noveltyScore.minimum;
    const structureMargin = (scores.structureScore - QUALITY_STANDARDS.structureScore.minimum) / QUALITY_STANDARDS.structureScore.minimum;

    const avgMargin = (hookMargin + clarityMargin + noveltyMargin + structureMargin) / 4;
    
    // Convert to confidence (0.5 = at threshold, 1.0 = perfect scores)
    return Math.min(1.0, 0.5 + avgMargin * 0.5);
  }

  /**
   * Log rejection for review and analysis
   */
  private async logRejection(candidate: ContentCandidate, reasons: string[]): Promise<void> {
    try {
      await this.supabase.from('rejected_posts').insert({
        content: candidate.content,
        tweets: candidate.tweets,
        format: candidate.format,
        topic: candidate.topic,
        scores: candidate.scores,
        rejection_reasons: reasons,
        rejected_at: new Date().toISOString()
      });

      console.log(`📝 REJECTION_LOGGED: Stored for review`);
    } catch (error) {
      console.warn('⚠️ Could not log rejection:', error);
    }
  }

  /**
   * Get quality gate statistics
   */
  async getGateStats(): Promise<{
    totalEvaluated: number;
    approvalRate: number;
    commonBlockReasons: string[];
    avgConfidence: number;
  }> {
    try {
      // This would query Supabase for rejection statistics
      // Mock implementation for now
      return {
        totalEvaluated: 0,
        approvalRate: 0.85,
        commonBlockReasons: ['Hook score too low', 'Near-duplicate detected'],
        avgConfidence: 0.78
      };
    } catch (error) {
      return {
        totalEvaluated: 0,
        approvalRate: 0,
        commonBlockReasons: [],
        avgConfidence: 0
      };
    }
  }
}

export default QualityGate;
