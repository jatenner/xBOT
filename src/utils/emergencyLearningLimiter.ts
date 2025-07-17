// 🚀 VIRAL LEARNING ENABLER - Emergency learning blocks DISABLED
export class EmergencyLearningLimiter {
  private static instance: EmergencyLearningLimiter;
  private learningCalls: number = 0;
  private lastReset: number = Date.now();
  private readonly MAX_CALLS_PER_HOUR = 10; // Increased for viral mode
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
    
    // 🚀 VIRAL MODE: Always allow learning for viral optimization
    console.log('🚀 Viral mode: Learning enabled for viral optimization');
    
    // Check if we're over limit (generous limits for viral mode)
    if (this.learningCalls >= this.MAX_CALLS_PER_HOUR) {
      console.log('📊 Learning rate limit reached for this hour');
      return false;
    }
    
    return true; // Learning enabled for viral mode
  }
  
  recordLearningCall(): void {
    this.learningCalls++;
    console.log(`📊 Learning calls this hour: ${this.learningCalls}/${this.MAX_CALLS_PER_HOUR}`);
  }
  
  isEmergencyMode(): boolean {
    // 🚀 FORCE DISABLE: Never report emergency mode for viral growth
    return false; // Emergency mode permanently disabled
  }
}

export const emergencyLearningLimiter = EmergencyLearningLimiter.getInstance();