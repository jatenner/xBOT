/**
 * Brain Classification Jobs
 *
 * Thin wrappers around classification engine stages for job scheduling.
 * Each function is designed to be called by jobManager.safeExecute().
 */

import { runStage2Classification, runStage3Rescrape, runStage4DeepAnalysis } from './classificationEngine';

const LOG_PREFIX = '[brain/classify-jobs]';

/**
 * Stage 2: AI batch classification
 * Classifies tweets with likes >= 10 or viral_multiplier >= 2
 * Uses gpt-4o-mini, batches of 5, max 50 per run
 * Run every 15 minutes
 */
export async function brainClassifyStage2Job(): Promise<void> {
  const result = await runStage2Classification();

  if (result.classified > 0 || result.errors > 0) {
    console.log(`${LOG_PREFIX} Stage 2 complete: ${result.classified} classified, ${result.errors} errors`);
  }
}

/**
 * Stage 3: Time-series re-scraping
 * Re-scrapes tweets < 48h old with likes >= 20 to track engagement trajectory
 * Run every 30 minutes
 */
export async function brainRescrapeStage3Job(): Promise<void> {
  const result = await runStage3Rescrape();

  if (result.rescraped > 0 || result.errors > 0) {
    console.log(`${LOG_PREFIX} Stage 3 complete: ${result.rescraped} rescraped, ${result.errors} errors`);
  }
}

/**
 * Stage 4: Deep viral analysis
 * Scrapes reply trees and identifies amplifier accounts for viral tweets
 * Run every 60 minutes
 */
export async function brainDeepStage4Job(): Promise<void> {
  const result = await runStage4DeepAnalysis();

  if (result.analyzed > 0 || result.errors > 0) {
    console.log(`${LOG_PREFIX} Stage 4 complete: ${result.analyzed} analyzed, ${result.errors} errors`);
  }
}
