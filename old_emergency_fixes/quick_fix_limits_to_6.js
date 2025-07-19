#!/usr/bin/env node

const fs = require('fs');

console.log('🔧 Fixing rate limits to 6 tweets per day...');

// Fix dailyPostingManager.ts
const dailyManagerPath = 'src/utils/dailyPostingManager.ts';
let dailyManagerContent = fs.readFileSync(dailyManagerPath, 'utf8');
dailyManagerContent = dailyManagerContent.replace(
  "parseInt(process.env.MAX_DAILY_TWEETS || '8')",
  "parseInt(process.env.MAX_DAILY_TWEETS || '6')"
);
fs.writeFileSync(dailyManagerPath, dailyManagerContent);
console.log('✅ Fixed dailyPostingManager.ts default to 6');

// Fix postTweet.ts rate limit check
const postTweetPath = 'src/agents/postTweet.ts';
let postTweetContent = fs.readFileSync(postTweetPath, 'utf8');
postTweetContent = postTweetContent.replace(
  'if (postsToday >= 8) {',
  'if (postsToday >= 6) {'
);
postTweetContent = postTweetContent.replace(
  'reason: `Daily limit reached: ${postsToday}/8 posts today`',
  'reason: `Daily limit reached: ${postsToday}/6 posts today`'
);
fs.writeFileSync(postTweetPath, postTweetContent);
console.log('✅ Fixed postTweet.ts rate limit to 6');

// Update monitor script
const monitorPath = 'monitor_rate_limits.js';
let monitorContent = fs.readFileSync(monitorPath, 'utf8');
monitorContent = monitorContent.replace(
  'Posts today: ${postsToday}/6 tweets',
  'Posts today: ${postsToday}/6 tweets'
); // Already correct
console.log('✅ Monitor script already uses 6');

console.log('🎯 All rate limits now set to 6 tweets per day'); 