#!/usr/bin/env node

/**
 * 🔍 TWITTER VS DATABASE MISMATCH INVESTIGATION
 * 
 * Twitter shows recent posts but bot claims 0 tweets today.
 * This script investigates the discrepancy.
 */

const { createClient } = require('@supabase/supabase-js');

async function investigateMismatch() {
  console.log('🚨 === TWITTER VS DATABASE MISMATCH INVESTIGATION ===');
  console.log('');
  console.log('📋 KNOWN FACTS:');
  console.log('  • Twitter Account: @SignalAndSynapse shows recent tweets');
  console.log('  • Last tweet: ~4 hours ago (10:57 AM Eastern)');
  console.log('  • Bot logs claim: 0/17 tweets used today');
  console.log('  • Current time: 2:57 PM Eastern');
  console.log('');

  try {
    // Note: We need the environment variables for this to work
    // For now, let's analyze what we can determine
    
    console.log('🔍 === POSSIBLE EXPLANATIONS ===');
    console.log('');
    
    console.log('1. 🤖 MANUAL POSTING:');
    console.log('   • Someone is posting manually to @SignalAndSynapse');
    console.log('   • Bot database only tracks bot-generated posts');
    console.log('   • Manual posts bypass the bot system entirely');
    console.log('');
    
    console.log('2. 📊 DATABASE WRITE FAILURE:');
    console.log('   • Bot is posting successfully to Twitter');
    console.log('   • But failing to record posts in Supabase database');
    console.log('   • This would cause rate limit miscalculation');
    console.log('');
    
    console.log('3. 🔄 MULTIPLE BOT INSTANCES:');
    console.log('   • Different bot instance running somewhere else');
    console.log('   • Using same Twitter account but different database');
    console.log('   • Current bot not aware of other instance');
    console.log('');
    
    console.log('4. 🕐 TIMEZONE/DATE CALCULATION ERROR:');
    console.log('   • Bot using wrong timezone for "today"');
    console.log('   • Posts recorded under different date');
    console.log('   • Rate limit calculation using wrong day');
    console.log('');
    
    console.log('5. 🔧 ENVIRONMENT VARIABLE MISMATCH:');
    console.log('   • Production bot using different database URL');
    console.log('   • Local scripts checking different database');
    console.log('   • Posts exist but in different database project');
    console.log('');
    
    console.log('🎯 === IMMEDIATE VERIFICATION STEPS ===');
    console.log('');
    
    console.log('✅ CONFIRMED EVIDENCE:');
    console.log('  • @SignalAndSynapse has recent tweets (your screenshot)');
    console.log('  • Bot logs show 0 tweets used (production logs)');
    console.log('  • Bot is rate limited with 0 remaining (429 error)');
    console.log('  • Time: July 18th, 2:57 PM Eastern');
    console.log('');
    
    console.log('🔍 NEXT INVESTIGATION ACTIONS:');
    console.log('1. Check if you have been posting manually today');
    console.log('2. Look at actual tweet content to see if it matches bot style');
    console.log('3. Check Twitter API rate limit headers for real usage');
    console.log('4. Verify production environment variables');
    console.log('5. Check if there are multiple Supabase projects');
    console.log('');
    
    console.log('💡 MOST LIKELY SCENARIO:');
    console.log('Based on the evidence, this appears to be MANUAL POSTING:');
    console.log('  • You or someone else posted manually to @SignalAndSynapse');
    console.log('  • This used up the 17 daily Twitter API limit');
    console.log('  • Bot is now rate limited and cannot post');
    console.log('  • Bot database shows 0 because it only tracks bot posts');
    console.log('');
    
    console.log('🎯 VERIFICATION QUESTION:');
    console.log('Did you or anyone else post manually to @SignalAndSynapse today?');
    console.log('');

    // Try to analyze the tweet content we can see
    console.log('📝 === TWEET CONTENT ANALYSIS ===');
    console.log('From your screenshots, recent tweets include:');
    console.log('• "Smartwatch data from 100K+ users: ML detects myocardial infarction 6.2 hours before symptoms..."');
    console.log('• "Digital therapeutics adherence study: session completion rates drop 67% after week 3..."');
    console.log('• "Clinical informatics reality: EHR implementations increase documentation time 23%..."');
    console.log('• "Polygenic risk scores now predict cardiovascular disease with 85% accuracy..."');
    console.log('');
    console.log('🤖 These tweets have BOT characteristics:');
    console.log('  ✅ Professional health tech content');
    console.log('  ✅ Statistical data points');
    console.log('  ✅ Academic citation style');
    console.log('  ✅ Consistent format');
    console.log('');
    console.log('🚨 CONCLUSION: These likely ARE bot-generated tweets!');
    console.log('   The issue is probably database recording failure or environment mismatch.');
    
  } catch (error) {
    console.error('💥 Error during investigation:', error);
  }
}

// Run the investigation
investigateMismatch(); 