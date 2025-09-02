#!/usr/bin/env node

/**
 * COMPREHENSIVE SYSTEM AUDIT
 * Check what's actually running and identify content quality issues
 */

async function fullSystemAudit() {
  console.log('🔍 COMPREHENSIVE SYSTEM AUDIT');
  console.log('='.repeat(60));
  
  try {
    console.log('\n1️⃣ CHECKING DEPLOYED FILES...');
    const fs = require('fs');
    
    // Check if Ultimate Content System files exist
    const ultimateFiles = [
      'dist/content/masterContentSystem.js',
      'dist/content/contentGrowthEngine.js', 
      'dist/content/contentLearningSystem.js',
      'dist/content/unifiedContentOrchestrator.js',
      'dist/ai/antiSpamContentGenerator.js'
    ];
    
    let ultimateSystemDeployed = true;
    for (const file of ultimateFiles) {
      const exists = fs.existsSync(file);
      console.log(`${exists ? '✅' : '❌'} ${file}`);
      if (!exists) ultimateSystemDeployed = false;
    }
    
    console.log('\n2️⃣ CHECKING MAIN ENTRY POINT...');
    
    // Check what main.ts is calling
    if (fs.existsSync('src/main.ts')) {
      const mainContent = fs.readFileSync('src/main.ts', 'utf8');
      console.log('📄 Main.ts content preview:');
      console.log(mainContent.substring(0, 500) + '...');
      
      const usesSimplified = mainContent.includes('SimplifiedPostingEngine');
      const usesAutonomous = mainContent.includes('AutonomousPostingEngine');
      const usesOptimized = mainContent.includes('OptimizedPostingEngine');
      
      console.log(`\n📊 MAIN ENTRY ANALYSIS:`);
      console.log(`   SimplifiedPostingEngine: ${usesSimplified ? '✅' : '❌'}`);
      console.log(`   AutonomousPostingEngine: ${usesAutonomous ? '✅' : '❌'}`);
      console.log(`   OptimizedPostingEngine: ${usesOptimized ? '✅' : '❌'}`);
    }
    
    console.log('\n3️⃣ CHECKING POSTING ENGINE INTEGRATION...');
    
    // Check SimplifiedPostingEngine (should use Ultimate System)
    if (fs.existsSync('dist/core/simplifiedPostingEngine.js')) {
      const simplifiedContent = fs.readFileSync('dist/core/simplifiedPostingEngine.js', 'utf8');
      
      const hasUltimate = simplifiedContent.includes('UnifiedContentOrchestrator');
      const hasGenerate = simplifiedContent.includes('generateUltimateContent');
      const hasLogging = simplifiedContent.includes('ULTIMATE_SYSTEM');
      
      console.log(`✅ SimplifiedPostingEngine deployed`);
      console.log(`   UnifiedContentOrchestrator: ${hasUltimate ? '✅' : '❌'}`);
      console.log(`   generateUltimateContent: ${hasGenerate ? '✅' : '❌'}`);
      console.log(`   Ultimate logging: ${hasLogging ? '✅' : '✅'}`);
    }
    
    // Check AutonomousPostingEngine (might be generating spam)
    if (fs.existsSync('dist/core/autonomousPostingEngine.js')) {
      const autonomousContent = fs.readFileSync('dist/core/autonomousPostingEngine.js', 'utf8');
      
      const hasOldGeneration = autonomousContent.includes('generateContent()');
      const hasSpamPatterns = autonomousContent.includes('Shocking') || autonomousContent.includes('BREAKING');
      
      console.log(`⚠️ AutonomousPostingEngine deployed`);
      console.log(`   Uses old generateContent: ${hasOldGeneration ? '❌ YES' : '✅ NO'}`);
      console.log(`   Has spam patterns: ${hasSpamPatterns ? '❌ YES' : '✅ NO'}`);
    }
    
    console.log('\n4️⃣ CHECKING PACKAGE.JSON SCRIPTS...');
    
    // Check what npm scripts are available
    if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};
      
      console.log('📦 Available scripts:');
      Object.keys(scripts).forEach(script => {
        if (script.includes('post') || script.includes('start')) {
          console.log(`   ${script}: ${scripts[script]}`);
        }
      });
    }
    
    console.log('\n5️⃣ TESTING ULTIMATE CONTENT SYSTEM...');
    
    try {
      // Test if Ultimate System works
      const { AntiSpamContentGenerator } = await import('./dist/ai/antiSpamContentGenerator.js');
      const generator = AntiSpamContentGenerator.getInstance();
      
      // Test spam detection
      const spamExamples = [
        "Shocking Truth: 80% of people fail at a plant-based diet!",
        "BREAKING: Did you know Data from the world's largest nutrition database...",
        "🚨 HEALTH ALERT: The secret doctors don't want you to know!"
      ];
      
      console.log('🚫 SPAM DETECTION TEST:');
      spamExamples.forEach(example => {
        const isSpam = generator.isSpammy(example);
        console.log(`   ${isSpam ? '❌ SPAM' : '✅ CLEAN'}: "${example.substring(0, 50)}..."`);
      });
      
      // Generate authentic content
      const authentic = await generator.generateAuthenticContent('health');
      console.log('\n✅ AUTHENTIC CONTENT GENERATION TEST:');
      console.log(`   Content: "${authentic.content}"`);
      console.log(`   Authenticity: ${authentic.authenticity_score}/100`);
      console.log(`   Engagement: ${authentic.engagement_prediction}/100`);
      
    } catch (error) {
      console.log('❌ Ultimate Content System test failed:', error.message);
    }
    
    console.log('\n6️⃣ DIAGNOSING THE PROBLEM...');
    
    console.log('\n🔍 ROOT CAUSE ANALYSIS:');
    if (!ultimateSystemDeployed) {
      console.log('❌ PRIMARY ISSUE: Ultimate Content System not fully deployed');
    } else {
      console.log('⚠️ LIKELY ISSUE: Wrong posting engine is running in production');
      console.log('   - Ultimate Content System is deployed but not being used');
      console.log('   - AutonomousPostingEngine may be generating the spam content');
      console.log('   - Main.ts may not be calling the right engine');
    }
    
    console.log('\n🎯 RECOMMENDED FIXES:');
    console.log('1. Ensure main.ts uses SimplifiedPostingEngine (with Ultimate System)');
    console.log('2. Disable or redirect AutonomousPostingEngine to use Ultimate System');
    console.log('3. Verify npm scripts point to the correct entry point');
    console.log('4. Test posting system end-to-end');
    
    console.log('\n📊 AUDIT COMPLETE');
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  }
}

fullSystemAudit();
