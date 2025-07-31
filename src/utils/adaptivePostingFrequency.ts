/**
 * 🎯 ADAPTIVE POSTING FREQUENCY
 * 
 * Manages dynamic daily posting limits controlled by AI learning
 * Integrates with bot_settings table for real-time limit adjustments
 */

import { supabaseClient } from './supabaseClient';

// Cache for performance (refreshed every few minutes)
let cachedLimit = 15; // Default starting limit
let lastCacheUpdate = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * 📊 GET CURRENT DYNAMIC DAILY LIMIT
 * Fetches from bot_settings table with caching for performance
 */
export async function refreshDailyLimit(): Promise<number> {
  try {
    const now = Date.now();
    
    // Use cache if fresh
    if (now - lastCacheUpdate < CACHE_DURATION_MS) {
      return cachedLimit;
    }
    
    console.log('🔄 Refreshing daily post limit from database...');
    
    const { data, error } = await supabaseClient.supabase
      ?.from('bot_settings')
      .select('daily_post_limit')
      .single() || { data: null, error: null };
    
    if (error) {
      console.warn('⚠️ Failed to fetch daily limit from DB, using cached:', error.message);
      return cachedLimit;
    }
    
    if (data?.daily_post_limit) {
      const newLimit = Math.min(100, Math.max(5, data.daily_post_limit)); // Enforce bounds
      
      if (newLimit !== cachedLimit) {
        console.log(`🎯 Daily post limit updated: ${cachedLimit} → ${newLimit}`);
        cachedLimit = newLimit;
      }
      
      lastCacheUpdate = now;
      return cachedLimit;
    }
    
    console.warn('⚠️ No daily_post_limit found in bot_settings, using default');
    return cachedLimit;
    
  } catch (error) {
    console.error('❌ Error refreshing daily limit:', error);
    return cachedLimit; // Fallback to cached value
  }
}

/**
 * 🎯 UPDATE DAILY LIMIT (Called by AI optimization)
 * Updates the bot_settings table with new optimal posting frequency
 */
export async function updateDailyLimit(newLimit: number, reason?: string): Promise<boolean> {
  try {
    const boundedLimit = Math.min(100, Math.max(5, Math.round(newLimit)));
    
    console.log(`🎯 AI updating daily post limit: ${cachedLimit} → ${boundedLimit}`);
    if (reason) {
      console.log(`📊 Reason: ${reason}`);
    }
    
    const { error } = await supabaseClient.supabase
      ?.from('bot_settings')
      .update({ 
        daily_post_limit: boundedLimit,
        updated_at: new Date().toISOString()
      })
      .eq('id', true) || { error: null };
    
    if (error) {
      console.error('❌ Failed to update daily limit in DB:', error);
      return false;
    }
    
    // Update cache immediately
    cachedLimit = boundedLimit;
    lastCacheUpdate = Date.now();
    
    console.log(`✅ Daily post limit updated to ${boundedLimit}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error updating daily limit:', error);
    return false;
  }
}

/**
 * 📈 GET CURRENT CACHED LIMIT (Fast, no DB call)
 */
export function getCachedDailyLimit(): number {
  return cachedLimit;
}

/**
 * 🔄 FORCE CACHE REFRESH
 */
export async function forceRefreshCache(): Promise<number> {
  lastCacheUpdate = 0; // Force refresh
  return await refreshDailyLimit();
}

/**
 * 📊 GET ADAPTIVE POSTING STATUS
 */
export async function getAdaptiveStatus() {
  const currentLimit = await refreshDailyLimit();
  const cacheAge = (Date.now() - lastCacheUpdate) / 1000 / 60; // minutes
  
  return {
    currentLimit,
    cachedLimit,
    cacheAgeMinutes: Math.round(cacheAge),
    lastUpdate: new Date(lastCacheUpdate).toISOString(),
    bounds: { min: 5, max: 100 }
  };
}