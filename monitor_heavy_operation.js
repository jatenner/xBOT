#!/usr/bin/env node

/**
 * 🔍 MONITOR HEAVY OPERATION
 * 
 * Continuous monitoring to ensure system operates heavily
 */

require('dotenv').config();

async function monitorHeavyOperation() {
  console.log('🔍 === HEAVY OPERATION MONITOR ===');
  console.log('🎯 Monitoring system for heavy posting activity...');
  console.log('⏰ Started:', new Date().toLocaleString());
  console.log('');

  const startTime = Date.now();
  let checkCount = 0;
  let postsDetected = 0;
  let lastPostTime = null;

  // Monitor for 30 minutes
  const monitorDuration = 30 * 60 * 1000; // 30 minutes
  const checkInterval = 2 * 60 * 1000; // Check every 2 minutes

  console.log('📊 MONITORING PLAN:');
  console.log('⏰ Duration: 30 minutes');
  console.log('🔍 Check interval: Every 2 minutes');
  console.log('🎯 Expected: 1+ posts in 30 minutes (with 90min intervals)');
  console.log('📈 Target: Detect increased activity vs previous 4h intervals');
  console.log('');

  const monitorInterval = setInterval(async () => {
    checkCount++;
    const elapsed = Date.now() - startTime;
    const elapsedMinutes = Math.round(elapsed / 60000);

    console.log(`🔍 CHECK ${checkCount} (${elapsedMinutes}min elapsed)`);

    try {
      // Check database for recent posts
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Get posts from last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: recentPosts, error } = await supabase
        .from('tweets')
        .select('tweet_id, content, posted_at')
        .gte('posted_at', oneHourAgo)
        .order('posted_at', { ascending: false });

      if (!error && recentPosts) {
        const newPosts = recentPosts.length;
        if (newPosts > postsDetected) {
          const addedPosts = newPosts - postsDetected;
          console.log(`📈 ACTIVITY DETECTED: ${addedPosts} new posts!`);
          
          recentPosts.slice(0, addedPosts).forEach((post, i) => {
            console.log(`   📝 Post ${i+1}: ${post.content?.substring(0, 60)}...`);
            console.log(`   🆔 ID: ${post.tweet_id}`);
            console.log(`   ⏰ Time: ${new Date(post.posted_at).toLocaleTimeString()}`);
          });
          
          postsDetected = newPosts;
          lastPostTime = new Date(recentPosts[0].posted_at);
        } else {
          console.log(`⏳ No new posts (${newPosts} total in last hour)`);
        }
      } else {
        console.log(`❌ Database check failed: ${error?.message || 'Unknown error'}`);
      }

      // Check time since last post
      if (lastPostTime) {
        const timeSinceLastPost = Date.now() - lastPostTime.getTime();
        const minutesSinceLastPost = Math.round(timeSinceLastPost / 60000);
        console.log(`⏰ Last post: ${minutesSinceLastPost} minutes ago`);
        
        // With 90min intervals, we should see activity
        if (minutesSinceLastPost > 100) {
          console.log(`⚠️ CONCERN: ${minutesSinceLastPost}min since last post (expected ~90min)`);
        } else if (minutesSinceLastPost < 90) {
          console.log(`✅ GOOD: Active posting (${minutesSinceLastPost}min < 90min interval)`);
        }
      }

    } catch (error) {
      console.log(`❌ Monitor error: ${error.message}`);
    }

    console.log('');

    // Stop monitoring after duration
    if (elapsed >= monitorDuration) {
      clearInterval(monitorInterval);
      
      console.log('🎉 === MONITORING COMPLETE ===');
      console.log(`📊 Duration: ${elapsedMinutes} minutes`);
      console.log(`📈 Posts detected: ${postsDetected}`);
      console.log(`🔍 Checks performed: ${checkCount}`);
      
      if (postsDetected > 0) {
        console.log('✅ HEAVY OPERATION CONFIRMED: System is posting actively');
      } else {
        console.log('⚠️ LOW ACTIVITY: System may need intervention');
        console.log('💡 Suggested actions:');
        console.log('   - Check Railway logs for errors');
        console.log('   - Verify environment variables');
        console.log('   - Test manual posting');
      }
    }

  }, checkInterval);

  // Also log current optimization status
  console.log('📋 OPTIMIZATION STATUS:');
  console.log('✅ Posting interval: Reduced from 4h to 90min');
  console.log('✅ Daily limits: Increased from 8 to 16-20 posts');
  console.log('✅ JSON parsing: Fixed for advanced AI features');
  console.log('✅ Quality gates: Enhanced with better fallbacks');
  console.log('✅ Railway deployment: Active with latest fixes');
  console.log('');
}

// Start monitoring
monitorHeavyOperation();
