/**
 * 🧹 CONTENT CLEANER
 * 
 * Removes banned elements and ensures viral-quality content
 */

export function cleanContentForViral(content: string): string {
  if (!content) return '';
  
  let cleaned = content.trim();
  
  // Remove hashtags completely (banned)
  cleaned = cleaned.replace(/#\w+/g, '');
  
  // Remove emojis (make content more professional)
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // Remove banned phrases
  const bannedPhrases = [
    'Thread below',
    'More in thread', 
    '👇',
    'Stay tuned',
    'More soon',
    'Let\'s dive in',
    'Let\'s explore'
  ];
  
  bannedPhrases.forEach(phrase => {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '');
  });
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove trailing punctuation that looks incomplete
  cleaned = cleaned.replace(/\.\.\.$/, '');
  
  return cleaned;
}

export function isViralWorthy(content: string): boolean {
  const cleaned = content.toLowerCase();
  
  // Check for viral elements
  const viralIndicators = [
    'wrong', 'truth', 'secret', 'myth', 'industry', 'lie', 'hidden',
    'shocking', 'surprising', 'discover', 'reveal', 'expose',
    'most people', 'everyone gets', 'nobody tells you',
    'doctors won\'t', 'industry doesn\'t want',
    'tried for', 'days', 'results', 'changed my'
  ];
  
  const hasViralElements = viralIndicators.some(indicator => 
    cleaned.includes(indicator)
  );
  
  // Check for specific numbers or percentages
  const hasNumbers = /\d+%|\d+x|\d+\s+(days|weeks|months|years|times)/.test(content);
  
  // Check for personal story elements
  const hasPersonalStory = /I\s+(tried|discovered|learned|found|realized)/.test(content);
  
  return hasViralElements && (hasNumbers || hasPersonalStory);
}

export function addViralElements(content: string, topic: string): string {
  // If content is already viral-worthy, return as is
  if (isViralWorthy(content)) {
    return cleanContentForViral(content);
  }
  
  // Add viral hook based on topic
  const viralHooks = [
    `Most people get ${topic} wrong. Here's the truth:`,
    `This common ${topic} mistake is sabotaging your health:`,
    `I tried this ${topic} approach for 30 days. Shocking results:`,
    `Your doctor won't tell you this about ${topic}:`,
    `The ${topic} industry doesn't want you to know:`
  ];
  
  const randomHook = viralHooks[Math.floor(Math.random() * viralHooks.length)];
  
  // Combine hook with cleaned content
  const cleaned = cleanContentForViral(content);
  return `${randomHook} ${cleaned}`;
}
