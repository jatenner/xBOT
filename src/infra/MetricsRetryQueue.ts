/**
 * Retry queue for failed metrics upserts with exponential backoff
 */

export interface MetricsRetryJob {
  id: string;
  tweetId: string;
  metrics: any;
  attempt: number;
  nextRetryAt: Date;
  createdAt: Date;
  lastError?: string;
}

export class MetricsRetryQueue {
  private static instance: MetricsRetryQueue | null = null;
  private jobs: Map<string, MetricsRetryJob> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  static getInstance(): MetricsRetryQueue {
    if (!this.instance) {
      this.instance = new MetricsRetryQueue();
    }
    return this.instance;
  }

  /**
   * Schedule a metrics upsert retry with exponential backoff
   */
  public scheduleRetry(tweetId: string, metrics: any, error: string): void {
    const existingJob = this.jobs.get(tweetId);
    const attempt = existingJob ? existingJob.attempt + 1 : 1;
    
    // Exponential backoff: 2m, 10m, 30m, then stop
    const delays = [2 * 60 * 1000, 10 * 60 * 1000, 30 * 60 * 1000]; // ms
    
    if (attempt > delays.length) {
      console.warn(`⚠️ METRICS_RETRY_EXHAUSTED tweet_id=${tweetId} attempts=${attempt}`);
      this.jobs.delete(tweetId);
      return;
    }

    const delay = delays[attempt - 1];
    const nextRetryAt = new Date(Date.now() + delay);

    const job: MetricsRetryJob = {
      id: `${tweetId}_${attempt}`,
      tweetId,
      metrics,
      attempt,
      nextRetryAt,
      createdAt: existingJob?.createdAt || new Date(),
      lastError: error
    };

    this.jobs.set(tweetId, job);
    
    console.log(`📅 METRICS_RETRY_SCHEDULED tweet_id=${tweetId} attempt=${attempt} next_retry=${nextRetryAt.toISOString()}`);
    
    this.startProcessing();
  }

  /**
   * Start the retry processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processRetries().catch(error => {
        console.error('❌ METRICS_RETRY_PROCESSOR_ERROR:', error);
      });
    }, 60 * 1000); // Check every minute
    
    console.log('🔄 METRICS_RETRY_PROCESSOR started');
  }

  /**
   * Process ready retry jobs
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const readyJobs = Array.from(this.jobs.values())
      .filter(job => job.nextRetryAt <= now);

    if (readyJobs.length === 0) return;

    console.log(`🔄 METRICS_RETRY_PROCESSING ${readyJobs.length} jobs`);

    for (const job of readyJobs) {
      try {
        await this.retryJob(job);
        this.jobs.delete(job.tweetId); // Remove on success
      } catch (error: any) {
        console.warn(`⚠️ METRICS_RETRY_FAILED tweet_id=${job.tweetId} attempt=${job.attempt} error=${error.message}`);
        
        // Schedule next retry
        this.scheduleRetry(job.tweetId, job.metrics, error.message);
      }
    }
  }

  /**
   * Retry a specific job
   */
  private async retryJob(job: MetricsRetryJob): Promise<void> {
    console.log(`🔄 METRICS_RETRY_ATTEMPTING tweet_id=${job.tweetId} attempt=${job.attempt}`);
    
    // First ensure schema is up to date with standalone SchemaGuard
    try {
      const { ensureSchema } = await import('./db/SchemaGuard');
      await ensureSchema(); // triggers NOTIFY and re-probe
    } catch (error) {
      console.warn('⚠️ Schema check failed during retry, continuing anyway:', error);
    }

    // Now retry the metrics upsert
    const { upsertTweetMetrics, upsertLearningPost } = await import('../posting/metrics');
    
    if (job.metrics.tweet_id) {
      await upsertTweetMetrics(job.metrics);
      console.log(`✅ METRICS_UPSERT_OK tweet_id=${job.tweetId} retry_attempt=${job.attempt}`);
    }
    
    if (job.metrics.format) {
      await upsertLearningPost(job.metrics);
      console.log(`✅ LEARNING_UPSERT_OK tweet_id=${job.tweetId} retry_attempt=${job.attempt}`);
    }
  }

  /**
   * Get current queue depth for status monitoring
   */
  public getQueueDepth(): number {
    return this.jobs.size;
  }

  /**
   * Get queue status for debugging
   */
  public getQueueStatus(): { depth: number; nextRetryAt: Date | null; jobs: MetricsRetryJob[] } {
    const jobs = Array.from(this.jobs.values());
    const nextRetryAt = jobs.length > 0 
      ? jobs.reduce((earliest, job) => job.nextRetryAt < earliest ? job.nextRetryAt : earliest, jobs[0].nextRetryAt)
      : null;

    return {
      depth: jobs.length,
      nextRetryAt,
      jobs: jobs.slice(0, 5) // First 5 jobs for debugging
    };
  }

  /**
   * Stop the retry processor (for cleanup)
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('🛑 METRICS_RETRY_PROCESSOR stopped');
  }
}
