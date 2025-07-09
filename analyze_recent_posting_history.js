#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 ANALYZING RECENT POSTING HISTORY');
console.log('===================================\n');

async function analyzeRecentHistory() {
  try {
    // Get tweets from last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const { data: recentTweets, error } = await supabase
      .from('tweets')
      .select('*')
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return;
    }

    if (!recentTweets || recentTweets.length === 0) {
      console.log('❌ No tweets found in last 3 days');
      return;
    }

    console.log(`📊 Found ${recentTweets.length} tweets in last 3 days\n`);

    // Group by day
    const tweetsByDay = {};
    recentTweets.forEach(tweet => {
      const day = tweet.created_at.split('T')[0];
      if (!tweetsByDay[day]) {
        tweetsByDay[day] = [];
      }
      tweetsByDay[day].push(tweet);
    });

    // Analyze each day
    for (const [day, tweets] of Object.entries(tweetsByDay)) {
      console.log(`\n📅 ${day} (${tweets.length} tweets):`);
      console.log('=' + '='.repeat(day.length + tweets.length.toString().length + 10));
      
      // Check for burst posting
      let burstCount = 0;
      let maxBurstSize = 0;
      let currentBurst = [];
      
      for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];
        const postTime = new Date(tweet.created_at);
        
        console.log(`${i + 1}. ${postTime.toLocaleTimeString()}: "${tweet.content.substring(0, 70)}..."`);
        
        // Check for burst posting (within 15 minutes)
        if (i > 0) {
          const prevTime = new Date(tweets[i - 1].created_at);
          const timeDiff = (postTime - prevTime) / 1000 / 60; // minutes
          
          if (timeDiff <= 15) {
            if (currentBurst.length === 0) {
              currentBurst.push(i - 1);
            }
            currentBurst.push(i);
          } else {
            if (currentBurst.length > 1) {
              burstCount++;
              maxBurstSize = Math.max(maxBurstSize, currentBurst.length);
              console.log(`   🚨 BURST ${burstCount}: ${currentBurst.length} tweets in ${timeDiff.toFixed(1)} minutes`);
            }
            currentBurst = [];
          }
        }
      }
      
      // Check final burst
      if (currentBurst.length > 1) {
        burstCount++;
        maxBurstSize = Math.max(maxBurstSize, currentBurst.length);
        console.log(`   🚨 FINAL BURST: ${currentBurst.length} tweets in rapid succession`);
      }
      
      if (burstCount > 0) {
        console.log(`   ❌ ${burstCount} burst posting episodes detected (max: ${maxBurstSize} tweets)`);
      } else {
        console.log(`   ✅ No burst posting detected`);
      }
    }

    // Check for content repetition across all recent tweets
    console.log('\n📝 CONTENT REPETITION ANALYSIS (Last 3 Days):');
    console.log('==============================================');
    
    const contentMap = new Map();
    const duplicateGroups = [];
    const similarityGroups = [];
    
    recentTweets.forEach((tweet, index) => {
      const normalized = tweet.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150); // First 150 chars for comparison
      
      // Check for near-exact matches
      for (const [existingContent, existingIndex] of contentMap.entries()) {
        const similarity = calculateDetailedSimilarity(normalized, existingContent);
        
        if (similarity >= 0.9) {
          duplicateGroups.push({
            similarity: similarity,
            tweet1: existingIndex,
            tweet2: index,
            content1: recentTweets[existingIndex].content.substring(0, 80),
            content2: tweet.content.substring(0, 80),
            time1: new Date(recentTweets[existingIndex].created_at).toLocaleString(),
            time2: new Date(tweet.created_at).toLocaleString()
          });
        } else if (similarity >= 0.7) {
          similarityGroups.push({
            similarity: similarity,
            tweet1: existingIndex,
            tweet2: index,
            content1: recentTweets[existingIndex].content.substring(0, 80),
            content2: tweet.content.substring(0, 80),
            time1: new Date(recentTweets[existingIndex].created_at).toLocaleString(),
            time2: new Date(tweet.created_at).toLocaleString()
          });
        }
      }
      
      contentMap.set(normalized, index);
    });

    if (duplicateGroups.length > 0) {
      console.log(`❌ Found ${duplicateGroups.length} near-duplicate tweets (>90% similar):`);
      duplicateGroups.forEach((dup, i) => {
        console.log(`\n${i + 1}. ${Math.round(dup.similarity * 100)}% similarity:`);
        console.log(`   Tweet A (${dup.time1}): "${dup.content1}..."`);
        console.log(`   Tweet B (${dup.time2}): "${dup.content2}..."`);
      });
    } else {
      console.log('✅ No near-duplicate content found');
    }

    if (similarityGroups.length > 0) {
      console.log(`\n⚠️ Found ${similarityGroups.length} highly similar tweets (70-90% similar):`);
      similarityGroups.slice(0, 5).forEach((sim, i) => { // Show first 5
        console.log(`\n${i + 1}. ${Math.round(sim.similarity * 100)}% similarity:`);
        console.log(`   Tweet A (${sim.time1}): "${sim.content1}..."`);
        console.log(`   Tweet B (${sim.time2}): "${sim.content2}..."`);
      });
      if (similarityGroups.length > 5) {
        console.log(`   ... and ${similarityGroups.length - 5} more similar pairs`);
      }
    }

    // Check for common phrases/patterns
    console.log('\n🔍 COMMON PHRASE ANALYSIS:');
    console.log('==========================');
    
    const phraseMap = new Map();
    const commonPhrases = [
      'machine learning algorithms',
      'breakthrough',
      'revolutionary',
      '92% accuracy',
      '96% accuracy',
      'drug compounds',
      'promising drug',
      'clinical trials',
      'nature medicine',
      'artificial intelligence',
      'health tech',
      'healthcare diagnostics'
    ];
    
    commonPhrases.forEach(phrase => {
      const count = recentTweets.filter(tweet => 
        tweet.content.toLowerCase().includes(phrase.toLowerCase())
      ).length;
      
      if (count > 1) {
        phraseMap.set(phrase, count);
      }
    });
    
    if (phraseMap.size > 0) {
      console.log('🚨 Overused phrases detected:');
      for (const [phrase, count] of phraseMap.entries()) {
        console.log(`   "${phrase}": used ${count} times`);
      }
    } else {
      console.log('✅ No overused phrases detected');
    }

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

// More detailed similarity calculation
function calculateDetailedSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

async function checkSystemHealth() {
  console.log('\n🏥 SYSTEM HEALTH CHECK:');
  console.log('=======================');
  
  try {
    // Check if multiple posting jobs are running
    const { data: jobs } = await supabase
      .from('bot_config')
      .select('*')
      .like('key', '%job%')
      .order('key');
    
    if (jobs && jobs.length > 0) {
      console.log('⚙️ Active job configurations:');
      jobs.forEach(job => {
        console.log(`   ${job.key}: ${job.value}`);
      });
    }

    // Check for emergency modes
    const { data: emergencyConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .like('key', '%emergency%')
      .order('key');

    if (emergencyConfigs && emergencyConfigs.length > 0) {
      console.log('\n🚨 Emergency configurations:');
      emergencyConfigs.forEach(config => {
        console.log(`   ${config.key}: ${config.value}`);
      });
    }

    // Check rate limiting config
    const { data: rateLimitConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .or('key.ilike.%rate%,key.ilike.%limit%,key.ilike.%interval%')
      .order('key');

    if (rateLimitConfigs && rateLimitConfigs.length > 0) {
      console.log('\n⏱️ Rate limiting configurations:');
      rateLimitConfigs.forEach(config => {
        console.log(`   ${config.key}: ${config.value}`);
      });
    }

  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

async function main() {
  await analyzeRecentHistory();
  await checkSystemHealth();
  
  console.log('\n🎯 DIAGNOSIS SUMMARY:');
  console.log('====================');
  console.log('✅ Run this diagnosis to identify:');
  console.log('   1. Burst posting patterns (8+ tweets at once)');
  console.log('   2. Content repetition and duplicates');
  console.log('   3. Overused phrases and templates');
  console.log('   4. System configuration issues');
  console.log('\n💡 Next step: Fix identified issues with targeted solutions');
}

main().catch(console.error); 