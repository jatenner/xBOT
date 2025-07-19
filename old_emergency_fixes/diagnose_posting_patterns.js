#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 DIAGNOSING POSTING PATTERNS & CONTENT ISSUES');
console.log('================================================\n');

async function analyzeTodaysPosts() {
  console.log('📊 ANALYZING TODAY\'S POSTING PATTERNS...\n');

  try {
    // Get today's tweets
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysTweets, error } = await supabase
      .from('tweets')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return;
    }

    if (!todaysTweets || todaysTweets.length === 0) {
      console.log('❌ No tweets found for today');
      return;
    }

    console.log(`📊 Found ${todaysTweets.length} tweets today\n`);

    // 1. ANALYZE TIMING PATTERNS
    console.log('⏰ TIMING ANALYSIS:');
    console.log('==================');
    
    const postTimes = [];
    let burstGroups = [];
    let currentBurst = [];
    
    for (let i = 0; i < todaysTweets.length; i++) {
      const tweet = todaysTweets[i];
      const postTime = new Date(tweet.created_at);
      postTimes.push(postTime);
      
      console.log(`${i + 1}. ${postTime.toLocaleTimeString()}: "${tweet.content.substring(0, 60)}..."`);
      
      // Check for burst posting (multiple posts within 10 minutes)
      if (i > 0) {
        const prevTime = new Date(todaysTweets[i - 1].created_at);
        const timeDiff = (postTime - prevTime) / 1000 / 60; // minutes
        
        if (timeDiff <= 10) {
          if (currentBurst.length === 0) {
            currentBurst.push(i - 1); // Add previous tweet to burst
          }
          currentBurst.push(i);
        } else {
          if (currentBurst.length > 1) {
            burstGroups.push([...currentBurst]);
          }
          currentBurst = [];
        }
      }
    }
    
    // Add final burst if exists
    if (currentBurst.length > 1) {
      burstGroups.push(currentBurst);
    }

    console.log('\n🚨 BURST POSTING ANALYSIS:');
    if (burstGroups.length > 0) {
      console.log(`❌ Found ${burstGroups.length} burst posting groups:`);
      burstGroups.forEach((burst, i) => {
        console.log(`   Burst ${i + 1}: ${burst.length} tweets in rapid succession`);
        burst.forEach(tweetIndex => {
          const tweet = todaysTweets[tweetIndex];
          const time = new Date(tweet.created_at);
          console.log(`     ${time.toLocaleTimeString()}: "${tweet.content.substring(0, 50)}..."`);
        });
      });
    } else {
      console.log('✅ No burst posting detected - good spacing');
    }

    // 2. ANALYZE CONTENT UNIQUENESS
    console.log('\n📝 CONTENT UNIQUENESS ANALYSIS:');
    console.log('================================');
    
    const contentHashes = new Map();
    const duplicates = [];
    const similarities = [];
    
    for (let i = 0; i < todaysTweets.length; i++) {
      const tweet = todaysTweets[i];
      const normalizedContent = tweet.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Check for exact duplicates
      if (contentHashes.has(normalizedContent)) {
        duplicates.push({
          current: i,
          duplicate: contentHashes.get(normalizedContent),
          content: tweet.content.substring(0, 80)
        });
      } else {
        contentHashes.set(normalizedContent, i);
      }
      
      // Check for high similarity with previous tweets
      for (let j = 0; j < i; j++) {
        const prevTweet = todaysTweets[j];
        const prevNormalized = prevTweet.content
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        const similarity = calculateSimilarity(normalizedContent, prevNormalized);
        if (similarity > 0.7) {
          similarities.push({
            tweet1: j,
            tweet2: i,
            similarity: Math.round(similarity * 100),
            content1: prevTweet.content.substring(0, 60),
            content2: tweet.content.substring(0, 60)
          });
        }
      }
    }

    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} exact duplicates:`);
      duplicates.forEach((dup, i) => {
        console.log(`   ${i + 1}. Tweet ${dup.current + 1} duplicates Tweet ${dup.duplicate + 1}:`);
        console.log(`      "${dup.content}..."`);
      });
    } else {
      console.log('✅ No exact duplicates found');
    }

    if (similarities.length > 0) {
      console.log(`\n⚠️ Found ${similarities.length} highly similar tweets (>70%):`);
      similarities.forEach((sim, i) => {
        console.log(`   ${i + 1}. ${sim.similarity}% similarity between tweets ${sim.tweet1 + 1} and ${sim.tweet2 + 1}:`);
        console.log(`      Tweet ${sim.tweet1 + 1}: "${sim.content1}..."`);
        console.log(`      Tweet ${sim.tweet2 + 1}: "${sim.content2}..."`);
      });
    } else {
      console.log('✅ No highly similar content found');
    }

    // 3. ANALYZE POSTING INTERVALS
    console.log('\n⏰ POSTING INTERVAL ANALYSIS:');
    console.log('============================');
    
    const intervals = [];
    for (let i = 1; i < todaysTweets.length; i++) {
      const current = new Date(todaysTweets[i].created_at);
      const previous = new Date(todaysTweets[i - 1].created_at);
      const intervalMinutes = (current - previous) / 1000 / 60;
      intervals.push(intervalMinutes);
    }

    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const minInterval = Math.min(...intervals);
      const maxInterval = Math.max(...intervals);
      
      console.log(`📊 Average interval: ${avgInterval.toFixed(1)} minutes`);
      console.log(`⚡ Shortest interval: ${minInterval.toFixed(1)} minutes`);
      console.log(`⏳ Longest interval: ${maxInterval.toFixed(1)} minutes`);
      
      if (minInterval < 5) {
        console.log('❌ PROBLEM: Some posts are too close together (< 5 minutes)');
      } else if (minInterval < 30) {
        console.log('⚠️ WARNING: Posting frequency might be too high for best engagement');
      } else {
        console.log('✅ Good posting intervals for engagement');
      }
    }

    // 4. CHECK POSTING CONFIGURATION
    console.log('\n⚙️ POSTING CONFIGURATION CHECK:');
    console.log('==============================');
    
    const configs = [
      'max_posts_per_day',
      'target_posting_interval_minutes',
      'content_cache_ratio',
      'disable_learning',
      'runtime_mode'
    ];

    for (const configKey of configs) {
      const { data: config } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', configKey)
        .single();
      
      console.log(`${configKey}: ${config?.value || 'NOT SET'}`);
    }

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

// Simple similarity calculation
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const allWords = new Set([...words1, ...words2]);
  
  let matches = 0;
  for (const word of allWords) {
    if (words1.includes(word) && words2.includes(word)) {
      matches++;
    }
  }
  
  return matches / allWords.size;
}

async function checkSchedulerConfig() {
  console.log('\n🕐 SCHEDULER CONFIGURATION CHECK:');
  console.log('=================================');
  
  try {
    // Check daily posting manager settings
    const { data: dailyConfig } = await supabase
      .from('bot_config')
      .select('*')
      .like('key', '%daily%')
      .order('key');

    if (dailyConfig && dailyConfig.length > 0) {
      console.log('📅 Daily posting configuration:');
      dailyConfig.forEach(config => {
        console.log(`   ${config.key}: ${config.value}`);
      });
    }

    // Check scheduler job settings
    const { data: schedulerConfig } = await supabase
      .from('bot_config')
      .select('*')
      .like('key', '%scheduler%')
      .order('key');

    if (schedulerConfig && schedulerConfig.length > 0) {
      console.log('\n⏰ Scheduler configuration:');
      schedulerConfig.forEach(config => {
        console.log(`   ${config.key}: ${config.value}`);
      });
    }

  } catch (error) {
    console.error('❌ Scheduler config check failed:', error);
  }
}

async function main() {
  await analyzeTodaysPosts();
  await checkSchedulerConfig();
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('==================');
  console.log('1. If burst posting detected: Fix scheduler timing');
  console.log('2. If content repetition found: Improve uniqueness checking');
  console.log('3. If intervals too short: Increase minimum posting interval');
  console.log('4. Aim for 2-4 hour intervals between posts for best engagement');
}

main().catch(console.error); 