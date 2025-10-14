#!/usr/bin/env node

/**
 * RAILWAY LOG READER
 * Alternative methods to access Railway logs when CLI is broken
 */

const https = require('https');

console.log('🔍 RAILWAY LOG READER');
console.log('=====================');
console.log('');

console.log('Since Railway CLI is having authentication issues,');
console.log('here are alternative ways to access your logs:');
console.log('');

console.log('📋 METHOD 1: Railway Web Dashboard');
console.log('==================================');
console.log('1. Go to: https://railway.app');
console.log('2. Click on: XBOT project');
console.log('3. Click on: your service');
console.log('4. Click on: "Observability" or "Logs" tab');
console.log('5. You can see live logs there');
console.log('');

console.log('📋 METHOD 2: System Health Check');
console.log('=================================');
console.log('Let me check your system status...');
console.log('');

// Check system health
const healthUrl = 'https://xbot-production-844b.up.railway.app/health';

const req = https.get(healthUrl, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      
      console.log('🟢 SYSTEM HEALTH STATUS:');
      console.log('========================');
      console.log(`Status: ${health.status}`);
      console.log(`Mode: ${health.mode}`);
      console.log(`Posting Enabled: ${health.postingEnabled}`);
      console.log(`Uptime: ${Math.floor(health.uptime_seconds / 60)} minutes`);
      console.log(`Timers Active: Plan=${health.timers.plan}, Reply=${health.timers.reply}, Post=${health.timers.posting}, Learn=${health.timers.learn}`);
      console.log('');
      
      // Get metrics
      const metricsUrl = 'https://xbot-production-844b.up.railway.app/metrics';
      
      const metricsReq = https.get(metricsUrl, (metricsRes) => {
        let metricsData = '';
        
        metricsRes.on('data', (chunk) => {
          metricsData += chunk;
        });
        
        metricsRes.on('end', () => {
          try {
            const metrics = JSON.parse(metricsData);
            
            console.log('📊 SYSTEM METRICS (Last 60 minutes):');
            console.log('====================================');
            console.log(`Plans Executed: ${metrics.metrics.plans}`);
            console.log(`Replies Generated: ${metrics.metrics.replies}`);
            console.log(`Posts Published: ${metrics.metrics.postings}`);
            console.log(`Learning Runs: ${metrics.metrics.learnRuns}`);
            console.log(`OpenAI Calls: ${metrics.metrics.openaiCalls}`);
            console.log(`Errors: ${metrics.metrics.errors}`);
            console.log('');
            
            if (metrics.metrics.plans === 0 && metrics.metrics.replies === 0 && metrics.metrics.postings === 0) {
              console.log('⚠️  ISSUE DETECTED:');
              console.log('==================');
              console.log('No jobs have executed in the last 60 minutes.');
              console.log('This suggests either:');
              console.log('1. Job intervals are too long (using defaults)');
              console.log('2. Jobs are failing to start');
              console.log('3. Configuration variables not applied');
              console.log('');
              console.log('🔧 RECOMMENDED ACTION:');
              console.log('======================');
              console.log('Check your Railway Variables tab for these critical settings:');
              console.log('- JOBS_PLAN_INTERVAL_MIN = 15');
              console.log('- JOBS_POSTING_INTERVAL_MIN = 5');
              console.log('- JOBS_REPLY_INTERVAL_MIN = 20');
              console.log('- JOBS_AUTOSTART = true');
              console.log('- MODE = live');
            } else {
              console.log('✅ Jobs are executing normally!');
            }
            
          } catch (error) {
            console.log('❌ Could not parse metrics data');
          }
        });
      });
      
      metricsReq.on('error', (error) => {
        console.log('❌ Could not fetch metrics:', error.message);
      });
      
    } catch (error) {
      console.log('❌ Could not parse health data:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Could not connect to system:', error.message);
  console.log('');
  console.log('💡 Your system might be down or restarting.');
  console.log('Check Railway dashboard for deployment status.');
});

console.log('📋 METHOD 3: Manual Log Sharing');
console.log('===============================');
console.log('If you can access Railway logs in the web dashboard:');
console.log('1. Copy the last 50-100 lines of logs');
console.log('2. Paste them here');
console.log('3. I can analyze them for issues');
console.log('');

console.log('📋 METHOD 4: Railway CLI Retry');
console.log('==============================');
console.log('You can try these CLI commands periodically:');
console.log('');
console.log('export PATH="/usr/local/bin:$PATH"');
console.log('railway whoami  # Check if rate limit cleared');
console.log('railway login   # If not rate limited');
console.log('railway logs    # Once authenticated');
console.log('');
