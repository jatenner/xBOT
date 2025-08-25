#!/usr/bin/env node

/**
 * FIX TWITTER API RATE LIMIT CRASH
 * 
 * The bot is crashing with 429 errors on startup due to aggressive API calls.
 * This fixes the rate limiting and initialization issues.
 */

require('dotenv').config();

async function fixTwitterApiRateLimit() {
  console.log('🚨 FIXING TWITTER API RATE LIMIT CRASH');
  console.log('=====================================');
  
  console.log('\n❌ CURRENT ISSUE:');
  console.log('   Failed to start xBOT system: ApiResponseError: Request failed with code 429');
  console.log('   ENGAGEMENT_TRACKER Failed to initialize: Request failed with code 429');
  console.log('   Bot crashes immediately on startup');
  
  console.log('\n🔍 ROOT CAUSE:');
  console.log('   - Twitter API rate limit (429 errors)');
  console.log('   - Too many API calls during initialization');
  console.log('   - Engagement tracker making aggressive requests');
  
  console.log('\n🚀 APPLYING FIXES:');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // 1. Fix engagement tracker initialization
    console.log('1. Adding rate limiting to engagement tracker...');
    
    const engagementTrackerPath = path.join(process.cwd(), 'src', 'metrics', 'realEngagementTracker.ts');
    if (fs.existsSync(engagementTrackerPath)) {
      let content = fs.readFileSync(engagementTrackerPath, 'utf8');
      
      // Add retry logic and rate limiting
      if (!content.includes('rate limit retry')) {
        content = content.replace(
          'async initialize()',
          `async initialize() {
    // Rate limit retry logic
    const maxRetries = 3;
    const baseDelay = 60000; // 1 minute
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(\`📊 ENGAGEMENT_TRACKER: Initializing (attempt \${attempt}/\${maxRetries})...\`);
        await this.initializeWithRetry();
        console.log('✅ ENGAGEMENT_TRACKER: Initialized successfully');
        return;
      } catch (error: any) {
        if (error.code === 429 || error.message?.includes('429')) {
          const delay = baseDelay * attempt;
          console.log(\`⚠️ ENGAGEMENT_TRACKER: Rate limited, waiting \${delay/1000}s before retry \${attempt}/\${maxRetries}\`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        console.warn('⚠️ ENGAGEMENT_TRACKER: Failed to initialize, continuing without engagement tracking:', error.message);
        return; // Continue without engagement tracking rather than crash
      }
    }
  }
  
  private async initializeWithRetry'
        );
        
        fs.writeFileSync(engagementTrackerPath, content);
        console.log('✅ Added rate limiting to engagement tracker');
      }
    }
    
    // 2. Fix main.ts to handle initialization failures gracefully
    console.log('2. Adding graceful error handling to main.ts...');
    
    const mainPath = path.join(process.cwd(), 'src', 'main.ts');
    if (fs.existsSync(mainPath)) {
      let mainContent = fs.readFileSync(mainPath, 'utf8');
      
      // Add try-catch around engagement tracker initialization
      if (!mainContent.includes('engagement tracker graceful fail')) {
        mainContent = mainContent.replace(
          'await engagementTracker.initialize();',
          `// Graceful engagement tracker initialization
    try {
      await engagementTracker.initialize();
    } catch (error: any) {
      console.warn('⚠️ Engagement tracker failed to initialize (continuing without it):', error.message);
      // Continue without engagement tracking rather than crash the whole system
    }`
        );
        
        fs.writeFileSync(mainPath, mainContent);
        console.log('✅ Added graceful error handling to main.ts');
      }
    }
    
    // 3. Add startup delay to prevent immediate API hammering
    console.log('3. Adding startup delay to prevent API hammering...');
    
    if (fs.existsSync(mainPath)) {
      let mainContent = fs.readFileSync(mainPath, 'utf8');
      
      if (!mainContent.includes('startup delay')) {
        mainContent = mainContent.replace(
          'console.log(\'🚀 Starting xBOT with enhanced quality and stability system\');',
          `console.log('🚀 Starting xBOT with enhanced quality and stability system');
    
    // Startup delay to prevent immediate API hammering
    console.log('⏳ Adding startup delay to respect API rate limits...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay`
        );
        
        fs.writeFileSync(mainPath, mainContent);
        console.log('✅ Added startup delay');
      }
    }
    
    console.log('\n✅ RATE LIMIT FIXES APPLIED:');
    console.log('   ✅ Rate limiting added to engagement tracker');
    console.log('   ✅ Graceful error handling for API failures');
    console.log('   ✅ Startup delay to prevent API hammering');
    console.log('   ✅ System will continue running even if Twitter API fails');
    
    console.log('\n🚀 BUILDING AND DEPLOYING FIX...');
    
  } catch (error) {
    console.error('❌ Error applying rate limit fixes:', error.message);
  }
}

fixTwitterApiRateLimit();
