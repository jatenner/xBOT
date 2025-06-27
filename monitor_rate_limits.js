#!/usr/bin/env node

/**
 * 🔍 EMERGENCY RATE LIMIT MONITORING
 * Monitor bot posting to ensure limits are respected
 */

const { supabaseClient } = require('./src/utils/supabaseClient.ts');

async function monitorPostingRate() {
  console.log('🔍 EMERGENCY RATE LIMIT MONITORING');
  console.log('=================================');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's posts
    const { data: todaysPosts } = await supabaseClient.supabase
      ?.from('tweets')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false }) || { data: [] };
    
    const postsToday = todaysPosts?.length || 0;
    
    console.log(`📊 Posts today: ${postsToday}/8 (safe limit)`);
    
    if (postsToday >= 8) {
      console.log('🚨 WARNING: Daily limit reached!');
    } else if (postsToday >= 6) {
      console.log('⚠️ CAUTION: Approaching daily limit');
    } else {
      console.log('✅ Posting rate is safe');
    }
    
    // Check posting intervals
    if (todaysPosts && todaysPosts.length > 1) {
      for (let i = 0; i < Math.min(5, todaysPosts.length - 1); i++) {
        const post1 = new Date(todaysPosts[i].created_at);
        const post2 = new Date(todaysPosts[i + 1].created_at);
        const interval = (post1.getTime() - post2.getTime()) / (1000 * 60);
        
        console.log(`⏱️  Interval ${i + 1}: ${interval.toFixed(1)} minutes`);
        
        if (interval < 20) {
          console.log('🚨 WARNING: Posting interval too short!');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
  }
}

monitorPostingRate();
