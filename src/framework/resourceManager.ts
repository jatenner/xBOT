/**
 * 📊 RESOURCE MANAGER FRAMEWORK
 * 
 * Tracks and manages system resources (CPU, memory, connections, etc.)
 * to prevent resource exhaustion and enable intelligent throttling.
 */

export interface ResourceBudget {
  name: string;
  max: number;
  current: number;
  reserved: number;
  timeout: number; // milliseconds
}

export interface ResourceRequest {
  id: string;
  resource: string;
  amount: number;
  priority: number;
  timeout: number;
  timestamp: Date;
}

export class ResourceManager {
  private static instance: ResourceManager;
  private budgets: Map<string, ResourceBudget> = new Map();
  private activeRequests: Map<string, ResourceRequest> = new Map();
  private requestQueue: ResourceRequest[] = [];
  
  private constructor() {
    // Initialize default budgets
    this.registerBudget('browser_contexts', {
      name: 'Browser Contexts',
      max: 3,
      current: 0,
      reserved: 0,
      timeout: 60000
    });
    
    this.registerBudget('database_connections', {
      name: 'Database Connections',
      max: 10,
      current: 0,
      reserved: 0,
      timeout: 30000
    });
    
    this.registerBudget('redis_connections', {
      name: 'Redis Connections',
      max: 5,
      current: 0,
      reserved: 0,
      timeout: 30000
    });
    
    this.registerBudget('openai_api_calls', {
      name: 'OpenAI API Calls',
      max: 100, // per minute
      current: 0,
      reserved: 0,
      timeout: 60000
    });
    
    console.log('[RESOURCE_MANAGER] Initialized with default budgets');
  }
  
  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }
  
  /**
   * Register a resource budget
   */
  registerBudget(resource: string, budget: ResourceBudget): void {
    this.budgets.set(resource, { ...budget });
    console.log(`[RESOURCE_MANAGER] Registered budget: ${budget.name} (max: ${budget.max})`);
  }
  
  /**
   * Request resources (returns true if available, false if denied)
   */
  async requestResource(
    resource: string,
    amount: number = 1,
    priority: number = 5,
    timeout: number = 30000
  ): Promise<boolean> {
    const budget = this.budgets.get(resource);
    if (!budget) {
      console.warn(`[RESOURCE_MANAGER] Unknown resource: ${resource}`);
      return false;
    }
    
    const requestId = `${resource}_${Date.now()}_${Math.random()}`;
    const request: ResourceRequest = {
      id: requestId,
      resource,
      amount,
      priority,
      timeout,
      timestamp: new Date()
    };
    
    // Check if resources are available
    const available = budget.max - budget.current - budget.reserved;
    
    if (available >= amount) {
      // Resources available - grant immediately
      budget.current += amount;
      this.activeRequests.set(requestId, request);
      console.log(`[RESOURCE_MANAGER] ✅ Granted ${amount} ${resource} (available: ${available - amount})`);
      return true;
    }
    
    // Resources not available - queue request
    this.requestQueue.push(request);
    this.requestQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    console.log(`[RESOURCE_MANAGER] ⏳ Queued request for ${amount} ${resource} (priority: ${priority})`);
    
    // Wait for resources with timeout
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const availableNow = budget.max - budget.current - budget.reserved;
      
      if (availableNow >= amount) {
        // Check if this request is next in queue (by priority)
        const nextRequest = this.requestQueue[0];
        if (nextRequest && nextRequest.id === requestId) {
          budget.current += amount;
          this.activeRequests.set(requestId, request);
          this.requestQueue = this.requestQueue.filter(r => r.id !== requestId);
          console.log(`[RESOURCE_MANAGER] ✅ Granted ${amount} ${resource} after queuing`);
          return true;
        }
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Timeout - remove from queue
    this.requestQueue = this.requestQueue.filter(r => r.id !== requestId);
    console.warn(`[RESOURCE_MANAGER] ⏱️ Request timeout for ${amount} ${resource}`);
    return false;
  }
  
  /**
   * Release resources
   */
  releaseResource(resource: string, amount: number = 1, requestId?: string): void {
    const budget = this.budgets.get(resource);
    if (!budget) {
      console.warn(`[RESOURCE_MANAGER] Unknown resource: ${resource}`);
      return;
    }
    
    if (requestId) {
      this.activeRequests.delete(requestId);
    }
    
    budget.current = Math.max(0, budget.current - amount);
    
    // Process queued requests
    this.processQueue(resource);
    
    console.log(`[RESOURCE_MANAGER] 🔓 Released ${amount} ${resource} (available: ${budget.max - budget.current - budget.reserved})`);
  }
  
  /**
   * Process queued requests for a resource
   */
  private processQueue(resource: string): void {
    const budget = this.budgets.get(resource);
    if (!budget) return;
    
    const available = budget.max - budget.current - budget.reserved;
    
    // Process requests in priority order
    const resourceRequests = this.requestQueue.filter(r => r.resource === resource);
    
    for (const request of resourceRequests) {
      if (available >= request.amount) {
        budget.current += request.amount;
        this.activeRequests.set(request.id, request);
        this.requestQueue = this.requestQueue.filter(r => r.id !== request.id);
        console.log(`[RESOURCE_MANAGER] ✅ Processed queued request: ${request.amount} ${resource}`);
      } else {
        break; // Can't fulfill more requests
      }
    }
  }
  
  /**
   * Reserve resources (for critical operations)
   */
  reserveResource(resource: string, amount: number): boolean {
    const budget = this.budgets.get(resource);
    if (!budget) {
      return false;
    }
    
    const available = budget.max - budget.current - budget.reserved;
    
    if (available >= amount) {
      budget.reserved += amount;
      console.log(`[RESOURCE_MANAGER] 🔒 Reserved ${amount} ${resource}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Release reserved resources
   */
  releaseReserved(resource: string, amount: number): void {
    const budget = this.budgets.get(resource);
    if (!budget) {
      return;
    }
    
    budget.reserved = Math.max(0, budget.reserved - amount);
    console.log(`[RESOURCE_MANAGER] 🔓 Released reserved ${amount} ${resource}`);
  }
  
  /**
   * Get resource status
   */
  getResourceStatus(resource: string): ResourceBudget | null {
    return this.budgets.get(resource) || null;
  }
  
  /**
   * Get all resource statuses
   */
  getAllResourceStatuses(): Map<string, ResourceBudget> {
    return new Map(this.budgets);
  }
  
  /**
   * Get health metrics
   */
  getHealthMetrics(): {
    totalResources: number;
    utilization: Record<string, number>;
    queuedRequests: number;
  } {
    const utilization: Record<string, number> = {};
    
    for (const [resource, budget] of this.budgets.entries()) {
      utilization[resource] = (budget.current + budget.reserved) / budget.max;
    }
    
    return {
      totalResources: this.budgets.size,
      utilization,
      queuedRequests: this.requestQueue.length
    };
  }
}

// Export singleton
export const resourceManager = ResourceManager.getInstance();



