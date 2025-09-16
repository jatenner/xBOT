/**
 * Circuit Breaker for OpenAI Rate Limiting
 * Prevents repeated failures and provides cooling down periods
 */

import { kvGet, kvSet, kvDel } from './kv';
import { timeUntilExpiry, addMinutes, isExpired } from './time';
import { FEATURE_FLAGS } from '../config/featureFlags';

export interface CircuitState {
  isOpen: boolean;
  expiryISO: string;
  remainingMs: number;
}

/**
 * Open a circuit breaker for a specified duration
 */
export async function openCircuit(key: string, minutes: number): Promise<void> {
  const circuitKey = `circuit:${key}`;
  const alertKey = `circuit_alerted:${key}`;
  const expiryISO = addMinutes(minutes);
  
  try {
    await kvSet(circuitKey, expiryISO, minutes * 60);
    
    console.log(`🚨 CIRCUIT_BREAKER: Opened '${key}' for ${minutes} minutes (expires: ${expiryISO})`);
    
    // Send alert if webhook configured and not already alerted for this window
    if (FEATURE_FLAGS.ALERT_WEBHOOK_URL) {
      const alreadyAlerted = await kvGet(alertKey);
      if (!alreadyAlerted) {
        await sendCircuitAlert(key, minutes, expiryISO);
        await kvSet(alertKey, 'true', minutes * 60); // Prevent duplicate alerts
      }
    }
  } catch (error) {
    console.error(`Failed to open circuit ${key}:`, error);
  }
}

/**
 * Check if a circuit breaker is currently open
 */
export async function isCircuitOpen(key: string): Promise<boolean> {
  const circuitKey = `circuit:${key}`;
  
  try {
    const expiryISO = await kvGet(circuitKey);
    if (!expiryISO) return false;
    
    if (isExpired(expiryISO)) {
      await kvDel(circuitKey);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to check circuit ${key}:`, error);
    return false;
  }
}

/**
 * Get remaining time in milliseconds for a circuit breaker
 */
export async function getCircuitRemaining(key: string): Promise<number> {
  const circuitKey = `circuit:${key}`;
  
  try {
    const expiryISO = await kvGet(circuitKey);
    if (!expiryISO) return 0;
    
    const remaining = timeUntilExpiry(expiryISO);
    if (remaining === 0) {
      await kvDel(circuitKey);
    }
    
    return remaining;
  } catch (error) {
    console.warn(`Failed to get circuit remaining ${key}:`, error);
    return 0;
  }
}

/**
 * Get circuit state for status reporting
 */
export async function getCircuitState(key: string): Promise<CircuitState> {
  const isOpen = await isCircuitOpen(key);
  const remainingMs = isOpen ? await getCircuitRemaining(key) : 0;
  const expiryISO = isOpen ? await kvGet(`circuit:${key}`) || '' : '';
  
  return {
    isOpen,
    expiryISO,
    remainingMs
  };
}

/**
 * Manually close a circuit breaker (admin function)
 */
export async function closeCircuit(key: string): Promise<void> {
  const circuitKey = `circuit:${key}`;
  const alertKey = `circuit_alerted:${key}`;
  
  try {
    await kvDel(circuitKey);
    await kvDel(alertKey);
    console.log(`✅ CIRCUIT_BREAKER: Manually closed '${key}'`);
  } catch (error) {
    console.error(`Failed to close circuit ${key}:`, error);
  }
}

/**
 * Send webhook alert when circuit opens
 */
async function sendCircuitAlert(key: string, minutes: number, expiryISO: string): Promise<void> {
  const webhookUrl = FEATURE_FLAGS.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  const alertPayload = {
    type: 'circuit_breaker_opened',
    circuit: key,
    duration_minutes: minutes,
    expires_at: expiryISO,
    timestamp: new Date().toISOString(),
    service: 'xBOT',
    severity: 'warning',
    message: `Circuit breaker '${key}' opened for ${minutes} minutes due to repeated failures`
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'xBOT-CircuitBreaker/1.0'
      },
      body: JSON.stringify(alertPayload)
    });
    
    if (response.ok) {
      console.log(`📡 CIRCUIT_ALERT: Sent webhook notification for '${key}'`);
    } else {
      console.warn(`Failed to send circuit alert: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn('Failed to send circuit breaker alert:', error);
  }
}

/**
 * Clear all circuit breakers (emergency function)
 */
export async function clearAllCircuits(): Promise<void> {
  try {
    // This is implementation-specific to the KV store
    // For now, we'll just clear the common ones
    const commonCircuits = ['openai_quota', 'openai_rate_limit'];
    
    for (const circuit of commonCircuits) {
      await closeCircuit(circuit);
    }
    
    console.log('🔄 CIRCUIT_BREAKER: Cleared all known circuits');
  } catch (error) {
    console.error('Failed to clear circuits:', error);
  }
}
