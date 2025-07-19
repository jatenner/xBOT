import { systemMonitor } from './systemMonitor';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;       // Number of failures before opening circuit
  recoveryTimeout: number;        // Time to wait before trying half-open (ms)
  monitoringWindow: number;       // Time window for counting failures (ms)
  minimumRequests: number;        // Minimum requests before considering failure rate
  successThreshold: number;       // Successes needed in half-open to close circuit
  timeout: number;                // Request timeout (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
  failureRate: number;
}

export interface FailureInfo {
  error: Error;
  timestamp: Date;
  operation: string;
  duration: number;
}

/**
 * 🛡️ CIRCUIT BREAKER IMPLEMENTATION
 * 
 * Prevents cascading failures by temporarily disabling failing services.
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing) -> CLOSED
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private recentFailures: FailureInfo[] = [];
  
  private readonly options: CircuitBreakerOptions;
  
  constructor(
    private readonly name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringWindow: 300000, // 5 minutes
      minimumRequests: 10,
      successThreshold: 3,
      timeout: 30000, // 30 seconds
      ...options
    };
    
    console.log(`🛡️ CircuitBreaker "${name}" initialized:`, this.options);
  }

  /**
   * 🔧 EXECUTE OPERATION WITH CIRCUIT BREAKER
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        console.log(`🔄 CircuitBreaker "${this.name}": Attempting HALF_OPEN state`);
      } else {
        const error = new Error(`Circuit breaker "${this.name}" is OPEN. Next attempt: ${this.nextAttemptTime?.toISOString()}`);
        this.recordFailure(error, operationName, 0);
        throw error;
      }
    }

    const startTime = Date.now();
    this.requests++;

    try {
      // Execute with timeout
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise<T>(this.options.timeout)
      ]);

      const duration = Date.now() - startTime;
      this.recordSuccess(operationName, duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(error instanceof Error ? error : new Error(String(error)), operationName, duration);
      throw error;
    }
  }

  /**
   * ✅ RECORD SUCCESS
   */
  private recordSuccess(operationName: string, duration: number): void {
    this.successes++;
    this.lastSuccessTime = new Date();
    
    console.log(`✅ CircuitBreaker "${this.name}": Success (${operationName}) in ${duration}ms`);
    
    // If we're in HALF_OPEN and have enough successes, close the circuit
    if (this.state === 'HALF_OPEN' && this.successes >= this.options.successThreshold) {
      this.state = 'CLOSED';
      this.failures = 0;
      this.nextAttemptTime = null;
      console.log(`🔒 CircuitBreaker "${this.name}": CLOSED (recovered)`);
      
      systemMonitor.addAlert('info', 'CircuitBreaker', `Circuit "${this.name}" recovered`, 
        `State: CLOSED after ${this.successes} successes`);
    }
  }

  /**
   * ❌ RECORD FAILURE
   */
  private recordFailure(error: Error, operationName: string, duration: number): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    const failureInfo: FailureInfo = {
      error,
      timestamp: new Date(),
      operation: operationName,
      duration
    };
    
    this.recentFailures.push(failureInfo);
    this.pruneOldFailures();
    
    console.error(`❌ CircuitBreaker "${this.name}": Failure (${operationName}) in ${duration}ms:`, error.message);
    
    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.state = 'OPEN';
      this.nextAttemptTime = new Date(Date.now() + this.options.recoveryTimeout);
      
      console.error(`🚨 CircuitBreaker "${this.name}": OPENED due to ${this.failures} failures. Next attempt: ${this.nextAttemptTime.toISOString()}`);
      
      systemMonitor.addAlert('error', 'CircuitBreaker', `Circuit "${this.name}" opened`, 
        `Failure rate: ${this.getFailureRate()}% (${this.failures}/${this.requests} in window)`);
    }
  }

  /**
   * 🔍 CIRCUIT OPENING LOGIC
   */
  private shouldOpenCircuit(): boolean {
    // Don't open if we haven't reached minimum requests
    if (this.requests < this.options.minimumRequests) {
      return false;
    }
    
    // Open if we've exceeded the failure threshold
    if (this.failures >= this.options.failureThreshold) {
      return true;
    }
    
    // Open if failure rate is too high (additional safety check)
    const failureRate = this.getFailureRate();
    if (failureRate > 50) { // 50% failure rate
      return true;
    }
    
    return false;
  }

  /**
   * 🔄 RESET ATTEMPT LOGIC
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== null && Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * ⏰ CREATE TIMEOUT PROMISE
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * 🧹 PRUNE OLD FAILURES
   */
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.options.monitoringWindow;
    this.recentFailures = this.recentFailures.filter(
      failure => failure.timestamp.getTime() > cutoff
    );
  }

  /**
   * 📊 CALCULATE FAILURE RATE
   */
  private getFailureRate(): number {
    if (this.requests === 0) return 0;
    return Math.round((this.failures / this.requests) * 100);
  }

  /**
   * 📊 GET CIRCUIT BREAKER STATISTICS
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      failureRate: this.getFailureRate()
    };
  }

  /**
   * 🔧 GET RECENT FAILURES
   */
  getRecentFailures(limit: number = 10): FailureInfo[] {
    return this.recentFailures
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 🔄 MANUAL RESET
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.recentFailures = [];
    
    console.log(`🔄 CircuitBreaker "${this.name}": Manually reset`);
    systemMonitor.addAlert('info', 'CircuitBreaker', `Circuit "${this.name}" manually reset`, 'All counters cleared');
  }

  /**
   * 🎯 IS AVAILABLE
   */
  isAvailable(): boolean {
    return this.state === 'CLOSED' || 
           (this.state === 'OPEN' && this.shouldAttemptReset()) ||
           this.state === 'HALF_OPEN';
  }

  /**
   * 📊 GET HEALTH SCORE
   */
  getHealthScore(): number {
    if (this.state === 'OPEN') return 0;
    if (this.state === 'HALF_OPEN') return 50;
    
    const failureRate = this.getFailureRate();
    return Math.max(0, 100 - failureRate);
  }
}

/**
 * 🛡️ CIRCUIT BREAKER MANAGER
 * 
 * Manages multiple circuit breakers and provides system-wide resilience
 */
export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  
  /**
   * 🔧 GET OR CREATE CIRCUIT BREAKER
   */
  getCircuitBreaker(
    name: string, 
    options: Partial<CircuitBreakerOptions> = {}
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker(name, options);
      this.circuitBreakers.set(name, circuitBreaker);
      console.log(`🛡️ Created new CircuitBreaker: ${name}`);
    }
    
    return this.circuitBreakers.get(name)!;
  }

  /**
   * 🎯 EXECUTE WITH CIRCUIT BREAKER
   */
  async executeWithBreaker<T>(
    breakerName: string,
    operation: () => Promise<T>,
    operationName: string = 'operation',
    options: Partial<CircuitBreakerOptions> = {}
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(breakerName, options);
    return breaker.execute(operation, operationName);
  }

  /**
   * 📊 GET ALL CIRCUIT BREAKER STATS
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    this.circuitBreakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    
    return stats;
  }

  /**
   * 🩺 GET SYSTEM HEALTH
   */
  getSystemHealth(): {
    overallHealth: number;
    availableBreakers: number;
    totalBreakers: number;
    openBreakers: string[];
    degradedBreakers: string[];
  } {
    const stats = this.getAllStats();
    const breakerNames = Object.keys(stats);
    const totalBreakers = breakerNames.length;
    
    if (totalBreakers === 0) {
      return {
        overallHealth: 100,
        availableBreakers: 0,
        totalBreakers: 0,
        openBreakers: [],
        degradedBreakers: []
      };
    }
    
    const openBreakers: string[] = [];
    const degradedBreakers: string[] = [];
    let totalHealth = 0;
    let availableBreakers = 0;
    
    breakerNames.forEach(name => {
      const breaker = this.circuitBreakers.get(name)!;
      const health = breaker.getHealthScore();
      const state = breaker.getStats().state;
      
      totalHealth += health;
      
      if (breaker.isAvailable()) {
        availableBreakers++;
      }
      
      if (state === 'OPEN') {
        openBreakers.push(name);
      } else if (health < 80) {
        degradedBreakers.push(name);
      }
    });
    
    return {
      overallHealth: Math.round(totalHealth / totalBreakers),
      availableBreakers,
      totalBreakers,
      openBreakers,
      degradedBreakers
    };
  }

  /**
   * 🔄 RESET ALL CIRCUIT BREAKERS
   */
  resetAll(): void {
    this.circuitBreakers.forEach(breaker => breaker.reset());
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * 📊 GENERATE HEALTH REPORT
   */
  generateHealthReport(): string {
    const health = this.getSystemHealth();
    const stats = this.getAllStats();
    
    let report = `🛡️ CIRCUIT BREAKER HEALTH REPORT\n`;
    report += `Overall Health: ${health.overallHealth}%\n`;
    report += `Available: ${health.availableBreakers}/${health.totalBreakers}\n`;
    
    if (health.openBreakers.length > 0) {
      report += `🚨 OPEN CIRCUITS: ${health.openBreakers.join(', ')}\n`;
    }
    
    if (health.degradedBreakers.length > 0) {
      report += `⚠️ DEGRADED CIRCUITS: ${health.degradedBreakers.join(', ')}\n`;
    }
    
    report += `\nDETAILED STATUS:\n`;
    Object.entries(stats).forEach(([name, stat]) => {
      const breaker = this.circuitBreakers.get(name)!;
      report += `  ${name}: ${stat.state} (Health: ${breaker.getHealthScore()}%, Failures: ${stat.failures}/${stat.requests})\n`;
    });
    
    return report;
  }

  /**
   * 🎯 MONITORING INTEGRATION
   */
  startMonitoring(): void {
    setInterval(() => {
      const health = this.getSystemHealth();
      
      // Alert on open circuits
      if (health.openBreakers.length > 0) {
        systemMonitor.addAlert('error', 'CircuitBreakerManager', 
          'Open circuit breakers detected', 
          `${health.openBreakers.length} circuits open: ${health.openBreakers.join(', ')}`);
      }
      
      // Alert on degraded circuits
      if (health.degradedBreakers.length > 0) {
        systemMonitor.addAlert('warning', 'CircuitBreakerManager', 
          'Degraded circuit breakers detected', 
          `${health.degradedBreakers.length} circuits degraded: ${health.degradedBreakers.join(', ')}`);
      }
      
      // Overall health monitoring
      if (health.overallHealth < 70) {
        systemMonitor.addAlert('warning', 'CircuitBreakerManager', 
          'Low overall circuit health', 
          `System health: ${health.overallHealth}%`);
      }
      
    }, 2 * 60 * 1000); // Check every 2 minutes
    
    console.log('🛡️ CircuitBreakerManager: Monitoring started');
  }
}

// Export singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Pre-configured circuit breakers for common operations
export const circuitBreakers = {
  // AI/OpenAI operations
  openai: circuitBreakerManager.getCircuitBreaker('openai', {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    timeout: 45000, // 45 seconds
    minimumRequests: 5
  }),
  
  // Database operations
  database: circuitBreakerManager.getCircuitBreaker('database', {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    timeout: 10000, // 10 seconds
    minimumRequests: 10
  }),
  
  // Twitter API operations
  twitter: circuitBreakerManager.getCircuitBreaker('twitter', {
    failureThreshold: 3,
    recoveryTimeout: 120000, // 2 minutes
    timeout: 30000, // 30 seconds
    minimumRequests: 5
  }),
  
  // Content generation
  contentGeneration: circuitBreakerManager.getCircuitBreaker('contentGeneration', {
    failureThreshold: 4,
    recoveryTimeout: 90000, // 90 seconds
    timeout: 60000, // 60 seconds
    minimumRequests: 5
  }),
  
  // Learning system
  learning: circuitBreakerManager.getCircuitBreaker('learning', {
    failureThreshold: 5,
    recoveryTimeout: 300000, // 5 minutes
    timeout: 30000, // 30 seconds
    minimumRequests: 3
  })
}; 