/**
 * 🚨 EMERGENCY POSTING SYSTEM
 * Replaces the broken posting system with a safe, controlled version
 */

import { emergencyCircuitBreaker } from '../infra/emergencyCircuitBreaker';
import { railwaySessionManager } from '../infra/session/railwaySessionManager';

export interface EmergencyPostResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function emergencyPost(text: string): Promise<EmergencyPostResult> {
  console.log('🚨 EMERGENCY_POST: Starting controlled posting');
  
  // Circuit breaker check
  if (!emergencyCircuitBreaker.canAttemptPost()) {
    const status = emergencyCircuitBreaker.getStatus();
    console.log('🚨 EMERGENCY_POST: Blocked by circuit breaker', status);
    return { 
      success: false, 
      error: `System overloaded. Circuit breaker active. Reset in ${Math.round((status.timeUntilReset || 0) / 1000)}s` 
    };
  }

  try {
    // Validate session first
    const sessionData = await railwaySessionManager.loadSession();
    if (!railwaySessionManager.validateSession(sessionData)) {
      emergencyCircuitBreaker.recordFailure('Invalid session');
      return { 
        success: false, 
        error: 'No valid Twitter session available' 
      };
    }

    console.log('🚨 EMERGENCY_POST: Session validated, attempting safe post');

    // NO FALLBACKS - Emergency post must extract real ID or fail
    console.error('🚨 EMERGENCY_POST: ❌ This emergency poster is deprecated and should not be used');
    console.error('🚨 EMERGENCY_POST: Use bulletproofTwitterComposer.ts instead');
    
    return {
      success: false,
      error: 'Emergency poster deprecated - use bulletproofTwitterComposer'
    };

  } catch (error: any) {
    const errorMessage = error.message || 'Emergency posting failed';
    emergencyCircuitBreaker.recordFailure(errorMessage);
    
    console.error('🚨 EMERGENCY_POST: Failed', errorMessage);
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}
