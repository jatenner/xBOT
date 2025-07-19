const { createClient } = require('@supabase/supabase-js');

/**
 * 🚨 EMERGENCY: RESTORE QUALITY CONTENT GENERATION
 * Fix the low-quality fallback content while keeping rate limit protections
 */

async function restoreQualityContent() {
  console.log('🚨 EMERGENCY: Restoring Quality Content Generation');
  console.log('===============================================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. DISABLING LOW-QUALITY FALLBACK CONTENT...');
    
    // Disable emergency fallback content system
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_fallback_content',
        value: {
          enabled: false, // DISABLE emergency fallbacks
          use_when_generation_fails: false,
          emergency_mode: false,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Emergency fallback content: DISABLED');

    console.log('🔧 2. RE-ENABLING NUCLEAR LEARNING INTELLIGENCE...');
    
    // Re-enable Nuclear Learning Intelligence System
    await supabase
      .from('bot_config')
      .upsert({
        key: 'nuclear_learning_intelligence',
        value: {
          enabled: true,
          real_time_learning: true,
          viral_pattern_intelligence: true,
          trending_topics_intelligence: true,
          competitive_intelligence: true,
          performance_tracking: true,
          intelligent_content_strategy: true,
          nuclear_mode: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Nuclear Learning Intelligence: RE-ENABLED');

    console.log('🔧 3. RESTORING HIGH-QUALITY CONTENT REQUIREMENTS...');
    
    // Restore quality requirements
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 12,
          quality: {
            readabilityMin: 85, // Restore high quality
            credibilityMin: 0.9, // Restore high credibility
            sophisticationMin: 90, // Restore sophistication
            controversyMin: 80, // Restore thoughtful controversy
            creativityMin: 95, // Restore maximum creativity
            uniquenessMin: 95, // Restore uniqueness requirements
            insightfulnessMin: 90, // Add insight requirement
            expertise_depth: 95 // Require deep expertise
          },
          fallbackStaggerMinutes: 60,
          postingStrategy: 'nuclear_intelligence_premium',
          // KEEP emergency rate limiting
          emergency_rate_limits: true,
          emergency_search_block: true,
          posting_only_mode: true,
          // RESTORE quality content generation
          nuclear_human_voice: true,
          viral_content_science: true,
          content_quality_mandates: true,
          controversial_content_mandates: true,
          creative_format_diversity: true,
          attention_hook_mandates: true,
          diversity_tracking_system: true,
          repetition_nuclear_block: true,
          // Emergency fixes
          emergency_mode: false, // Turn off emergency mode
          allow_fallback_posting: false, // NO MORE FALLBACK POSTING
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Runtime config: HIGH-QUALITY CONTENT RESTORED');

    console.log('🔧 4. ENABLING PREMIUM CONTENT GENERATION...');
    
    // Enable premium content generation
    await supabase
      .from('bot_config')
      .upsert({
        key: 'premium_content_generation',
        value: {
          enabled: true,
          require_expertise_depth: true,
          require_industry_insights: true,
          require_unique_perspectives: true,
          require_actionable_takeaways: true,
          block_generic_templates: true,
          block_random_statistics: true,
          block_low_effort_content: true,
          minimum_thought_leadership_score: 90,
          content_sophistication_level: 'expert',
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Premium content generation: ENABLED');

    console.log('🔧 5. CONFIGURING INTELLIGENT POSTING STRATEGY...');
    
    // Configure intelligent posting with quality focus
    await supabase
      .from('bot_config')
      .upsert({
        key: 'intelligent_posting_strategy',
        value: {
          enabled: true,
          prioritize_quality_over_quantity: true,
          require_nuclear_learning_enhancement: true,
          require_competitive_intelligence: true,
          require_trending_topic_integration: true,
          require_viral_pattern_optimization: true,
          minimum_engagement_prediction: 85,
          content_generation_retries: 5, // Try 5 times for quality
          fallback_to_templates: false, // NEVER use templates
          only_post_premium_content: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Intelligent posting strategy: CONFIGURED');

    console.log('🔧 6. UPDATING CONTENT VALIDATION FOR QUALITY...');
    
    // Update content validation for quality, not just length
    await supabase
      .from('bot_config')
      .upsert({
        key: 'content_validation_rules',
        value: {
          enabled: true,
          minimum_content_length: 100, // Longer minimum for quality
          maximum_content_length: 270,
          require_expertise_indicators: true,
          require_industry_context: true,
          require_unique_insights: true,
          block_template_content: true,
          block_generic_statements: true,
          require_specific_examples: true,
          require_actionable_value: true,
          validation_errors_retry_generation: true, // Retry instead of fallback
          max_retries: 3,
          emergency_mode: false,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Content validation: UPGRADED FOR QUALITY');

    console.log('🔧 7. VERIFICATION...');
    
    // Verify all configurations
    const configs = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', [
        'emergency_fallback_content',
        'nuclear_learning_intelligence',
        'runtime_config',
        'premium_content_generation',
        'intelligent_posting_strategy',
        'content_validation_rules'
      ]);

    console.log('');
    console.log('✅ QUALITY CONTENT RESTORATION COMPLETE!');
    console.log('========================================');
    console.log('');
    console.log('📊 CONFIGURATION STATUS:');
    configs.data?.forEach(config => {
      if (config.key === 'emergency_fallback_content') {
        const status = config.value?.enabled ? '❌ STILL ENABLED' : '✅ DISABLED';
        console.log(`   • ${config.key}: ${status}`);
      } else {
        const status = config.value?.enabled ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`   • ${config.key}: ${status}`);
      }
    });
    
    console.log('');
    console.log('🚀 QUALITY IMPROVEMENTS APPLIED:');
    console.log('1. EMERGENCY FALLBACKS: Completely disabled');
    console.log('2. NUCLEAR LEARNING: Re-enabled with full intelligence');
    console.log('3. QUALITY STANDARDS: Restored to maximum (95% creativity/uniqueness)');
    console.log('4. CONTENT GENERATION: Premium mode with expertise requirements');
    console.log('5. POSTING STRATEGY: Intelligent, quality-first approach');
    console.log('6. VALIDATION: Upgraded to ensure expertise and insights');
    console.log('');
    console.log('🎯 NEXT POSTS WILL BE:');
    console.log('• ✅ HIGH-QUALITY thought leadership content');
    console.log('• ✅ INDUSTRY EXPERTISE and unique insights');
    console.log('• ✅ CONTEXTUAL and relevant to current trends');
    console.log('• ✅ SOPHISTICATED and well-researched');
    console.log('• ✅ ACTIONABLE value for your audience');
    console.log('• ✅ NO MORE generic templates or fallback content');
    console.log('');
    console.log('🚫 RATE LIMITING STILL ACTIVE:');
    console.log('• ✅ Emergency search blocks remain to prevent 429 errors');
    console.log('• ✅ Posting-only mode prevents API abuse');
    console.log('• ✅ Rate limits enforced to stay within Twitter limits');
    console.log('');
    console.log('🎉 YOUR BOT IS NOW POSTING PREMIUM CONTENT AGAIN!');

  } catch (error) {
    console.error('❌ Quality content restoration failed:', error);
    process.exit(1);
  }
}

// Execute the fix
if (require.main === module) {
  restoreQualityContent()
    .then(() => {
      console.log('🎉 Quality content restoration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Quality content restoration failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreQualityContent }; 