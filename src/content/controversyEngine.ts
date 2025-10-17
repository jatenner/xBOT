/**
 * 🔥 CONTROVERSY ENGINE
 * Generates controversial, engaging content at different intensity levels
 * CRITICAL: NO first-person language (I, me, my). Third-person stories ONLY.
 */

import { OpenAIService } from '../ai/openAIService';

export interface ControversialContent {
  content: string[];
  controversyLevel: number;
  shockFactor: number;
  engagementPotential: number;
  topics: string[];
}

export class ControversyEngine {
  private static instance: ControversyEngine;
  private openai: OpenAIService;

  private constructor() {
    this.openai = OpenAIService.getInstance();
  }

  public static getInstance(): ControversyEngine {
    if (!ControversyEngine.instance) {
      ControversyEngine.instance = new ControversyEngine();
    }
    return ControversyEngine.instance;
  }

  /**
   * Generate controversial content at specified level
   * Level 1-10:
   * 1-3: Safe, conventional wisdom
   * 4-6: Mildly contrarian, debate-worthy
   * 7-8: Controversial, challenges mainstream
   * 9-10: Provocative, polarizing
   */
  public async generateControversialContent(
    baseTopic: string,
    controversyLevel: number
  ): Promise<ControversialContent> {
    try {
      const prompt = this.buildControversyPrompt(baseTopic, controversyLevel);
      
      const response = await this.openai.generateChatCompletion([
        {
          role: 'system',
          content: this.getSystemPrompt(controversyLevel)
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: controversyLevel >= 7 ? 0.9 : 0.7,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content || '';
      const tweets = this.splitIntoTweets(content);

      return {
        content: tweets,
        controversyLevel,
        shockFactor: this.calculateShockFactor(tweets.join(' ')),
        engagementPotential: controversyLevel * 10,
        topics: [baseTopic]
      };

    } catch (error: any) {
      console.error(`[CONTROVERSY] ❌ Generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Build prompt based on controversy level
   */
  private buildControversyPrompt(topic: string, level: number): string {
    const levelDescriptions = {
      low: 'Present conventional health wisdom with evidence. Be informative.',
      moderate: 'Take a mildly contrarian position. Question common assumptions.',
      high: 'Challenge mainstream medical opinion. Present controversial research findings.',
      extreme: 'Expose industry secrets. Take a provocative stance that makes people rethink everything.'
    };

    let levelDesc = levelDescriptions.low;
    if (level >= 9) levelDesc = levelDescriptions.extreme;
    else if (level >= 7) levelDesc = levelDescriptions.high;
    else if (level >= 4) levelDesc = levelDescriptions.moderate;

    return `Topic: ${topic}

Create engaging health content about this topic.

Controversy level: ${level}/10 - ${levelDesc}

Requirements:
1. NEVER use first-person (no "I", "me", "my", "I've", "my friend")
2. Tell stories about OTHER PEOPLE (doctors, patients, researchers)
3. Use third-person: "A Stanford researcher found...", "Patients who...", "Studies show..."
4. Include specific, verifiable data and statistics
5. Make it interesting and debate-worthy
6. 280 characters or less (single tweet) OR break into thread if needed

Examples:
Level 3: "New research from Johns Hopkins: Vitamin D deficiency affects 40% of Americans, yet only 8% supplement. Simple blood test can detect it."

Level 7: "A Mayo Clinic cardiologist quit prescribing statins after reviewing 15 years of patient data. What she found contradicts mainstream guidelines."

Level 9: "FDA approved Vioxx despite internal memos showing cardiac risks. 60,000 people died. Researchers who raised concerns were silenced. Full story:"

Generate compelling health content at level ${level}:`;
  }

  /**
   * Get system prompt based on controversy level
   */
  private getSystemPrompt(level: number): string {
    const basePrompt = `You are a health content creator known for evidence-based, engaging posts. 

CRITICAL RULES:
- NEVER use first-person language (I, me, my, I've, my friend, personally)
- ALWAYS use third-person (researchers, doctors, patients, studies, experts)
- Tell TRUE stories about other people, not yourself
- Be specific with names, institutions, data
- Make content engaging and shareable`;

    if (level >= 7) {
      return basePrompt + `
- Take CONTROVERSIAL positions backed by research
- Challenge mainstream medical advice
- Expose industry practices
- Make readers question what they've been told
- Be provocative but fact-based`;
    } else if (level >= 4) {
      return basePrompt + `
- Present contrarian viewpoints
- Question common assumptions
- Highlight lesser-known research
- Make readers think differently`;
    } else {
      return basePrompt + `
- Present evidence-based health information
- Focus on interesting facts and data
- Be informative and helpful`;
    }
  }

  /**
   * Add shock factor to content
   * Makes it more attention-grabbing
   */
  public addShockFactor(content: string): string {
    const shockPhrases = [
      "Here's what they don't tell you:",
      "The data is shocking:",
      "Most doctors don't know this:",
      "This changes everything:",
      "Industry insiders revealed:",
      "Hidden in the research:",
      "A whistleblower exposed:",
      "The truth finally came out:"
    ];

    const randomPhrase = shockPhrases[Math.floor(Math.random() * shockPhrases.length)];
    
    // Add to beginning if not already attention-grabbing
    if (!content.toLowerCase().includes('shocking') && 
        !content.toLowerCase().includes('secret') &&
        !content.toLowerCase().includes('truth')) {
      return `${randomPhrase} ${content}`;
    }

    return content;
  }

  /**
   * Validate that content meets controversy target
   * Returns score 0-10
   */
  public validateControversy(content: string, targetLevel: number): number {
    const controversialKeywords = {
      mild: ['question', 'debate', 'alternative', 'consider', 'might'],
      moderate: ['controversial', 'challenge', 'mainstream', 'hidden', 'secret'],
      high: ['scam', 'lie', 'exposed', 'fraud', 'cover-up', 'industry', 'profit']
    };

    let score = 0;

    // Check for controversial keywords
    const lowerContent = content.toLowerCase();
    
    controversialKeywords.mild.forEach(word => {
      if (lowerContent.includes(word)) score += 1;
    });
    
    controversialKeywords.moderate.forEach(word => {
      if (lowerContent.includes(word)) score += 2;
    });
    
    controversialKeywords.high.forEach(word => {
      if (lowerContent.includes(word)) score += 3;
    });

    // Check for data/statistics (makes controversy more credible)
    const hasNumbers = /\d+%|\d+\s+(people|patients|deaths|cases)/i.test(content);
    if (hasNumbers) score += 2;

    // Check for institutional references (adds authority)
    const hasInstitution = /(FDA|CDC|NIH|Mayo|Hopkins|Harvard|Stanford)/i.test(content);
    if (hasInstitution) score += 2;

    // Normalize to 0-10
    return Math.min(10, score);
  }

  /**
   * Calculate shock factor of content
   */
  private calculateShockFactor(content: string): number {
    let factor = 0;

    // High-impact words
    const highImpact = ['scam', 'fraud', 'lie', 'exposed', 'secret', 'hidden', 'banned', 'censored'];
    highImpact.forEach(word => {
      if (content.toLowerCase().includes(word)) factor += 15;
    });

    // Numbers and statistics
    if (/\d+,?\d*\s+(died|deaths|killed)/i.test(content)) factor += 20;
    if (/\$\d+[MBK]/i.test(content)) factor += 10; // Money amounts

    // Questions that make you think
    if (content.includes('?')) factor += 5;
    if (/why .+ (won't|don't|can't)/i.test(content)) factor += 10;

    return Math.min(100, factor);
  }

  /**
   * Split content into tweet-sized chunks
   */
  private splitIntoTweets(content: string): string[] {
    const lines = content.split('\n').filter(line => line.trim());
    const tweets: string[] = [];

    for (const line of lines) {
      if (line.length <= 280) {
        tweets.push(line.trim());
      } else {
        // Split long line into multiple tweets
        const words = line.split(' ');
        let currentTweet = '';
        
        for (const word of words) {
          if ((currentTweet + ' ' + word).length <= 280) {
            currentTweet += (currentTweet ? ' ' : '') + word;
          } else {
            if (currentTweet) tweets.push(currentTweet.trim());
            currentTweet = word;
          }
        }
        
        if (currentTweet) tweets.push(currentTweet.trim());
      }
    }

    return tweets.length > 0 ? tweets : [content.substring(0, 280)];
  }

  /**
   * Ensure content has NO first-person language
   */
  public validateThirdPerson(content: string): { valid: boolean; violations: string[] } {
    const firstPersonPatterns = [
      /\bI\b/gi,
      /\bme\b/gi,
      /\bmy\b/gi,
      /\bI'm\b/gi,
      /\bI've\b/gi,
      /\bI'll\b/gi,
      /\bmine\b/gi,
      /\bmyself\b/gi,
      /\bmy friend\b/gi,
      /\bpersonally\b/gi
    ];

    const violations: string[] = [];

    for (const pattern of firstPersonPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push(...matches);
      }
    }

    return {
      valid: violations.length === 0,
      violations: [...new Set(violations)] // Remove duplicates
    };
  }
}

/**
 * Convenience function
 */
export async function generateControversialContent(
  topic: string,
  level: number
): Promise<ControversialContent> {
  return ControversyEngine.getInstance().generateControversialContent(topic, level);
}

