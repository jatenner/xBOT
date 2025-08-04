#!/usr/bin/env node

/**
 * 🔧 FIX THREADING SYSTEM
 * =======================
 * Fixes the thread parsing to properly split content into separate tweets
 */

console.log('🔧 FIXING THREADING SYSTEM');
console.log('===========================');

// Your actual problematic content
const problematicContent = [
  {
    name: "Blue Light Thread",
    content: "Blue light disrupting your sleep? That's a myth. 😮 Here's why: 🧵 THREAD 🧵 1/4 You've heard blue light from screens ruins sleep. Wrong! Research shows the real issue is inconsistent sleep patterns, not screen time. 2/4 A Harvard study found dim light impacts melatonin more than BLUE light. Bet you didn't see that coming! 👀 3/4 As a sleep expert with 15 years of experience, I tell my clients: focus on routine, ditch the blame game on tech. 4/4 Want better sleep? Try regular sleep schedules. Don't miss out on REAL advice. Retweet if you'll give it a try! 🌙 #SleepMyths #SleepHealth"
  },
  {
    name: "Carnivore Thread", 
    content: "The carnivore diet is healthier than you think! 🥩🍖 1/5 Popular belief says plant-based is king. WRONG. Here's why: 2/5 I've researched diets for 10+ years & the evidence is undeniable. The nutrient density & benefits of a carnivore diet are backed by top experts. Dr. Shawn Baker & countless testimonials prove it! 3/5 Studies show increased energy, improved digestion, & mental clarity. But mainstream media won't tell you about it because it defies the norm. 4/5 Imagine being part of a growing movement that's transforming lives worldwide. Don't let outdated beliefs hold you back. 5/5 Ready to rethink your health? Join the conversation! 💬 Comment, retweet, and share your experiences. #CarnivoreClarity #HealthRevolution"
  }
];

// IMPROVED THREAD PARSING FUNCTION
function parseThreadContent(content) {
  console.log(`\\n🧵 PARSING: ${content.substring(0, 50)}...`);
  
  // Remove thread header indicators first
  let cleaned = content
    .replace(/🧵\s*THREAD\s*🧵\s*/g, '')
    .replace(/Here's why:\s*/g, '')
    .trim();
  
  // Split on numbered patterns like "1/4", "2/4", "3/4", etc.
  // This regex finds patterns like "1/4", "2/5", etc.
  const parts = cleaned.split(/\s+(\d+\/\d+)\s+/);
  
  const tweets = [];
  let currentTweet = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // If this part is a number pattern (1/4, 2/4, etc.), start a new tweet
    if (part && part.match(/^\d+\/\d+$/)) {
      // Save previous tweet if it exists
      if (currentTweet.trim()) {
        tweets.push(currentTweet.trim());
      }
      // Start new tweet
      currentTweet = '';
    } else {
      // Add content to current tweet
      currentTweet += part + ' ';
    }
  }
  
  // Add the last tweet
  if (currentTweet.trim()) {
    tweets.push(currentTweet.trim());
  }
  
  // Clean up each tweet
  const cleanedTweets = tweets
    .map(tweet => tweet.trim())
    .filter(tweet => tweet.length > 10) // Remove very short fragments
    .map(tweet => {
      // Clean up common issues
      return tweet
        .replace(/^\d+\/\d+\s*/, '') // Remove any remaining number patterns
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    });
  
  return cleanedTweets;
}

// Test the improved parsing
problematicContent.forEach(({ name, content }) => {
  console.log(`\\n🔍 TESTING: ${name}`);
  console.log('='.repeat(50));
  
  console.log('❌ CURRENT PROBLEM:');
  console.log(`   Single tweet: "${content.substring(0, 100)}..."`);
  console.log('   Contains thread indicators but posted as one tweet!');
  
  const tweets = parseThreadContent(content);
  
  console.log(`\\n✅ FIXED - PROPER THREAD (${tweets.length} tweets):`);
  tweets.forEach((tweet, index) => {
    console.log(`\\n--- Tweet ${index + 1}/${tweets.length} ---`);
    console.log(`"${tweet}"`);
    console.log(`Length: ${tweet.length} chars`);
  });
});

console.log('\\n\\n🔧 CREATING FIXED THREAD UTILS');
console.log('=================================');

// Create the fixed thread parsing function
const fixedThreadUtils = `
/**
 * 🔧 FIXED THREAD PARSING FUNCTION
 * ================================
 * Properly splits content with numbered patterns (1/4, 2/4, etc.) into separate tweets
 */

export function parseNumberedThreadFixed(content: string): {
  isThread: boolean;
  tweets: string[];
  originalContent: string;
} {
  const originalContent = content;
  
  // Check if content contains thread indicators
  const hasNumberedPattern = /\\d+\\/\\d+/.test(content);
  const hasThreadMarkers = content.includes('🧵') || content.includes('THREAD');
  
  if (!hasNumberedPattern && !hasThreadMarkers) {
    return {
      isThread: false,
      tweets: [content],
      originalContent
    };
  }
  
  console.log('🧵 Thread indicators detected, parsing...');
  
  // Remove thread header indicators
  let cleaned = content
    .replace(/🧵\\s*THREAD\\s*🧵\\s*/g, '')
    .replace(/Here's why:\\s*/g, '')
    .trim();
  
  // Split on numbered patterns like "1/4", "2/4", "3/4"
  const parts = cleaned.split(/\\s+(\\d+\\/\\d+)\\s+/);
  
  const tweets = [];
  let currentTweet = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // If this part is a number pattern, save current tweet and start new one
    if (part && part.match(/^\\d+\\/\\d+$/)) {
      if (currentTweet.trim()) {
        tweets.push(currentTweet.trim());
      }
      currentTweet = '';
    } else {
      currentTweet += part + ' ';
    }
  }
  
  // Add the last tweet
  if (currentTweet.trim()) {
    tweets.push(currentTweet.trim());
  }
  
  // Clean up tweets
  const cleanedTweets = tweets
    .map(tweet => tweet.trim())
    .filter(tweet => tweet.length > 10)
    .map(tweet => {
      return tweet
        .replace(/^\\d+\\/\\d+\\s*/, '')
        .replace(/\\s+/g, ' ')
        .trim();
    });
  
  if (cleanedTweets.length > 1) {
    console.log(\`✅ Successfully parsed into \${cleanedTweets.length} tweets\`);
    return {
      isThread: true,
      tweets: cleanedTweets,
      originalContent
    };
  }
  
  // If parsing failed, return as single tweet
  return {
    isThread: false,
    tweets: [content],
    originalContent
  };
}
`;

console.log('✅ Fixed thread parsing function created');

console.log('\\n🚀 IMPLEMENTATION PLAN:');
console.log('========================');
console.log('1. Update src/utils/threadUtils.ts with fixed parsing');
console.log('2. Test with your actual problematic content');
console.log('3. Deploy to ensure threads are properly split');
console.log('4. Verify that "THREAD 1/4" becomes 4 separate connected tweets');

console.log('\\n🎯 EXPECTED RESULT:');
console.log('===================');
console.log('BEFORE: Single tweet saying "THREAD 1/4" with all content');
console.log('AFTER: 4 separate connected tweets in proper thread format');
console.log('- Tweet 1: Thread starter');
console.log('- Tweet 2: Reply to Tweet 1');
console.log('- Tweet 3: Reply to Tweet 2');
console.log('- Tweet 4: Reply to Tweet 3');

console.log('\\n✅ Threading problem identified and solution ready!');