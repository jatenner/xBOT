#!/usr/bin/env node

/**
 * 🔓 RESET POSTING LOCKS
 * Emergency script to reset stuck posting locks
 */

console.log('🔓 RESET POSTING LOCKS');
console.log('====================');

async function resetPostingLocks() {
  try {
    // Import the PostingOrchestrator
    const { PostingOrchestrator } = await import('./dist/posting/orchestrator.js');
    const { CadenceGuard } = await import('./dist/posting/cadenceGuard.js');
    
    console.log('📍 Resetting PostingOrchestrator lock...');
    const orchestrator = PostingOrchestrator.getInstance();
    // Force reset the isPosting flag
    orchestrator.isPosting = false;
    console.log('✅ PostingOrchestrator lock reset');
    
    console.log('📍 Resetting CadenceGuard lock...');
    await CadenceGuard.releaseLock();
    console.log('✅ CadenceGuard lock reset');
    
    console.log('');
    console.log('🎯 ALL POSTING LOCKS RESET SUCCESSFULLY!');
    console.log('🚀 Bot should now be able to post again');
    
  } catch (error) {
    console.error('❌ Error resetting locks:', error.message);
    process.exit(1);
  }
}

resetPostingLocks();
