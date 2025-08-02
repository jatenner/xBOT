/**
 * 🤖 INTELLIGENT POST TYPE DETECTOR
 * Decides whether content should be a single tweet or thread based on multiple factors
 */

export interface PostTypeDecision {
  shouldBeThread: boolean;
  confidence: number;
  reasoning: string[];
  suggestedFormat: 'single' | 'thread';
}

export class IntelligentPostTypeDetector {
  
  /**
   * 🎯 MAIN DECISION LOGIC - Analyzes content and decides single vs thread
   */
  static analyzeContent(rawContent: string): PostTypeDecision {
    const reasoning: string[] = [];
    let threadScore = 0;
    let singleScore = 0;
    
    // Factor 1: Length analysis (more conservative)
    const length = rawContent.length;
    if (length > 400) {
      threadScore += 3;
      reasoning.push(`Content length ${length} chars suggests thread`);
    } else if (length < 280) {
      singleScore += 3;
      reasoning.push(`Content length ${length} chars suggests single tweet`);
    }
    
    // Factor 2: Explicit numbered structure
    const hasNumberedTweets = /Tweet\s*\d+[:\/]/i.test(rawContent) || 
                             /^\d+[.\/\)]\s/m.test(rawContent) ||
                             rawContent.split(/Tweet\s*\d+/).length > 2;
    
    if (hasNumberedTweets) {
      threadScore += 4;
      reasoning.push('Found explicit numbered tweet structure');
    }
    
    // Factor 3: List-like content indicators
    const listIndicators = [
      /\b(\d+)\s+(ways|tips|reasons|myths|steps|hacks|methods|strategies)\b/i,
      /here\s+are\s+\d+/i,
      /\d+\s+evidence-based/i,
      /breakdown/i,
      /\d+[\.\)]\s+.*?\d+[\.\)]/s,  // Multiple numbered points
      /first.*second.*third/i,       // Sequential language
      /morning.*breathwork.*fasting/i // Multiple distinct topics
    ];
    
    const hasListContent = listIndicators.some(pattern => pattern.test(rawContent));
    if (hasListContent) {
      threadScore += 2;
      reasoning.push('Content appears to be list-based (ways/tips/etc)');
    }
    
    // Factor 4: Multiple distinct points
    const sentences = rawContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 4) {
      threadScore += 2;
      reasoning.push(`${sentences.length} distinct sentences suggest thread format`);
    } else if (sentences.length <= 2) {
      singleScore += 1;
      reasoning.push(`${sentences.length} sentences suggest single tweet`);
    }
    
    // Factor 5: Question format (often single tweets)
    const isQuestion = /^[^.!]*\?[^.!]*$/m.test(rawContent);
    if (isQuestion && length < 250) {
      singleScore += 2;
      reasoning.push('Question format with reasonable length suggests single tweet');
    }
    
    // Factor 6: Actionable advice patterns (often threads)
    const hasActionableAdvice = /\b(how to|step \d+|first|second|then|next|finally)\b/i.test(rawContent);
    if (hasActionableAdvice && length > 200) {
      threadScore += 2;
      reasoning.push('Contains actionable advice patterns suggesting thread');
    }
    
    // Factor 7: Research/study mentions (only for longer content)
    const hasResearchContent = /\b(study|research|scientists|found that|according to)\b/i.test(rawContent);
    if (hasResearchContent && length > 300 && sentences.length > 3) {
      threadScore += 1;
      reasoning.push('Contains research references suggesting detailed thread');
    }
    
    // Factor 8: Simple announcement/fact (single tweet)
    const isSimpleStatement = sentences.length <= 2 && 
                             !hasNumberedTweets && 
                             !hasListContent && 
                             length < 220;
    
    if (isSimpleStatement) {
      singleScore += 3;
      reasoning.push('Simple statement format ideal for single tweet');
    }
    
    // Make decision
    const shouldBeThread = threadScore > singleScore;
    const confidence = Math.abs(threadScore - singleScore) / Math.max(threadScore + singleScore, 1);
    
    const decision: PostTypeDecision = {
      shouldBeThread,
      confidence,
      reasoning,
      suggestedFormat: shouldBeThread ? 'thread' : 'single'
    };
    
    console.log(`🤖 Post type decision: ${decision.suggestedFormat.toUpperCase()} (confidence: ${Math.round(confidence * 100)}%)`);
    console.log(`📊 Scores - Thread: ${threadScore}, Single: ${singleScore}`);
    reasoning.forEach(reason => console.log(`   • ${reason}`));
    
    return decision;
  }
  
  /**
   * 🧠 LEARNS FROM PERFORMANCE DATA
   * Adjusts decision thresholds based on what actually performs better
   */
  static async learnFromPerformance(): Promise<void> {
    // TODO: Query database for single vs thread performance
    // Adjust scoring weights based on which format gets more followers
    console.log('🧠 Learning from performance data (placeholder for future enhancement)');
  }
}