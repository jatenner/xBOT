#!/usr/bin/env node

/**
 * 🧠 FORCE HUMAN EXPERT TEST POST
 * Tests the improved Human Expert content generation immediately
 */

import { PostTweetAgent } from './src/agents/postTweet.js';
import { supabaseClient } from './src/utils/supabaseClient.js';

async function forceHumanExpertPost() {
  console.log('🧠 === FORCING HUMAN EXPERT TEST POST ===');
  
  try {
    // Initialize PostTweetAgent
    const postAgent = new PostTweetAgent();
    
    console.log('🔧 Setting emergency override for human expert mode...');
    
    // Set emergency override flag for immediate posting
    const overrideResult = await supabaseClient.upsertConfig('startup_posting_override', {
      enabled: true,
      force_immediate_post: true,
      force_human_expert_mode: true,
      clear_phantom_times: true,
      reason: 'Testing improved Human Expert content - Emergency Quality Fix',
      timestamp: new Date().toISOString()
    });
    
    if (overrideResult.success) {
      console.log('✅ Emergency override set for Human Expert testing');
    }
    
    // Force a single test post
    console.log('🧠 Generating Human Expert content (no contamination)...');
    
    const result = await postAgent.run(true, false); // force=true, testMode=false
    
    if (result.success) {
      console.log('✅ HUMAN EXPERT POST SUCCESSFUL!');
      console.log(`🐦 Tweet ID: ${result.tweetId}`);
      console.log(`📝 Content: ${result.content}`);
      console.log(`🎯 Quality: Using authentic human voice from persona.txt`);
      
      // Clear the override to prevent spam
      await supabaseClient.upsertConfig('startup_posting_override', {
        enabled: false,
        force_immediate_post: false,
        force_human_expert_mode: false,
        reason: 'Human Expert test completed successfully',
        timestamp: new Date().toISOString()
      });
      
      console.log('🔧 Override cleared - normal posting will resume');
      
    } else {
      console.error('❌ Human Expert post failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the test
forceHumanExpertPost().catch(console.error); 