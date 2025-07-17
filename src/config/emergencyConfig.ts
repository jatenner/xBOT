// 🚀 VIRAL GROWTH CONFIGURATION - Emergency mode PERMANENTLY DISABLED
// =====================================================================
// This ensures viral growth capabilities regardless of environment variables

export const EMERGENCY_BOT_CONFIG = {
  // 🚀 VIRAL GROWTH MODE: Emergency mode DISABLED
  EMERGENCY_MODE: false,                    // DISABLED: Let viral agents work!
  DISABLE_AUTONOMOUS_LEARNING: false,       // ENABLED: Learning for viral optimization
  DISABLE_LEARNING_AGENTS: false,           // ENABLED: All learning agents active
  DAILY_BUDGET_LIMIT: 3.00,                // Keep cost protection
  EMERGENCY_COST_MODE: false,               // DISABLED: Allow AI optimization
  
  // 🧠 LEARNING ENABLED for viral growth
  MAX_LEARNING_CYCLES_PER_HOUR: 6,         // Full learning capacity
  LEARNING_COOLDOWN_MINUTES: 10,           // Fast learning adaptation
  
  // 🎯 VIRAL POSTING CAPABILITIES
  BULLETPROOF_MODE: true,                  // Keep reliability
  GRACEFUL_ERROR_HANDLING: true,           // Keep error handling
  
  // 🔥 VIRAL POSTING FREQUENCY
  MAX_POSTS_PER_HOUR: 2,                   // Allow viral posting frequency  
  NORMAL_OPERATION: true,                  // FULL operation mode
  
  // 🚀 VIRAL GROWTH FEATURES
  ENABLE_VIRAL_AGENTS: true,               // All viral agents active
  ENABLE_ENGAGEMENT_OPTIMIZATION: true,    // Optimize for followers
  ENABLE_LEARNING_FROM_ENGAGEMENT: true,   // Learn what goes viral
  ENABLE_FOLLOWER_GROWTH_STRATEGY: true    // Focus on growth
};

// 🎯 FORCE VIRAL MODE - Ignore ALL environment variables
export const isEmergencyMode = (): boolean => {
  // Check database override first
  const dbOverride = process.env.EMERGENCY_MODE_OVERRIDE || 'false';
  if (dbOverride === 'false') {
    return false; // Database says no emergency mode
  }
  
  // FORCE VIRAL MODE regardless of environment variables
  return false; // EMERGENCY MODE PERMANENTLY DISABLED FOR VIRAL GROWTH!
};

// 🚀 FORCE VIRAL MODE ACTIVE
export const isViralModeActive = (): boolean => {
  return true; // VIRAL MODE ALWAYS ACTIVE!
};

console.log('🚀 VIRAL GROWTH MODE FORCE ACTIVE - Emergency mode permanently disabled!');