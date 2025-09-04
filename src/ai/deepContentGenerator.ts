import OpenAI from 'openai';
import { ContentDiversityTracker } from '../content/diversityTracker';

/**
 * DEEP CONTENT GENERATOR - Creates detailed, specific, actionable content
 * 
 * Instead of generic "take magnesium" - generates specific products, brands, routines
 * Creates thread-worthy content with depth and actionable protocols
 */

export class DeepContentGenerator {
  private openai: OpenAI;
  private diversityTracker: ContentDiversityTracker;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.diversityTracker = ContentDiversityTracker.getInstance();
  }

  /**
   * Generate DEEP, SPECIFIC content with products, brands, and detailed protocols
   * Now with DIVERSITY TRACKING to avoid repetitive magnesium/sleep content
   */
  async generateDeepContent(topic: string, format: 'single' | 'thread' = 'single'): Promise<{
    content: string;
    threadParts?: string[];
    hasSpecificDetails: boolean;
    productMentions: string[];
    actionableSteps: string[];
  }> {
    console.log(`🧠 DEEP_CONTENT: Generating detailed ${format} content for "${topic}"`);

    // 🎯 FORCE CONTENT DIVERSITY: Get fresh topic if current one is overused
    const diverseTopicSuggestion = await this.ensureContentDiversity(topic);
    const finalTopic = diverseTopicSuggestion || topic;
    
    if (diverseTopicSuggestion && diverseTopicSuggestion !== topic) {
      console.log(`🔄 DIVERSITY_OVERRIDE: "${topic}" → "${finalTopic}" (avoiding repetition)`);
    }

    const prompt = this.buildDeepContentPrompt(finalTopic, format);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: format === 'thread' ? 2000 : 800
      });

      const rawContent = response.choices[0]?.message?.content || '';
      return this.parseDeepContent(rawContent, format);

    } catch (error: any) {
      console.error('❌ DEEP_CONTENT_ERROR:', error.message);
      return {
        content: 'System temporarily unavailable',
        hasSpecificDetails: false,
        productMentions: [],
        actionableSteps: []
      };
    }
  }

  /**
   * Ensure content diversity by checking recent posts and forcing new topics
   */
  private async ensureContentDiversity(requestedTopic: string): Promise<string | null> {
    try {
      // Check if the requested topic should be avoided due to recent overuse
      const shouldAvoid = await this.diversityTracker.shouldAvoidTopic(requestedTopic);
      
      if (shouldAvoid) {
        console.log(`🚫 AVOIDING_OVERUSED_TOPIC: "${requestedTopic}" posted too recently`);
        
        // Force a completely new domain
        const newTopic = await this.diversityTracker.forceNewDomain();
        console.log(`🎯 FORCED_DIVERSITY: Switching to "${newTopic}"`);
        return newTopic;
      }

      // Get topic suggestions based on recent content analysis
      const suggestions = await this.diversityTracker.getTopicSuggestions();
      
      if (suggestions.specificSuggestions.length > 0) {
        // Use specific suggestions from underexplored domains
        const newTopic = suggestions.specificSuggestions[Math.floor(Math.random() * suggestions.specificSuggestions.length)];
        console.log(`💡 DIVERSITY_SUGGESTION: "${newTopic}" (from underexplored domain)`);
        return newTopic;
      }

      // Topic is fine, proceed with original
      return null;

    } catch (error: any) {
      console.warn('⚠️ DIVERSITY_CHECK_FAILED:', error.message);
      return null; // Proceed with original topic
    }
  }

  /**
   * Build prompts that demand SPECIFIC, ACTIONABLE, DETAILED content
   */
  private buildDeepContentPrompt(topic: string, format: 'single' | 'thread'): string {
    const basePrompt = `
🎯 MISSION: Create DEEP, SPECIFIC, ACTIONABLE health content that goes beyond generic advice

📋 CONTENT REQUIREMENTS (MANDATORY):
1. SPECIFIC PRODUCT RECOMMENDATIONS: Mention actual brands, dosages, timing
2. DETAILED PROTOCOLS: Step-by-step instructions with exact numbers
3. SCIENTIFIC MECHANISMS: Explain HOW and WHY things work
4. PERSONAL EXPERIENCE ELEMENTS: "I tried this for 30 days..." style
5. COST CONSIDERATIONS: Mention price points, value comparisons
6. TIMING SPECIFICS: Exact times, durations, frequencies

🚫 ABSOLUTELY FORBIDDEN:
- Generic advice like "exercise more" or "eat healthy"
- Vague recommendations without specifics
- "99% of people" or similar overused hooks
- Basic tips everyone already knows
- Mentioning magnesium unless providing SPECIFIC protocol details

💡 EXAMPLES OF GOOD DEPTH:
❌ BAD: "Take magnesium for better sleep"
✅ GOOD: "I tested 4 magnesium types for 30 days: Glycinate (400mg, $0.12/dose) works best taken 90min before bed with tart cherry juice. Here's my exact protocol..."

❌ BAD: "Cold exposure boosts metabolism"  
✅ GOOD: "Wim Hof method + 2min cold shower daily increased my metabolism 14% (measured via DEXA). Here's the exact protocol I used..."

🎯 TOPIC: ${topic}

${format === 'thread' ? `
📱 THREAD FORMAT REQUIREMENTS:
- Create 3-5 connected tweets that tell a complete story
- Each tweet should be 200-240 characters
- Include specific products, brands, protocols in EVERY tweet
- Build suspense and deliver value progressively
- End with a clear call-to-action or summary

THREAD STRUCTURE:
Tweet 1: Hook with specific claim/result
Tweet 2: The exact protocol/method used  
Tweet 3: Specific products/brands/costs
Tweet 4: Results/timeline/what to expect
Tweet 5: Summary + next steps

` : `
📱 SINGLE TWEET REQUIREMENTS:
- 200-240 characters
- Include specific product OR protocol OR surprising fact
- Mention exact numbers, costs, or timeframes
- Create curiosity while delivering value
`}

Generate content that makes people think "I need to save this and try it immediately" rather than "I've heard this before."
`;

    return basePrompt;
  }

  /**
   * Parse the generated content and extract specific details
   */
  private parseDeepContent(rawContent: string, format: 'single' | 'thread'): {
    content: string;
    threadParts?: string[];
    hasSpecificDetails: boolean;
    productMentions: string[];
    actionableSteps: string[];
  } {
    const productMentions: string[] = [];
    const actionableSteps: string[] = [];

    // Extract product mentions (brands, specific supplements, etc.)
    const productPatterns = [
      /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, // Brand names
      /\d+mg|\d+g|\d+ml|\$\d+/g, // Dosages and prices
      /Amazon|iHerb|Costco|Target/gi // Retailers
    ];

    productPatterns.forEach(pattern => {
      const matches = rawContent.match(pattern);
      if (matches) {
        productMentions.push(...matches);
      }
    });

    // Extract actionable steps (numbered items, specific instructions)
    const stepPatterns = [
      /\d+\.\s+[^.]+/g, // Numbered steps
      /Take \d+[mg|g]+ of/gi, // Specific dosages
      /at \d+[:\d]* [ap]m/gi, // Specific times
      /for \d+ days?/gi // Specific durations
    ];

    stepPatterns.forEach(pattern => {
      const matches = rawContent.match(pattern);
      if (matches) {
        actionableSteps.push(...matches);
      }
    });

    const hasSpecificDetails = productMentions.length > 0 || actionableSteps.length > 0;

    if (format === 'thread') {
      // Split into thread parts
      const threadParts = this.splitIntoThreadParts(rawContent);
      return {
        content: rawContent,
        threadParts,
        hasSpecificDetails,
        productMentions,
        actionableSteps
      };
    }

    return {
      content: rawContent.substring(0, 280), // Twitter limit
      hasSpecificDetails,
      productMentions,
      actionableSteps
    };
  }

  /**
   * Split content into thread parts (separate tweets)
   */
  private splitIntoThreadParts(content: string): string[] {
    // Look for natural break points
    const sentences = content.split(/[.!?]+/);
    const parts: string[] = [];
    let currentPart = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if ((currentPart + trimmed).length > 240) {
        if (currentPart) {
          parts.push(currentPart.trim());
          currentPart = trimmed + '.';
        } else {
          // Sentence too long, split it
          parts.push(trimmed.substring(0, 240));
        }
      } else {
        currentPart += (currentPart ? ' ' : '') + trimmed + '.';
      }
    }

    if (currentPart) {
      parts.push(currentPart.trim());
    }

    return parts.slice(0, 5); // Max 5 tweets per thread
  }

  /**
   * Generate a complete nighttime routine thread (your example)
   */
  async generateNighttimeRoutineThread(): Promise<{
    content: string;
    threadParts: string[];
    hasSpecificDetails: boolean;
    productMentions: string[];
    actionableSteps: string[];
  }> {
    const prompt = `
Create a detailed nighttime routine thread with SPECIFIC products and brands:

Requirements:
1. Mention specific magnesium supplement brands and dosages
2. Include exact timing for each step
3. Recommend specific products with approximate costs
4. Share a complete 60-90 minute routine
5. Include lesser-known tips most people miss

Format as 5 tweets, each 200-240 characters.
Focus on actionable details, not generic advice.
`;

    return this.generateDeepContent('nighttime routine with products', 'thread');
  }

  /**
   * Generate content about specific products/brands (not generic advice)
   */
  async generateProductFocusedContent(category: string): Promise<{
    content: string;
    hasSpecificDetails: boolean;
    productMentions: string[];
    actionableSteps: string[];
  }> {
    const topics = {
      'sleep': 'specific sleep aids, magnesium brands, sleep tracking devices',
      'metabolism': 'thermogenic supplements, cold therapy equipment, metabolic testing',
      'stress': 'adaptogens, breathing devices, stress monitoring wearables',
      'energy': 'nootropics, light therapy lamps, energy tracking methods'
    };

    const selectedTopic = topics[category as keyof typeof topics] || category;
    return this.generateDeepContent(selectedTopic, 'single');
  }

  /**
   * Validate that content has sufficient depth and specificity
   */
  validateContentDepth(content: string): {
    isDeepEnough: boolean;
    missingElements: string[];
    score: number;
  } {
    const missingElements: string[] = [];
    let score = 0;

    // Check for specific numbers
    if (!/\d+mg|\d+g|\d+ml|\d+%|\$\d+/.test(content)) {
      missingElements.push('Specific dosages/amounts/costs');
    } else {
      score += 2;
    }

    // Check for brand mentions or specific products
    if (!/[A-Z][a-z]+ [A-Z][a-z]+|Amazon|iHerb|Costco/.test(content)) {
      missingElements.push('Specific brands/products/retailers');
    } else {
      score += 2;
    }

    // Check for timing specifics
    if (!/\d+:\d+|morning|evening|\d+ minutes?|\d+ hours?/.test(content)) {
      missingElements.push('Specific timing/duration');
    } else {
      score += 1;
    }

    // Check for actionable steps
    if (!/Take|Use|Try|Apply|Consume/.test(content)) {
      missingElements.push('Actionable instructions');
    } else {
      score += 1;
    }

    const isDeepEnough = score >= 4 && missingElements.length <= 1;

    return { isDeepEnough, missingElements, score };
  }
}
