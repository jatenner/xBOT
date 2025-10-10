/**
 * 🚦 RAILWAY RESOURCE PROTECTOR
 * Prevents resource exhaustion by controlling posting rate
 */

interface ResourceLimits {
  maxConcurrentPosts: number;
  minPostInterval: number;  // milliseconds between posts
  maxMemoryMB: number;
  maxCpuPercent: number;
}

export class RailwayResourceProtector {
  private static instance: RailwayResourceProtector;
  private activePosts = 0;
  private lastPostTime = 0;
  private postQueue: Array<{ content: string; resolve: Function; reject: Function }> = [];
  
  private limits: ResourceLimits = {
    maxConcurrentPosts: 1,      // Only 1 post at a time
    minPostInterval: 5000,      // 5 seconds between posts
    maxMemoryMB: 500,           // 500MB memory limit
    maxCpuPercent: 80           // 80% CPU limit
  };

  static getInstance(): RailwayResourceProtector {
    if (!RailwayResourceProtector.instance) {
      RailwayResourceProtector.instance = new RailwayResourceProtector();
    }
    return RailwayResourceProtector.instance;
  }

  /**
   * 🛡️ PROTECTED POSTING - Prevents Railway Overload
   */
  async protectedPost(content: string, postFunction: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.postQueue.push({ content, resolve, reject });
      
      // Process queue
      this.processQueue();
    });
  }

  /**
   * ⚡ Process Queue with Resource Protection
   */
  private async processQueue(): Promise<void> {
    // Check if we can process
    if (this.postQueue.length === 0 || this.activePosts >= this.limits.maxConcurrentPosts) {
      return;
    }

    // Check resource limits
    const resourceCheck = await this.checkResourceLimits();
    if (!resourceCheck.canPost) {
      console.log(`🚦 RESOURCE_LIMIT: ${resourceCheck.reason} - waiting...`);
      setTimeout(() => this.processQueue(), 2000);
      return;
    }

    // Check time interval
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    if (timeSinceLastPost < this.limits.minPostInterval) {
      const waitTime = this.limits.minPostInterval - timeSinceLastPost;
      console.log(`⏱️ RATE_LIMIT: Waiting ${waitTime}ms before next post`);
      setTimeout(() => this.processQueue(), waitTime);
      return;
    }

    // Process next post
    const nextPost = this.postQueue.shift();
    if (nextPost) {
      this.activePosts++;
      this.lastPostTime = now;
      
      try {
        console.log(`🚀 PROTECTED_POST: Processing (queue: ${this.postQueue.length}, active: ${this.activePosts})`);
        
        // Import and use lightweight poster
        const { LightweightPoster } = await import('../posting/lightweightPoster');
        const poster = LightweightPoster.getInstance();
        const result = await poster.postContent(nextPost.content);
        
        console.log(`✅ PROTECTED_SUCCESS: Memory used: ${result.resourcesUsed.memoryMB}MB, Duration: ${result.resourcesUsed.durationMs}ms`);
        nextPost.resolve(result);
        
      } catch (error) {
        console.error('❌ PROTECTED_ERROR:', error);
        nextPost.reject(error);
      } finally {
        this.activePosts--;
        
        // Process next in queue after small delay
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * 📊 Check System Resource Limits
   */
  private async checkResourceLimits(): Promise<{ canPost: boolean; reason?: string }> {
    try {
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memoryMB = memUsage.heapUsed / 1024 / 1024;
      
      if (memoryMB > this.limits.maxMemoryMB) {
        return { 
          canPost: false, 
          reason: `Memory usage ${Math.round(memoryMB)}MB exceeds limit ${this.limits.maxMemoryMB}MB` 
        };
      }

      // Check if Railway is under stress (simple heuristic)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      
      if (cpuPercent > this.limits.maxCpuPercent) {
        return { 
          canPost: false, 
          reason: `CPU usage ${Math.round(cpuPercent)}% exceeds limit ${this.limits.maxCpuPercent}%` 
        };
      }

      return { canPost: true };
      
    } catch (error) {
      console.warn('⚠️ Resource check error:', error);
      return { canPost: true }; // Default to allow if check fails
    }
  }

  /**
   * 📈 Get Current Stats
   */
  getStats(): {
    queueLength: number;
    activePosts: number;
    memoryMB: number;
    lastPostTime: Date | null;
  } {
    const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    
    return {
      queueLength: this.postQueue.length,
      activePosts: this.activePosts,
      memoryMB: Math.round(memoryMB),
      lastPostTime: this.lastPostTime ? new Date(this.lastPostTime) : null
    };
  }

  /**
   * 🔧 Update Resource Limits (for tuning)
   */
  updateLimits(newLimits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
    console.log('🔧 LIMITS_UPDATED:', this.limits);
  }
}
