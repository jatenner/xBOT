/**
 * 🧠 SIMPLE CONTENT SELECTOR
 * 
 * Lightweight intelligence system that improves content quality without complex dependencies:
 * 1. Generates multiple content variants using simple templates
 * 2. Scores each variant for quality and engagement potential
 * 3. Only posts the highest-scoring content
 * 4. Works with basic OpenAI client - no complex dependencies
 */

interface ContentCandidate {
  content: string;
  score: number;
  reasoning: string;
}

interface SelectionResult {
  should_post: boolean;
  content?: string;
  score?: number;
  reasoning?: string;
  alternatives_considered: number;
}

export class SimpleContentSelector {
  private static instance: SimpleContentSelector;
  private openai: any = null;

  private static readonly MIN_POSTING_SCORE = 65; // Only post if 65/100+
  private static readonly CANDIDATE_COUNT = 3;    // Generate 3 candidates

  constructor() {}

  static getInstance(): SimpleContentSelector {
    if (!SimpleContentSelector.instance) {
      SimpleContentSelector.instance = new SimpleContentSelector();
    }
    return SimpleContentSelector.instance;
  }

  /**
   * 🔧 INITIALIZE OPENAI CLIENT
   */
  private async initializeOpenAI(): Promise<void> {
    if (!this.openai) {
      try {
        const { OpenAI } = await import('openai');
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        console.log('✅ OpenAI client initialized for content selection');
      } catch (error) {
        console.error('❌ Failed to initialize OpenAI client:', error);
        throw error;
      }
    }
  }

  /**
   * 🎯 MAIN SELECTION FUNCTION
   */
  async selectBestContent(request: {
    topic?: string;
    style?: string;
    content_type?: 'single' | 'thread' | 'auto';
  } = {}): Promise<SelectionResult> {
    console.log('🧠 === SIMPLE CONTENT SELECTION ===');

    try {
      await this.initializeOpenAI();

      // Generate multiple candidates
      const candidates = await this.generateCandidates(request);
      console.log(`🎨 Generated ${candidates.length} candidates`);

      if (candidates.length === 0) {
        return {
          should_post: false,
          reasoning: 'No candidates generated',
          alternatives_considered: 0
        };
      }

      // Find best candidate
      const bestCandidate = candidates.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      console.log(`🏆 Best score: ${bestCandidate.score}/100`);
      console.log(`💭 Reasoning: ${bestCandidate.reasoning}`);

      const shouldPost = bestCandidate.score >= SimpleContentSelector.MIN_POSTING_SCORE;

      if (shouldPost) {
        return {
          should_post: true,
          content: bestCandidate.content,
          score: bestCandidate.score,
          reasoning: bestCandidate.reasoning,
          alternatives_considered: candidates.length
        };
      } else {
        return {
          should_post: false,
          reasoning: `Quality too low: ${bestCandidate.score}/100 (need ${SimpleContentSelector.MIN_POSTING_SCORE}+)`,
          alternatives_considered: candidates.length
        };
      }

    } catch (error) {
      console.error('❌ Content selection failed:', error);
      return {
        should_post: false,
        reasoning: `Selection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        alternatives_considered: 0
      };
    }
  }

  /**
   * 🎨 GENERATE CONTENT CANDIDATES
   */
  private async generateCandidates(request: any): Promise<ContentCandidate[]> {
    const candidates: ContentCandidate[] = [];

    const prompts = [
      // Health tips variant 1
      `Create a viral health tweet that challenges common myths. Make it controversial but backed by science. Include specific actionable advice. Be direct and confident, no questions. 150-250 characters.`,
      
      // Health tips variant 2  
      `Write a surprising health fact that will make people stop scrolling. Include a specific tip or insight. Use "Most people don't know..." or "New research shows..." style. Be engaging and factual. 150-250 characters.`,
      
      // Health tips variant 3
      `Generate a health tweet that exposes industry lies or hidden truths. Be specific about what's wrong and what to do instead. Controversial but defendable. No engagement begging. 150-250 characters.`
    ];

    for (let i = 0; i < prompts.length; i++) {
      try {
        const content = await this.generateSingleCandidate(prompts[i]);
        if (content) {
          const score = await this.scoreContent(content);
          candidates.push({
            content,
            score,
            reasoning: `Variant ${i + 1}: ${this.getScoreReasoning(score)}`
          });
        }
      } catch (error) {
        console.warn(`Candidate ${i + 1} generation failed:`, error);
      }
    }

    return candidates;
  }

  /**
   * 📝 GENERATE SINGLE CANDIDATE
   */
  private async generateSingleCandidate(prompt: string): Promise<string | null> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.9
      });

      const content = response.choices[0]?.message?.content?.trim();
      return content || null;
    } catch (error) {
      console.warn('Single candidate generation failed:', error);
      return null;
    }
  }

  /**
   * 📊 SCORE CONTENT FOR QUALITY
   */
  private async scoreContent(content: string): Promise<number> {
    const prompt = `Score this Twitter content for viral potential and quality (0-100):

CONTENT: "${content}"

Rate based on:
1. Hook strength (grabs attention immediately)
2. Viral potential (would people share this?)
3. Content quality (clear, valuable, well-written)
4. Engagement potential (sparks discussion without begging)
5. Credibility (sounds authoritative and trustworthy)

Return ONLY a number 0-100:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.3
      });

      const scoreText = response.choices[0]?.message?.content?.trim();
      const score = parseInt(scoreText || '0');
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.warn('Content scoring failed, using heuristic score:', error);
      return this.getHeuristicScore(content);
    }
  }

  /**
   * 📏 HEURISTIC SCORING FALLBACK
   */
  private getHeuristicScore(content: string): number {
    let score = 50; // Base score

    // Length check
    if (content.length >= 100 && content.length <= 250) score += 10;
    
    // Hook indicators
    if (content.match(/(Most people|New study|Hidden truth|Industry secret|Doctors won't tell)/i)) score += 15;
    
    // Specific advice
    if (content.match(/(Instead|Try|Avoid|Replace|Stop)/i)) score += 10;
    
    // Controversy balance
    if (content.match(/(However|But|Actually|Truth is)/i)) score += 8;
    
    // Avoid engagement begging
    if (content.match(/(What do you think|Comment below|Share if|Let me know)/i)) score -= 20;
    
    // Question ending penalty (unless it's rhetorical)
    if (content.endsWith('?') && content.length < 150) score -= 10;
    
    // Multiple sentences bonus
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length >= 2 && sentences.length <= 4) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 💭 GET SCORE REASONING
   */
  private getScoreReasoning(score: number): string {
    if (score >= 80) return 'Excellent viral potential';
    if (score >= 70) return 'Good engagement quality';
    if (score >= 60) return 'Decent content quality';
    if (score >= 50) return 'Average performance expected';
    return 'Below quality threshold';
  }
}