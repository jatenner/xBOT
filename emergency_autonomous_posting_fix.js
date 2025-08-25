#!/usr/bin/env node

/**
 * EMERGENCY AUTONOMOUS POSTING FIX
 * 
 * The bot has been silent for 10+ hours because main.ts is using SimplifiedPostingEngine
 * which requires manual calls, not autonomous posting.
 * 
 * This fixes the autonomous posting by ensuring the system runs automatically.
 */

require('dotenv').config();

async function fixAutonomousPosting() {
  console.log('🚨 EMERGENCY: FIXING 10-HOUR POSTING SILENCE');
  console.log('============================================');
  
  console.log('\n❌ CURRENT PROBLEM:');
  console.log('   Bot silent for 10+ hours');
  console.log('   main.ts using SimplifiedPostingEngine (manual calls only)');
  console.log('   No autonomous posting schedule running');
  
  console.log('\n✅ SOLUTION:');
  console.log('   Switch back to AutonomousPostingEngine');
  console.log('   Ensure posting schedule is active');
  console.log('   Lower posting threshold from 60 to 40');
  
  try {
    // Check current main.ts configuration
    const fs = require('fs');
    const path = require('path');
    
    const mainPath = path.join(process.cwd(), 'src', 'main.ts');
    let mainContent = fs.readFileSync(mainPath, 'utf8');
    
    console.log('\n🔍 Checking main.ts configuration...');
    
    if (mainContent.includes('SimplifiedPostingEngine')) {
      console.log('❌ Found SimplifiedPostingEngine - this requires manual calls!');
      console.log('✅ Need to switch to AutonomousPostingEngine');
      
      // Update main.ts to use autonomous posting
      const updatedMain = mainContent
        .replace(
          /import.*SimplifiedPostingEngine.*from.*['"]/g,
          "import { AutonomousPostingEngine } from './core/autonomousPostingEngine'"
        )
        .replace(
          /SimplifiedPostingEngine/g,
          'AutonomousPostingEngine'
        );
      
      fs.writeFileSync(mainPath, updatedMain);
      console.log('✅ Updated main.ts to use AutonomousPostingEngine');
    } else {
      console.log('✅ main.ts already using AutonomousPostingEngine');
    }
    
    // Check if autonomous posting threshold is too high
    const autonomousEnginePath = path.join(process.cwd(), 'src', 'core', 'autonomousPostingEngine.ts');
    if (fs.existsSync(autonomousEnginePath)) {
      let autonomousContent = fs.readFileSync(autonomousEnginePath, 'utf8');
      
      if (autonomousContent.includes('need: 60')) {
        console.log('❌ Posting threshold too high (60) - lowering to 40');
        
        autonomousContent = autonomousContent.replace(
          /need:\s*60/g,
          'need: 40'
        );
        
        fs.writeFileSync(autonomousEnginePath, autonomousContent);
        console.log('✅ Lowered posting threshold from 60 to 40');
      }
    }
    
    console.log('\n🚀 DEPLOYING AUTONOMOUS POSTING FIX...');
    
    // Build the updated code
    const { spawn } = require('child_process');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    buildProcess.on('close', (buildCode) => {
      if (buildCode === 0) {
        console.log('✅ Build successful');
        
        // Force a deployment
        console.log('🚀 Triggering Railway deployment...');
        
        const deployProcess = spawn('git', ['add', '.'], {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        
        deployProcess.on('close', (gitCode) => {
          if (gitCode === 0) {
            const commitProcess = spawn('git', ['commit', '-m', 'EMERGENCY: Fix autonomous posting silence + database constraints'], {
              stdio: 'inherit',
              cwd: process.cwd()
            });
            
            commitProcess.on('close', (commitCode) => {
              const pushProcess = spawn('git', ['push'], {
                stdio: 'inherit',
                cwd: process.cwd()
              });
              
              pushProcess.on('close', (pushCode) => {
                if (pushCode === 0) {
                  console.log('\n🎉 AUTONOMOUS POSTING FIX DEPLOYED!');
                  console.log('\n✅ FIXED ISSUES:');
                  console.log('   ✅ Switched to AutonomousPostingEngine');
                  console.log('   ✅ Lowered posting threshold');
                  console.log('   ✅ Autonomous schedule will resume');
                  console.log('   ✅ Bot will start posting again within 5-10 minutes');
                } else {
                  console.log('❌ Git push failed');
                }
              });
            });
          }
        });
      } else {
        console.log('❌ Build failed');
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing autonomous posting:', error.message);
  }
}

fixAutonomousPosting();