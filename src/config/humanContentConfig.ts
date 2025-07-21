/**
 * 🧠 HUMAN CONTENT CONFIGURATION
 * 
 * Enforces authentic, human-like content creation
 * - NO hashtags ever
 * - Natural conversational tone
 * - Authentic voice and personality
 */

export const HUMAN_CONTENT_CONFIG = {
  // Absolutely no hashtags
  noHashtags: true,
  
  // Human-like writing style
  conversationalTone: true,
  naturalLanguage: true,
  authenticVoice: true,
  
  // Content characteristics
  useEmojis: true, // Sparingly, like a real person
  useQuestions: true, // Engage naturally
  usePersonalOpinions: true,
  shareThoughts: true,
  
  // Avoid robotic patterns
  noGenericPhrases: true,
  noMarketingSpeak: true,
  noHashtagLists: true,
  
  // Human personality traits
  occasionalTypos: false, // Keep professional but human
  casualContractions: true, // "can't" instead of "cannot"
  personalPerspective: true, // "I think" "In my experience"
  
  // Content guidelines
  maxHashtags: 0, // NEVER use hashtags
  preferNaturalKeywords: true, // Embed topics naturally in text
  humanLikeStructure: true,
  
  // Banned phrases and patterns
  bannedPatterns: [
    '#', // No hashtags at all
    'Follow for more',
    'Like and retweet',
    'Thoughts?', // Too generic
    'What do you think?', // Too common
    'Drop your thoughts below',
    'Let me know in the comments',
    'Follow me for',
    'Don\'t forget to',
    'Make sure to',
    'Be sure to'
  ],
  
  // Human alternatives
  humanAlternatives: {
    'What do you think?': [
      'Curious what others have experienced with this.',
      'Anyone else notice this trend?',
      'This got me thinking...',
      'Makes me wonder if others see it the same way.',
      'Interested to hear different perspectives on this.'
    ],
    'Thoughts?': [
      'What\'s your take?',
      'How do you see it?',
      'Your experience?',
      'Sound familiar?',
      'Ring true for anyone else?'
    ]
  }
};

/**
 * Remove all hashtags from content
 */
export function removeHashtags(content: string): string {
  // Remove hashtags completely
  return content
    .replace(/#\w+/g, '') // Remove hashtags
    .replace(/\s+/g, ' ') // Clean up extra spaces
    .trim();
}

/**
 * Make content more human and conversational
 */
export function humanizeContent(content: string): string {
  let humanContent = content;
  
  // Remove hashtags first
  humanContent = removeHashtags(humanContent);
  
  // Replace robotic phrases with human ones
  HUMAN_CONTENT_CONFIG.bannedPatterns.forEach(pattern => {
    if (pattern !== '#') { // Skip hashtag pattern
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      humanContent = humanContent.replace(regex, '');
    }
  });
  
  // Add human contractions
  humanContent = humanContent
    .replace(/\bcannot\b/g, "can't")
    .replace(/\bdo not\b/g, "don't")
    .replace(/\bwill not\b/g, "won't")
    .replace(/\bit is\b/g, "it's")
    .replace(/\bthat is\b/g, "that's")
    .replace(/\bwho is\b/g, "who's")
    .replace(/\bwhat is\b/g, "what's")
    .replace(/\bwhere is\b/g, "where's")
    .replace(/\bhow is\b/g, "how's")
    .replace(/\bwe are\b/g, "we're")
    .replace(/\bthey are\b/g, "they're")
    .replace(/\byou are\b/g, "you're")
    .replace(/\bi am\b/g, "I'm")
    .replace(/\bhe is\b/g, "he's")
    .replace(/\bshe is\b/g, "she's");
  
  // Clean up spacing
  humanContent = humanContent.replace(/\s+/g, ' ').trim();
  
  return humanContent;
}

/**
 * Generate human-like content starters
 */
export function getHumanContentStarters(): string[] {
  return [
    "Just noticed something interesting...",
    "Been thinking about this lately:",
    "Something I've been seeing more of:",
    "This caught my attention today:",
    "Came across this insight:",
    "Here's what's fascinating:",
    "One thing I've learned:",
    "What strikes me about this:",
    "The more I think about it:",
    "This reminded me of something:",
    "There's something happening that",
    "I keep seeing this pattern where",
    "What I find remarkable is",
    "It's interesting how",
    "I've been noticing that"
  ];
}

/**
 * Generate human-like content endings
 */
export function getHumanContentEndings(): string[] {
  return [
    "Anyone else seeing this?",
    "Makes you wonder, doesn't it?",
    "That's what I'm seeing anyway.",
    "Could be just me though.",
    "Might be onto something here.",
    "Food for thought.",
    "Just my observation.",
    "What's your take on this?",
    "Curious if others have noticed this too.",
    "Worth keeping an eye on.",
    "Seems significant to me.",
    "At least in my experience.",
    "Could be a coincidence, but...",
    "Time will tell, I suppose.",
    "Makes sense when you think about it."
  ];
} 