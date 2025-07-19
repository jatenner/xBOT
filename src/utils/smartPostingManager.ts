import { rateLimitHandler } from './enhancedRateLimitHandler';
import { systemMonitor } from './systemMonitor';

interface PostingJob {
  id: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  scheduledTime: Date;
  retryCount: number;
  maxRetries: number;
  metadata?: any;
}

export class SmartPostingManager {
  private postQueue: PostingJob[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.startQueueProcessor();
  }

  /**
   * Add a post to the smart queue
   */
  async queuePost(content: string, priority: 'high' | 'medium' | 'low' = 'medium', metadata?: any): Promise<string> {
    const schedule = await rateLimitHandler.getSmartSchedule();
    
    const job: PostingJob = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      priority,
      scheduledTime: schedule.nextPostTime,
      retryCount: 0,
      maxRetries: 3,
      metadata
    };

    // Insert into queue based on priority and time
    this.insertSorted(job);
    
    console.log(`📝 Queued post: ${job.id}`);
    console.log(`⏰ Scheduled for: ${job.scheduledTime.toLocaleString()}`);
    console.log(`🎯 Priority: ${job.priority}`);
    console.log(`📊 Queue size: ${this.postQueue.length}`);
    
    return job.id;
  }

  /**
   * Insert job into queue maintaining sort order
   */
  private insertSorted(job: PostingJob): void {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    
    let inserted = false;
    for (let i = 0; i < this.postQueue.length; i++) {
      const existing = this.postQueue[i];
      
      // Higher priority goes first
      if (priorityWeight[job.priority] > priorityWeight[existing.priority]) {
        this.postQueue.splice(i, 0, job);
        inserted = true;
        break;
      }
      
      // Same priority, earlier time goes first
      if (priorityWeight[job.priority] === priorityWeight[existing.priority] && 
          job.scheduledTime < existing.scheduledTime) {
        this.postQueue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.postQueue.push(job);
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Check queue every 2 minutes
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 120000);
    
    // Initial check
    setTimeout(() => this.processQueue(), 5000);
    
    console.log('🚀 Smart posting queue processor started');
  }

  /**
   * Process the posting queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.postQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const now = new Date();
      const nextJob = this.postQueue[0];
      
      if (!nextJob || nextJob.scheduledTime > now) {
        console.log(`⏳ Next post scheduled for: ${nextJob?.scheduledTime.toLocaleString() || 'none'}`);
        return;
      }

      // Check if we can post
      const shouldPost = await rateLimitHandler.shouldAttemptPost();
      
      if (!shouldPost.shouldPost) {
        console.log(`🛡️ Skipping post: ${shouldPost.reason}`);
        
        if (shouldPost.waitTime) {
          // Reschedule the job
          nextJob.scheduledTime = new Date(Date.now() + (shouldPost.waitTime * 1000));
          console.log(`📅 Rescheduled to: ${nextJob.scheduledTime.toLocaleString()}`);
        }
        return;
      }

      // Remove job from queue
      const job = this.postQueue.shift()!;
      
      console.log(`🚀 Attempting to post: ${job.id}`);
      console.log(`📝 Content: ${job.content.substring(0, 100)}...`);
      
      // Attempt to post
      const success = await this.attemptPost(job);
      
      if (!success && job.retryCount < job.maxRetries) {
        // Retry with exponential backoff
        job.retryCount++;
        job.scheduledTime = new Date(Date.now() + (Math.pow(2, job.retryCount) * 60000)); // 2^n minutes
        
        this.insertSorted(job);
        console.log(`🔄 Retry ${job.retryCount}/${job.maxRetries} scheduled for: ${job.scheduledTime.toLocaleString()}`);
      } else if (!success) {
        console.log(`❌ Post failed permanently: ${job.id}`);
        await this.logFailedPost(job);
      }
      
    } catch (error) {
      console.error('❌ Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

     /**
    * Attempt to post content
    */
   private async attemptPost(job: PostingJob): Promise<boolean> {
     try {
       console.log(`🚀 Simulating post attempt for job: ${job.id}`);
       console.log(`📝 Content: ${job.content.substring(0, 100)}...`);
       
       // For now, simulate posting success
       // In production, this would integrate with the actual posting system
       console.log(`✅ Post simulated successful: ${job.id}`);
       
       // Track metrics by adding alert
       systemMonitor.addAlert('info', 'SmartPosting', 'Post queued', `Queued: ${job.id}`);
       
       return true;
       
     } catch (error: any) {
       console.error(`❌ Error posting ${job.id}:`, error);
       
       // Handle rate limit specifically
       if (error.code === 429) {
         console.log('🛡️ Rate limit hit - enabling graceful mode');
         
         // Extract reset time from headers if available
         const resetTime = error.headers?.['x-app-limit-24hour-reset'] || 
                          Math.floor(Date.now() / 1000) + 86400; // 24 hours default
         
         await rateLimitHandler.enableGracefulMode(parseInt(resetTime));
       }
       
       return false;
     }
   }

  /**
   * Log failed post for analysis
   */
  private async logFailedPost(job: PostingJob): Promise<void> {
    try {
      // Could store in database for analysis
      console.log(`📊 Failed post logged: ${job.id}`);
      console.log(`📝 Content: ${job.content}`);
      console.log(`🔄 Retries: ${job.retryCount}/${job.maxRetries}`);
      
             systemMonitor.addAlert('error', 'SmartPosting', 'Post permanently failed', `Failed permanently: ${job.id}`);
      
    } catch (error) {
      console.error('❌ Error logging failed post:', error);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { 
    size: number; 
    nextPost?: Date; 
    processing: boolean;
    priorityBreakdown: Record<string, number>;
  } {
    const priorityBreakdown = this.postQueue.reduce((acc, job) => {
      acc[job.priority] = (acc[job.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      size: this.postQueue.length,
      nextPost: this.postQueue[0]?.scheduledTime,
      processing: this.isProcessing,
      priorityBreakdown
    };
  }

  /**
   * Clear the queue (emergency use)
   */
  clearQueue(): void {
    this.postQueue = [];
    console.log('🗑️ Post queue cleared');
  }

  /**
   * Get queue contents for debugging
   */
  getQueueContents(): PostingJob[] {
    return [...this.postQueue];
  }

  /**
   * Update scheduling based on current rate limits
   */
  async optimizeScheduling(): Promise<void> {
    if (this.postQueue.length === 0) return;
    
    console.log('🧠 Optimizing post scheduling...');
    
    const schedule = await rateLimitHandler.getSmartSchedule();
    let currentTime = schedule.nextPostTime;
    
    // Reschedule all posts with optimal spacing
    for (const job of this.postQueue) {
      job.scheduledTime = new Date(currentTime);
      currentTime = new Date(currentTime.getTime() + (2 * 60 * 60 * 1000)); // 2 hours spacing
    }
    
    // Re-sort queue
    this.postQueue.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      
      if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      
      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });
    
    console.log('✅ Scheduling optimized');
  }

  /**
   * Shutdown the manager
   */
  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    console.log('🛑 Smart posting manager shutdown');
  }
}

// Singleton instance
export const smartPostingManager = new SmartPostingManager(); 