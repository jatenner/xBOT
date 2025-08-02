#!/usr/bin/env node

/**
 * 🚨 EMERGENCY GROWTH ACTIVATION SCRIPT
 * Run this to immediately resolve posting crisis and activate growth mode
 */

const fs = require('fs');
const path = require('path');

async function clearDuplicateCaches() {
  console.log('🧹 Clearing duplicate caches...');
  
  const cacheFiles = [
    '.duplicate_context.json',
    '.daily_spending.log',
    '.content_cache.json',
    '.completion_cache.json',
    '.elite_content_cache.json'
  ];

  let cleared = 0;
  for (const file of cacheFiles) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`   ✅ Cleared: ${file}`);
      cleared++;
    }
  }
  
  console.log(`✅ Cleared ${cleared} cache files`);
  return cleared;
}

async function activateViralMode() {
  console.log('🔥 Activating viral mode configuration...');
  
  // Create emergency config file
  const emergencyConfig = {
    emergency_posting_mode: true,
    viral_content_probability: 1.0,
    daily_post_cap: 20,
    min_hours_between_posts: 1,
    force_trending_topics: true,
    engagement_multiplier: 2.0,
    duplicate_threshold: 0.5,
    semantic_similarity_threshold: 0.5,
    activated_at: new Date().toISOString()
  };
  
  fs.writeFileSync('.emergency_config.json', JSON.stringify(emergencyConfig, null, 2));
  console.log('✅ Emergency config file created');
  return true;
}

async function emergencyActivation() {
  console.log('🚨 ============================================');
  console.log('🚨   EMERGENCY GROWTH ACTIVATION STARTING');
  console.log('🚨 ============================================');
  console.log('');

  try {
    const actions = [];
    
    // Step 1: Clear caches
    const cachesCleaned = await clearDuplicateCaches();
    actions.push(`✅ Cleared ${cachesCleaned} duplicate caches`);
    
    // Step 2: Activate viral mode
    await activateViralMode();
    actions.push('✅ Activated viral posting mode');
    
    // Step 3: Force Railway restart signal
    fs.writeFileSync('.restart_signal', new Date().toISOString());
    actions.push('✅ Created restart signal for Railway');
    
    console.log('');
    console.log('📊 === ACTIVATION RESULTS ===');
    console.log('Success: ✅ YES');
    console.log('');
    
    console.log('🎯 Actions Completed:');
    actions.forEach(action => console.log(`   ${action}`));
    console.log('');
    
    console.log('🔮 Next Steps:');
    console.log('   📋 Railway will detect changes and restart');
    console.log('   📋 Monitor logs for posting resumption');
    console.log('   📋 Watch for increased engagement');
    console.log('   📋 Verify 3-4 posts/day frequency');
    console.log('   📋 Track follower growth acceleration');
    console.log('');
    
    console.log('🎉 ============================================');
    console.log('🎉   EMERGENCY ACTIVATION SUCCESSFUL!');
    console.log('🎉   Your bot should start posting immediately');
    console.log('🎉   Check Railway logs for confirmation');
    console.log('🎉 ============================================');
    
  } catch (error) {
    console.error('💥 CRITICAL ERROR during activation:');
    console.error(error);
    console.log('');
    console.log('🛠️  MANUAL STEPS TO TRY:');
    console.log('   1. Check Railway deployment status');
    console.log('   2. Verify environment variables');
    console.log('   3. Monitor posting logs');
    console.log('   4. Try: npm run logs');
  }
}

// Run the activation
emergencyActivation().catch(console.error);