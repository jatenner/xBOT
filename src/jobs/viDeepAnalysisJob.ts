/**
 * 🧠 VI DEEP ANALYSIS JOB
 * 
 * Scheduled job to run deep semantic/visual analysis on high-performing tweets
 * Runs every 12 hours to analyze top performers with deep AI understanding
 */

import { VIDeepUnderstanding } from '../intelligence/viDeepUnderstanding';
import { log } from '../lib/logger';

export async function viDeepAnalysisJob(): Promise<void> {
  log({ op: 'vi_deep_job_start' });
  
  try {
    const deepAnalyzer = new VIDeepUnderstanding();
    
    // Process high-performing tweets (2%+ ER or 50K+ views)
    const analyzed = await deepAnalyzer.processHighPerformers();
    
    log({ 
      op: 'vi_deep_job_complete', 
      analyzed,
      message: `Analyzed ${analyzed} high-performing tweets with deep understanding`
    });
    
  } catch (error: any) {
    log({ op: 'vi_deep_job_error', error: error.message });
    throw error;
  }
}

