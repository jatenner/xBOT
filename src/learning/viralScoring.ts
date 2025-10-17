/**
 * VIRAL SCORING SYSTEM
 * Predicts viral potential of content before posting
 */

export interface ViralScore {
  total_score: number; // 0-100
  hook_score: number;
  specificity_score: number;
  controversy_score: number;
  actionability_score: number;
  readability_score: number;
  curiosity_score: number;
  breakdown: string[];
}

/**
 * Calculate viral potential score for content
 */
export function calculateViralPotential(content: string | string[]): ViralScore {
  // Handle both single tweets and threads
  const textToAnalyze = Array.isArray(content) 
    ? content.join(' ') 
    : content;
  
  const firstTweet = Array.isArray(content) ? content[0] : content;
  const firstSevenWords = firstTweet.split(' ').slice(0, 7).join(' ');
  
  let breakdown: string[] = [];
  
  // 1. HOOK STRENGTH (0-25 points)
  let hookScore = 0;
  
  if (/\d+%/.test(firstSevenWords)) {
    hookScore += 10;
    breakdown.push('✅ Number in first 7 words (+10)');
  }
  
  if (/\?/.test(firstSevenWords)) {
    hookScore += 8;
    breakdown.push('✅ Question hook (+8)');
  }
  
  const boldClaimWords = ['wrong', 'lie', 'myth', 'fake', 'scam', 'backwards'];
  if (boldClaimWords.some(w => firstSevenWords.toLowerCase().includes(w))) {
    hookScore += 15;
    breakdown.push('✅ Bold claim hook (+15)');
  }
  
  const negationWords = ['don\'t', 'stop', 'never', 'avoid'];
  if (negationWords.some(w => firstSevenWords.toLowerCase().includes(w))) {
    hookScore += 12;
    breakdown.push('✅ Negation hook (+12)');
  }
  
  if (hookScore === 0) {
    breakdown.push('⚠️ Weak hook - no clear pattern');
    hookScore = 5; // Base score
  }
  
  // 2. SPECIFICITY SCORE (0-20 points)
  let specificityScore = 0;
  
  const hasSpecificNumber = /\d+%|\d+\s+(people|participants|patients|studies|years|weeks|hours)/.test(textToAnalyze);
  if (hasSpecificNumber) {
    specificityScore += 10;
    breakdown.push('✅ Specific numbers/data (+10)');
  }
  
  const studyCitations = /(Stanford|MIT|Harvard|Yale|Johns Hopkins|study|research|scientists|researchers)/i.test(textToAnalyze);
  if (studyCitations) {
    specificityScore += 10;
    breakdown.push('✅ Study citation (+10)');
  }
  
  if (specificityScore === 0) {
    breakdown.push('⚠️ No specific data or sources');
  }
  
  // 3. CONTROVERSY/CONTRARIAN SCORE (0-20 points)
  let controversyScore = 0;
  
  const controversyWords = ['wrong', 'lie', 'myth', 'opposite', 'actually', 'backwards', 'scam', 'fake'];
  const controversyCount = controversyWords.filter(w => 
    textToAnalyze.toLowerCase().includes(w)
  ).length;
  
  controversyScore = Math.min(controversyCount * 5, 20);
  if (controversyScore > 0) {
    breakdown.push(`✅ Contrarian angle (+${controversyScore})`);
  }
  
  // 4. ACTIONABILITY SCORE (0-15 points)
  let actionabilityScore = 0;
  
  const actionWords = ['do this', 'try', 'start', 'stop', 'avoid', 'instead', 'protocol', 'steps', 'how to'];
  const hasAction = actionWords.some(w => textToAnalyze.toLowerCase().includes(w));
  
  // Check for specific quantities (400mg, 8 hours, 2L water)
  const hasSpecificProtocol = /\d+\s*(mg|g|hours|mins|minutes|ml|L|grams)/i.test(textToAnalyze);
  
  if (hasAction) {
    actionabilityScore += 8;
    breakdown.push('✅ Actionable language (+8)');
  }
  
  if (hasSpecificProtocol) {
    actionabilityScore += 7;
    breakdown.push('✅ Specific protocol (+7)');
  }
  
  // 5. READABILITY SCORE (0-10 points)
  let readabilityScore = 0;
  
  const hasLineBreaks = textToAnalyze.includes('\n');
  if (hasLineBreaks) {
    readabilityScore += 5;
    breakdown.push('✅ Line breaks for readability (+5)');
  }
  
  const sentences = textToAnalyze.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
  
  if (avgSentenceLength < 20) {
    readabilityScore += 5;
    breakdown.push('✅ Concise sentences (+5)');
  }
  
  // 6. CURIOSITY SCORE (0-10 points)
  let curiosityScore = 0;
  
  const curiosityWords = ['secret', 'nobody talks about', 'hidden', 'surprising', 'shocking', 'what happened'];
  const hasCuriosity = curiosityWords.some(w => textToAnalyze.toLowerCase().includes(w));
  
  if (hasCuriosity) {
    curiosityScore += 10;
    breakdown.push('✅ Curiosity gap (+10)');
  }
  
  // CALCULATE TOTAL
  const totalScore = Math.min(
    hookScore + 
    specificityScore + 
    controversyScore + 
    actionabilityScore + 
    readabilityScore + 
    curiosityScore,
    100
  );
  
  return {
    total_score: totalScore,
    hook_score: hookScore,
    specificity_score: specificityScore,
    controversy_score: controversyScore,
    actionability_score: actionabilityScore,
    readability_score: readabilityScore,
    curiosity_score: curiosityScore,
    breakdown
  };
}

/**
 * Get dynamic viral threshold based on account growth stage
 * ADAPTIVE: Lower threshold for new accounts, higher as you grow
 */
export async function getDynamicViralThreshold(): Promise<number> {
  try {
    // Get current follower count and engagement from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const { data: metrics } = await supabase
      .from('twitter_metrics')
      .select('followers, avg_engagement')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    const followers = metrics?.followers || 0;
    const avgEngagement = metrics?.avg_engagement || 0;
    
    // DYNAMIC THRESHOLD FORMULA
    let threshold = 30; // Base threshold for exploration
    
    if (followers < 100) {
      threshold = 30; // Exploration phase - accept more variety
    } else if (followers < 500) {
      threshold = 35; // Early growth
    } else if (followers < 2000) {
      threshold = 40; // Scaling phase
    } else if (followers < 10000) {
      threshold = 45; // Optimization phase
    } else {
      threshold = 50; // Mature phase - be selective
    }
    
    // ENGAGEMENT ADJUSTMENT: Good engagement = can be more selective
    if (avgEngagement > 0.05) {
      threshold += 5; // High engagement - raise standards
    } else if (avgEngagement < 0.02 && followers > 100) {
      threshold -= 5; // Low engagement - try more variety
    }
    
    console.log(`[VIRAL_THRESHOLD] 🎯 Dynamic threshold: ${threshold} (followers: ${followers}, engagement: ${(avgEngagement * 100).toFixed(2)}%)`);
    
    return threshold;
    
  } catch (error) {
    console.warn('[VIRAL_THRESHOLD] ⚠️ Could not fetch metrics, using fallback threshold: 35');
    return 35; // Fallback for new accounts
  }
}

/**
 * Determine if content meets viral threshold
 * Use getDynamicViralThreshold() for adaptive thresholds
 */
export function meetsViralThreshold(score: ViralScore, threshold: number = 70): boolean {
  return score.total_score >= threshold;
}

/**
 * Get improvement suggestions for low-scoring content
 */
export function getImprovementSuggestions(score: ViralScore): string[] {
  const suggestions: string[] = [];
  
  if (score.hook_score < 10) {
    suggestions.push('❌ Weak hook - Start with bold claim, number, or question');
  }
  
  if (score.specificity_score < 10) {
    suggestions.push('❌ Add specific data - Include percentages, study names, or exact numbers');
  }
  
  if (score.controversy_score < 5) {
    suggestions.push('💡 Consider contrarian angle - Challenge common beliefs');
  }
  
  if (score.actionability_score < 8) {
    suggestions.push('💡 Add actionable steps - Include specific protocols or instructions');
  }
  
  if (score.readability_score < 5) {
    suggestions.push('💡 Improve readability - Add line breaks, shorter sentences');
  }
  
  if (score.curiosity_score === 0) {
    suggestions.push('💡 Create curiosity gap - Hint at surprise or hidden insight');
  }
  
  return suggestions;
}

