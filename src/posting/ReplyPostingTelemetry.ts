import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';

type PostingStatus = 'success' | 'failure';

export class ReplyPostingTelemetry {
  private readonly startTs = Date.now();
  private readonly stepMarks: Record<string, number> = {};
  private readonly metrics: {
    durations: Record<string, number>;
    attempt: number;
    session_refreshes: number;
    composer_attempts: number;
    warning?: string;
  };

  constructor(
    private readonly decisionId: string | undefined,
    private readonly targetTweetId: string,
    private readonly attemptNumber: number
  ) {
    this.metrics = {
      durations: {},
      attempt: attemptNumber,
      session_refreshes: 0,
      composer_attempts: 0
    };
    this.mark('start');
  }

  public mark(step: string): void {
    this.stepMarks[step] = Date.now();
  }

  public setSessionRefreshes(count: number): void {
    this.metrics.session_refreshes = count;
  }

  public setComposerAttempts(count: number): void {
    this.metrics.composer_attempts = count;
  }

  public setWarning(message: string): void {
    this.metrics.warning = message;
  }

  private computeDurations(): void {
    const order = ['start', 'navigation_complete', 'composer_ready', 'post_clicked', 'id_extracted'];
    for (let i = 1; i < order.length; i++) {
      const prev = this.stepMarks[order[i - 1]];
      const curr = this.stepMarks[order[i]];
      if (prev && curr) {
        const key = `${order[i - 1]}→${order[i]}`;
        this.metrics.durations[key] = curr - prev;
      }
    }
    if (this.stepMarks.start) {
      this.metrics.durations.total = Date.now() - this.stepMarks.start;
    }
  }

  public async flush(status: PostingStatus, extra?: { tweetId?: string; error?: string }): Promise<void> {
    this.computeDurations();

    try {
      const supabase = getSupabaseClient();
      await supabase.from('posting_attempts').insert({
        job_type: 'reply',
        decision_id: this.decisionId ?? null,
        target_tweet_id: this.targetTweetId,
        tweet_id: extra?.tweetId ?? null,
        status,
        error_message: extra?.error?.slice(0, 500) ?? null,
        metrics: this.metrics
      });
    } catch (error: any) {
      log({ op: 'reply_posting_telemetry_write_failed', error: error.message || error });
    }
  }
}

