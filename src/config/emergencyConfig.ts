export const isEmergencyMode = (): boolean => {
  return process.env.EMERGENCY_MODE === 'true' || true; // Enable emergency mode for cost protection
};

export const EMERGENCY_BOT_CONFIG = {
  // ULTRA-STRICT cost protection settings
  EMERGENCY_MODE: true,
  DISABLE_AUTONOMOUS_LEARNING: true,
  DISABLE_LEARNING_AGENTS: true,
  DAILY_BUDGET_LIMIT: 2, // Reduced from $10 to $2
  EMERGENCY_COST_MODE: true,
  
  // Strict learning limits
  MAX_LEARNING_CYCLES_PER_HOUR: 1, // Down from 6
  LEARNING_COOLDOWN_MINUTES: 120, // Up from 10 to 2 hours
  
  // Maintain posting capability
  BULLETPROOF_MODE: true,
  GRACEFUL_ERROR_HANDLING: true,
  
  // Reasonable posting frequency
  MAX_POSTS_PER_HOUR: 2,
  NORMAL_OPERATION: false
};

console.log('🚨 Emergency cost protection mode enabled - $2/day budget');