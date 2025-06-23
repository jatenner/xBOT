#!/usr/bin/env node

/**
 * 🔍 GHOST KILLER DEPLOYMENT MONITOR
 * Checks if Ghost Killer is successfully activated after Render deployment
 */

require('dotenv').config();

console.log('🔍 === GHOST KILLER DEPLOYMENT MONITOR ===');
console.log('🎯 Checking if Render deployment activated Ghost Killer\n');

async function checkGhostKillerActivation() {
  console.log('📊 === DEPLOYMENT STATUS CHECK ===');
  
  // Check 1: Recent Activity
  console.log('\n1️⃣ CHECKING RECENT ACTIVITY...');
  try {
    const { supabaseClient } = require('./dist/utils/supabaseClient.js');
    
    const { data: tweets, error } = await supabaseClient.supabase
      .from('tweets')
      .select('content, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.log('⚠️  Database query failed:', error.message);
    } else if (tweets && tweets.length > 0) {
      console.log(`✅ Found ${tweets.length} recent tweets`);
      
      const latestTweet = new Date(tweets[0].created_at);
      const minutesSinceLatest = Math.round((Date.now() - latestTweet) / (1000 * 60));
      
      console.log(`📝 Latest tweet: ${minutesSinceLatest} minutes ago`);
      
      if (minutesSinceLatest < 60) {
        console.log('🔥 RECENT ACTIVITY: Bot is actively posting!');
      } else {
        console.log('⏰ ACTIVITY: May be in between posting cycles');
      }
    } else {
      console.log('❌ No recent tweets found');
    }
  } catch (error) {
    console.log('❌ Activity check failed:', error.message);
  }
  
  // Check 2: API Usage Trend
  console.log('\n2️⃣ CHECKING API USAGE TRENDS...');
  try {
    const { supabaseClient } = require('./dist/utils/supabaseClient.js');
    
    const { data: usage, error } = await supabaseClient.supabase
      .from('monthly_api_usage')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.log('⚠️  Usage data unavailable:', error.message);
    } else if (usage && usage.length > 0) {
      const latest = usage[0];
      console.log(`📊 API Usage: ${latest.tweets_count || 0} tweets this month`);
      
      if (latest.tweets_count > 0) {
        console.log('✅ API USAGE: Bot has been posting');
      } else {
        console.log('❌ API USAGE: No tweets recorded yet');
      }
    }
  } catch (error) {
    console.log('⚠️  Usage check skipped:', error.message);
  }
  
  // Check 3: Health Endpoint (if available)
  console.log('\n3️⃣ CHECKING HEALTH ENDPOINT...');
  try {
    const axios = require('axios');
    
    // Try the health endpoint with timeout
    const response = await axios.get('https://your-app.onrender.com/health', { 
      timeout: 10000,
      headers: { 'User-Agent': 'Ghost-Killer-Monitor/1.0' }
    });
    
    console.log('✅ Health endpoint responded');
    
    if (response.data) {
      console.log(`🔥 Ghost Killer Active: ${response.data.ghost_killer_active || 'unknown'}`);
      console.log(`⚡ Aggressive Mode: ${response.data.aggressive_mode || 'unknown'}`);
      console.log(`📊 Bot Status: ${response.data.status || 'unknown'}`);
      
      if (response.data.ghost_killer_active) {
        console.log('🎉 HEALTH CHECK: GHOST KILLER IS ACTIVE!');
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
      console.log('⚠️  Health endpoint not accessible (deployment may still be in progress)');
    } else {
      console.log('⚠️  Health check failed:', error.message);
    }
  }
  
  // Summary
  console.log('\n🎯 === GHOST KILLER ACTIVATION SUMMARY ===');
  console.log('');
  console.log('📈 WHAT TO WATCH FOR:');
  console.log('• 🔥 Engagement activities every 30 minutes');
  console.log('• 📝 New tweets every 25 minutes');
  console.log('• 📊 API usage increasing to 50+ calls/day');
  console.log('• 💖 Likes, follows, and replies starting');
  console.log('');
  console.log('⏰ TIMELINE:');
  console.log('• Next 2 hours: Ghost Killer should fully activate');
  console.log('• Next 24 hours: Engagement patterns establish');
  console.log('• Next 48 hours: Algorithm visibility improves');
  console.log('• Next 1 week: Ghost syndrome eliminated');
  console.log('');
  
  const now = new Date();
  const nextCheck = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
  console.log(`🔍 NEXT MONITORING: ${nextCheck.toLocaleString()}`);
  console.log('📋 Run this script again: node monitor_ghost_killer_deployment.js');
  console.log('');
  console.log('🎊 GHOST ACCOUNT SYNDROME ELIMINATION IN PROGRESS! 🎊');
}

checkGhostKillerActivation().catch(console.error); 