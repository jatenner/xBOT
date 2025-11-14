#!/usr/bin/env tsx
/**
 * 🚀 CLI JOB RUNNER WITH FALLBACK
 * 
 * Usage: tsx bin/run-job.ts <job-type>
 * Where job-type: plan | posting | reply | learn | outcomes
 * 
 * Strategy:
 * 1. Try API call to /admin/jobs/run if ADMIN_TOKEN is set
 * 2. On auth failure or missing token, fallback to direct function invocation
 * 3. Exit non-zero on failure for CI/CD integration
 */

import { exit } from 'process';

type JobType = 'plan' | 'posting' | 'reply' | 'learn' | 'outcomes' | 'reply-health';

const jobType = process.argv[2] as JobType;

if (!jobType || !['plan', 'posting', 'reply', 'learn', 'outcomes', 'reply-health'].includes(jobType)) {
  console.error('❌ Usage: tsx bin/run-job.ts <plan|posting|reply|learn|outcomes|reply-health>');
  exit(1);
}

async function runViaAPI(job: JobType): Promise<boolean> {
  const adminToken = process.env.ADMIN_TOKEN;
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL || 'http://localhost:3000';
  
  if (!adminToken) {
    console.log('[RUN_JOB] ℹ️ No ADMIN_TOKEN found, skipping API call');
    return false;
  }
  
  try {
    console.log(`[RUN_JOB] 🌐 Attempting API call to ${railwayUrl}/admin/jobs/run?name=${job}`);
    
    const response = await fetch(`${railwayUrl}/admin/jobs/run?name=${job}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.warn(`[RUN_JOB] ⚠️ API returned ${response.status}: ${data.error || data.message || 'Unknown error'}`);
      return false;
    }
    
    console.log(`[RUN_JOB] ✅ API call successful:`, data);
    return true;
  } catch (error: any) {
    console.warn(`[RUN_JOB] ⚠️ API call failed: ${error.message}`);
    return false;
  }
}

async function runDirectly(job: JobType): Promise<void> {
  console.log(`[RUN_JOB] 🔧 Fallback: Running ${job} job directly`);
  
  try {
    switch (job) {
      case 'plan': {
        const { planContent } = await import('../src/jobs/planJob');
        await planContent();
        console.log('[PLAN_JOB] ✅ Direct execution completed');
        break;
      }
      
      case 'posting': {
        const { processPostingQueue } = await import('../src/posting/orchestrator');
        await processPostingQueue();
        console.log('[POSTING_ORCHESTRATOR] ✅ Direct execution completed');
        break;
      }
      
      case 'reply': {
        const { generateReplies } = await import('../src/jobs/replyJob');
        await generateReplies();
        console.log('[REPLY_JOB] ✅ Direct execution completed');
        break;
      }
      
      case 'learn': {
        const { runLearningCycle } = await import('../src/jobs/learnJob');
        const stats = await runLearningCycle();
        console.log('[LEARN_JOB] ✅ Direct execution completed', stats);
        break;
      }
      
      case 'outcomes': {
        const { collectRealOutcomes } = await import('../src/jobs/outcomeIngestJob');
        await collectRealOutcomes();
        console.log('[OUTCOME_INGEST] ✅ Direct execution completed');
        break;
      }

      case 'reply-health': {
        const { runReplyHealthMonitor } = await import('../src/jobs/replyHealthMonitor');
        await runReplyHealthMonitor();
        console.log('[REPLY_HEALTH] ✅ Direct execution completed');
        break;
      }
      
      default:
        throw new Error(`Unknown job type: ${job}`);
    }
  } catch (error: any) {
    console.error(`[RUN_JOB] ❌ Direct execution failed: ${error.message}`);
    console.error(error.stack);
    exit(1);
  }
}

async function main() {
  console.log(`[RUN_JOB] 🚀 Starting job: ${jobType}`);
  
  // Try API first
  const apiSuccess = await runViaAPI(jobType);
  
  if (apiSuccess) {
    console.log(`[RUN_JOB] ✅ Job ${jobType} completed via API`);
    exit(0);
  }
  
  // Fallback to direct execution
  console.log(`[RUN_JOB] 🔄 Falling back to direct execution...`);
  await runDirectly(jobType);
  
  console.log(`[RUN_JOB] ✅ Job ${jobType} completed via direct execution`);
  exit(0);
}

main().catch((error) => {
  console.error('[RUN_JOB] ❌ Fatal error:', error.message);
  console.error(error.stack);
  exit(1);
});
