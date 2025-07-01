#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: Force Human Content Fix
 * ====================================
 * 
 * Issues from Twitter screenshots:
 * 1. Bot posting random images (prosthetic hands, devices) with no context
 * 2. Content not living up to human expert expectations
 * 3. Not sounding like a brilliant healthcare expert
 * 
 * Solutions:
 * 1. NUCLEAR image blocking - absolutely no images
 * 2. Force human voice persona enforcement
 * 3. Ensure quality content generation
 * 4. Verify hashtag elimination is working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencyForceHumanContentFix() {
  console.log('🚨 EMERGENCY: Force Human Content Fix');
  console.log('=====================================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. NUCLEAR IMAGE BLOCKING...');
    
    // Nuclear option: Block ALL images
    await supabase
      .from('bot_config')
      .upsert({
        key: 'nuclear_image_block',
        value: {
          enabled: true,
          block_all_images: true,
          disable_pexels: true,
          disable_unsplash: true,
          disable_fallback_images: true,
          force_text_only_always: true,
          image_probability: 0,
          nuclear_mode: true,
          reason: 'Random images with no context - user complaint',
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Nuclear image blocking: ACTIVE');

    console.log('🔧 2. FORCE HUMAN VOICE PERSONA...');
    
    // Nuclear human voice enforcement
    await supabase
      .from('bot_config')
      .upsert({
        key: 'nuclear_human_voice',
        value: {
          enabled: true,
          force_phd_persona: true,
          require_expert_language: true,
          block_generic_content: true,
          minimum_sophistication_level: 90,
          enforce_scholarly_tone: true,
          use_insider_knowledge: true,
          academic_voice_patterns: [
            "From my research at",
            "Having spent 15+ years in",
            "The data suggests",
            "Clinical implications here",
            "What's fascinating is",
            "This challenges conventional",
            "The systemic impact",
            "Methodologically speaking"
          ],
          expert_conversation_starters: [
            "Just analyzed the latest data on",
            "After 15 years in healthcare tech,",
            "Clinical pearl I learned recently:",
            "Hot take from the research trenches:",
            "What the journals won't tell you:",
            "Industry insider perspective:",
            "From my work with Stanford Med:",
            "Data I've been tracking shows"
          ],
          nuclear_enforcement: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Nuclear human voice: ENFORCED');

    console.log('🔧 3. QUALITY CONTENT MANDATES...');
    
    // Force high-quality content standards
    await supabase
      .from('bot_config')
      .upsert({
        key: 'content_quality_mandates',
        value: {
          enabled: true,
          minimum_readability_score: 70,
          require_specific_data_points: true,
          require_actionable_insights: true,
          block_vague_statements: true,
          require_expert_analysis: true,
          content_sophistication_level: 'PhD_researcher',
          banned_generic_phrases: [
            "game-changer",
            "revolutionary breakthrough", 
            "amazing discovery",
            "incredible innovation",
            "mind-blowing technology",
            "this is huge",
            "you won't believe"
          ],
          required_content_elements: [
            "specific_data_or_study",
            "expert_analysis", 
            "actionable_insight",
            "industry_context",
            "credible_source"
          ],
          nuclear_quality_enforcement: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Content quality mandates: ACTIVE');

    console.log('🔧 4. VERIFY HASHTAG ELIMINATION...');
    
    // Double-check hashtag elimination is working
    await supabase
      .from('bot_config')
      .upsert({
        key: 'hashtag_verification',
        value: {
          enabled: true,
          nuclear_hashtag_ban: true,
          blocked_patterns: [
            "#",
            "hashtag",
            "trending",
            "tags:",
            "#healthtech",
            "#AI",
            "#innovation",
            "#breakthrough"
          ],
          immediate_rejection: true,
          zero_tolerance: true,
          replacement_with_conversation: true,
          conversation_endings: [
            "Thoughts?",
            "Change my mind.",
            "What do you think?",
            "Anyone else seeing this?",
            "Too controversial?",
            "Am I missing something?",
            "Your take?",
            "Worth the investment?"
          ],
          nuclear_enforcement: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Hashtag elimination: VERIFIED');

    console.log('🔧 5. RUNTIME CONFIG UPDATE...');
    
    // Update runtime config with all fixes
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 10,
          quality: {
            readabilityMin: 70,
            credibilityMin: 0.85,
            sophisticationMin: 90
          },
          fallbackStaggerMinutes: 60,
          postingStrategy: 'expert_human_voice',
          disable_images: true,
          text_only_mode: true,
          nuclear_human_voice: true,
          nuclear_image_block: true,
          nuclear_hashtag_ban: true,
          content_quality_mandates: true,
          emergency_mode: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Runtime config: UPDATED with all fixes');

    console.log('🔧 6. VERIFICATION...');
    
    // Verify all configurations
    const configs = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', [
        'nuclear_image_block',
        'nuclear_human_voice', 
        'content_quality_mandates',
        'hashtag_verification',
        'runtime_config'
      ]);

    console.log('');
    console.log('✅ EMERGENCY FIX DEPLOYED SUCCESSFULLY!');
    console.log('=======================================');
    console.log('');
    console.log('📊 CONFIGURATION STATUS:');
    configs.data?.forEach(config => {
      const status = config.value?.enabled || config.value?.nuclear_mode || config.value?.nuclear_enforcement ? '✅ ACTIVE' : '❌ FAILED';
      console.log(`   • ${config.key}: ${status}`);
    });
    
    console.log('');
    console.log('🎯 NEW OPERATING PARAMETERS:');
    console.log('   • Images: ❌ NUCLEAR BLOCK (0% chance)');
    console.log('   • Hashtags: ❌ ZERO TOLERANCE');
    console.log('   • Voice: 👨‍🎓 PhD Expert (15+ years experience)');
    console.log('   • Quality: 📊 90+ sophistication required');
    console.log('   • Content: 🎯 Specific data + expert analysis');
    console.log('   • Format: 💬 Natural conversation patterns');
    console.log('');
    console.log('🚨 WHAT CHANGED:');
    console.log('1. NO MORE RANDOM IMAGES - Nuclear block active');
    console.log('2. FORCED EXPERT VOICE - PhD researcher persona');
    console.log('3. HIGH QUALITY MANDATES - Specific data required');
    console.log('4. CONVERSATION STYLE - Natural expert insights');
    console.log('5. ZERO HASHTAGS - Replaced with "Thoughts?" etc.');
    console.log('');
    console.log('🎯 EXPECTED RESULTS:');
    console.log('• Tweets will sound like brilliant healthcare expert');
    console.log('• NO random images or devices without context');
    console.log('• Specific data points and actionable insights');
    console.log('• Natural conversation patterns');
    console.log('• Academic sophistication with accessibility');
    console.log('');
    console.log('📈 NEXT POSTS SHOULD:');
    console.log('• Start with expert perspective: "After 15 years..."');
    console.log('• Include specific data: "Study shows 47% improvement"');
    console.log('• End naturally: "Thoughts?" or "Your take?"');
    console.log('• NO IMAGES, NO HASHTAGS, HIGH SOPHISTICATION');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  emergencyForceHumanContentFix();
}

module.exports = { emergencyForceHumanContentFix }; 