/**
 * 📝 GRAMMAR ENHANCER
 * 
 * Grammarly-style micro pass for final content polishing.
 * Uses minimal tokens (20-30) to fix grammar while preserving meaning.
 */

import { BudgetAwareOpenAI, BudgetAwareRequestOptions } from './budgetAwareOpenAI';

export class GrammarEnhancer {
  private static instance: GrammarEnhancer;
  private budgetAwareOpenAI: BudgetAwareOpenAI;

  private constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
  }

  public static getInstance(): GrammarEnhancer {
    if (!GrammarEnhancer.instance) {
      GrammarEnhancer.instance = new GrammarEnhancer();
    }
    return GrammarEnhancer.instance;
  }

  /**
   * 🔧 MICRO GRAMMAR PASS - Minimal token usage for grammar fixes
   */
  async enhanceGrammar(content: string): Promise<{ 
    enhanced: string; 
    improvementsFound: boolean; 
    tokensUsed: number 
  }> {
    try {
      // Quick check: if content is very short or already perfect, skip
      if (content.length < 30 || this.isAlreadyWellFormatted(content)) {
        return {
          enhanced: content,
          improvementsFound: false,
          tokensUsed: 0
        };
      }

      console.log('📝 Running grammar micro-pass...');

      const messages = [
        {
          role: 'system',
          content: `Fix ONLY grammar, punctuation, and minor typos. DO NOT change meaning, tone, or structure. Keep all emojis, line breaks, and formatting exactly as-is. If no fixes needed, return the text unchanged.`
        },
        {
          role: 'user',
          content: `Fix grammar only:\n\n${content}`
        }
      ];

      const options: BudgetAwareRequestOptions = {
        priority: 'optional',
        operationType: 'grammar_enhancement',
        maxTokens: Math.max(150, Math.ceil(content.length * 1.2)), // Ensure enough tokens to complete sentences
        model: 'gpt-3.5-turbo', // Cheaper model for simple fixes
        temperature: 0.1, // Low temperature for consistency
        existingContent: content
      };

      const result = await this.budgetAwareOpenAI.createChatCompletion(messages, options);

      if (!result.success || !result.response?.choices?.[0]?.message?.content) {
        console.warn('⚠️ Grammar enhancement failed, using original content');
        return {
          enhanced: content,
          improvementsFound: false,
          tokensUsed: 0
        };
      }

      let enhanced = result.response.choices[0].message.content.trim();
      const tokensUsed = result.response.usage?.total_tokens || 25;
      
      // 🚨 CRITICAL: Validate sentence completion
      if (!this.isSentenceComplete(enhanced)) {
        console.warn('⚠️ Grammar enhancer returned incomplete sentence, using original');
        enhanced = content; // Fallback to original if incomplete
      }
      
      const improvementsFound = enhanced !== content && enhanced.length > 0;

      if (improvementsFound) {
        console.log(`✨ Grammar enhanced (${tokensUsed} tokens)`);
        
        // Log what changed for transparency
        if (enhanced.length !== content.length) {
          console.log(`📊 Length: ${content.length} → ${enhanced.length} chars`);
        }
      } else {
        console.log(`✅ Grammar already perfect (${tokensUsed} tokens)`);
      }

      return {
        enhanced: enhanced || content,
        improvementsFound,
        tokensUsed
      };

    } catch (error) {
      console.warn('⚠️ Grammar enhancement error (non-blocking):', error.message);
      return {
        enhanced: content,
        improvementsFound: false,
        tokensUsed: 0
      };
    }
  }

  /**
   * 🔍 QUICK HEURISTIC CHECK - Skip grammar pass if content looks perfect
   */
  private isAlreadyWellFormatted(content: string): boolean {
    // Check for common grammar issues that would benefit from AI fixing
    const issues = [
      /\s{2,}/g,           // Multiple spaces
      /\.\s*\./g,          // Double periods
      /[a-z]\.[A-Z]/g,     // Missing space after period
      /\s,/g,              // Space before comma
      /,,/g,               // Double commas
      /\s+$/gm,            // Trailing whitespace
    ];

    // If no obvious issues found, likely already well-formatted
    return !issues.some(pattern => pattern.test(content));
  }

  /**
   * 🚨 SENTENCE COMPLETION VALIDATOR - Prevents mid-sentence cutoffs
   */
  private isSentenceComplete(content: string): boolean {
    if (!content || content.length === 0) return false;
    
    const trimmed = content.trim();
    
    // Check for proper sentence endings
    if (/[.!?]$/.test(trimmed)) {
      return true;
    }
    
    // Check for incomplete sentences (ends with prepositions, articles, etc.)
    const incompleteEndings = [
      /\b(with|for|to|in|on|at|by|of|and|or|but|if|when|that|which|who|what|how|why|where)\s*$/i,
      /\b(a|an|the)\s*$/i,
      /\b(can|will|should|could|would|may|might|must)\s*$/i,
      /\b(is|are|was|were|has|have|had)\s*$/i,
      /[,;:]\s*$/,
      /\?\s*$/  // Question marks at the end without proper closure
    ];
    
    const isIncomplete = incompleteEndings.some(pattern => pattern.test(trimmed));
    
    if (isIncomplete) {
      console.warn(`🚨 Incomplete sentence detected: "${trimmed.slice(-30)}"`);
      return false;
    }
    
    return true;
  }

  /**
   * 📊 GET STATS - For monitoring grammar enhancement usage
   */
  getStats(): { totalEnhancements: number; tokensUsed: number } {
    // TODO: Add tracking if needed
    return {
      totalEnhancements: 0,
      tokensUsed: 0
    };
  }
}

// Export singleton instance
export const grammarEnhancer = GrammarEnhancer.getInstance();