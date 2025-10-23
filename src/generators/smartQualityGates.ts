/**
 * 🎯 SMART QUALITY GATES
 * Generator-aware quality validation that ensures high standards
 * while respecting each generator's unique content style
 * 
 * Philosophy: Quality = "Appropriate for the generator type"
 * Not all posts need citations. Not all posts need numbers.
 * But EVERY post must be excellent for its type.
 */

export interface SmartValidationResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  fixes: string[];
  generator: string;
  autoFixable: boolean;
  breakdown: {
    completeness: number; // Does it have what this generator NEEDS?
    engagement: number;   // Is it interesting/shareable?
    authenticity: number; // Does it sound human and authoritative?
  };
}

/**
 * 🏆 GENERATOR-SPECIFIC QUALITY STANDARDS
 * Each generator has different requirements for "high quality"
 */
const GENERATOR_STANDARDS = {
  dataNerd: {
    name: 'Data Nerd',
    mustHave: ['2+ numbers', 'study citation', 'specific data'],
    shouldHave: ['mechanism term', 'sample size or year'],
    optional: ['protocol specificity'],
    allowEmojis: 1, // Data is serious
    maxChars: 270
  },
  
  mythBuster: {
    name: 'Myth Buster',
    mustHave: ['myth stated', 'truth revealed', '1+ data point'],
    shouldHave: ['study reference or meta-analysis', 'mechanism'],
    optional: ['alternative solution'],
    allowEmojis: 1,
    maxChars: 270
  },
  
  provocateur: {
    name: 'Provocateur',
    mustHave: ['provocative question', 'mechanism term'],
    shouldHave: ['challenges assumption', '1+ number'],
    optional: ['research citation', 'protocol'],
    allowEmojis: 0, // Questions should be sharp, not cute
    maxChars: 270
  },
  
  storyteller: {
    name: 'Storyteller',
    mustHave: ['engaging narrative', 'concrete examples'],
    shouldHave: ['emotional resonance', 'relatable scenario'],
    optional: ['numbers', 'citations', 'mechanisms'], // Stories don't need data!
    allowEmojis: 2, // Stories can be warmer
    maxChars: 270
  },
  
  contrarian: {
    name: 'Contrarian',
    mustHave: ['challenges conventional wisdom', 'mechanism or data'],
    shouldHave: ['setup + twist structure', '1+ number'],
    optional: ['research citation', 'protocol'],
    allowEmojis: 1,
    maxChars: 270
  },
  
  thoughtLeader: {
    name: 'Thought Leader',
    mustHave: ['original insight', 'framework or mental model'],
    shouldHave: ['supports with logic or data', 'actionable'],
    optional: ['specific numbers', 'citations'],
    allowEmojis: 1,
    maxChars: 270
  },
  
  philosopher: {
    name: 'Philosopher',
    mustHave: ['deep question or principle', 'makes you think'],
    shouldHave: ['connects concepts', 'reframes perspective'],
    optional: ['numbers', 'citations', 'protocols'], // Philosophy is about ideas
    allowEmojis: 0, // Philosophical = serious
    maxChars: 270
  },
  
  coach: {
    name: 'Coach',
    mustHave: ['actionable advice', 'specific protocol'],
    shouldHave: ['dosage or duration', 'clear next step'],
    optional: ['research citation', 'mechanism'], // Coach = practical
    allowEmojis: 2, // Coaches can be encouraging
    maxChars: 270
  },
  
  explorer: {
    name: 'Explorer',
    mustHave: ['introduces novel concept', 'curiosity-driven'],
    shouldHave: ['explains clearly', '1+ concrete example'],
    optional: ['numbers', 'citations'],
    allowEmojis: 1,
    maxChars: 270
  },
  
  interestingContent: {
    name: 'Interesting',
    mustHave: ['surprising or counterintuitive', 'substantive'],
    shouldHave: ['mechanism or explanation', 'concrete details'],
    optional: ['numbers', 'citations'],
    allowEmojis: 2,
    maxChars: 270
  },
  
  newsReporter: {
    name: 'News Reporter',
    mustHave: ['timely/recent', 'specific source', 'factual'],
    shouldHave: ['institution or study name', 'date or timeline'],
    optional: ['mechanism'],
    allowEmojis: 0, // News is professional
    maxChars: 270
  },
  
  viralThread: {
    name: 'Viral Thread',
    mustHave: ['hook that grabs', 'clear structure', 'payoff'],
    shouldHave: ['concrete examples', 'actionable insights'],
    optional: ['numbers per tweet', 'citations'],
    allowEmojis: 2,
    maxChars: 250 // Threads need buffer for thread numbering
  }
};

/**
 * 🎯 SMART VALIDATION: Generator-aware quality check
 */
export function validateContentSmart(
  content: string | string[],
  generatorName: string
): SmartValidationResult {
  
  const fullText = Array.isArray(content) ? content.join(' ') : content;
  const standard = GENERATOR_STANDARDS[generatorName as keyof typeof GENERATOR_STANDARDS];
  
  // Fallback for unknown generators
  if (!standard) {
    console.warn(`⚠️ Unknown generator: ${generatorName}, using default standards`);
    return validateWithDefaults(content, generatorName);
  }
  
  console.log(`\n🎯 SMART_GATE: Validating ${standard.name} content...`);
  
  let score = 100;
  const issues: string[] = [];
  const fixes: string[] = [];
  let autoFixable = false;
  
  // ============================================================================
  // UNIVERSAL CHECKS (apply to ALL generators)
  // ============================================================================
  
  // 1. Character limit (varies by generator)
  const charLimit = standard.maxChars;
  if (Array.isArray(content)) {
    const longTweets = content.filter(t => t.length > charLimit);
    if (longTweets.length > 0) {
      issues.push(`${longTweets.length} tweet(s) exceed ${charLimit} chars`);
      fixes.push(`Shorten to ≤${charLimit} chars per tweet`);
      score -= 20;
      autoFixable = true;
    }
  } else {
    if (content.length > charLimit) {
      issues.push(`Tweet too long: ${content.length} chars (max ${charLimit})`);
      fixes.push(`Shorten to ≤${charLimit} chars`);
      score -= 20;
      autoFixable = true;
    }
  }
  
  // 2. Emoji limit (varies by generator)
  const emojiCount = (fullText.match(/[\p{Emoji}]/gu) || []).length;
  if (emojiCount > standard.allowEmojis) {
    issues.push(`${emojiCount} emojis found (max ${standard.allowEmojis} for ${standard.name})`);
    fixes.push(`Remove ${emojiCount - standard.allowEmojis} emoji(s)`);
    score -= 15;
    autoFixable = true;
  }
  
  // 3. No first-person language (universal rule)
  const firstPersonPattern = /\b(I|me|my|mine|we|us|our|ours)\b/gi;
  const firstPersonMatches = fullText.match(firstPersonPattern);
  if (firstPersonMatches) {
    issues.push(`First-person language: ${[...new Set(firstPersonMatches)].join(', ')}`);
    fixes.push('Remove I/me/my/we/us/our - use third-person or "you"');
    score -= 25; // This is a big violation
  }
  
  // 4. No banned casual words (universal)
  const bannedWords = /\b(crazy|insane|mind-blown|mind-blowing|literally|honestly|who knew|turns out|fun fact)\b/gi;
  const bannedMatches = fullText.match(bannedWords);
  if (bannedMatches) {
    issues.push(`Banned casual words: ${[...new Set(bannedMatches)].join(', ')}`);
    fixes.push('Use authoritative tone - remove casual language');
    score -= 15;
  }
  
  // ============================================================================
  // GENERATOR-SPECIFIC CHECKS (the smart part!)
  // ============================================================================
  
  const checks = checkGeneratorRequirements(fullText, generatorName, standard);
  
  score -= checks.deductions;
  issues.push(...checks.issues);
  fixes.push(...checks.fixes);
  
  // ============================================================================
  // CALCULATE BREAKDOWN SCORES
  // ============================================================================
  
  const breakdown = calculateBreakdown(fullText, generatorName, standard, checks);
  
  // ============================================================================
  // DETERMINE PASS/FAIL
  // ============================================================================
  
  // ✅ IMPROVED THRESHOLDS: Generator-specific standards ensure quality
  // Each generator type has customized requirements
  const minOverall = 60; // Raised from 50 for better quality
  const minCompleteness = (() => {
    // Storyteller & Philosopher: Don't need data/citations
    if (generatorName === 'storyteller' || generatorName === 'philosopher') return 60;
    // Data Nerd: Needs high completeness (data + citations)
    if (generatorName === 'dataNerd') return 75;
    // Others: Standard requirement
    return 70;
  })();
  const minEngagement = (() => {
    // Provocateur: Engagement is critical
    if (generatorName === 'provocateur') return 70;
    // Storyteller: Engagement matters most
    if (generatorName === 'storyteller') return 70;
    // Others: Standard requirement
    return 60;
  })();
  const minAuthenticity = 60; // Universal standard
  
  const passed = 
    score >= minOverall &&
    breakdown.completeness >= minCompleteness &&
    breakdown.engagement >= minEngagement &&
    breakdown.authenticity >= minAuthenticity;
  
  console.log(`   Score: ${score}/100`);
  console.log(`   Completeness: ${breakdown.completeness}/100 (min: ${minCompleteness})`);
  console.log(`   Engagement: ${breakdown.engagement}/100 (min: ${minEngagement})`);
  console.log(`   Authenticity: ${breakdown.authenticity}/100 (min: ${minAuthenticity})`);
  console.log(`   Result: ${passed ? '✅ PASS' : '🚫 FAIL'}`);
  
  if (!passed && issues.length > 0) {
    console.log(`   Issues: ${issues.join(', ')}`);
  }
  
  return {
    passed,
    score,
    issues,
    fixes,
    generator: generatorName,
    autoFixable,
    breakdown
  };
}

/**
 * Check generator-specific requirements
 */
function checkGeneratorRequirements(
  text: string,
  generator: string,
  standard: any
): { deductions: number; issues: string[]; fixes: string[] } {
  
  let deductions = 0;
  const issues: string[] = [];
  const fixes: string[] = [];
  
  // Extract common patterns
  const numberCount = (text.match(/\d+\.?\d*%?/g) || []).length;
  const hasCitation = /\b(study|research|meta-analysis|trial|journal|university|institute|Harvard|Stanford|Science|Nature|JAMA)\b/i.test(text);
  const hasMechanism = /\b(cortisol|serotonin|dopamine|hrv|mitochondria|autophagy|circadian|glucose|insulin|inflammation|pathway|receptor|neurotransmitter|hormone)\b/i.test(text);
  const hasProtocol = /\b(\d+\s*(mg|g|ml|mcg|iu|hours?|minutes?|weeks?|months?|days?|times?\s+per|°[CF]))\b/i.test(text);
  const hasQuestion = /\?/.test(text);
  const hasNarrative = text.length > 150 && /\b(when|after|before|then|now|first|finally)\b/i.test(text);
  
  // Generator-specific validation
  switch (generator) {
    case 'dataNerd':
      if (numberCount < 2) {
        issues.push('Data Nerd needs 2+ numbers/percentages');
        fixes.push('Add specific data: "43% lower", "6 hours", "2,400 people"');
        deductions += 25;
      }
      if (!hasCitation) {
        issues.push('Data Nerd needs study citation');
        fixes.push('Add source: "(Stanford 2023)", "Harvard study", "meta-analysis"');
        deductions += 20;
      }
      if (!hasMechanism) {
        issues.push('Should include mechanism term');
        fixes.push('Add biological term: cortisol, HRV, autophagy, etc.');
        deductions += 10;
      }
      break;
      
    case 'mythBuster':
      if (!/\b(myth|actually|truth|reality|wrong|fact)\b/i.test(text)) {
        issues.push('Myth Buster must state myth vs truth');
        fixes.push('Clear structure: "Myth: X. Truth: Y"');
        deductions += 25;
      }
      if (numberCount < 1) {
        issues.push('Myth Buster needs 1+ data point');
        fixes.push('Add evidence: percentage, study size, or timeframe');
        deductions += 20;
      }
      if (!hasCitation && !hasMechanism) {
        issues.push('Need citation OR mechanism to support claim');
        fixes.push('Add study reference or explain biological mechanism');
        deductions += 15;
      }
      break;
      
    case 'provocateur':
      if (!hasQuestion && !/\b(why|what if|nobody asks|challenge|conventional)\b/i.test(text)) {
        issues.push('Provocateur must ask provocative question');
        fixes.push('Ask challenging question: "Why do we...?", "What if...?"');
        deductions += 30;
      }
      if (!hasMechanism) {
        issues.push('Provocateur needs mechanism term');
        fixes.push('Ground question in biology: HRV, cortisol, circadian, etc.');
        deductions += 20;
      }
      if (numberCount < 1) {
        issues.push('Should include 1+ number for context');
        fixes.push('Add data: "200,000 years", "6 hours", "40%"');
        deductions += 10;
      }
      break;
      
    case 'storyteller':
      if (!hasNarrative) {
        issues.push('Storyteller needs narrative structure');
        fixes.push('Tell a story with progression: when/then/after/before');
        deductions += 25;
      }
      if (!/\b(body|brain|feel|happens|signals|warning|fatigue|stress|energy|mood)\b/i.test(text)) {
        issues.push('Should use concrete, relatable examples');
        fixes.push('Make it tangible: "the 3am wake-ups", "brain fog", "fatigue"');
        deductions += 15;
      }
      // Storyteller gets a pass on numbers/citations!
      break;
      
    case 'contrarian':
      if (!/\b(everyone|nobody|conventional|opposite|backwards|hot take|actually)\b/i.test(text)) {
        issues.push('Contrarian must challenge conventional wisdom');
        fixes.push('Setup contrast: "Everyone does X. Nobody asks Y."');
        deductions += 25;
      }
      if (!hasMechanism && numberCount < 1) {
        issues.push('Need mechanism OR data to support contrarian view');
        fixes.push('Explain WHY conventional wisdom is wrong');
        deductions += 20;
      }
      break;
      
    case 'thoughtLeader':
      if (!/\b(framework|model|principle|system|approach|method|strategy)\b/i.test(text)) {
        issues.push('Thought Leader should present framework/model');
        fixes.push('Offer mental model or strategic approach');
        deductions += 20;
      }
      if (text.length < 120) {
        issues.push('Too short for thought leadership');
        fixes.push('Develop idea more fully (aim for 180-250 chars)');
        deductions += 15;
      }
      break;
      
    case 'philosopher':
      if (!hasQuestion && !/\b(principle|truth|nature|essence|fundamental|consider)\b/i.test(text)) {
        issues.push('Philosopher needs deep question or principle');
        fixes.push('Explore fundamental question or truth');
        deductions += 25;
      }
      // Philosopher gets pass on data requirements
      break;
      
    case 'coach':
      if (!hasProtocol && numberCount < 1) {
        issues.push('Coach needs specific protocol (dose/duration/timing)');
        fixes.push('Add specifics: "11 min at 11°C", "500mg daily", "16:8 window"');
        deductions += 25;
      }
      if (!/\b(do|try|start|avoid|optimize|improve|track|measure)\b/i.test(text)) {
        issues.push('Coach should give clear action');
        fixes.push('Make it actionable: what to DO');
        deductions += 15;
      }
      break;
      
    case 'explorer':
      if (!/\b(new|novel|emerging|discovered|research shows|found|reveals)\b/i.test(text)) {
        issues.push('Explorer should introduce novel concept');
        fixes.push('Frame as discovery: "new research shows", "emerging"');
        deductions += 20;
      }
      break;
      
    case 'interestingContent':
      if (!/\b(surprising|counter|actually|opposite|unexpected|turns out)\b/i.test(text)) {
        issues.push('Interesting content should be surprising/counterintuitive');
        fixes.push('Lead with surprising angle');
        deductions += 20;
      }
      if (!hasMechanism && numberCount < 1) {
        issues.push('Needs mechanism OR data to be substantive');
        fixes.push('Explain WHY or add data');
        deductions += 15;
      }
      break;
      
    case 'newsReporter':
      if (!hasCitation) {
        issues.push('News Reporter must cite specific source');
        fixes.push('Name institution, journal, or study');
        deductions += 30;
      }
      if (!/\b(20\d{2}|recent|new|latest|just|published)\b/i.test(text)) {
        issues.push('News should indicate timing/recency');
        fixes.push('Add date or "recent study", "new research"');
        deductions += 15;
      }
      break;
      
    case 'viralThread':
      // Thread-specific checks would go here
      if (!/\b(why|how|what|when|secret|truth|nobody)\b/i.test(text)) {
        issues.push('Viral thread needs strong hook');
        fixes.push('Start with question or bold claim');
        deductions += 20;
      }
      break;
  }
  
  return { deductions, issues, fixes };
}

/**
 * Calculate detailed breakdown scores
 */
function calculateBreakdown(
  text: string,
  generator: string,
  standard: any,
  checks: any
): { completeness: number; engagement: number; authenticity: number } {
  
  // Completeness: Does it have what this generator type NEEDS?
  let completeness = 100 - checks.deductions;
  completeness = Math.max(0, Math.min(100, completeness));
  
  // Engagement: Is it interesting and shareable?
  let engagement = 85; // Start high, deduct for problems
  if (text.length < 100) engagement -= 20; // Too short
  if (!/[?!]/.test(text)) engagement -= 10; // No punctuation variety
  if (/\b(very|really|just|quite|some)\b/gi.test(text)) engagement -= 10; // Weak words
  if (/\b(interesting|important|good|bad|nice)\b/gi.test(text)) engagement -= 15; // Vague adjectives
  engagement = Math.max(0, Math.min(100, engagement));
  
  // Authenticity: Does it sound human and authoritative?
  let authenticity = 85; // Start high
  if (/\b(I|me|my|we|our)\b/i.test(text)) authenticity -= 30; // First person
  if (/\b(crazy|insane|mind-blown)\b/gi.test(text)) authenticity -= 20; // Casual
  if (/\b(studies show|research suggests)\b/gi.test(text)) authenticity -= 15; // Vague
  if ((text.match(/[\p{Emoji}]/gu) || []).length > standard.allowEmojis) authenticity -= 15;
  authenticity = Math.max(0, Math.min(100, authenticity));
  
  return { completeness, engagement, authenticity };
}

/**
 * Fallback validation for unknown generators
 */
function validateWithDefaults(content: string | string[], generator: string): SmartValidationResult {
  const text = Array.isArray(content) ? content.join(' ') : content;
  
  return {
    passed: text.length > 50 && text.length < 280,
    score: 70,
    issues: ['Unknown generator type - using basic validation'],
    fixes: [],
    generator,
    autoFixable: false,
    breakdown: {
      completeness: 70,
      engagement: 70,
      authenticity: 70
    }
  };
}

