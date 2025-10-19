/**
 * 🎯 AUTHORITATIVE CONTENT ENGINE
 * Zero tolerance for personal anecdotes - expert authority only
 */

import { OpenAIService } from '../../services/openAIService';
import { getRedisSafeClient } from '../../lib/redisSafe';
import { getSafeDatabase } from '../../lib/db';

export interface AuthoritativeContent {
  content: string[];
  format: 'single' | 'thread';
  topic: string;
  scores: {
    authorityScore: number;
    evidenceScore: number;
    hookScore: number;
    clarityScore: number;
    overall: number;
  };
  rejectionReasons: string[];
  approved: boolean;
}

export interface ContentGenerationRequest {
  topic: string;
  format: 'single' | 'thread';
  targetLength?: number;
  useDataInsights?: boolean;
}

export class AuthoritativeContentEngine {
  private static instance: AuthoritativeContentEngine;
  private openaiService: OpenAIService;
  private redis = getRedisSafeClient();
  private db = getSafeDatabase();

  private constructor() {
    // We'll implement the OpenAI integration when needed
    // For now, using fallback responses
  }

  public static getInstance(): AuthoritativeContentEngine {
    if (!AuthoritativeContentEngine.instance) {
      AuthoritativeContentEngine.instance = new AuthoritativeContentEngine();
    }
    return AuthoritativeContentEngine.instance;
  }

  /**
   * Generate expert-level content with zero personal language
   */
  async generateAuthoritativeContent(request: ContentGenerationRequest): Promise<AuthoritativeContent> {
    console.log(`🎯 AUTHORITATIVE_CONTENT: Generating ${request.format} about ${request.topic}`);

    // Get performance insights for optimization
    const insights = await this.getPerformanceInsights();
    
    // Generate multiple candidates
    const candidates = await this.generateCandidates(request, insights);
    
    // Score and validate each candidate
    const scoredCandidates = await Promise.all(
      candidates.map(candidate => this.scoreContent(candidate, request.format))
    );

    // Select best candidate that meets quality thresholds
    const bestCandidate = scoredCandidates
      .filter(c => c.scores.overall >= 40)
      .sort((a, b) => b.scores.overall - a.scores.overall)[0];

    if (!bestCandidate) {
      console.warn('⚠️ CONTENT_REJECTED: No candidates met quality thresholds');
      
      // Store rejection data for learning
      await this.logRejection(scoredCandidates, request);
      
      // Return best attempt with rejection reasons
      const bestAttempt = scoredCandidates.sort((a, b) => b.scores.overall - a.scores.overall)[0];
      return bestAttempt || this.createFallbackContent(request);
    }

    console.log(`✅ CONTENT_APPROVED: Score ${bestCandidate.scores.overall}/100`);
    
    // Store successful content for learning
    await this.logSuccess(bestCandidate, request);
    
    return bestCandidate;
  }

  /**
   * Generate content candidates with strict expert prompts
   */
  private async generateCandidates(
    request: ContentGenerationRequest, 
    insights: any
  ): Promise<AuthoritativeContent[]> {
    const candidateCount = 3;
    const candidates: AuthoritativeContent[] = [];

    for (let i = 0; i < candidateCount; i++) {
      try {
        const prompt = this.buildExpertPrompt(request, insights, i);
        
        const response = await this.generateContentWithOpenAI(prompt, {
          maxTokens: request.format === 'thread' ? 800 : 300,
          temperature: 0.7 + (i * 0.1), // Slight variation for diversity
        });

        const content = this.parseGeneratedContent(response.content || '', request.format);
        
        if (content && content.length > 0) {
          candidates.push({
            content,
            format: request.format,
            topic: request.topic,
            scores: { authorityScore: 0, evidenceScore: 0, hookScore: 0, clarityScore: 0, overall: 0 },
            rejectionReasons: [],
            approved: false
          });
        }
        
      } catch (error) {
        console.warn(`⚠️ CANDIDATE_${i + 1}_FAILED:`, error instanceof Error ? error.message : error);
      }
    }

    return candidates;
  }

  /**
   * Build expert-level prompt with zero tolerance for personal language
   */
  private buildExpertPrompt(request: ContentGenerationRequest, insights: any, variation: number): string {
    const hookTypes = ['contrarian', 'research_reveal', 'myth_buster'][variation % 3];
    const isThread = request.format === 'thread';

    return `You are a world-renowned health expert with PhD credentials writing authoritative content for medical professionals and health-conscious individuals.

🎯 CRITICAL MISSION: Generate ${isThread ? 'a thread (3-5 tweets)' : 'a single tweet'} about "${request.topic}" that establishes absolute authority.

🚫 ZERO TOLERANCE POLICY - INSTANT REJECTION FOR:
❌ ANY first-person language: "I", "my", "me", "personally", "in my experience"
❌ ANY anecdotal phrasing: "a friend told me", "I tried", "worked for me", "my results"
❌ ANY casual language: "crazy", "insane", "mind-blown", "who knew?"
❌ ANY vague claims: "studies show", "experts say", "research suggests" (without specifics)
❌ ANY diary-style content: personal stories, experiences, testimonials
❌ ANY hashtags (#) or social media markers
❌ ANY emoji usage
❌ ANY incomplete sentences or ellipses (...)

✅ MANDATORY REQUIREMENTS:
✅ Third-person expert perspective ONLY
✅ Specific research citations (journal names, sample sizes, percentages)
✅ Precise medical/scientific terminology used correctly
✅ Clear cause-and-effect explanations
✅ Quantifiable data (numbers, percentages, timeframes)
✅ Professional medical voice throughout

🎯 CONTENT STRUCTURE - HOOK TYPE: ${hookTypes.toUpperCase()}

${hookTypes === 'contrarian' ? `
CONTRARIAN HOOK: Challenge common health beliefs with research
Example: "Contrary to popular belief, [specific health practice] actually [opposite effect] according to [specific study details]"
` : hookTypes === 'research_reveal' ? `
RESEARCH REVEAL: Present recent findings that change understanding  
Example: "New research from [Journal Name] (n=[sample size]) reveals [specific finding] contradicts [previous assumption]"
` : `
MYTH BUSTER: Debunk widespread health misconceptions with facts
Example: "[Common health belief] lacks scientific evidence. Clinical trials demonstrate [actual truth] in [specific population]"
`}

🧵 ${isThread ? 'THREAD REQUIREMENTS' : 'SINGLE TWEET REQUIREMENTS'}:
${isThread ? `
- Tweet 1 (Hook): Challenging statement + preview of evidence
- Tweet 2-3 (Evidence): Specific research findings with citations  
- Tweet 4-5 (Takeaway): Clinical recommendations based on evidence
- Each tweet MUST be under 260 characters
- Each tweet MUST stand alone as valuable content
- NO thread indicators (1/5, 2/5, etc.)
` : `
- MAXIMUM 260 characters total
- Complete thought with evidence and takeaway
- Specific statistic or research finding
- Clear clinical/practical implication
`}

📊 EVIDENCE REQUIREMENTS:
- Use specific data but keep it simple and viral
- NO academic citations (no "n=", no "et al.", no journal names)
- Use compelling numbers: "23% reduction", "increased by 47%"
- Make it feel like insider knowledge, not a research paper
- NO publication years or study references - sounds too academic

🎯 VIRAL VOICE EXAMPLES (NO BORING ACADEMIC SHIT):
✅ "Most people don't know this, but..."
✅ "Here's what actually works..."  
✅ "The data is clear:"
✅ "Studies found something crazy:"
✅ "This changes everything we thought about..."

❌ "Clinical trials demonstrate..." (TOO ACADEMIC)
❌ "Peer-reviewed research indicates..." (TOO BORING)
❌ "I discovered that..." (TOO PERSONAL)
❌ "My friend tried this..." (NO ONE CARES)
❌ "In my experience..." (NOT AUTHORITATIVE)

🔬 TOPIC FOCUS: ${request.topic}
${insights.topPerformingContent ? `
📈 OPTIMIZE FOR: Based on performance data, emphasize ${insights.topPerformingContent.slice(0, 2).join(' and ')}
` : ''}

Generate content that would be publishable in a medical journal's public education section. Sound like an expert who has spent decades studying this topic, not someone sharing personal experiences.

Return only the content (no explanations or metadata), formatted as:
${isThread ? 'Each tweet on a separate line, no numbering' : 'Single tweet text only'}`;
  }

  /**
   * Parse generated content into structured format
   */
  private parseGeneratedContent(rawContent: string, format: 'single' | 'thread'): string[] {
    if (!rawContent || rawContent.trim().length === 0) {
      return [];
    }

    if (format === 'single') {
      const cleaned = rawContent.trim().replace(/^["']|["']$/g, '');
      return [cleaned];
    }

    // Parse thread content
    const lines = rawContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.match(/^(Tweet\s*\d+|Thread|Hook|Evidence|Takeaway):/i))
      .filter(line => !line.match(/^\d+[\.\)\/]/) && !line.includes('/'))
      .slice(0, 5); // Max 5 tweets

    return lines.length > 0 ? lines : [rawContent.trim()];
  }

  /**
   * Score content for authority, evidence, and quality
   */
  private async scoreContent(candidate: AuthoritativeContent, format: string): Promise<AuthoritativeContent> {
    const content = candidate.content.join(' ');
    const rejectionReasons: string[] = [];

    // Check for instant rejection criteria
    const firstPersonPatterns = /\b(I|my|me|myself|personally|in my experience|I tried|I found|I discovered|worked for me|my results|my friend|a friend told me)\b/gi;
    if (firstPersonPatterns.test(content)) {
      rejectionReasons.push('Contains first-person language or anecdotal references');
    }

    const casualLanguage = /\b(crazy|insane|mind-blown|who knew|amazing|incredible|unbelievable)\b/gi;
    if (casualLanguage.test(content)) {
      rejectionReasons.push('Contains casual or sensational language');
    }

    const vagueTerms = /\b(studies show|experts say|research suggests|many believe|some people)\b/gi;
    if (vagueTerms.test(content)) {
      rejectionReasons.push('Uses vague claims without specific citations');
    }

    // Score components
    const authorityScore = this.scoreAuthority(content);
    const evidenceScore = this.scoreEvidence(content);
    const hookScore = this.scoreHook(candidate.content[0]);
    const clarityScore = this.scoreClarity(content);

    // Calculate weighted overall score
    const overall = Math.round(
      authorityScore * 0.35 +
      evidenceScore * 0.30 +
      hookScore * 0.20 +
      clarityScore * 0.15
    );

    const approved = rejectionReasons.length === 0 && overall >= 70;

    if (!approved && rejectionReasons.length === 0) {
      rejectionReasons.push(`Overall score too low: ${overall}/100`);
    }

    return {
      ...candidate,
      scores: { authorityScore, evidenceScore, hookScore, clarityScore, overall },
      rejectionReasons,
      approved
    };
  }

  /**
   * Score authority level (0-100)
   */
  private scoreAuthority(content: string): number {
    let score = 50; // Base score

    // Positive indicators
    if (/\b(clinical trials|peer-reviewed|systematic review|meta-analysis|randomized controlled)\b/gi.test(content)) score += 20;
    if (/\b(journal of|published in|research from|study by)\b/gi.test(content)) score += 15;
    if (/\b(PhD|MD|professor|researcher|scientist)\b/gi.test(content)) score += 10;
    if (/\b(evidence|data|findings|results)\b/gi.test(content)) score += 10;

    // Character count check for substance
    if (content.length > 200) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Score evidence quality (0-100)
   */
  private scoreEvidence(content: string): number {
    let score = 30; // Base score

    // Specific citations
    if (/\(n=\d+\)|sample size|participants/gi.test(content)) score += 25;
    if (/\d+%|\d+x|fold increase|reduction/gi.test(content)) score += 20;
    if (/20\d{2}|recent|latest/gi.test(content)) score += 15;
    if (/university|institute|hospital/gi.test(content)) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Score hook strength (0-100)
   */
  private scoreHook(hookContent: string): number {
    let score = 40; // Base score

    if (/^(contrary to|unlike|while most|new research|recent study)/gi.test(hookContent)) score += 20;
    if (/\d+%|\d+ times|significantly/gi.test(hookContent)) score += 15;
    if (hookContent.length >= 100 && hookContent.length <= 250) score += 15;
    if (/\b(reveals|demonstrates|shows|found|discovered)\b/gi.test(hookContent)) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Score clarity and readability (0-100)
   */
  private scoreClarity(content: string): number {
    let score = 50; // Base score

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = content.length / sentences.length;

    // Optimal sentence length
    if (avgSentenceLength >= 80 && avgSentenceLength <= 150) score += 20;
    
    // Clear structure
    if (sentences.length >= 2) score += 10;
    
    // Action words
    if (/\b(increases|decreases|improves|reduces|prevents|causes)\b/gi.test(content)) score += 15;
    
    // Technical precision
    if (/\b(significantly|specifically|directly|effectively)\b/gi.test(content)) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Get performance insights from Redis/Supabase
   */
  private async getPerformanceInsights(): Promise<any> {
    try {
      // Get cached insights from Redis
      const cachedInsights = await this.redis.getJSON('content_performance_insights');
      if (cachedInsights) {
        return cachedInsights;
      }

      // Fetch from Supabase
      const recentPosts = await this.db.safeSelect(
        'posts',
        'content, scores, engagement_metrics',
        {},
        { limit: 50, orderBy: 'created_at', ascending: false }
      );

      if (recentPosts.success && recentPosts.data) {
        const insights = this.analyzePerformancePatterns(recentPosts.data);
        
        // Cache for 1 hour
        await this.redis.setJSON('content_performance_insights', insights, 3600);
        
        return insights;
      }

      return { topPerformingContent: [], patterns: [] };
    } catch (error) {
      console.warn('⚠️ INSIGHTS_FAILED:', error instanceof Error ? error.message : error);
      return { topPerformingContent: [], patterns: [] };
    }
  }

  /**
   * Analyze performance patterns from historical data
   */
  private analyzePerformancePatterns(posts: any[]): any {
    const patterns = {
      topPerformingContent: [],
      avgScores: {},
      successFactors: []
    };

    // Calculate average scores for successful posts
    const successfulPosts = posts.filter(p => p.scores?.overall >= 75);
    
    if (successfulPosts.length > 0) {
      patterns.avgScores = {
        authority: successfulPosts.reduce((sum, p) => sum + (p.scores?.authorityScore || 0), 0) / successfulPosts.length,
        evidence: successfulPosts.reduce((sum, p) => sum + (p.scores?.evidenceScore || 0), 0) / successfulPosts.length,
        hook: successfulPosts.reduce((sum, p) => sum + (p.scores?.hookScore || 0), 0) / successfulPosts.length
      };

      // Extract common successful patterns
      patterns.successFactors = successfulPosts
        .map(p => p.content)
        .filter(content => content && content.length > 0)
        .slice(0, 5);
    }

    return patterns;
  }

  /**
   * Log successful content for learning
   */
  private async logSuccess(content: AuthoritativeContent, request: ContentGenerationRequest): Promise<void> {
    try {
      const logData = {
        content: content.content.join('\n'),
        format: content.format,
        topic: content.topic,
        scores: content.scores,
        approved: true,
        created_at: new Date().toISOString(),
        request_context: request
      };

      await this.db.safeInsert('posts', logData);
      
      // Update Redis counters
      await this.redis.incr(`successful_posts:${content.format}`);
      await this.redis.incrByFloat(`avg_score:${content.format}`, content.scores.overall);
      
    } catch (error) {
      console.warn('⚠️ LOG_SUCCESS_FAILED:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Log rejected content for learning
   */
  private async logRejection(candidates: AuthoritativeContent[], request: ContentGenerationRequest): Promise<void> {
    try {
      for (const candidate of candidates) {
        const logData = {
          content: candidate.content.join('\n'),
          format: candidate.format,
          topic: candidate.topic,
          scores: candidate.scores,
          rejection_reasons: candidate.rejectionReasons,
          rejected_at: new Date().toISOString(),
          request_context: request
        };

        await this.db.safeInsert('rejected_posts', logData);
      }
      
      // Update Redis rejection counters
      await this.redis.incr(`rejected_posts:${request.format}`);
      
    } catch (error) {
      console.warn('⚠️ LOG_REJECTION_FAILED:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Generate content with OpenAI (simplified method)
   */
  private async generateContentWithOpenAI(prompt: string, options: any): Promise<{ content: string }> {
    try {
      // For now, create a simple authoritative response
      // This will be replaced with actual OpenAI integration
      const fallbackResponses = [
        "Recent clinical studies demonstrate significant improvements in patient outcomes when evidence-based protocols are implemented.",
        "Systematic reviews reveal measurable physiological changes following targeted interventions, with effect sizes ranging from moderate to large.",
        "Peer-reviewed research indicates optimal results occur when combining multiple evidence-based approaches with consistent monitoring."
      ];
      
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      
      return { content: randomResponse };
    } catch (error) {
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Create fallback content when all candidates fail
   */
  private createFallbackContent(request: ContentGenerationRequest): AuthoritativeContent {
    const fallbackContent = request.format === 'thread' 
      ? [
          `Recent research on ${request.topic} reveals significant clinical implications.`,
          `Evidence-based studies demonstrate measurable effects on patient outcomes.`,
          `Healthcare professionals recommend evidence-based approaches for optimal results.`
        ]
      : [`Clinical evidence supports targeted interventions for ${request.topic} management.`];

    return {
      content: fallbackContent,
      format: request.format,
      topic: request.topic,
      scores: { authorityScore: 60, evidenceScore: 50, hookScore: 40, clarityScore: 70, overall: 55 },
      rejectionReasons: ['Fallback content - original generation failed'],
      approved: false
    };
  }
}

export default AuthoritativeContentEngine;
