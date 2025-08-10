/**
 * 🚀 MEMORY-EFFICIENT AUTONOMOUS CONTROLLER
 * 
 * Lightweight replacement for masterAutonomousController.ts (2506 lines)
 * Uses lazy loading, memory limits, and efficient resource management
 * Target: <50MB memory usage vs unlimited before
 */

import { AutonomousPostingEngine } from './autonomousPostingEngine';
import { memoryEfficientLearning } from '../intelligence/memoryEfficientLearningCoordinator';

interface ControllerStats {
  memory_usage_mb: number;
  uptime_hours: number;
  posts_successful: number;
  posts_failed: number;
  last_post_time?: string;
}

export class MemoryEfficientController {
  private static instance: MemoryEfficientController;
  private isRunning = false;
  private startTime: Date | null = null;
  private stats: ControllerStats = {
    memory_usage_mb: 0,
    uptime_hours: 0,
    posts_successful: 0,
    posts_failed: 0
  };

  // Memory budget: 50MB maximum for this controller
  private readonly MEMORY_BUDGET = 50 * 1024 * 1024; // 50MB
  
  // Lazy-loaded systems (only when needed)
  private postingEngine?: AutonomousPostingEngine;
  private memoryMonitorInterval?: NodeJS.Timeout;

  static getInstance(): MemoryEfficientController {
    if (!this.instance) {
      this.instance = new MemoryEfficientController();
    }
    return this.instance;
  }

  /**
   * 🚀 Start the autonomous system (memory-efficient)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Controller already running');
      return;
    }

    console.log('🚀 Starting Memory-Efficient Autonomous Controller...');
    this.startTime = new Date();
    this.isRunning = true;

    // Start memory monitoring first
    this.startMemoryMonitoring();

    // Lazy load posting engine only when needed
    await this.initializePostingEngine();

    // Start posting schedule (every 30 minutes for memory efficiency)
    this.schedulePosting();

    console.log('✅ Memory-Efficient Controller started successfully');
  }

  /**
   * 📊 Initialize posting engine with memory limits
   */
  private async initializePostingEngine(): Promise<void> {
    try {
      console.log('🔧 Initializing posting engine with memory constraints...');
      
      // Check memory before loading
      this.checkMemoryBudget();
      
      this.postingEngine = new AutonomousPostingEngine();
      
      console.log('✅ Posting engine initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize posting engine:', error.message);
    }
  }

  /**
   * 📝 Execute posting with memory management
   */
  private async executePost(): Promise<void> {
    try {
      console.log('📝 Executing autonomous post...');
      
      // Memory check before posting
      this.checkMemoryBudget();
      
      if (!this.postingEngine) {
        await this.initializePostingEngine();
      }

      // Generate content using memory-efficient learning
      const topic = this.selectRandomTopic();
      const content = await memoryEfficientLearning.generateOptimizedContent(topic);
      
      // Post content
      const result = await this.postingEngine!.post(content);
      
      // Update stats
      if (result.success) {
        this.stats.posts_successful++;
        this.stats.last_post_time = new Date().toISOString();
        console.log('✅ Post successful');
      } else {
        this.stats.posts_failed++;
        console.error('❌ Post failed:', result.error);
      }

      // Learn from the post (memory-efficient)
      if (result.success) {
        await memoryEfficientLearning.learnFromPost(content, { likes: 0 });
      }

      // Cleanup after posting
      this.cleanup();
      
    } catch (error: any) {
      console.error('❌ Post execution error:', error.message);
      this.stats.posts_failed++;
    }
  }

  /**
   * ⏰ Schedule posting (memory-efficient intervals)
   */
  private schedulePosting(): void {
    // Post every 30 minutes (memory-efficient)
    const postInterval = setInterval(() => {
      this.executePost();
    }, 30 * 60 * 1000); // 30 minutes

    // Initial post
    setTimeout(() => this.executePost(), 5000); // 5 seconds after start
  }

  /**
   * 📊 Memory monitoring and management
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const usageMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      this.stats.memory_usage_mb = usageMB;
      this.stats.uptime_hours = this.startTime ? 
        (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60) : 0;

      // Log memory usage
      console.log(`📊 Memory: ${usageMB}MB | Uptime: ${this.stats.uptime_hours.toFixed(1)}h`);
      
      // Memory cleanup if getting high
      if (usageMB > 300) { // 300MB warning threshold
        console.warn(`⚠️ High memory usage: ${usageMB}MB - initiating cleanup`);
        this.cleanup();
      }
      
    }, 60000); // Check every minute
  }

  /**
   * 🧹 Memory cleanup and garbage collection
   */
  private cleanup(): void {
    console.log('🧹 Performing memory cleanup...');
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Clear any temporary data
    // (In a full implementation, this would clear caches, close connections, etc.)
    
    const usage = process.memoryUsage();
    const usageMB = Math.round(usage.heapUsed / 1024 / 1024);
    console.log(`✅ Cleanup complete. Memory: ${usageMB}MB`);
  }

  /**
   * 🔍 Check memory budget compliance
   */
  private checkMemoryBudget(): void {
    const usage = process.memoryUsage();
    if (usage.heapUsed > this.MEMORY_BUDGET) {
      const usageMB = Math.round(usage.heapUsed / 1024 / 1024);
      const budgetMB = Math.round(this.MEMORY_BUDGET / 1024 / 1024);
      console.warn(`⚠️ Memory budget exceeded: ${usageMB}MB > ${budgetMB}MB`);
      
      // Force cleanup
      this.cleanup();
    }
  }

  /**
   * 🎯 Select random health topic
   */
  private selectRandomTopic(): string {
    const topics = [
      'hydration',
      'sleep quality',
      'stress management',
      'nutrition',
      'exercise',
      'mental health',
      'vitamin D',
      'meditation',
      'healthy habits',
      'immune system'
    ];
    
    return topics[Math.floor(Math.random() * topics.length)];
  }

  /**
   * 📊 Get controller statistics
   */
  getStats(): ControllerStats {
    return { ...this.stats };
  }

  /**
   * 🛑 Stop the controller
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Controller not running');
      return;
    }

    console.log('🛑 Stopping Memory-Efficient Controller...');
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    // Shutdown learning system
    await memoryEfficientLearning.shutdown();
    
    // Final cleanup
    this.cleanup();
    
    console.log('✅ Controller stopped successfully');
  }
}

// Export singleton instance
export const memoryEfficientController = MemoryEfficientController.getInstance();