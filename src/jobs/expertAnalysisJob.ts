/**
 * 🎯 EXPERT ANALYSIS JOB
 * 
 * Scheduled job to analyze successful tweets with expert-level strategic analysis
 * Runs every 6 hours to process high-performing tweets
 * 
 * Uses GPT-4o as expert social media manager to provide strategic advice
 */

import { ExpertTweetAnalyzer } from '../intelligence/expertTweetAnalyzer';
import { recordJobSuccess, recordJobFailure } from './jobHeartbeat';
import { log } from '../lib/logger';

export async function expertAnalysisJob(): Promise<void> {
  const jobName = 'expert_analysis';
  log({ op: 'expert_analysis_job_start' });

  try {
    const analyzer = new ExpertTweetAnalyzer();

    // Get tweets needing analysis (successful tweets: 10K+ views OR 2%+ ER)
    const tweetsToAnalyze = await analyzer.getTweetsNeedingAnalysis({
      minViews: 10000,
      minEngagementRate: 0.02,
      limit: 20 // Process 20 per run to manage costs
    });

    if (tweetsToAnalyze.length === 0) {
      log({ op: 'expert_analysis_job_no_work', message: 'No tweets need analysis' });
      await recordJobSuccess(jobName);
      return;
    }

    log({ op: 'expert_analysis_job_processing', count: tweetsToAnalyze.length });

    let successCount = 0;
    let failureCount = 0;

    // Process each tweet
    for (const tweet of tweetsToAnalyze) {
      try {
        await analyzer.analyzeTweet(tweet);
        successCount++;
        log({ op: 'expert_analysis_job_tweet_success', tweet_id: tweet.tweet_id });
      } catch (error: any) {
        failureCount++;
        log({ 
          op: 'expert_analysis_job_tweet_error', 
          tweet_id: tweet.tweet_id, 
          error: error.message 
        });
        // Continue processing other tweets even if one fails
      }
    }

    log({ 
      op: 'expert_analysis_job_complete', 
      success: successCount, 
      failures: failureCount,
      total: tweetsToAnalyze.length
    });

    await recordJobSuccess(jobName);
  } catch (error: any) {
    log({ op: 'expert_analysis_job_error', error: error.message });
    await recordJobFailure(jobName, error.message);
    throw error;
  }
}


