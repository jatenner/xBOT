#!/usr/bin/env node

/**
 * 🔍 ANALYZE REAL TWEETS DATA - THE TRUTH
 * =======================================
 * 
 * Now we found the actual tweets table with 99 records.
 * This will show us the REAL posting patterns and whether
 * our burst posting fixes actually worked.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeRealTweetPatterns() {
  console.log('🔍 ANALYZING REAL TWEET POSTING PATTERNS');
  console.log('=' .repeat(60));
  
  try {
    // Get all tweets to analyze patterns
    const { data: tweets, error } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching tweets:', error);
      return;
    }
    
    console.log(`📊 Total tweets analyzed: ${tweets.length}\n`);
    
    // Get recent tweets (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentTweets = tweets.filter(tweet => 
      new Date(tweet.created_at) >= sevenDaysAgo
    );
    
    console.log(`📅 Recent tweets (last 7 days): ${recentTweets.length}`);
    
    // Group tweets by day and hour
    const tweetsByDay = {};
    const tweetsByHour = {};
    const tweetsByMinute = {};
    
    recentTweets.forEach(tweet => {
      const date = new Date(tweet.created_at);
      const dayKey = date.toISOString().split('T')[0];
      const hourKey = `${dayKey} ${date.getHours().toString().padStart(2, '0')}:00`;
      const minuteKey = `${dayKey} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      if (!tweetsByDay[dayKey]) tweetsByDay[dayKey] = [];
      if (!tweetsByHour[hourKey]) tweetsByHour[hourKey] = [];
      if (!tweetsByMinute[minuteKey]) tweetsByMinute[minuteKey] = [];
      
      tweetsByDay[dayKey].push(tweet);
      tweetsByHour[hourKey].push(tweet);
      tweetsByMinute[minuteKey].push(tweet);
    });
    
    // Check for burst posting (multiple tweets in same hour)
    console.log('\n🚨 BURST POSTING ANALYSIS:');
    console.log('-'.repeat(50));
    
    let burstDetected = false;
    let maxHourlyTweets = 0;
    let burstHours = [];
    
    Object.entries(tweetsByHour).forEach(([hour, tweets]) => {
      if (tweets.length > 3) {
        console.log(`⚡ BURST DETECTED: ${hour} - ${tweets.length} tweets`);
        burstDetected = true;
        burstHours.push({ hour, count: tweets.length });
        
        // Show exact times and content
        tweets.forEach(tweet => {
          const time = new Date(tweet.created_at).toLocaleTimeString('en-US', { 
            timeZone: 'America/New_York',
            hour12: true 
          });
          console.log(`   • ${time} EST: "${tweet.content?.substring(0, 60)}..."`);
        });
        console.log('');
      }
      maxHourlyTweets = Math.max(maxHourlyTweets, tweets.length);
    });
    
    if (!burstDetected) {
      console.log('✅ No burst posting detected in recent tweets');
    } else {
      console.log(`❌ BURST POSTING CONFIRMED: Max ${maxHourlyTweets} tweets in one hour`);
    }
    
    // Check for the specific 10:30 AM Eastern pattern
    console.log('\n⏰ 10:30 AM EASTERN TIME ANALYSIS:');
    console.log('-'.repeat(50));
    
    const tenThirtyPattern = Object.entries(tweetsByMinute).filter(([minute, tweets]) => {
      const date = new Date(minute);
      const estHour = (date.getUTCHours() - 5 + 24) % 24; // Convert to EST
      const estMinute = date.getUTCMinutes();
      return estHour === 10 && estMinute >= 25 && estMinute <= 35; // 10:25-10:35 AM range
    });
    
    if (tenThirtyPattern.length > 0) {
      console.log('⚠️  10:30 AM EASTERN PATTERN DETECTED:');
      tenThirtyPattern.forEach(([minute, tweets]) => {
        console.log(`   ${minute}: ${tweets.length} tweets`);
        tweets.forEach(tweet => {
          console.log(`     • "${tweet.content?.substring(0, 50)}..."`);
        });
      });
    } else {
      console.log('✅ No 10:30 AM Eastern burst pattern detected');
    }
    
    // Daily posting counts
    console.log('\n📅 DAILY POSTING COUNTS:');
    console.log('-'.repeat(50));
    Object.entries(tweetsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([day, tweets]) => {
        const status = tweets.length > 10 ? ' ⚠️ HIGH VOLUME' : 
                      tweets.length > 6 ? ' ⚠️ ABOVE TARGET' : ' ✅';
        console.log(`${day}: ${tweets.length} tweets${status}`);
      });
    
    // Content analysis for viral vs academic
    console.log('\n🦠 CONTENT TYPE ANALYSIS:');
    console.log('-'.repeat(50));
    
    let viralCount = 0;
    let academicCount = 0;
    let unknownCount = 0;
    
    recentTweets.forEach(tweet => {
      const content = tweet.content?.toLowerCase() || '';
      
      // Viral indicators
      if (content.includes('🧵') || content.includes('thread') || 
          content.includes('controversial') || content.includes('unpopular') ||
          content.includes('trigger warning') || content.includes('hot take') ||
          content.includes('nobody talks about') || content.includes('harsh truth')) {
        viralCount++;
      }
      // Academic indicators
      else if (content.includes('study shows') || content.includes('research indicates') ||
               content.includes('according to') || content.includes('evidence suggests') ||
               content.includes('published') || content.includes('peer-reviewed')) {
        academicCount++;
      }
      else {
        unknownCount++;
      }
    });
    
    console.log(`🦠 Viral content: ${viralCount} tweets`);
    console.log(`🎓 Academic content: ${academicCount} tweets`);
    console.log(`❓ Other content: ${unknownCount} tweets`);
    
    // Show recent tweet examples
    console.log('\n📝 RECENT TWEET EXAMPLES:');
    console.log('-'.repeat(50));
    
    const latestTweets = recentTweets.slice(-5);
    latestTweets.forEach(tweet => {
      const date = new Date(tweet.created_at);
      const estTime = date.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      console.log(`${estTime} EST: "${tweet.content?.substring(0, 100)}..."`);
    });
    
    return {
      totalTweets: tweets.length,
      recentTweets: recentTweets.length,
      burstDetected,
      maxHourlyTweets,
      burstHours: burstHours.length,
      viralCount,
      academicCount,
      daysActive: Object.keys(tweetsByDay).length
    };
    
  } catch (error) {
    console.error('❌ Error analyzing tweet patterns:', error);
  }
}

async function checkSystemConfigImplementation() {
  console.log('\n🔧 SYSTEM CONFIG IMPLEMENTATION CHECK:');
  console.log('=' .repeat(60));
  
  try {
    // Check if our configurations are being loaded
    const { data: configs, error } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', [
        'unified_daily_target',
        'disable_strategic_catch_up',
        'distributed_posting_schedule'
      ]);
    
    console.log('📋 Current configurations:');
    configs?.forEach(config => {
      console.log(`\n${config.key}:`);
      console.log(`  Set: ${config.updated_at}`);
      console.log(`  Value: ${JSON.stringify(config.value, null, 2)}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking configs:', error);
  }
}

async function main() {
  console.log('🔍 REAL TWEET DATA ANALYSIS');
  console.log('This will tell us exactly what happened with our fixes...\n');
  
  const analysis = await analyzeRealTweetPatterns();
  await checkSystemConfigImplementation();
  
  console.log('\n🎯 FINAL VERDICT:');
  console.log('=' .repeat(60));
  
  if (analysis) {
    if (analysis.burstDetected && analysis.maxHourlyTweets >= 10) {
      console.log('❌ CHANGES FAILED: Burst posting still occurring');
      console.log(`   Found ${analysis.burstHours} burst hours with up to ${analysis.maxHourlyTweets} tweets/hour`);
      console.log('   🚨 THE SYSTEM IS NOT RESPECTING OUR DATABASE CONFIGURATIONS');
    } else if (analysis.burstDetected && analysis.maxHourlyTweets > 3) {
      console.log('⚠️  PARTIAL SUCCESS: Reduced burst posting but not eliminated');
      console.log(`   Max tweets per hour: ${analysis.maxHourlyTweets} (should be 1)`);
    } else {
      console.log('✅ BURST POSTING FIXED: No significant bursts detected');
    }
    
    if (analysis.academicCount > analysis.viralCount && analysis.viralCount === 0) {
      console.log('❌ VIRAL CONTENT FAILED: Still posting academic content');
    } else if (analysis.viralCount > 0) {
      console.log('✅ VIRAL CONTENT ACTIVE: Detecting viral content patterns');
    }
    
    console.log(`\n📊 Key Stats:`);
    console.log(`   Recent tweets (7 days): ${analysis.recentTweets}`);
    console.log(`   Daily average: ${(analysis.recentTweets / Math.max(analysis.daysActive, 1)).toFixed(1)}`);
    console.log(`   Max tweets per hour: ${analysis.maxHourlyTweets}`);
    console.log(`   Viral vs Academic: ${analysis.viralCount} vs ${analysis.academicCount}`);
  }
  
  console.log('\n💡 Why our changes might not be working:');
  console.log('1. Production server not reading from our database configs');
  console.log('2. Code changes not deployed to Render');
  console.log('3. System using hardcoded values instead of database values');
  console.log('4. Multiple posting agents running simultaneously');
}

main().catch(console.error); 