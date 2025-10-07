/**
 * 🚨 EMERGENCY CIRCUIT BREAKER
 * Prevents cascade failures and resource exhaustion
 */

export class EmergencyCircuitBreaker {
  private static instance: EmergencyCircuitBreaker;
  private failureCount = 0;
  private lastFailureTime = 0;
  private isCircuitOpen = false;
  
  // EMERGENCY LIMITS
  private readonly MAX_FAILURES = 3; // Max failures before circuit opens
  private readonly FAILURE_WINDOW = 60000; // 1 minute window
  private readonly CIRCUIT_TIMEOUT = 300000; // 5 minutes circuit open time
  private readonly MAX_CONCURRENT_BROWSERS = 1; // Only 1 browser at a time
  
  private activeBrowsers = 0;

  public static getInstance(): EmergencyCircuitBreaker {
    if (!EmergencyCircuitBreaker.instance) {
      EmergencyCircuitBreaker.instance = new EmergencyCircuitBreaker();
    }
    return EmergencyCircuitBreaker.instance;
  }

  /**
   * 🚨 Check if posting should be allowed
   */
  canAttemptPost(): boolean {
    const now = Date.now();
    
    // Reset failure count if outside window
    if (now - this.lastFailureTime > this.FAILURE_WINDOW) {
      this.failureCount = 0;
    }
    
    // Check if circuit should be closed
    if (this.isCircuitOpen && now - this.lastFailureTime > this.CIRCUIT_TIMEOUT) {
      console.log('🔄 CIRCUIT_BREAKER: Attempting to close circuit');
      this.isCircuitOpen = false;
      this.failureCount = 0;
    }
    
    // Block if circuit is open
    if (this.isCircuitOpen) {
      console.log('🚨 CIRCUIT_BREAKER: Circuit is OPEN - blocking posting attempt');
      return false;
    }
    
    // Block if too many concurrent browsers
    if (this.activeBrowsers >= this.MAX_CONCURRENT_BROWSERS) {
      console.log('🚨 CIRCUIT_BREAKER: Too many active browsers - blocking');
      return false;
    }
    
    return true;
  }

  /**
   * 🚨 Record a posting failure
   */
  recordFailure(error: string): void {
    const now = Date.now();
    this.failureCount++;
    this.lastFailureTime = now;
    
    console.log(`🚨 CIRCUIT_BREAKER: Failure recorded (${this.failureCount}/${this.MAX_FAILURES}): ${error}`);
    
    // Open circuit if too many failures
    if (this.failureCount >= this.MAX_FAILURES) {
      this.isCircuitOpen = true;
      console.log('🚨 CIRCUIT_BREAKER: Circuit OPENED - blocking all posting for 5 minutes');
    }
  }

  /**
   * 🚨 Record browser launch
   */
  recordBrowserLaunch(): boolean {
    if (this.activeBrowsers >= this.MAX_CONCURRENT_BROWSERS) {
      console.log('🚨 CIRCUIT_BREAKER: Browser launch blocked - too many active');
      return false;
    }
    
    this.activeBrowsers++;
    console.log(`🚨 CIRCUIT_BREAKER: Browser launched (${this.activeBrowsers}/${this.MAX_CONCURRENT_BROWSERS})`);
    return true;
  }

  /**
   * 🚨 Record browser close
   */
  recordBrowserClose(): void {
    this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);
    console.log(`🚨 CIRCUIT_BREAKER: Browser closed (${this.activeBrowsers}/${this.MAX_CONCURRENT_BROWSERS})`);
  }

  /**
   * 🚨 Get circuit status
   */
  getStatus(): { 
    isOpen: boolean; 
    failures: number; 
    activeBrowsers: number;
    timeUntilReset?: number;
  } {
    const timeUntilReset = this.isCircuitOpen 
      ? Math.max(0, this.CIRCUIT_TIMEOUT - (Date.now() - this.lastFailureTime))
      : undefined;
      
    return {
      isOpen: this.isCircuitOpen,
      failures: this.failureCount,
      activeBrowsers: this.activeBrowsers,
      timeUntilReset
    };
  }

  /**
   * 🚨 Emergency reset (admin only)
   */
  emergencyReset(): void {
    console.log('🚨 CIRCUIT_BREAKER: EMERGENCY RESET');
    this.isCircuitOpen = false;
    this.failureCount = 0;
    this.activeBrowsers = 0;
    this.lastFailureTime = 0;
  }
}

// Export singleton
export const emergencyCircuitBreaker = EmergencyCircuitBreaker.getInstance();
