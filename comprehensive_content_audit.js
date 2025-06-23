#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE CONTENT & ENGAGEMENT AUDIT
 * 
 * Diagnoses why the bot isn't gaining followers or engagement
 * Analyzes content quality, patterns, and provides actionable fixes
 */

console.log('🔍 === COMPREHENSIVE BOT CONTENT AUDIT ===');
console.log('🎯 Diagnosing engagement and follower growth issues...\n');

const { supabaseClient } = require('./dist/utils/supabaseClient.js');

async function runComprehensiveAudit() {
  console.log('📊 === PHASE 1: RECENT CONTENT ANALYSIS ===');
  
  try {
    // 1. Analyze recent tweets for patterns
    const recentTweets = await analyzeRecentTweets();
    
    // 2. Check for repetitive content
    const contentPatterns = analyzeContentPatterns(recentTweets);
    
    // 3. Engagement analysis
    const engagementStats = analyzeEngagementData(recentTweets);
    
    // 4. Content quality assessment
    const qualityIssues = assessContentQuality(recentTweets);
    
    // 5. Generate actionable recommendations
    const recommendations = generateRecommendations(contentPatterns, engagementStats, qualityIssues);
    
    console.log('\n🎯 === AUDIT RESULTS ===');
    console.log('📈 Engagement Stats:', engagementStats);
    console.log('🔄 Content Patterns:', contentPatterns);
    console.log('⚠️ Quality Issues:', qualityIssues);
    console.log('💡 Recommendations:', recommendations);
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    
    // Manual content analysis if database fails
    console.log('\n🔍 === MANUAL CONTENT ANALYSIS ===');
    await manualContentAnalysis();
  }
}

async function analyzeRecentTweets() {
  try {
    const { data: tweets, error } = await supabaseClient.supabase
      ?.from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !tweets) {
      console.log('⚠️ No tweet data available, using test analysis');
      return [];
    }

    console.log(`📝 Analyzed ${tweets.length} recent tweets`);
    
    tweets.forEach((tweet, i) => {
      console.log(`${i + 1}. ${tweet.content?.substring(0, 80)}...`);
      console.log(`   💖 ${tweet.likes || 0} likes | 🔄 ${tweet.retweets || 0} RTs | 💬 ${tweet.replies || 0} replies`);
    });

    return tweets;
  } catch (error) {
    console.error('Error fetching tweets:', error);
    return [];
  }
}

function analyzeContentPatterns(tweets) {
  const patterns = {
    repetitiveQuestions: 0,
    openEndedQuestions: 0,
    factsWithData: 0,
    personalOpinions: 0,
    breakingNews: 0,
    engagementBait: 0,
    professionalTone: 0,
    casualTone: 0
  };

  const questionIndicators = ['?', 'what do you think', 'thoughts?', 'agree?', 'what\'s your'];
  const factIndicators = ['%', 'study shows', 'research reveals', 'data suggests'];
  const newsIndicators = ['breaking:', 'just in:', 'new study:', 'latest:'];
  const engagementBaitIndicators = ['like if', 'retweet if', 'comment below', 'tag someone'];

  tweets.forEach(tweet => {
    const content = tweet.content?.toLowerCase() || '';
    
    if (questionIndicators.some(indicator => content.includes(indicator))) {
      patterns.openEndedQuestions++;
    }
    
    if (factIndicators.some(indicator => content.includes(indicator))) {
      patterns.factsWithData++;
    }
    
    if (newsIndicators.some(indicator => content.includes(indicator))) {
      patterns.breakingNews++;
    }
    
    if (engagementBaitIndicators.some(indicator => content.includes(indicator))) {
      patterns.engagementBait++;
    }
    
    // Check for repetitive patterns
    if (content.includes('what do you think') || content.includes('thoughts?')) {
      patterns.repetitiveQuestions++;
    }
  });

  return patterns;
}

function analyzeEngagementData(tweets) {
  const totalTweets = tweets.length;
  const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
  const totalRetweets = tweets.reduce((sum, tweet) => sum + (tweet.retweets || 0), 0);
  const totalReplies = tweets.reduce((sum, tweet) => sum + (tweet.replies || 0), 0);
  
  return {
    totalTweets,
    averageLikes: totalTweets > 0 ? (totalLikes / totalTweets).toFixed(2) : 0,
    averageRetweets: totalTweets > 0 ? (totalRetweets / totalTweets).toFixed(2) : 0,
    averageReplies: totalTweets > 0 ? (totalReplies / totalTweets).toFixed(2) : 0,
    totalEngagement: totalLikes + totalRetweets + totalReplies,
    engagementRate: totalTweets > 0 ? ((totalLikes + totalRetweets + totalReplies) / totalTweets).toFixed(2) : 0
  };
}

function assessContentQuality(tweets) {
  const issues = {
    lackOfPersonality: 0,
    tooGeneric: 0,
    noActionableInsights: 0,
    poorTiming: 0,
    missingHashtags: 0,
    noVisualElements: 0,
    repetitiveFormats: 0
  };

  const genericPhrases = [
    'thoughts?', 'what do you think?', 'agree or disagree?', 
    'let me know', 'share your thoughts', 'comment below'
  ];

  tweets.forEach(tweet => {
    const content = tweet.content?.toLowerCase() || '';
    
    // Check for generic engagement phrases
    if (genericPhrases.some(phrase => content.includes(phrase))) {
      issues.tooGeneric++;
    }
    
    // Check for lack of specific data or insights
    if (!(/\d+%|\d+\.\d+%|\d+ years|\d+ million/.test(content))) {
      issues.noActionableInsights++;
    }
    
    // Check for missing hashtags
    if (!content.includes('#')) {
      issues.missingHashtags++;
    }
  });

  return issues;
}

function generateRecommendations(patterns, engagement, quality) {
  const recommendations = [];

  if (patterns.repetitiveQuestions > patterns.factsWithData) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Too many repetitive questions',
      solution: 'Replace 70% of questions with data-driven insights and breaking news',
      implementation: 'Update content mode selection to prioritize "current_events" and "breakthrough" content'
    });
  }

  if (parseFloat(engagement.engagementRate) < 2) {
    recommendations.push({
      priority: 'CRITICAL',
      issue: 'Very low engagement rate',
      solution: 'Implement viral content strategies with hooks, controversy, and shareable insights',
      implementation: 'Enhance UltraViralGenerator with more aggressive engagement tactics'
    });
  }

  if (quality.tooGeneric > 5) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Content too generic and boring',
      solution: 'Add personality, humor, hot takes, and controversial opinions',
      implementation: 'Create personality-driven content modes with strong viewpoints'
    });
  }

  if (patterns.breakingNews < 2) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Not enough timely, newsworthy content',
      solution: 'Increase real-time health tech news and breakthrough announcements',
      implementation: 'Fix NewsAPI integration or enhance OpenAI news generation'
    });
  }

  recommendations.push({
    priority: 'HIGH',
    issue: 'Missing follower growth strategy',
    solution: 'Implement follow-worthy content: exclusive insights, predictions, threads',
    implementation: 'Create "thought leadership" content mode with bold predictions and analysis'
  });

  return recommendations;
}

async function manualContentAnalysis() {
  console.log('🔍 Analyzing current content generation patterns...');
  
  // Test current content generation
  try {
    const { PostTweetAgent } = require('./dist/agents/postTweet.js');
    const agent = new PostTweetAgent();
    
    console.log('\n📝 Testing current content generation (5 samples):');
    
    for (let i = 1; i <= 5; i++) {
      try {
        const result = await agent.run(false, true, true); // dryRun mode
        console.log(`\n${i}. Generated Content:`);
        console.log(`   📝 "${result.content}"`);
        console.log(`   🎯 Type: ${result.content_type || 'unknown'}`);
        console.log(`   📊 Quality: ${result.qualityScore || 'N/A'}`);
        
        // Analyze this specific content
        const analysis = analyzeSpecificContent(result.content);
        console.log(`   🔍 Analysis: ${analysis}`);
        
      } catch (error) {
        console.log(`${i}. ❌ Generation failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Could not test content generation:', error);
  }
}

function analyzeSpecificContent(content) {
  if (!content) return 'Empty content';
  
  const issues = [];
  const strengths = [];
  
  // Check for issues
  if (content.includes('?') && (content.includes('thoughts') || content.includes('think'))) {
    issues.push('Generic question');
  }
  
  if (!/\d+%|\d+\.\d+%|\d+ \w+/.test(content)) {
    issues.push('No specific data');
  }
  
  if (!/#\w+/.test(content)) {
    issues.push('No hashtags');
  }
  
  if (content.length < 100) {
    issues.push('Too short');
  }
  
  // Check for strengths
  if (/\d+%|\d+\.\d+%/.test(content)) {
    strengths.push('Has data');
  }
  
  if (content.includes('breakthrough') || content.includes('study') || content.includes('research')) {
    strengths.push('Scientific backing');
  }
  
  if (content.length > 200) {
    strengths.push('Good length');
  }
  
  return `Issues: ${issues.join(', ') || 'None'} | Strengths: ${strengths.join(', ') || 'None'}`;
}

// Critical Issues to Fix
console.log('🚨 === CRITICAL ISSUES LIKELY CAUSING POOR PERFORMANCE ===');
console.log('1. ❌ REPETITIVE QUESTIONS: "What do you think?" "Thoughts?" - BORING!');
console.log('2. ❌ NO PERSONALITY: Sounds like corporate press releases');
console.log('3. ❌ NO CONTROVERSY: Nothing to make people stop scrolling');
console.log('4. ❌ NO HUMOR: Health tech can be funny and engaging');
console.log('5. ❌ NO HOT TAKES: No strong opinions that spark debate');
console.log('6. ❌ NO THREADS: Missing high-engagement thread opportunities');
console.log('7. ❌ NO FOLLOW VALUE: Why would someone follow for more?');

console.log('\n✅ === WHAT SUCCESSFUL HEALTH TECH ACCOUNTS DO ===');
console.log('1. 🔥 BOLD PREDICTIONS: "AI will replace radiologists by 2027"');
console.log('2. 💡 INSIDER INSIGHTS: "Here\'s what Big Pharma doesn\'t want you to know"');
console.log('3. 🎯 SPECIFIC DATA: "This startup just raised $50M to cure diabetes"');
console.log('4. 🧵 VIRAL THREADS: "7 health tech trends that will blow your mind"');
console.log('5. 😂 RELATABLE HUMOR: "When your fitness tracker judges you for ordering pizza"');
console.log('6. 🚨 BREAKING NEWS: "JUST IN: FDA approves game-changing treatment"');
console.log('7. 💪 STRONG OPINIONS: "Telemedicine is overhyped and here\'s why"');

console.log('\n🚀 Running comprehensive audit...\n');
runComprehensiveAudit(); 