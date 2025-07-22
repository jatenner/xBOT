#!/usr/bin/env node

/**
 * ✅ VERIFY ALL FIXES APPLIED
 * 
 * Quick verification that critical issues have been resolved
 */

require('dotenv').config();

console.log('✅ === VERIFYING ALL FIXES APPLIED ===');
console.log('🔍 Checking if critical issues have been resolved\n');

async function verifyFixes() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    console.log('🔍 1. CHECKING LEARNING CONFIGURATIONS...\n');

    const criticalConfigs = [
      'learning_enabled',
      'adaptive_content_learning', 
      'engagement_learning_system',
      'viral_pattern_learning',
      'ai_learning_insights',
      'live_posting_enabled'
    ];

    const { data: configs } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', criticalConfigs);

    let enabledCount = 0;
    criticalConfigs.forEach(configKey => {
      const config = configs?.find(c => c.key === configKey);
      if (config) {
        const isEnabled = config.value === true || 
                         (typeof config.value === 'object' && config.value.enabled === true);
        console.log(`   ${isEnabled ? '✅' : '❌'} ${configKey}: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
        if (isEnabled) enabledCount++;
      } else {
        console.log(`   ⚠️ ${configKey}: NOT FOUND`);
      }
    });

    console.log(`\n📊 Learning Systems: ${enabledCount}/${criticalConfigs.length} enabled (${((enabledCount/criticalConfigs.length)*100).toFixed(1)}%)`);
    console.log('');

    console.log('🔍 2. CHECKING LIVE POSTING STATUS...\n');
    
    // Check environment variable
    const livePostingEnv = process.env.LIVE_POSTING_ENABLED;
    console.log(`   📱 Environment Variable: LIVE_POSTING_ENABLED=${livePostingEnv} ${livePostingEnv === 'true' ? '✅' : '❌'}`);

    // Check database config
    const { data: liveConfig } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'force_live_posting')
      .single();

    const liveConfigEnabled = liveConfig?.value?.enabled === true;
    console.log(`   📊 Database Config: force_live_posting ${liveConfigEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log('');

    console.log('🔍 3. CHECKING CONTENT QUALITY...\n');

    // Check high-quality content
    const { data: highQualityTweets, count } = await supabase
      .from('tweets')
      .select('*', { count: 'exact' })
      .eq('tweet_type', 'high_quality_initial');

    console.log(`   📝 High-Quality Content Generated: ${count || 0} tweets`);

    if (highQualityTweets && highQualityTweets.length > 0) {
      console.log('   ✅ Sample high-quality content:');
      highQualityTweets.slice(0, 2).forEach((tweet, index) => {
        const metadata = typeof tweet.metadata === 'string' ? 
          JSON.parse(tweet.metadata) : tweet.metadata;
        console.log(`      ${index + 1}. Quality ${metadata?.quality_score || 'N/A'}/100: "${tweet.content.substring(0, 80)}..."`);
      });
    }
    console.log('');

    console.log('🔍 4. CHECKING CONTENT QUALITY SYSTEM...\n');

    const { data: qualityConfig } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'content_quality_enforcement')
      .single();

    const qualitySystemEnabled = qualityConfig?.value?.enabled === true;
    console.log(`   🎯 Content Quality Enforcement: ${qualitySystemEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);

    if (qualitySystemEnabled) {
      const minScore = qualityConfig.value.minimum_score;
      console.log(`   📊 Minimum Quality Score: ${minScore}/100`);
      console.log(`   🗣️ Human Voice Required: ${qualityConfig.value.human_authenticity_required ? '✅' : '❌'}`);
      console.log(`   🚫 No Hashtags: ${qualityConfig.value.no_hashtags ? '✅' : '❌'}`);
      console.log(`   💬 Personal Perspective: ${qualityConfig.value.personal_perspective ? '✅' : '❌'}`);
    }
    console.log('');

    console.log('🔍 5. OVERALL SYSTEM STATUS...\n');

    // Calculate overall improvement
    const learningScore = (enabledCount / criticalConfigs.length) * 100;
    const livePostingScore = (livePostingEnv === 'true' && liveConfigEnabled) ? 100 : 0;
    const contentQualityScore = (count && count > 0 && qualitySystemEnabled) ? 100 : 0;

    const overallImprovement = (learningScore + livePostingScore + contentQualityScore) / 3;

    console.log(`📊 IMPROVEMENT SCORES:`);
    console.log(`   🧠 Learning Systems: ${learningScore.toFixed(1)}% (was 66.7%)`);
    console.log(`   📱 Live Posting: ${livePostingScore}% (was 6%)`);
    console.log(`   📝 Content Quality: ${contentQualityScore}% (was 26%)`);
    console.log(`\n🎯 OVERALL IMPROVEMENT: ${overallImprovement.toFixed(1)}%`);

    if (overallImprovement >= 85) {
      console.log('🟢 EXCELLENT - Ready for production deployment');
      console.log('🚀 Expected follower growth potential: 85+/100');
    } else if (overallImprovement >= 70) {
      console.log('🟡 GOOD - Significant improvement achieved');
      console.log('📈 Expected follower growth potential: 70+/100');
    } else {
      console.log('🔴 NEEDS MORE WORK - Some fixes may not have applied');
    }

    console.log('\n🎉 === VERIFICATION SUMMARY ===');
    console.log(`✅ Learning configurations: ${enabledCount}/${criticalConfigs.length} enabled`);
    console.log(`✅ Live posting: ${livePostingEnv === 'true' && liveConfigEnabled ? 'Fully enabled' : 'Needs attention'}`);
    console.log(`✅ High-quality content: ${count || 0} tweets generated`);
    console.log(`✅ Quality enforcement: ${qualitySystemEnabled ? 'Active' : 'Needs activation'}`);

    return {
      learningScore,
      livePostingScore,
      contentQualityScore,
      overallImprovement,
      ready: overallImprovement >= 85
    };

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return { error: error.message };
  }
}

verifyFixes()
  .then(result => {
    if (result.error) {
      console.log('\n❌ VERIFICATION FAILED');
    } else if (result.ready) {
      console.log('\n🚀 SYSTEM READY FOR RENDER DEPLOYMENT!');
    } else {
      console.log('\n⚠️ Some fixes may need to be reapplied');
    }
  })
  .catch(console.error); 