#!/usr/bin/env node

/**
 * 🚨 EMERGENCY FIX: REPETITIVE CONTENT CRISIS
 * 
 * The bot is posting the same "Machine learning algorithms identify promising drug compounds"
 * content repeatedly. This script fixes the issue by:
 * 1. Blocking all repetitive patterns
 * 2. Forcing Expert Intelligence and Human Expert modes
 * 3. Disabling viral template fallbacks
 * 4. Enhancing content quality enforcement
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRepetitiveContentCrisis() {
  console.log('🚨 === FIXING REPETITIVE CONTENT CRISIS ===\\n');

  try {
    // 1. BLOCK ALL REPETITIVE PATTERNS
    console.log('🚫 BLOCKING REPETITIVE PATTERNS...');
    
    const bannedPatterns = [
      'as ai transforms diagnostics',
      'precision medicine is becoming a reality',
      'machine learning algorithms identify promising drug compounds',
      'breakthrough: machine learning algorithms identify',
      'with 92% accuracy in predicting therapeutic effectiveness',
      'revolutionary findings (nature medicine, 2024)',
      'machine learning algorithms identify promising drug compounds in months instead of years',
      'with 92% accuracy in predicting therapeutic effectiveness across 500+ trials',
      'this could revolutionize healthcare',
      'the implications are staggering',
      'this changes everything we know',
      'the future of healthcare is being written',
      'ai, digital therapeutics, and precision medicine are converging',
      'artificial intelligence is revolutionizing',
      'digital health solutions are',
      'healthcare technology is advancing',
      'medical innovation continues'
    ];

    await supabase.from('bot_config').upsert({
      key: 'content_quality_enforcement',
      value: {
        enabled: true,
        banned_repetitive_phrases: bannedPatterns,
        strict_uniqueness_check: true,
        emergency_expert_fallback: true,
        block_viral_templates: true
      },
      description: 'Emergency content quality enforcement to eliminate repetitive patterns',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log(`✅ Blocked ${bannedPatterns.length} repetitive patterns`);

    // 2. FORCE EXPERT CONTENT DISTRIBUTION
    console.log('🧠 FORCING EXPERT CONTENT DISTRIBUTION...');
    
    await supabase.from('bot_config').upsert({
      key: 'enhanced_content_distribution',
      value: {
        distribution: {
          expert_intelligence: 40,    // Increased from 30%
          human_expert: 35,          // Increased from 15%
          diverse_perspectives: 20,   // Reduced from 25%
          breaking_news: 5,          // Reduced from 15%
          viral_content: 0,          // DISABLED
          trending_topics: 0,        // DISABLED
          comprehensive_analysis: 0   // DISABLED
        },
        emergency_mode: true,
        block_viral_fallbacks: true
      },
      description: 'Emergency expert-focused content distribution to eliminate repetitive content',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log('✅ Content distribution: 40% Expert Intelligence + 35% Human Expert + 20% Diverse Perspectives');

    // 3. ENHANCE HUMAN EXPERT PERSONALITY SETTINGS
    console.log('🎭 ENHANCING HUMAN EXPERT PERSONALITY...');
    
    await supabase.from('bot_config').upsert({
      key: 'human_expert_personality_config',
      value: {
        enabled: true,
        emergency_mode: true,
        max_retries: 10,           // Increased retries
        min_content_length: 50,    // Ensure substantial content
        uniqueness_threshold: 0.3, // Stricter uniqueness
        expertise_rotation: true,  // Force rotation through different expertise areas
        block_template_fallbacks: true,
        require_personal_insights: true
      },
      description: 'Emergency human expert configuration for authentic content generation',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log('✅ Human Expert Personality enhanced with emergency settings');

    // 4. CONFIGURE EXPERT INTELLIGENCE SYSTEM
    console.log('🧠 CONFIGURING EXPERT INTELLIGENCE SYSTEM...');
    
    await supabase.from('bot_config').upsert({
      key: 'expert_intelligence_config',
      value: {
        enabled: true,
        emergency_mode: true,
        build_on_previous: true,
        min_expertise_level: 70,
        require_knowledge_connections: true,
        block_generic_content: true,
        force_unique_insights: true
      },
      description: 'Emergency expert intelligence configuration for knowledge-based content',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log('✅ Expert Intelligence System configured for emergency operation');

    // 5. DISABLE VIRAL TEMPLATE GENERATORS
    console.log('🚫 DISABLING VIRAL TEMPLATE GENERATORS...');
    
    await supabase.from('bot_config').upsert({
      key: 'viral_content_emergency_block',
      value: {
        block_ultra_viral_generator: true,
        block_nuclear_learning_templates: true,
        block_hardcoded_templates: true,
        emergency_expert_only: true,
        reason: 'Repetitive content crisis - viral templates generating same content repeatedly'
      },
      description: 'Emergency block on viral template generators causing repetitive content',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log('✅ Viral template generators disabled');

    // 6. ENHANCE CONTENT TRACKING AND SIMILARITY DETECTION
    console.log('📊 ENHANCING CONTENT TRACKING...');
    
    await supabase.from('bot_config').upsert({
      key: 'content_similarity_enforcement',
      value: {
        enabled: true,
        similarity_threshold: 0.4,  // Stricter similarity detection
        track_last_posts: 50,       // Track more posts
        block_similar_topics: true,
        emergency_uniqueness_mode: true
      },
      description: 'Emergency content similarity detection to prevent repetition',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log('✅ Content similarity detection enhanced');

    // 7. UPDATE EMERGENCY POSTING CONFIGURATION
    console.log('⚡ UPDATING EMERGENCY POSTING CONFIG...');
    
    await supabase.from('bot_config').upsert({
      key: 'emergency_posting_config',
      value: {
        expert_content_only: true,
        block_template_fallbacks: true,
        require_manual_review: false,  // Keep automated but with quality controls
        max_attempts_per_mode: 10,
        emergency_uniqueness_enforcement: true
      },
      description: 'Emergency posting configuration to ensure quality expert content only',
      created_by: 'emergency_fix_repetitive_content'
    });

    console.log('✅ Emergency posting configuration updated');

    // 8. CLEAR ANY EXISTING REPETITIVE CONTENT FROM TRACKING
    console.log('🗑️ CLEARING REPETITIVE CONTENT FROM TRACKING...');
    
    // Remove any tracked content that contains banned patterns
    const { data: trackedContent } = await supabase
      .from('tweets')
      .select('id, content')
      .order('created_at', { ascending: false })
      .limit(100);

    if (trackedContent) {
      const repetitiveIds = trackedContent
        .filter(tweet => 
          bannedPatterns.some(pattern => 
            tweet.content.toLowerCase().includes(pattern.toLowerCase())
          )
        )
        .map(tweet => tweet.id);

      if (repetitiveIds.length > 0) {
        console.log(`🗑️ Found ${repetitiveIds.length} repetitive tweets in database`);
        
        // Mark them as repetitive for learning purposes
        await supabase
          .from('tweets')
          .update({ 
            quality_issues: 'repetitive_content',
            updated_at: new Date().toISOString()
          })
          .in('id', repetitiveIds);
          
        console.log(`✅ Marked ${repetitiveIds.length} tweets as repetitive for learning`);
      }
    }

    console.log('\\n🎯 === REPETITIVE CONTENT CRISIS FIX COMPLETE ===');
    console.log('\\n📊 SUMMARY:');
    console.log('   ✅ Blocked 17+ repetitive patterns');
    console.log('   ✅ Content distribution: 75% Expert modes, 20% Diverse, 5% News');
    console.log('   ✅ Viral template generators disabled');
    console.log('   ✅ Enhanced similarity detection (40% threshold)');
    console.log('   ✅ Human Expert Personality enhanced');
    console.log('   ✅ Expert Intelligence System configured');
    console.log('   ✅ Emergency posting configuration active');
    console.log('\\n🚀 NEXT POSTS WILL BE:');
    console.log('   🧠 Genuine expert insights with personal experience');
    console.log('   🎭 Diverse perspectives from different viewpoints');
    console.log('   💡 Knowledge-based content building on previous posts');
    console.log('   🚫 NO MORE repetitive "Machine learning algorithms" templates');
    console.log('\\n✅ BOT READY FOR HIGH-QUALITY EXPERT CONTENT GENERATION');

  } catch (error) {
    console.error('❌ Error fixing repetitive content crisis:', error);
    throw error;
  }
}

if (require.main === module) {
  fixRepetitiveContentCrisis()
    .then(() => {
      console.log('\\n🎉 Repetitive content crisis fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixRepetitiveContentCrisis }; 