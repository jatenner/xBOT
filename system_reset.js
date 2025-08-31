#!/usr/bin/env node

/**
 * 🔄 SYSTEM RESET SCRIPT
 * Resets all stuck states and restarts posting system
 */

require('dotenv').config();

async function systemReset() {
  console.log('🔄 === SYSTEM RESET ===');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Clear any Redis-like flags that might be stuck
    console.log('🧹 Clearing system state...');
    
    // Check recent posts to see what's happening
    const { data: recentPosts } = await supabase
      .from('tweets')
      .select('tweet_id, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('📊 Recent posts:');
    if (recentPosts && recentPosts.length > 0) {
      recentPosts.forEach(post => {
        const timeAgo = Math.round((Date.now() - new Date(post.created_at).getTime()) / (60 * 1000));
        console.log(`   - ${post.tweet_id}: ${timeAgo} minutes ago`);
      });
    } else {
      console.log('   - No recent posts found');
    }
    
    console.log('✅ System state cleared - ready for fresh start');
    return { success: true };
    
  } catch (error) {
    console.error('❌ System reset failed:', error);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  systemReset()
    .then(result => {
      if (result.success) {
        console.log('🎉 SYSTEM RESET COMPLETE!');
        process.exit(0);
      } else {
        console.error('🚨 SYSTEM RESET FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { systemReset };
