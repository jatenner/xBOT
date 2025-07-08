
// Emergency learning rate limiter to prevent cost runaway
export class EmergencyLearningLimiter {
  private static instance: EmergencyLearningLimiter;
  private learningCalls: number = 0;
  private lastReset: number = Date.now();
  private readonly MAX_CALLS_PER_HOUR = 1; // Reduced from 2 to 1
  private readonly HOUR_IN_MS = 3600000;
  
  static getInstance(): EmergencyLearningLimiter {
    if (!EmergencyLearningLimiter.instance) {
      EmergencyLearningLimiter.instance = new EmergencyLearningLimiter();
    }
    return EmergencyLearningLimiter.instance;
  }
  
  canPerformLearning(): boolean {
    const now = Date.now();
    
    // Reset counter every hour
    if (now - this.lastReset > this.HOUR_IN_MS) {
      this.learningCalls = 0;
      this.lastReset = now;
    }
    
    // ULTRA-STRICT: Block learning entirely for cost protection
    if (this.isEmergencyMode()) {
      console.log('🚨 Emergency mode: All learning blocked for cost protection');
      return false;
    }
    
    // Check if we're over limit
    if (this.learningCalls >= this.MAX_CALLS_PER_HOUR) {
      console.log('🚨 Learning rate limit reached for this hour');
      return false;
    }
    
    return true;
  }
  
  recordLearningCall(): void {
    this.learningCalls++;
    console.log(`📊 Learning calls this hour: ${this.learningCalls}/${this.MAX_CALLS_PER_HOUR}`);
  }
  
  isEmergencyMode(): boolean {
    return process.env.EMERGENCY_MODE === 'true' || 
           process.env.EMERGENCY_COST_MODE === 'true' ||
           true; // Force emergency mode for cost protection
  }
}

export const emergencyLearningLimiter = EmergencyLearningLimiter.getInstance();
