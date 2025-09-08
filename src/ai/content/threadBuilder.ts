/**
 * Thread Builder for xBOT
 * Builds structured threads with hook → body → close format
 */

import { StudyCitation, formatStudyCitation, QUALITY_STANDARDS } from './policies';

export interface ThreadInput {
  idea: string;
  facts: string[];
  targetLength?: number;
  format?: 'how_to' | 'case_study' | 'thread_deep_dive' | 'myth_buster';
  citations?: StudyCitation[];
}

export interface ThreadMeta {
  hookScore: number;
  clarityScore: number;
  noveltyScore: number;
  structureScore: number;
  totalCharacters: number;
  avgCharactersPerTweet: number;
}

export interface ThreadOutput {
  tweets: string[];
  meta: ThreadMeta;
  format: string;
  topic: string;
}

/**
 * Build structured thread from idea and facts
 */
export function buildThread(input: ThreadInput): ThreadOutput {
  const { idea, facts, targetLength = 4, format = 'thread_deep_dive', citations = [] } = input;
  
  // Enforce length constraints (3-5 tweets max)
  const clampedLength = Math.max(3, Math.min(5, targetLength));
  
  const tweets: string[] = [];
  
  // 1. Hook Tweet - Curiosity-driven, no conclusions
  const hook = buildHookTweet(idea, format);
  tweets.push(hook);
  
  // 2. Body Tweets - Evidence and explanation
  const bodyTweets = buildBodyTweets(facts, citations, clampedLength - 2); // Reserve space for hook + close
  tweets.push(...bodyTweets);
  
  // 3. Close Tweet - Actionable takeaway + soft CTA
  const close = buildCloseTweet(idea, format);
  tweets.push(close);
  
  // Add thread numbering
  const numberedTweets = tweets.map((tweet, index) => 
    `${index + 1}/${tweets.length} ${tweet}`
  );
  
  // Calculate metadata
  const meta = calculateThreadMeta(numberedTweets, idea, facts);
  
  return {
    tweets: numberedTweets,
    meta,
    format,
    topic: extractTopic(idea)
  };
}

/**
 * Build compelling hook tweet (first tweet)
 */
function buildHookTweet(idea: string, format: string): string {
  const hooks = {
    thread_deep_dive: generateContrarianHook(idea),
    how_to: generateProblemHook(idea),
    case_study: generateStudyHook(idea),
    myth_buster: generateMythHook(idea)
  };
  
  let hook = hooks[format as keyof typeof hooks] || generateContrarianHook(idea);
  
  // Ensure hook is under 240 chars and ends with thread indicator
  if (hook.length > 200) {
    hook = hook.substring(0, 197) + "...";
  }
  
  // Add thread indicator if not present
  if (!hook.includes('🧵') && !hook.includes('👇') && !hook.includes('thread')) {
    hook += ' 🧵';
  }
  
  return hook;
}

/**
 * Generate contrarian hook that challenges conventional wisdom
 */
function generateContrarianHook(idea: string): string {
  const contrarianStarters = [
    "Contrary to popular belief,",
    "Most people think",
    "The conventional wisdom about",
    "Everyone believes",
    "The standard advice on",
    "Common health wisdom says"
  ];
  
  const starter = contrarianStarters[Math.floor(Math.random() * contrarianStarters.length)];
  
  // Extract the core claim to challenge
  const coreIdea = idea.split('.')[0].toLowerCase();
  
  if (coreIdea.includes('sleep')) {
    return `${starter} you need 8 hours of sleep—but timing and quality matter more than duration`;
  }
  
  if (coreIdea.includes('exercise') || coreIdea.includes('workout')) {
    return `${starter} longer workouts are better—but intensity trumps duration for most goals`;
  }
  
  if (coreIdea.includes('diet') || coreIdea.includes('nutrition')) {
    return `${starter} counting calories is key—but food timing and quality change everything`;
  }
  
  if (coreIdea.includes('stress')) {
    return `${starter} stress is bad—but the right kind of stress makes you stronger`;
  }
  
  // Generic contrarian hook
  return `${starter.replace(' about', '')} ${idea.split('.')[0].toLowerCase()}—but the research tells a different story`;
}

/**
 * Generate problem-focused hook for how-to content
 */
function generateProblemHook(idea: string): string {
  const problemFrames = [
    "Most people struggle with",
    "The biggest mistake with",
    "Why do so many fail at",
    "The hidden barrier to"
  ];
  
  const frame = problemFrames[Math.floor(Math.random() * problemFrames.length)];
  const problem = extractProblem(idea);
  
  return `${frame} ${problem}—here's the science-backed solution`;
}

/**
 * Generate study-focused hook for case studies
 */
function generateStudyHook(idea: string): string {
  const studyFrames = [
    "A groundbreaking study found",
    "Researchers discovered",
    "New evidence shows",
    "Clinical trials reveal"
  ];
  
  const frame = studyFrames[Math.floor(Math.random() * studyFrames.length)];
  const finding = extractKeyFinding(idea);
  
  return `${frame} ${finding}—the implications change everything`;
}

/**
 * Generate myth-busting hook
 */
function generateMythHook(idea: string): string {
  const mythFrames = [
    "The myth:",
    "Everyone believes:",
    "Common assumption:",
    "Popular wisdom:"
  ];
  
  const frame = mythFrames[Math.floor(Math.random() * mythFrames.length)];
  const myth = extractMyth(idea);
  
  return `${frame} ${myth}. The reality is more nuanced`;
}

/**
 * Build body tweets with evidence and explanation
 */
function buildBodyTweets(facts: string[], citations: StudyCitation[], targetCount: number): string[] {
  const bodyTweets: string[] = [];
  
  // Ensure we have enough content for body tweets
  const contentPieces = [...facts];
  
  // Add citations as content if available
  citations.forEach(citation => {
    contentPieces.push(formatStudyCitation(citation));
  });
  
  // Build body tweets (one idea per tweet)
  for (let i = 0; i < Math.min(targetCount, contentPieces.length); i++) {
    const fact = contentPieces[i];
    const bodyTweet = buildSingleBodyTweet(fact, i === 0);
    
    if (bodyTweet.length <= 240) {
      bodyTweets.push(bodyTweet);
    }
  }
  
  // If we don't have enough body content, create explanatory tweets
  while (bodyTweets.length < targetCount && bodyTweets.length < 3) {
    const explanatory = generateExplanatoryTweet(facts[0] || "health optimization", bodyTweets.length);
    bodyTweets.push(explanatory);
  }
  
  return bodyTweets;
}

/**
 * Build single body tweet with one clear idea
 */
function buildSingleBodyTweet(fact: string, isFirst: boolean): string {
  // Clean and format the fact
  let tweet = fact.trim();
  
  // Add evidence markers if missing
  if (!hasEvidenceMarker(tweet)) {
    const markers = ["Research shows:", "Studies find:", "Data reveals:", "Evidence suggests:"];
    const marker = markers[Math.floor(Math.random() * markers.length)];
    tweet = `${marker} ${tweet}`;
  }
  
  // Ensure it's one clear idea
  if (tweet.includes(';') || tweet.includes('. ')) {
    tweet = tweet.split(/[;.]/)[0] + '.';
  }
  
  // Add stat or anatomic fact if relevant and missing
  if (!hasStatistic(tweet) && !hasAnatomicFact(tweet)) {
    tweet = addRelevantDetail(tweet);
  }
  
  return tweet;
}

/**
 * Build close tweet with actionable takeaway + soft CTA
 */
function buildCloseTweet(idea: string, format: string): string {
  const actionableTakeaway = generateActionableTakeaway(idea, format);
  const softCTA = "Follow for evidence-based health breakdowns.";
  
  let close = `${actionableTakeaway}\n\n${softCTA}`;
  
  // Ensure it fits in tweet length
  if (close.length > 240) {
    close = `${actionableTakeaway.substring(0, 200)}...\n\n${softCTA}`;
  }
  
  return close;
}

/**
 * Generate actionable takeaway based on content
 */
function generateActionableTakeaway(idea: string, format: string): string {
  const coreIdea = idea.toLowerCase();
  
  if (coreIdea.includes('sleep')) {
    return "Optimize sleep timing and environment over just duration for better results.";
  }
  
  if (coreIdea.includes('exercise')) {
    return "Focus on workout intensity and consistency rather than length.";
  }
  
  if (coreIdea.includes('nutrition') || coreIdea.includes('diet')) {
    return "Prioritize food quality and timing alongside caloric considerations.";
  }
  
  if (coreIdea.includes('stress')) {
    return "Use strategic stress (exercise, cold) to build resilience.";
  }
  
  // Generic actionable advice
  return "Apply these evidence-based principles for sustainable health improvements.";
}

/**
 * Calculate thread metadata and scores
 */
function calculateThreadMeta(tweets: string[], idea: string, facts: string[]): ThreadMeta {
  const totalCharacters = tweets.join('').length;
  const avgCharactersPerTweet = totalCharacters / tweets.length;
  
  // Score the thread
  const hookScore = scoreHook(tweets[0]);
  const clarityScore = scoreClarity(tweets);
  const noveltyScore = scoreNovelty(tweets, facts);
  const structureScore = scoreStructure(tweets);
  
  return {
    hookScore,
    clarityScore, 
    noveltyScore,
    structureScore,
    totalCharacters,
    avgCharactersPerTweet: Math.round(avgCharactersPerTweet)
  };
}

/**
 * Score hook effectiveness (0-1)
 */
function scoreHook(hook: string): number {
  let score = 0.5; // Base score
  
  // Curiosity gap indicators
  if (hook.includes('but') || hook.includes('however') || hook.includes('contrary')) {
    score += 0.2;
  }
  
  // No conclusions in hook
  if (!hook.includes('because') && !hook.includes('therefore') && !hook.includes('so')) {
    score += 0.1;
  }
  
  // Contrarian angle
  if (hook.includes('myth') || hook.includes('belief') || hook.includes('conventional')) {
    score += 0.15;
  }
  
  // Length appropriate
  if (hook.length >= 100 && hook.length <= 240) {
    score += 0.05;
  }
  
  return Math.min(1.0, score);
}

/**
 * Score clarity across all tweets (0-1)  
 */
function scoreClarity(tweets: string[]): number {
  let score = 0.6; // Base score
  
  // One idea per tweet
  const avgIdeasPerTweet = tweets.reduce((sum, tweet) => {
    const ideas = tweet.split(/[;,]/).length;
    return sum + ideas;
  }, 0) / tweets.length;
  
  if (avgIdeasPerTweet <= 1.2) {
    score += 0.2;
  }
  
  // Logical flow
  const hasFlow = tweets.some((tweet, i) => 
    i > 0 && (tweet.includes('next') || tweet.includes('then') || tweet.includes('also'))
  );
  
  if (hasFlow) {
    score += 0.1;
  }
  
  // No jargon without explanation
  const jargonWords = ['metabolic', 'circadian', 'homeostasis', 'inflammation'];
  const hasUnexplainedJargon = tweets.some(tweet => 
    jargonWords.some(jargon => tweet.includes(jargon) && !tweet.includes(':'))
  );
  
  if (!hasUnexplainedJargon) {
    score += 0.1;
  }
  
  return Math.min(1.0, score);
}

/**
 * Score novelty and insight quality (0-1)
 */
function scoreNovelty(tweets: string[], facts: string[]): number {
  let score = 0.5; // Base score
  
  // Surprising insights
  const surprisingWords = ['contrary', 'surprising', 'unexpected', 'counterintuitive'];
  if (tweets.some(tweet => surprisingWords.some(word => tweet.toLowerCase().includes(word)))) {
    score += 0.2;
  }
  
  // Recent research indicators
  if (tweets.some(tweet => tweet.includes('study') || tweet.includes('research'))) {
    score += 0.15;
  }
  
  // Specific statistics
  const hasStats = tweets.some(tweet => /\d+%|\d+ times|\d+x/.test(tweet));
  if (hasStats) {
    score += 0.15;
  }
  
  return Math.min(1.0, score);
}

/**
 * Score structure compliance (0-1)
 */
function scoreStructure(tweets: string[]): number {
  let score = 0.4; // Base score
  
  // Proper length (3-5 tweets)
  if (tweets.length >= 3 && tweets.length <= 5) {
    score += 0.2;
  }
  
  // Hook structure
  const hook = tweets[0];
  if (hook.includes('🧵') || hook.includes('👇') || hook.includes('thread')) {
    score += 0.1;
  }
  
  // Body structure (evidence in middle tweets)
  const hasEvidence = tweets.slice(1, -1).some(tweet => 
    hasEvidenceMarker(tweet) || hasStatistic(tweet)
  );
  if (hasEvidence) {
    score += 0.2;
  }
  
  // Close structure (actionable + CTA)
  const close = tweets[tweets.length - 1];
  if (close.includes('Follow') && (close.includes('.') || close.includes('!'))) {
    score += 0.1;
  }
  
  return Math.min(1.0, score);
}

// Helper functions
function hasEvidenceMarker(text: string): boolean {
  const markers = ['research shows', 'studies find', 'data reveals', 'evidence suggests', 'clinical trials'];
  return markers.some(marker => text.toLowerCase().includes(marker));
}

function hasStatistic(text: string): boolean {
  return /\d+%|\d+ times|\d+x|\d+ participants|\d+ years|\d+ hours/.test(text);
}

function hasAnatomicFact(text: string): boolean {
  const anatomicTerms = ['brain', 'heart', 'muscle', 'liver', 'kidney', 'lung', 'blood', 'hormone'];
  return anatomicTerms.some(term => text.toLowerCase().includes(term));
}

function addRelevantDetail(tweet: string): string {
  const core = tweet.toLowerCase();
  
  if (core.includes('sleep')) {
    return tweet.replace('.', ' (brain clears 60% more toxins during deep sleep).');
  }
  
  if (core.includes('exercise')) {
    return tweet.replace('.', ' (muscle protein synthesis peaks 24-48h post-workout).');
  }
  
  if (core.includes('stress')) {
    return tweet.replace('.', ' (cortisol levels drop 23% after 20min meditation).');
  }
  
  return tweet;
}

function extractTopic(idea: string): string {
  const topicKeywords = ['sleep', 'exercise', 'nutrition', 'stress', 'metabolism', 'hormones'];
  const lowerIdea = idea.toLowerCase();
  
  const foundTopic = topicKeywords.find(keyword => lowerIdea.includes(keyword));
  return foundTopic || 'health_optimization';
}

function extractProblem(idea: string): string {
  // Extract the problem from how-to ideas
  return idea.split('how to')[1]?.trim() || idea.split('.')[0];
}

function extractKeyFinding(idea: string): string {
  // Extract the key finding for study hooks
  return idea.split('.')[0];
}

function extractMyth(idea: string): string {
  // Extract the myth being busted
  return idea.split('.')[0];
}

function generateExplanatoryTweet(baseFact: string, index: number): string {
  const explanations = [
    "The mechanism: improved cellular energy production increases exercise capacity.",
    "Why it works: enhanced recovery allows for more frequent high-quality training.",
    "The result: sustainable improvements without burnout or plateaus."
  ];
  
  return explanations[index] || explanations[0];
}

export default { buildThread };
