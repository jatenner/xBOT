#!/usr/bin/env tsx
/**
 * Emergency script to reset browser pool circuit breaker
 * Use when circuit breaker is stuck open and blocking all posts
 */

import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';

async function resetBrowserCircuitBreaker() {
  console.log('🔄 Resetting browser pool circuit breaker...');
  
  try {
    const pool = UnifiedBrowserPool.getInstance();
    
    // Force close circuit breaker (faster than full reset)
    pool.forceCloseCircuitBreaker();
    
    console.log('✅ Browser pool circuit breaker force-closed');
    console.log('📊 Checking status...');
    
    const status = await pool.getStatus();
    console.log(JSON.stringify(status, null, 2));
    
    if (!status.circuitBreaker.isOpen) {
      console.log('✅ Circuit breaker is now CLOSED - posting should work');
    } else {
      console.log('⚠️ Circuit breaker still OPEN - attempting full reset...');
      await pool.resetPool();
      const newStatus = await pool.getStatus();
      if (!newStatus.circuitBreaker.isOpen) {
        console.log('✅ Full reset successful - circuit breaker closed');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Failed to reset circuit breaker:', error.message);
    process.exit(1);
  }
}

resetBrowserCircuitBreaker();

