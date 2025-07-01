#!/usr/bin/env node

/**
 * Fix TypeScript errors for TweetSearchResult usage across all agent files
 * The issue: agents are treating TweetSearchResult as an array instead of accessing .tweets property
 */

const fs = require('fs');
const path = require('path');

const agentFiles = [
  'src/agents/autonomousCommunityGrowthAgent.ts',
  'src/agents/autonomousLearningAgent.ts', 
  'src/agents/crossIndustryLearningAgent.ts',
  'src/agents/rateLimitedEngagementAgent.ts',
  'src/agents/realEngagementAgent.ts',
  'src/agents/replyAgent.ts'
];

function fixTweetSearchResultUsage(filePath) {
  console.log(`🔧 Fixing ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  // Fix patterns where TweetSearchResult is treated as array
  
  // Pattern 1: searchResult.length > 0
  content = content.replace(
    /(\w+)\s*&&\s*(\w+)\.length\s*>\s*0/g,
    (match, var1, var2) => {
      if (var1 === var2) {
        changes++;
        return `${var1} && ${var1}.success && ${var1}.tweets.length > 0`;
      }
      return match;
    }
  );
  
  // Pattern 2: searchResult[0] access
  content = content.replace(
    /(\w+)\[(\d+)\]/g,
    (match, varName, index) => {
      if (varName.includes('Tweets') || varName.includes('search') || varName.includes('result')) {
        changes++;
        return `${varName}.tweets[${index}]`;
      }
      return match;
    }
  );
  
  // Pattern 3: for...of searchResult
  content = content.replace(
    /for\s*\(\s*const\s+(\w+)\s+of\s+(\w+)\s*\)/g,
    (match, itemVar, arrayVar) => {
      if (arrayVar.includes('Tweets') || arrayVar.includes('search') || arrayVar.includes('result')) {
        changes++;
        return `for (const ${itemVar} of ${arrayVar}.tweets || [])`;
      }
      return match;
    }
  );
  
  // Pattern 4: searchResult.slice()
  content = content.replace(
    /(\w+)\.slice\(/g,
    (match, varName) => {
      if (varName.includes('Tweets') || varName.includes('search') || varName.includes('result')) {
        changes++;
        return `${varName}.tweets.slice(`;
      }
      return match;
    }
  );
  
  // Pattern 5: searchResult.filter()
  content = content.replace(
    /(\w+)\.filter\(/g,
    (match, varName) => {
      if (varName.includes('Tweets') || varName.includes('search') || varName.includes('result')) {
        changes++;
        return `${varName}.tweets.filter(`;
      }
      return match;
    }
  );
  
  // Pattern 6: searchResult.find()
  content = content.replace(
    /(\w+)\.find\(/g,
    (match, varName) => {
      if (varName.includes('Tweets') || varName.includes('search') || varName.includes('result')) {
        changes++;
        return `${varName}.tweets.find(`;
      }
      return match;
    }
  );
  
  // Fix SearchedTweet property names
  // author_id -> authorId
  content = content.replace(/\.author_id/g, '.authorId');
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${changes} issues in ${filePath}`);
  } else {
    console.log(`✅ No issues found in ${filePath}`);
  }
}

// Fix all agent files
agentFiles.forEach(fixTweetSearchResultUsage);

console.log('🎉 TypeScript error fixing complete!'); 