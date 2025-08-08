/**
 * 🧠 CONTENT SELECTION ENGINE
 * 
 * Master intelligence system that:
 * 1. Generates multiple content candidates
 * 2. Scores each candidate for viral potential
 * 3. Only posts the highest-scoring content
 * 4. Learns from performance to improve future selections
 */

import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';

// Import existing generators
import { ViralFollowerGrowthMaster } from '../agents/viralFollowerGrowthMaster';
import { IntelligentTweetGenerator } from '../agents/intelligentTweetGenerator';
import { EnhancedContentGenerator } from '../agents/enhancedContentGenerator';
import { DiverseContentAgent } from '../agents/diverseContentAgent';

interface ContentCandidate {
  content: string | string[];
  content_type: 'single_tweet' | 'thread';
  generator: string;
  raw_content: string;
  metadata?: any;
}

interface ContentScore {
  candidate: ContentCandidate;
  total_score: number;
  breakdown: {
    viral_potential: number;     // 0-25 points
    engagement_hooks: number;    // 0-20 points  
    content_quality: number;     // 0-20 points
    thread_structure: number;    // 0-15 points
    uniqueness: number;          // 0-10 points
    controversy_balance: number; // 0-10 points
  };
  predicted_engagement: number;
  confidence: number;
  reasoning: string;
}

interface PostingDecision {
  should_post: boolean;
  selected_candidate?: ContentCandidate;
  score?: ContentScore;
  rejection_reason?: string;
  alternatives_considered: number;
}

export class ContentSelectionEngine {
  private static instance: ContentSelectionEngine;
  private openai: BudgetAwareOpenAI;
  private supabase: SecureSupabaseClient;
  
  // Quality thresholds
  private static readonly MIN_POSTING_SCORE = 65; // Only post if 65/100+
  private static readonly TARGET_SCORE = 80;      // Aim for 80/100+
  private static readonly CANDIDATE_COUNT = 5;    // Generate 5 candidates per posting opportunity

  constructor() {
    this.openai = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
    this.supabase = new SecureSupabaseClient();
  }

  static getInstance(): ContentSelectionEngine {
    if (!ContentSelectionEngine.instance) {
      ContentSelectionEngine.instance = new ContentSelectionEngine();
    }
    return ContentSelectionEngine.instance;
  }

  /**
   * 🎯 MAIN SELECTION FUNCTION
   * Generate multiple candidates, score them, and select the best
   */
  async selectBestContent(request: {
    content_type?: 'single_tweet' | 'thread' | 'auto';
    topic?: string;
    style_preference?: string;
    time_of_day?: string;
  } = {}): Promise<PostingDecision> {
    console.log('🧠 === INTELLIGENT CONTENT SELECTION ===');
    console.log(`📋 Request: ${JSON.stringify(request)}`);

    try {
      // Step 1: Generate multiple candidates from different generators
      const candidates = await this.generateCandidates(request);
      console.log(`🎨 Generated ${candidates.length} content candidates`);

      if (candidates.length === 0) {
        return {
          should_post: false,
          rejection_reason: 'No candidates generated',
          alternatives_considered: 0
        };
      }

      // Step 2: Score each candidate
      const scoredCandidates = await this.scoreCandidates(candidates);
      console.log('📊 Scoring complete');

      // Step 3: Select best candidate
      const bestCandidate = scoredCandidates.reduce((best, current) => 
        current.total_score > best.total_score ? current : best
      );

      console.log(`🏆 Best candidate: ${bestCandidate.total_score}/100 (${bestCandidate.candidate.generator})`);
      console.log(`💡 Reasoning: ${bestCandidate.reasoning}`);

      // Step 4: Make posting decision
      const shouldPost = bestCandidate.total_score >= ContentSelectionEngine.MIN_POSTING_SCORE;

      if (shouldPost) {
        // Log successful selection for learning
        await this.logSuccessfulSelection(bestCandidate, scoredCandidates);
        
        return {
          should_post: true,
          selected_candidate: bestCandidate.candidate,
          score: bestCandidate,
          alternatives_considered: candidates.length
        };
      } else {
        console.log(`🚫 Content rejected: Score ${bestCandidate.total_score} below threshold ${ContentSelectionEngine.MIN_POSTING_SCORE}`);
        
        return {
          should_post: false,
          rejection_reason: `Quality too low: ${bestCandidate.total_score}/100 (need ${ContentSelectionEngine.MIN_POSTING_SCORE}+)`,
          alternatives_considered: candidates.length
        };
      }

    } catch (error) {
      console.error('❌ Content selection failed:', error);
      return {
        should_post: false,
        rejection_reason: `Selection engine error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        alternatives_considered: 0
      };
    }
  }

  /**
   * 🎨 GENERATE MULTIPLE CONTENT CANDIDATES
   */
  private async generateCandidates(request: any): Promise<ContentCandidate[]> {
    const candidates: ContentCandidate[] = [];
    
    try {
      // Get instances of existing generators
      const viralMaster = ViralFollowerGrowthMaster.getInstance();
      const intelligentGenerator = IntelligentTweetGenerator.getInstance();
      const enhancedGenerator = new EnhancedContentGenerator();
      const diverseAgent = new DiverseContentAgent();

      // Generate from each source (parallel for speed)
      const generationPromises = [
        // Viral content generator (usually high engagement)
        this.generateFromViral(viralMaster, request),
        
        // Intelligent generator (learning-based)
        this.generateFromIntelligent(intelligentGenerator, request),
        
        // Enhanced generator (format-optimized)
        this.generateFromEnhanced(enhancedGenerator, request),
        
        // Diverse agent (template variety)
        this.generateFromDiverse(diverseAgent, request),
        
        // Additional viral attempt with different parameters
        this.generateFromViral(viralMaster, { ...request, force_controversial: true })
      ];

      const results = await Promise.allSettled(generationPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          candidates.push(result.value);
        } else {
          console.warn(`Generator ${index} failed:`, result.status === 'rejected' ? result.reason : 'Unknown error');
        }
      });

      return candidates;

    } catch (error) {
      console.error('❌ Candidate generation failed:', error);
      return [];
    }
  }

  /**
   * 📊 SCORE ALL CANDIDATES FOR QUALITY AND VIRAL POTENTIAL
   */
  private async scoreCandidates(candidates: ContentCandidate[]): Promise<ContentScore[]> {
    const scoringPromises = candidates.map(candidate => this.scoreCandidate(candidate));
    const scores = await Promise.allSettled(scoringPromises);
    
    return scores
      .filter((result): result is PromiseFulfilledResult<ContentScore> => result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * 🎯 SCORE INDIVIDUAL CANDIDATE
   */
  private async scoreCandidate(candidate: ContentCandidate): Promise<ContentScore> {
    const content = Array.isArray(candidate.content) ? candidate.content.join(' ') : candidate.content;
    
    // AI-powered scoring
    const aiScore = await this.getAIQualityScore(candidate);
    
    // Heuristic scoring
    const heuristicScores = this.calculateHeuristicScores(candidate);
    
    // Combine scores
    const breakdown = {
      viral_potential: Math.min(25, Math.round(aiScore.viral_potential * 0.25 + heuristicScores.viral_potential)),
      engagement_hooks: Math.min(20, Math.round(aiScore.engagement_hooks * 0.2 + heuristicScores.engagement_hooks)),
      content_quality: Math.min(20, Math.round(aiScore.content_quality * 0.2 + heuristicScores.content_quality)),
      thread_structure: Math.min(15, heuristicScores.thread_structure),
      uniqueness: Math.min(10, heuristicScores.uniqueness),
      controversy_balance: Math.min(10, Math.round(aiScore.controversy_balance * 0.1 + heuristicScores.controversy_balance))
    };

    const total_score = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    
    return {
      candidate,
      total_score,
      breakdown,
      predicted_engagement: this.predictEngagement(candidate, total_score),
      confidence: this.calculateConfidence(breakdown),
      reasoning: this.generateScoreReasoning(breakdown, candidate)
    };
  }

  /**
   * 🤖 AI-POWERED QUALITY SCORING
   */
  private async getAIQualityScore(candidate: ContentCandidate): Promise<{
    viral_potential: number;
    engagement_hooks: number;
    content_quality: number;
    controversy_balance: number;
  }> {
    const content = Array.isArray(candidate.content) ? candidate.content.join('\n') : candidate.content;
    
    const prompt = `Analyze this Twitter content for viral potential and quality. Score each dimension 0-100:

CONTENT TO ANALYZE:
"${content}"

SCORING CRITERIA:

🔥 VIRAL POTENTIAL (0-100):
- Hook strength (first 10 words grab attention?)
- Shareability (would people repost this?)
- Emotional impact (surprise, anger, joy, curiosity?)
- Timing relevance (trending topics, current events?)

🪝 ENGAGEMENT HOOKS (0-100):
- Question that sparks debate (not "What do you think?")
- Controversial but defendable statement
- Surprising fact or myth-busting
- Personal story or specific example
- Clear call-to-action or takeaway

📝 CONTENT QUALITY (0-100):
- Clear, concise writing
- Specific vs vague statements
- Value provided to reader
- Professional tone
- Grammar and formatting

⚖️ CONTROVERSY BALANCE (0-100):
- Sparks healthy debate without offending
- Challenges common beliefs thoughtfully
- Backed by logic or evidence
- Avoids polarizing politics/religion

Return ONLY a JSON object:
{
  "viral_potential": 0-100,
  "engagement_hooks": 0-100,
  "content_quality": 0-100,
  "controversy_balance": 0-100
}`;

    try {
      const response = await this.openai.createChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini',
        maxTokens: 200,
        temperature: 0.3,
        priority: 'medium',
        operationType: 'content_scoring'
      });

      const jsonMatch = (response.response as any).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]);
        return {
          viral_potential: Math.max(0, Math.min(100, scores.viral_potential || 0)),
          engagement_hooks: Math.max(0, Math.min(100, scores.engagement_hooks || 0)),
          content_quality: Math.max(0, Math.min(100, scores.content_quality || 0)),
          controversy_balance: Math.max(0, Math.min(100, scores.controversy_balance || 0))
        };
      }
      
      throw new Error('Invalid AI response format');
      
    } catch (error) {
      console.warn('⚠️ AI scoring failed, using fallback:', error);
      return {
        viral_potential: 50,
        engagement_hooks: 50,
        content_quality: 50,
        controversy_balance: 50
      };
    }
  }

  /**
   * 📏 HEURISTIC SCORING BASED ON PATTERNS
   */
  private calculateHeuristicScores(candidate: ContentCandidate): {
    viral_potential: number;
    engagement_hooks: number;
    content_quality: number;
    thread_structure: number;
    uniqueness: number;
    controversy_balance: number;
  } {
    const content = Array.isArray(candidate.content) ? candidate.content.join(' ') : candidate.content;
    const isThread = candidate.content_type === 'thread';
    
    let scores = {
      viral_potential: 0,
      engagement_hooks: 0,
      content_quality: 0,
      thread_structure: 0,
      uniqueness: 0,
      controversy_balance: 0
    };

    // Viral potential heuristics
    if (content.includes('Most people don\'t know') || content.includes('99% of')) scores.viral_potential += 5;
    if (content.includes('shocking') || content.includes('surprising')) scores.viral_potential += 3;
    if (content.match(/\d+%/)) scores.viral_potential += 2;
    if (content.includes('study shows') || content.includes('research found')) scores.viral_potential += 3;
    
    // Engagement hooks (avoid questions)
    if (content.includes('?') && !content.match(/(what do you think|comment below|let me know)/i)) scores.engagement_hooks += 5;
    if (content.match(/(myth|truth|secret|hidden|won't tell you)/i)) scores.engagement_hooks += 7;
    if (content.match(/(here's why|the real reason|actually)/i)) scores.engagement_hooks += 5;
    if (content.match(/(what do you think|comment below|share if)/i)) scores.engagement_hooks -= 10; // Penalty for engagement begging
    
    // Content quality
    const wordCount = content.split(/\s+/).length;
    if (wordCount >= 15 && wordCount <= 50) scores.content_quality += 8; // Optimal length
    if (content.length <= 280 && !isThread) scores.content_quality += 5; // Proper tweet length
    if (content.match(/^[A-Z]/)) scores.content_quality += 2; // Proper capitalization
    if (!content.match(/(.)\1{2,}/)) scores.content_quality += 3; // No repeated characters
    
    // Thread structure (only for threads)
    if (isThread && Array.isArray(candidate.content)) {
      const tweets = candidate.content;
      if (tweets.length >= 2 && tweets.length <= 6) scores.thread_structure += 10;
      if (tweets.every(tweet => tweet.length <= 280)) scores.thread_structure += 5;
      if (tweets[0].match(/(thread|here's)/i)) scores.thread_structure += 3;
    } else if (!isThread) {
      scores.thread_structure = 15; // Max points for single tweets
    }
    
    // Uniqueness (basic check against common phrases)
    const commonPhrases = ['what do you think', 'comment below', 'share if you agree'];
    const hasCommonPhrase = commonPhrases.some(phrase => content.toLowerCase().includes(phrase));
    scores.uniqueness = hasCommonPhrase ? 2 : 8;
    
    // Controversy balance
    if (content.match(/(however|but|actually|truth is)/i)) scores.controversy_balance += 5;
    if (content.match(/(most doctors|industry doesn't want|won't tell you)/i)) scores.controversy_balance += 3;
    if (content.match(/(nazi|hitler|trump|biden|abortion|gun)/i)) scores.controversy_balance -= 5; // Avoid toxic topics
    
    return scores;
  }

  /**
   * 📈 PREDICT ENGAGEMENT BASED ON SCORE
   */
  private predictEngagement(candidate: ContentCandidate, totalScore: number): number {
    // Base engagement prediction on total score
    const baseRate = Math.max(0, (totalScore - 40) / 60); // 0-1 based on score above 40
    
    // Adjust for content type
    const typeMultiplier = candidate.content_type === 'thread' ? 1.2 : 1.0;
    
    // Adjust for generator (viral generator typically performs better)
    const generatorMultiplier = candidate.generator === 'viral' ? 1.3 : 1.0;
    
    return Math.min(100, baseRate * typeMultiplier * generatorMultiplier * 100);
  }

  /**
   * 🎯 CALCULATE CONFIDENCE IN PREDICTION
   */
  private calculateConfidence(breakdown: any): number {
    const scores = Object.values(breakdown) as number[];
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    
    // Higher confidence if scores are consistent and high
    return Math.max(0, Math.min(100, 100 - variance + (avg / 2)));
  }

  /**
   * 💭 GENERATE REASONING FOR SCORE
   */
  private generateScoreReasoning(breakdown: any, candidate: ContentCandidate): string {
    const reasons = [];
    
    if (breakdown.viral_potential >= 20) reasons.push('Strong viral potential');
    if (breakdown.engagement_hooks >= 15) reasons.push('Good engagement hooks');
    if (breakdown.content_quality >= 15) reasons.push('High content quality');
    if (breakdown.thread_structure >= 12) reasons.push('Well-structured format');
    if (breakdown.uniqueness >= 7) reasons.push('Unique content');
    if (breakdown.controversy_balance >= 7) reasons.push('Balanced controversy');
    
    if (breakdown.viral_potential < 10) reasons.push('Weak viral potential');
    if (breakdown.engagement_hooks < 8) reasons.push('Poor engagement hooks');
    if (breakdown.content_quality < 10) reasons.push('Quality issues');
    
    return reasons.join(', ') || 'Mixed performance across criteria';
  }

  // Generator helper methods
  private async generateFromViral(generator: any, request: any): Promise<ContentCandidate | null> {
    try {
      const result = await generator.generateViralContent({ ...request });
      return {
        content: result.content,
        content_type: result.content_type,
        generator: 'viral',
        raw_content: result.raw_content,
        metadata: result
      };
    } catch (error) {
      console.warn('Viral generator failed:', error);
      return null;
    }
  }

  private async generateFromIntelligent(generator: any, request: any): Promise<ContentCandidate | null> {
    try {
      const result = await generator.generateIntelligentTweet(request);
      return {
        content: result.content,
        content_type: Array.isArray(result.content) ? 'thread' : 'single_tweet',
        generator: 'intelligent',
        raw_content: Array.isArray(result.content) ? result.content.join('\n') : result.content,
        metadata: result
      };
    } catch (error) {
      console.warn('Intelligent generator failed:', error);
      return null;
    }
  }

  private async generateFromEnhanced(generator: any, request: any): Promise<ContentCandidate | null> {
    try {
      const result = await generator.generatePost(request.topic);
      return {
        content: result.content,
        content_type: Array.isArray(result.content) ? 'thread' : 'single_tweet',
        generator: 'enhanced',
        raw_content: Array.isArray(result.content) ? result.content.join('\n') : result.content,
        metadata: result
      };
    } catch (error) {
      console.warn('Enhanced generator failed:', error);
      return null;
    }
  }

  private async generateFromDiverse(generator: any, request: any): Promise<ContentCandidate | null> {
    try {
      const result = await generator.generateDiverseContent();
      if (result.success) {
        return {
          content: result.content,
          content_type: 'single_tweet',
          generator: 'diverse',
          raw_content: result.content,
          metadata: result
        };
      }
      return null;
    } catch (error) {
      console.warn('Diverse generator failed:', error);
      return null;
    }
  }

  /**
   * 📊 LOG SUCCESSFUL SELECTION FOR LEARNING
   */
  private async logSuccessfulSelection(selected: ContentScore, allCandidates: ContentScore[]): Promise<void> {
    try {
      const logData = {
        selected_generator: selected.candidate.generator,
        selected_score: selected.total_score,
        alternatives_count: allCandidates.length,
        score_breakdown: selected.breakdown,
        predicted_engagement: selected.predicted_engagement,
        confidence: selected.confidence,
        reasoning: selected.reasoning,
        timestamp: new Date().toISOString()
      };

      // Store in database for learning
      await this.supabase.supabase
        .from('content_selection_log')
        .insert(logData);

      console.log('📊 Selection logged for learning');
    } catch (error) {
      console.warn('⚠️ Failed to log selection:', error);
    }
  }
}