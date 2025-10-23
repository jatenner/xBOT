/**
 * Content Vetting System for @SignalAndSynapse
 * Filters duplicates, weak content, and scores candidates for quality
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface VettingResult {
  approved: boolean;
  scores: {
    novelty: number;
    hook_strength: number;
    clarity: number;
    overall: number;
  };
  rejection_reason?: string;
  similar_posts?: string[];
}

export class ContentVetter {
  private openai: OpenAI;
  private supabase: any;
  private redis: Redis;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Comprehensive vetting of content candidates
   */
  async vetCandidate(candidateId: string): Promise<VettingResult> {
    // Get candidate from database
    const { data: candidate } = await this.supabase
      .from('content_candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }

    // Run all vetting checks
    const noveltyScore = await this.checkNovelty(candidate);
    const hookStrengthScore = await this.assessHookStrength(candidate.text);
    const clarityScore = await this.assessClarity(candidate.text);
    
    // Check for specific rejection criteria
    const rejectionCheck = await this.checkRejectionCriteria(candidate);
    
    if (rejectionCheck.rejected) {
      return {
        approved: false,
        scores: {
          novelty: noveltyScore,
          hook_strength: hookStrengthScore,
          clarity: clarityScore,
          overall: 0
        },
        rejection_reason: rejectionCheck.reason,
        similar_posts: rejectionCheck.similar_posts
      };
    }

    // Calculate weighted overall score
    const overallScore = this.calculateOverallScore(noveltyScore, hookStrengthScore, clarityScore);
    
    // Update candidate in database
    await this.updateCandidateScores(candidateId, {
      novelty_score: noveltyScore,
      hook_strength_score: hookStrengthScore,
      clarity_score: clarityScore,
      overall_score: overallScore
    });

    return {
      approved: overallScore >= 0.7, // Threshold for approval
      scores: {
        novelty: noveltyScore,
        hook_strength: hookStrengthScore,
        clarity: clarityScore,
        overall: overallScore
      }
    };
  }

  /**
   * Check novelty against recent posts using embeddings
   */
  private async checkNovelty(candidate: any): Promise<number> {
    try {
      if (!candidate.embeddings) {
        // Generate embeddings if not already present
        const embeddings = await this.getEmbedding(candidate.text);
        await this.supabase
          .from('content_candidates')
          .update({ embeddings })
          .eq('id', candidate.id);
        candidate.embeddings = embeddings;
      }

      // Get posts from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentPosts } = await this.supabase
        .from('posts')
        .select('embeddings, text')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('embeddings', 'is', null);

      if (!recentPosts?.length) {
        return 1.0; // High novelty if no recent posts to compare
      }

      // Find highest similarity
      let maxSimilarity = 0;
      for (const post of recentPosts) {
        if (post.embeddings) {
          const similarity = this.cosineSimilarity(candidate.embeddings, post.embeddings);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      // Convert similarity to novelty (inverse relationship)
      return Math.max(0, 1 - maxSimilarity);
    } catch (error) {
      console.error('Novelty check failed:', error);
      return 0.5; // Default score on error
    }
  }

  /**
   * Assess hook strength using AI
   */
  private async assessHookStrength(text: string): Promise<number> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `You are an expert at analyzing Twitter content for virality potential. 

Rate the hook strength of this health content on a scale of 0.0 to 1.0:

Strong hooks (0.8-1.0):
- Surprising statistics that contradict common beliefs
- Provocative questions that make people think
- Counter-intuitive claims backed by evidence
- Personal revelations that challenge norms

Weak hooks (0.0-0.4):
- Generic health tips everyone knows
- Obvious statements without surprise
- Vague claims without specifics
- Corporate wellness speak

Only respond with a decimal number between 0.0 and 1.0.`
        }, {
          role: 'user',
          content: `Rate this hook: "${text}"`
        }],
        temperature: 0.1,
        max_tokens: 10
      });

      const score = parseFloat(response.choices[0]?.message?.content?.trim() || '0.5');
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Hook strength assessment failed:', error);
      return 0.5;
    }
  }

  /**
   * Assess clarity and readability
   */
  private async assessClarity(text: string): Promise<number> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `Rate the clarity of this content on a scale of 0.0 to 1.0:

High clarity (0.8-1.0):
- Easy to understand on first read
- Clear logical flow
- Specific and concrete
- No jargon or unnecessary complexity

Low clarity (0.0-0.4):
- Confusing or ambiguous
- Too much jargon
- Poor structure
- Vague statements

Only respond with a decimal number between 0.0 and 1.0.`
        }, {
          role: 'user',
          content: `Rate this clarity: "${text}"`
        }],
        temperature: 0.1,
        max_tokens: 10
      });

      const score = parseFloat(response.choices[0]?.message?.content?.trim() || '0.5');
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Clarity assessment failed:', error);
      return 0.5;
    }
  }

  /**
   * Check for automatic rejection criteria
   */
  private async checkRejectionCriteria(candidate: any): Promise<{
    rejected: boolean;
    reason?: string;
    similar_posts?: string[];
  }> {
    const text = candidate.text.toLowerCase();

    // Check for banned phrases/patterns
    const bannedPatterns = [
      /remember to consult|consult your doctor/i,
      /not medical advice/i,
      /#\w+/g, // hashtags
      /😊|👍|💪|🔥/g, // emojis
      /drink more water/i,
      /exercise more/i,
      /eat your vegetables/i,
      /listen to your body/i
    ];

    for (const pattern of bannedPatterns) {
      if (pattern.test(text)) {
        return {
          rejected: true,
          reason: `Contains banned pattern: ${pattern.source}`
        };
      }
    }

    // Check for high similarity to recent posts (>0.9)
    if (candidate.embeddings) {
      const { data: recentPosts } = await this.supabase
        .from('posts')
        .select('text, embeddings')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .not('embeddings', 'is', null);

      const similarPosts = [];
      for (const post of recentPosts || []) {
        if (post.embeddings) {
          const similarity = this.cosineSimilarity(candidate.embeddings, post.embeddings);
          if (similarity > 0.9) {
            similarPosts.push(post.text);
          }
        }
      }

      if (similarPosts.length > 0) {
        return {
          rejected: true,
          reason: 'Too similar to recent posts',
          similar_posts: similarPosts
        };
      }
    }

    return { rejected: false };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverallScore(novelty: number, hookStrength: number, clarity: number): number {
    // Weights based on importance for engagement
    const weights = {
      novelty: 0.4,
      hookStrength: 0.4,
      clarity: 0.2
    };

    return (
      novelty * weights.novelty +
      hookStrength * weights.hookStrength +
      clarity * weights.clarity
    );
  }

  /**
   * Update candidate scores in database
   */
  private async updateCandidateScores(candidateId: string, scores: any): Promise<void> {
    await this.supabase
      .from('content_candidates')
      .update(scores)
      .eq('id', candidateId);
  }

  /**
   * Get top approved candidates for posting
   */
  async getTopCandidates(format?: string, limit: number = 5): Promise<any[]> {
    let query = this.supabase
      .from('content_candidates')
      .select('*')
      .eq('status', 'pending')
      .gte('overall_score', 0.7)
      .order('overall_score', { ascending: false })
      .limit(limit);

    if (format) {
      query = query.eq('format', format);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Mark candidate as approved for posting
   */
  async approveCandidateForPosting(candidateId: string): Promise<void> {
    await this.supabase
      .from('content_candidates')
      .update({ status: 'approved' })
      .eq('id', candidateId);
  }

  /**
   * Reject candidate with reason
   */
  async rejectCandidate(candidateId: string, reason: string): Promise<void> {
    await this.supabase
      .from('content_candidates')
      .update({ 
        status: 'rejected',
        rejected_reason: reason
      })
      .eq('id', candidateId);
  }

  /**
   * Bulk vet all pending candidates
   */
  async vetAllPendingCandidates(): Promise<void> {
    const { data: candidates } = await this.supabase
      .from('content_candidates')
      .select('id')
      .eq('status', 'pending');

    if (!candidates?.length) return;

    console.log(`Vetting ${candidates.length} candidates...`);

    for (const candidate of candidates) {
      try {
        const result = await this.vetCandidate(candidate.id);
        console.log(`Candidate ${candidate.id}: ${result.approved ? 'APPROVED' : 'REJECTED'} (${result.scores.overall.toFixed(2)})`);
        
        if (!result.approved && result.rejection_reason) {
          await this.rejectCandidate(candidate.id, result.rejection_reason);
        }
      } catch (error) {
        console.error(`Failed to vet candidate ${candidate.id}:`, error);
      }
    }
  }

  /**
   * Get OpenAI embeddings for text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
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
}

export default ContentVetter;
