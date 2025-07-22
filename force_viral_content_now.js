#!/usr/bin/env node

/**
 * 🚨 FORCE VIRAL CONTENT NOW
 * 
 * Problem: System still generating academic content despite configurations
 * Solution: Direct database override + force viral content agent activation
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔥 === FORCING VIRAL CONTENT GENERATION ===');
console.log('🎯 Overriding all academic content systems');
console.log('🎯 Activating aggressive viral content mode');

async function forceViralContentNow() {
  try {
    // 1. DELETE ALL ACADEMIC CONFIGURATIONS
    console.log('\n🚫 === DELETING ACADEMIC CONTENT CONFIGS ===');
    
    const academicKeys = [
      'phd_persona_enabled',
      'research_agent_active',
      'clinical_content_enabled',
      'academic_language_mode',
      'scholarly_citations_required'
    ];
    
    for (const key of academicKeys) {
      await supabase.from('bot_config').delete().eq('key', key);
      console.log(`❌ Deleted: ${key}`);
    }
    
    // 2. FORCE VIRAL CONTENT OVERRIDES
    console.log('\n🔥 === FORCING VIRAL CONTENT OVERRIDES ===');
    
    const forceViralConfigs = [
      {
        key: 'FORCE_VIRAL_CONTENT',
        value: {
          enabled: true,
          mode: 'MAXIMUM_VIRAL',
          override_all_agents: true,
          controversial_percentage: 50,
          personal_story_percentage: 30,
          shock_value_percentage: 20,
          engagement_hooks_mandatory: true,
          academic_content_blocked: true
        }
      },
      {
        key: 'viral_agent_priority',
        value: {
          viral_follower_growth_agent: 1,
          viral_content_agent: 2,
          ultra_viral_generator: 3,
          streamlined_post_agent: 4,
          block_all_academic: true
        }
      },
      {
        key: 'content_generation_override',
        value: {
          primary_agent: 'ViralFollowerGrowthAgent',
          fallback_agent: 'UltraViralGenerator',
          banned_agents: ['ResearchAgent', 'AcademicAgent', 'ClinicalAgent'],
          force_viral_scoring: true,
          minimum_viral_score: 70
        }
      }
    ];
    
    for (const config of forceViralConfigs) {
      await supabase.from('bot_config').upsert({
        key: config.key,
        value: config.value,
        updated_at: new Date().toISOString()
      });
      console.log(`✅ FORCED: ${config.key}`);
    }
    
    // 3. OVERRIDE OPENAI PROMPTS
    console.log('\n📝 === OVERRIDING OPENAI PROMPTS ===');
    
    const viralPromptOverride = {
      key: 'openai_prompt_override',
      value: {
        system_message: 'You are a viral content creator. NEVER generate academic, clinical, or research-heavy content. Always create controversial, personal, or shocking content that makes people want to follow.',
        banned_words: ['clinical', 'research shows', 'studies indicate', 'according to', 'peer-reviewed', 'systematic review'],
        required_elements: ['personal voice', 'controversy', 'engagement hook', 'follow trigger'],
        content_types: ['controversial_take', 'personal_story', 'shock_value_data', 'insider_knowledge']
      }
    };
    
    await supabase.from('bot_config').upsert({
      key: viralPromptOverride.key,
      value: viralPromptOverride.value,
      updated_at: new Date().toISOString()
    });
    console.log('✅ OpenAI prompts overridden for viral content');
    
    // 4. INSERT VIRAL CONTENT EXAMPLES TO OVERRIDE ACADEMIC
    console.log('\n🎯 === INSERTING VIRAL CONTENT EXAMPLES ===');
    
    const viralExamples = [
      {
        content: "Unpopular opinion: Most health advice you follow is making you weaker, not stronger. I've seen what actually works with 1000+ patients. The truth will shock you...",
        viral_score: 90,
        content_type: 'controversial_take'
      },
      {
        content: "The patient who changed everything I thought about medicine walked in at 3 AM. What she said next made me question 10 years of medical training...",
        viral_score: 85,
        content_type: 'personal_story'
      },
      {
        content: "Wild: Your phone already knows you're getting sick before you do. The data patterns are terrifying. Here's what tech companies aren't telling you...",
        viral_score: 88,
        content_type: 'shock_value_data'
      }
    ];
    
    for (const example of viralExamples) {
      await supabase.from('bot_config').upsert({
        key: `force_viral_example_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        value: example,
        updated_at: new Date().toISOString()
      });
    }
    console.log(`✅ Inserted ${viralExamples.length} viral content examples`);
    
    // 5. BLOCK ACADEMIC AGENTS DIRECTLY
    console.log('\n🚫 === BLOCKING ACADEMIC AGENTS ===');
    
    const blockConfigs = [
      {
        key: 'block_research_agent',
        value: { active: true, reason: 'generates academic content' }
      },
      {
        key: 'block_expert_intelligence',
        value: { active: true, reason: 'too academic for viral content' }
      },
      {
        key: 'block_comprehensive_content',
        value: { active: true, reason: 'creates research-heavy posts' }
      }
    ];
    
    for (const block of blockConfigs) {
      await supabase.from('bot_config').upsert({
        key: block.key,
        value: block.value,
        updated_at: new Date().toISOString()
      });
      console.log(`🚫 BLOCKED: ${block.key}`);
    }
    
    // 6. VERIFY VIRAL ACTIVATION
    console.log('\n🔍 === VERIFYING VIRAL FORCE ACTIVATION ===');
    
    const { data: allConfigs } = await supabase
      .from('bot_config')
      .select('key, value')
      .like('key', '%viral%');
    
    console.log('✅ Active Viral Configurations:');
    allConfigs?.forEach(config => {
      console.log(`   - ${config.key}: ${config.value?.enabled || config.value?.active || config.value?.mode || 'ACTIVE'}`);
    });
    
    console.log('\n🔥 === VIRAL CONTENT FORCE ACTIVATED ===');
    console.log('🚀 All academic content systems BLOCKED');
    console.log('🎯 Viral content agents PRIORITIZED');
    console.log('⚡ Next posts MUST be viral, not academic');
    console.log('\n🔄 Deploy to Render IMMEDIATELY for viral content!');
    
  } catch (error) {
    console.error('❌ Force viral content activation failed:', error);
  }
}

forceViralContentNow(); 