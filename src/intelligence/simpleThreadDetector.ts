/**
 * 🧵 SIMPLE THREAD DETECTOR
 * 
 * Lightweight thread detection and structuring without complex dependencies:
 * 1. Analyzes content to determine if it should be a thread
 * 2. Creates proper thread structure with engaging hooks
 * 3. Uses simple heuristics + basic AI analysis
 */

interface ThreadAnalysis {
  isThread: boolean;
  confidence: number;
  reasoning: string;
  suggestedStructure?: string[];
}

export class SimpleThreadDetector {
  private static instance: SimpleThreadDetector;
  private openai: any = null;

  constructor() {}

  static getInstance(): SimpleThreadDetector {
    if (!SimpleThreadDetector.instance) {
      SimpleThreadDetector.instance = new SimpleThreadDetector();
    }
    return SimpleThreadDetector.instance;
  }

  /**
   * 🔧 INITIALIZE OPENAI CLIENT
   */
  private async initializeOpenAI(): Promise<void> {
    if (!this.openai) {
      try {
        const { OpenAI } = await import('openai');
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        console.log('✅ OpenAI client initialized for thread detection');
      } catch (error) {
        console.warn('⚠️ OpenAI not available, using heuristic detection only');
        this.openai = null;
      }
    }
  }

  /**
   * 🕵️ ANALYZE CONTENT FOR THREAD STRUCTURE
   */
  async analyzeContent(content: string): Promise<ThreadAnalysis> {
    console.log('🧵 Analyzing content for thread structure...');

    try {
      await this.initializeOpenAI();

      // Quick heuristic check first
      const heuristicResult = this.getHeuristicAnalysis(content);
      
      // If OpenAI available and heuristic is uncertain, get AI analysis
      if (this.openai && heuristicResult.confidence < 80) {
        const aiResult = await this.getAIAnalysis(content);
        return this.combineAnalysis(heuristicResult, aiResult);
      }

      return heuristicResult;

    } catch (error) {
      console.warn('Thread analysis failed, using basic heuristics:', error);
      return this.getHeuristicAnalysis(content);
    }
  }

  /**
   * ⚡ HEURISTIC THREAD ANALYSIS
   */
  private getHeuristicAnalysis(content: string): ThreadAnalysis {
    let threadScore = 0;
    let singleScore = 0;
    const reasons: string[] = [];

    // Length analysis
    if (content.length > 350) {
      threadScore += 3;
      reasons.push('Long content suggests thread');
    } else if (content.length < 200) {
      singleScore += 3;
      reasons.push('Short content suggests single tweet');
    }

    // Explicit thread indicators
    if (content.match(/(\d+[\.\)\/]\s|here\s+are\s+\d+|thread|🧵)/i)) {
      threadScore += 5;
      reasons.push('Explicit thread indicators found');
    }

    // List-like content
    if (content.match(/(\d+\s+(ways|tips|reasons|steps|myths))/i)) {
      threadScore += 4;
      reasons.push('List-based content pattern');
    }

    // Multiple distinct points
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);
    if (sentences.length > 4) {
      threadScore += 3;
      reasons.push(`${sentences.length} distinct points suggest thread`);
    } else if (sentences.length <= 2) {
      singleScore += 2;
      reasons.push('Few sentences suggest single tweet');
    }

    // Question format (usually single)
    if (content.match(/^[^.!]*\?[^.!]*$/m) && content.length < 250) {
      singleScore += 3;
      reasons.push('Question format suggests single tweet');
    }

    // Sequential language
    if (content.match(/(first.*second|step.*then|next.*finally)/i)) {
      threadScore += 3;
      reasons.push('Sequential language suggests thread');
    }

    const isThread = threadScore > singleScore;
    const totalScore = threadScore + singleScore;
    const confidence = totalScore > 0 ? Math.abs(threadScore - singleScore) / totalScore * 100 : 50;

    let suggestedStructure: string[] | undefined;
    if (isThread) {
      suggestedStructure = this.createSimpleThreadStructure(content);
    }

    return {
      isThread,
      confidence: Math.round(confidence),
      reasoning: reasons.join(', ') || 'Basic analysis',
      suggestedStructure
    };
  }

  /**
   * 🤖 AI THREAD ANALYSIS
   */
  private async getAIAnalysis(content: string): Promise<ThreadAnalysis> {
    const prompt = `Analyze if this content should be a Twitter thread or single tweet:

CONTENT: "${content}"

Consider:
- Complexity of ideas
- Natural breakpoints  
- Whether splitting improves readability
- Engagement potential

Reply with JSON:
{
  "isThread": boolean,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      });

      const responseText = response.choices[0]?.message?.content || '{}';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isThread: Boolean(result.isThread),
          confidence: Math.max(0, Math.min(100, result.confidence || 50)),
          reasoning: result.reasoning || 'AI analysis',
          suggestedStructure: result.isThread ? this.createSimpleThreadStructure(content) : undefined
        };
      }
    } catch (error) {
      console.warn('AI analysis failed:', error);
    }

    // Fallback to heuristic
    return this.getHeuristicAnalysis(content);
  }

  /**
   * 🔄 COMBINE HEURISTIC AND AI ANALYSIS
   */
  private combineAnalysis(heuristic: ThreadAnalysis, ai: ThreadAnalysis): ThreadAnalysis {
    // Weight AI more heavily if it's confident
    const aiWeight = ai.confidence > 70 ? 0.7 : 0.4;
    const heuristicWeight = 1 - aiWeight;

    const combinedConfidence = (heuristic.confidence * heuristicWeight) + (ai.confidence * aiWeight);
    
    // Choose thread if either analysis strongly suggests it
    const isThread = (heuristic.isThread && heuristic.confidence > 60) || 
                     (ai.isThread && ai.confidence > 70) ||
                     (heuristic.isThread && ai.isThread);

    return {
      isThread,
      confidence: Math.round(combinedConfidence),
      reasoning: `Heuristic: ${heuristic.reasoning}; AI: ${ai.reasoning}`,
      suggestedStructure: isThread ? this.createSimpleThreadStructure('') : undefined
    };
  }

  /**
   * 🔨 CREATE SIMPLE THREAD STRUCTURE
   */
  private createSimpleThreadStructure(content: string): string[] {
    if (!content || content.length < 100) {
      return ['Thread content needs structuring'];
    }

    // Simple sentence-based splitting
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const tweets: string[] = [];
    let currentTweet = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      const potentialTweet = currentTweet ? `${currentTweet}. ${trimmedSentence}` : trimmedSentence;

      if (potentialTweet.length <= 250) {
        currentTweet = potentialTweet;
      } else {
        if (currentTweet) {
          tweets.push(currentTweet.trim());
        }
        currentTweet = trimmedSentence;
      }
    }

    if (currentTweet) {
      tweets.push(currentTweet.trim());
    }

    // Add thread numbering if multiple tweets
    if (tweets.length > 1) {
      return tweets.map((tweet, i) => `${i + 1}/${tweets.length} ${tweet}`);
    }

    return tweets;
  }
}