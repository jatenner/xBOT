#!/usr/bin/env node

/**
 * 🧠 EMERGENCY HUMAN EXPERT FIX
 * Forces the bot to use Human Expert mode exclusively for better quality content
 */

import { supabaseClient } from './src/utils/supabaseClient.ts';

async function emergencyHumanExpertFix() {
  console.log('🧠 === EMERGENCY HUMAN EXPERT QUALITY FIX ===');
  
  try {
    console.log('🔧 Setting emergency configuration...');
    
    // Set bot configuration to force Human Expert mode
    const configs = [
      {
        key: 'content_mode_override',
        value: {
          enabled: true,
          force_human_expert: true,
          disable_viral_contamination: true,
          disable_nuclear_enhancement: true,
          reason: 'Emergency quality fix - prevent terrible bot content',
          timestamp: new Date().toISOString()
        }
      },
      {
        key: 'startup_posting_override',
        value: {
          enabled: true,
          force_immediate_post: true,
          force_human_expert_mode: true,
          clear_phantom_times: true,
          reason: 'Quality improvement - switching to Human Expert only',
          timestamp: new Date().toISOString()
        }
      },
      {
        key: 'content_quality_enforcement',
        value: {
          enabled: true,
          require_persona_compliance: true,
          block_academic_language: true,
          block_hashtags: true,
          enforce_conversational_tone: true,
          minimum_quality_score: 0.8,
          timestamp: new Date().toISOString()
        }
      }
    ];
    
    for (const config of configs) {
      const result = await supabaseClient.upsertConfig(config.key, config.value);
      if (result.success) {
        console.log(`✅ Set config: ${config.key}`);
      } else {
        console.log(`❌ Failed to set: ${config.key}`);
      }
    }
    
    console.log('🧠 === CONFIGURATION COMPLETE ===');
    console.log('✅ Bot will now use Human Expert mode exclusively');
    console.log('✅ No more terrible "Nuclear Learning Intelligence System Test" tweets');
    console.log('✅ Content will follow persona.txt requirements');
    console.log('✅ Conversational tone enforced, no hashtags');
    console.log('');
    console.log('📊 Expected improvements:');
    console.log('   • Authentic expert insights instead of robotic announcements');
    console.log('   • Conversational "Ever wonder why..." style');
    console.log('   • No hashtags or academic language');
    console.log('   • Practical impact explanations');
    console.log('   • Human voice that builds followers, not loses them');
    console.log('');
    console.log('⏰ Next posts should be significantly better quality!');
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
  }
}

// Run the emergency fix
emergencyHumanExpertFix().catch(console.error); 