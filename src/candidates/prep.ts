/**
 * 🔧 CANDIDATE PREPARATION
 * 
 * PURPOSE: Normalize, score by recency, and deduplicate candidates
 * STRATEGY: Redis-based deduplication with SHA256 hashing
 */

import { createHash } from 'crypto';
import { ContentCandidate } from './sources';

export interface PreparedCandidate extends ContentCandidate {
  normalizedText: string;
  recencyScore: number;
  isDuplicate: boolean;
  duplicateOf?: string;
  preparationTimestamp: Date;
}

export interface PrepConfig {
  maxLength: number;
  minLength: number;
  recencyWindow: number; // hours
  freshnessDecay: number; // 0-1 per hour
}

/**
 * Content normalizer and deduplicator
 */
export class CandidatePreprocessor {
  private config: PrepConfig;

  constructor(config: PrepConfig = {
    maxLength: 280,
    minLength: 10,
    recencyWindow: 24,
    freshnessDecay: 0.95
  }) {
    this.config = config;
  }

  /**
   * Normalize text content for consistent processing
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s#@.,!?]/g, '')
      .trim();
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(normalizedText: string): string {
    return createHash('sha256')
      .update(normalizedText)
      .digest('hex')
      .substring(0, 16); // Shortened for Redis keys
  }

  /**
   * Calculate recency score based on freshness and time decay
   */
  private calculateRecencyScore(candidate: ContentCandidate): number {
    // Base freshness from source
    let score = candidate.freshness;

    // Apply time decay (newer content scores higher)
    const hoursAgo = 0; // Would be calculated from content timestamp in real implementation
    score *= Math.pow(this.config.freshnessDecay, hoursAgo);

    // Boost based on priority
    score *= (1 + candidate.priority / 1000);

    return Math.min(score, 1.0);
  }

  /**
   * Validate candidate meets basic requirements
   */
  private validateCandidate(candidate: ContentCandidate): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (candidate.text.length < this.config.minLength) {
      reasons.push(`Too short: ${candidate.text.length} < ${this.config.minLength}`);
    }

    if (candidate.text.length > this.config.maxLength) {
      reasons.push(`Too long: ${candidate.text.length} > ${this.config.maxLength}`);
    }

    // Check for hashtag limits
    const hashtagCount = (candidate.text.match(/#\w+/g) || []).length + candidate.tags.length;
    if (hashtagCount > 3) {
      reasons.push(`Too many hashtags: ${hashtagCount} > 3`);
    }

    // Basic profanity check
    const profanityWords = ['spam', 'scam', 'fake', 'virus'];
    const hasProfileanity = profanityWords.some(word => 
      candidate.text.toLowerCase().includes(word)
    );
    if (hasProfileanity) {
      reasons.push('Contains flagged words');
    }

    return {
      valid: reasons.length === 0,
      reasons
    };
  }

  /**
   * Prepare a single candidate
   */
  async prepareCandidate(candidate: ContentCandidate, duplicateHashes: Set<string>): Promise<PreparedCandidate> {
    const normalizedText = this.normalizeText(candidate.text);
    const contentHash = this.generateContentHash(normalizedText);
    const recencyScore = this.calculateRecencyScore(candidate);
    const isDuplicate = duplicateHashes.has(contentHash);

    return {
      ...candidate,
      normalizedText,
      recencyScore,
      isDuplicate,
      duplicateOf: isDuplicate ? contentHash : undefined,
      preparationTimestamp: new Date(),
      hash: contentHash // Override with shorter hash
    };
  }

  /**
   * Prepare multiple candidates with deduplication
   */
  async prepareCandidates(candidates: ContentCandidate[]): Promise<PreparedCandidate[]> {
    console.log(`🔧 Preparing ${candidates.length} candidates...`);
    
    const prepared: PreparedCandidate[] = [];
    const seenHashes = new Set<string>();
    const invalidCandidates: { candidate: ContentCandidate; reasons: string[] }[] = [];

    for (const candidate of candidates) {
      // Validate candidate
      const validation = this.validateCandidate(candidate);
      if (!validation.valid) {
        invalidCandidates.push({ candidate, reasons: validation.reasons });
        continue;
      }

      // Prepare candidate
      const preparedCandidate = await this.prepareCandidate(candidate, seenHashes);

      // Track hash for deduplication
      seenHashes.add(preparedCandidate.hash);

      prepared.push(preparedCandidate);
    }

    // Log results
    console.log(`✅ Prepared: ${prepared.length} valid candidates`);
    console.log(`❌ Invalid: ${invalidCandidates.length} candidates`);
    
    if (invalidCandidates.length > 0) {
      console.log('Invalid candidates:');
      invalidCandidates.forEach(({ candidate, reasons }, index) => {
        console.log(`  ${index + 1}. "${candidate.text.substring(0, 50)}..." - ${reasons.join(', ')}`);
      });
    }

    const duplicates = prepared.filter(c => c.isDuplicate);
    if (duplicates.length > 0) {
      console.log(`🔄 Duplicates found: ${duplicates.length}`);
    }

    // Sort by combined score (recency + priority)
    return prepared.sort((a, b) => {
      const scoreA = a.recencyScore * (1 + a.priority / 100);
      const scoreB = b.recencyScore * (1 + b.priority / 100);
      return scoreB - scoreA;
    });
  }

  /**
   * Get preparation statistics
   */
  getPreparationStats(prepared: PreparedCandidate[]): {
    total: number;
    duplicates: number;
    bySource: Record<string, number>;
    byTopic: Record<string, number>;
    avgRecencyScore: number;
    topSources: string[];
  } {
    const bySource: Record<string, number> = {};
    const byTopic: Record<string, number> = {};
    let totalRecencyScore = 0;

    for (const candidate of prepared) {
      bySource[candidate.source] = (bySource[candidate.source] || 0) + 1;
      byTopic[candidate.topic] = (byTopic[candidate.topic] || 0) + 1;
      totalRecencyScore += candidate.recencyScore;
    }

    const duplicates = prepared.filter(c => c.isDuplicate).length;
    const avgRecencyScore = prepared.length > 0 ? totalRecencyScore / prepared.length : 0;
    
    const topSources = Object.entries(bySource)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([source]) => source);

    return {
      total: prepared.length,
      duplicates,
      bySource,
      byTopic,
      avgRecencyScore,
      topSources
    };
  }
}

/**
 * Utility functions for candidate preparation
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches ? matches.map(tag => tag.toLowerCase()) : [];
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@\w+/g);
  return matches ? matches.map(mention => mention.toLowerCase()) : [];
}

export function estimateEngagementPotential(candidate: PreparedCandidate): number {
  let score = candidate.recencyScore;

  // Boost for trending topics
  if (candidate.topic.includes('fps') || candidate.topic.includes('battle_royale')) {
    score *= 1.2;
  }

  // Boost for media content
  if (candidate.mediaHint === 'clip') {
    score *= 1.5;
  } else if (candidate.mediaHint === 'image') {
    score *= 1.2;
  }

  // Boost for optimal length (140-200 chars)
  const textLength = candidate.text.length;
  if (textLength >= 140 && textLength <= 200) {
    score *= 1.1;
  }

  // Boost for questions and controversial takes
  if (candidate.text.includes('?') || candidate.text.toLowerCase().includes('hot take')) {
    score *= 1.3;
  }

  return Math.min(score, 1.0);
}