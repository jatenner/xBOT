#!/usr/bin/env node

/**
 * Fix remaining TypeScript errors more precisely
 */

const fs = require('fs');

function fixFile(filePath, fixes) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  fixes.forEach(({ search, replace, description }) => {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      changes++;
      console.log(`✅ Fixed: ${description}`);
    }
  });
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${changes} issues in ${filePath}`);
  }
}

// Fix autonomousCommunityGrowthAgent.ts
console.log('🔧 Fixing autonomousCommunityGrowthAgent.ts...');
fixFile('src/agents/autonomousCommunityGrowthAgent.ts', [
  {
    search: 'for (const query of searchQueries.tweets.slice(0, 2))',
    replace: 'for (const query of searchQueries.slice(0, 2))',
    description: 'Fix searchQueries array access'
  },
  {
    search: 'for (const search of searches.tweets.slice(0, 2))',
    replace: 'for (const search of searches.slice(0, 2))',
    description: 'Fix searches array access'
  },
  {
    search: 'for (const discussion of discussions.slice(0, 1))',
    replace: 'for (const discussion of discussions.tweets.slice(0, 1))',
    description: 'Fix discussions TweetSearchResult access'
  },
  {
    search: 'if (posts && posts.success && posts.tweets.length > 0)',
    replace: 'if (posts && posts.length > 0)',
    description: 'Fix posts array check'
  }
]);

// Fix autonomousLearningAgent.ts
console.log('🔧 Fixing autonomousLearningAgent.ts...');
fixFile('src/agents/autonomousLearningAgent.ts', [
  {
    search: 'await this.analyzeViralStructures(creator, topContent, industry);',
    replace: 'await this.analyzeViralStructures(creator, topContent.tweets, industry);',
    description: 'Fix topContent parameter to analyzeViralStructures'
  },
  {
    search: 'tweet.public_metrics',
    replace: 'tweet.publicMetrics',
    description: 'Fix public_metrics to publicMetrics'
  }
]);

// Fix crossIndustryLearningAgent.ts
console.log('🔧 Fixing crossIndustryLearningAgent.ts...');
fixFile('src/agents/crossIndustryLearningAgent.ts', [
  {
    search: 'await this.analyzeViralStructures(creator, topContent, industry);',
    replace: 'await this.analyzeViralStructures(creator, topContent.tweets, industry);',
    description: 'Fix topContent parameter to analyzeViralStructures'
  }
]);

// Fix rateLimitedEngagementAgent.ts
console.log('🔧 Fixing rateLimitedEngagementAgent.ts...');
fixFile('src/agents/rateLimitedEngagementAgent.ts', [
  {
    search: 'if (usersToFollow && usersToFollow.success && usersToFollow.tweets.length > 0)',
    replace: 'if (usersToFollow && usersToFollow.length > 0)',
    description: 'Fix usersToFollow array check'
  },
  {
    search: 'tweet.public_metrics',
    replace: 'tweet.publicMetrics',
    description: 'Fix public_metrics to publicMetrics'
  },
  {
    search: 'const tweet = goodTweets.tweets[0];',
    replace: 'const tweet = goodTweets[0];',
    description: 'Fix goodTweets array access'
  }
]);

// Fix realEngagementAgent.ts
console.log('🔧 Fixing realEngagementAgent.ts...');
fixFile('src/agents/realEngagementAgent.ts', [
  {
    search: 'if (usersToFollow && usersToFollow.success && usersToFollow.tweets.length > 0)',
    replace: 'if (usersToFollow && usersToFollow.length > 0)',
    description: 'Fix usersToFollow array check'
  }
]);

// Fix replyAgent.ts  
console.log('🔧 Fixing replyAgent.ts...');
fixFile('src/agents/replyAgent.ts', [
  {
    search: 'const metrics = tweet.public_metrics;',
    replace: 'const metrics = tweet.publicMetrics;',
    description: 'Fix public_metrics to publicMetrics'
  },
  {
    search: 'created_at: tweet.created_at,',
    replace: 'created_at: tweet.createdAt,',
    description: 'Fix created_at to createdAt'
  }
]);

console.log('🎉 Targeted TypeScript error fixing complete!'); 