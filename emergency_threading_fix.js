#!/usr/bin/env node

/**
 * 🚨 EMERGENCY THREADING FIX
 * ==========================
 * The threading fix didn't work because the content uses "1/" "2/" not "1/4" "2/4"
 */

console.log('🚨 EMERGENCY THREADING FIX');
console.log('===========================');

// Your actual current problematic content uses "1/" "2/" "3/" pattern
const actualContent = `Everything you've heard about the Carnivore Diet is completely wrong. Here's why: 🧵 1/ You've been told it's dangerous, but new research shows it can be transformative. Meat-only diets can improve heart health and reduce inflammation. 🥩 2/ I'm a nutritionist with over 15 years of experience, and I've never seen results like these. Clients report weight loss, mental clarity, and energy boosts. 3/ Thousands are sharing their success stories. This isn't just a fad—it's a movement. The Carnivore Diet is changing lives, and it could change yours. 4/ The fear of cholesterol is outdated. Modern science supports the benefits of meat-first nutrition. Don't miss out on the future of health. 5/ Join the discussion: Are you brave enough to rethink everything you know about nutrition? 🔥 Retweet if you're ready to challenge the status quo. Let's start a revolution in how we view food. 🍖`;

console.log('\\n🔍 ANALYZING CURRENT CONTENT PATTERN:');
console.log('=====================================');
console.log('Content uses: "1/" "2/" "3/" "4/" "5/" pattern');
console.log('My fix looked for: "1/4" "2/4" "3/4" pattern');
console.log('❌ MISMATCH! That\\'s why the fix didn\\'t work');

function fixedParseNumberedThread(content) {
  console.log('\\n🔧 APPLYING CORRECTED PARSING...');
  
  const hasNumberedSlash = /\\d+\//.test(content);
  const hasThreadMarkers = content.includes('🧵') || content.includes('THREAD');
  
  if (!hasNumberedSlash && !hasThreadMarkers) {
    return { isThread: false, tweets: [content] };
  }
  
  console.log('✅ Thread patterns detected');
  
  // Remove thread indicators
  let cleaned = content
    .replace(/🧵\\s*THREAD\\s*🧵\\s*/g, '')
    .replace(/Here's why:\\s*/g, '')
    .trim();
  
  // Split on "1/" "2/" "3/" patterns (not "1/4" patterns!)
  const parts = cleaned.split(/\\s+(\\d+\/)\\s*/);
  
  const tweets = [];
  let currentTweet = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part && part.match(/^\\d+\/$/)) {
      // Found a number pattern like "1/" - save current tweet and start new
      if (currentTweet.trim()) {
        tweets.push(currentTweet.trim());
      }
      currentTweet = '';
    } else {
      currentTweet += part + ' ';
    }
  }
  
  // Add final tweet
  if (currentTweet.trim()) {
    tweets.push(currentTweet.trim());
  }
  
  // Clean tweets
  const cleanedTweets = tweets
    .map(tweet => tweet.trim())
    .filter(tweet => tweet.length > 10)
    .map(tweet => tweet.replace(/^\\d+\/\\s*/, '').replace(/\\s+/g, ' ').trim());
  
  return {
    isThread: cleanedTweets.length > 1,
    tweets: cleanedTweets.length > 1 ? cleanedTweets : [content]
  };
}

console.log('\\n🧪 TESTING CORRECTED PARSING:');
console.log('==============================');

const result = fixedParseNumberedThread(actualContent);

console.log('\\n✅ CORRECTED RESULT:');
console.log(\`Is Thread: \${result.isThread}\`);
console.log(\`Number of tweets: \${result.tweets.length}\`);

if (result.isThread) {
  console.log('\\n🧵 PROPER THREAD BREAKDOWN:');
  result.tweets.forEach((tweet, index) => {
    console.log(\`\\nTweet \${index + 1}/\${result.tweets.length}:\`);
    console.log(\`"\${tweet}"\`);
    console.log(\`Length: \${tweet.length} chars\`);
  });
} else {
  console.log('❌ Still not working - needs more debugging');
}

console.log('\\n🔧 THE REAL FIX NEEDED:');
console.log('========================');
console.log('✅ Update regex from /\\\\d+\\/\\\\d+/ to /\\\\d+\\//');
console.log('✅ This will match "1/" "2/" "3/" instead of "1/4" "2/4"');
console.log('✅ Split pattern should be /\\\\s+(\\\\d+\\/)\\\\s*/ not /\\\\s+(\\\\d+\\/\\\\d+)\\\\s+/');

// Generate the exact fix code
console.log('\\n📝 EXACT CODE FIX:');
console.log('==================');
console.log(\`
// WRONG (current fix):
const hasNumberedPattern = /\\\\d+\\/\\\\d+/.test(raw);  // Looks for "1/4"
const parts = cleaned.split(/\\\\s+(\\\\d+\\/\\\\d+)\\\\s+/);  // Splits on "1/4"

// CORRECT (needed fix):  
const hasNumberedPattern = /\\\\d+\\//.test(raw);  // Looks for "1/"
const parts = cleaned.split(/\\\\s+(\\\\d+\\/)\\\\s*/);  // Splits on "1/"
\`);

console.log('\\n🚨 URGENT: Need to update threadUtils.ts with the correct regex pattern!');