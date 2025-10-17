#!/usr/bin/env node
/**
 * MANUALLY TRIGGER CONTENT GENERATION
 * Forces an immediate content planning cycle
 */

require('dotenv').config();

async function triggerNow() {
  console.log('🚀 MANUALLY TRIGGERING CONTENT GENERATION...\n');
  
  // Import and run the plan job directly
  const { planContent } = require('./dist/src/jobs/planJobNew');
  
  try {
    console.log('📝 Running content planning job...');
    await planContent();
    console.log('\n✅ CONTENT GENERATION COMPLETE!');
    console.log('📊 Check the database for new content_metadata entries');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ CONTENT GENERATION FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

triggerNow();
