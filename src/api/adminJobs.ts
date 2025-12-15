/**
 * 🔧 ADMIN JOBS ENDPOINT
 * Allows manual triggering of specific jobs with authentication
 */

import { Request, Response } from 'express';

interface JobRunRequest {
  name: string;
  params?: Record<string, any>;
}

export async function runJob(req: Request, res: Response): Promise<void> {
  try {
    // Check admin token authentication
    const adminToken = process.env.ADMIN_TOKEN;
    const providedToken = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!adminToken || !providedToken || providedToken !== adminToken) {
      res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
      return;
    }
    
    const jobName = req.query.name as string;
    const params = req.body || {};
    
    if (!jobName) {
      res.status(400).json({ error: 'Missing required parameter: name' });
      return;
    }
    
    console.log(`[ADMIN_JOBS] 🔧 Manual job trigger: ${jobName}`);
    
    const result = await executeJob(jobName, params);
    
    res.json({
      success: true,
      job: jobName,
      executedAt: new Date().toISOString(),
      result
    });
    
  } catch (error: any) {
    console.error(`[ADMIN_JOBS] ❌ Job execution failed:`, error.message);
    res.status(500).json({ 
      error: 'Job execution failed',
      details: error.message 
    });
  }
}

async function executeJob(jobName: string, params: Record<string, any>): Promise<any> {
  switch (jobName) {
    case 'analyticsCollector':
      const { collectRealOutcomes } = await import('../jobs/analyticsCollectorJob');
      await collectRealOutcomes();
      return { message: 'Analytics collection completed' };
      
    case 'learn':
      const { runLearningCycle } = await import('../jobs/learnJob');
      const stats = await runLearningCycle();
      return { message: 'Learning cycle completed', stats };
      
    case 'plan':
      const { planContent } = await import('../jobs/planJob');
      await planContent();
      return { message: 'Content planning completed' };
      
    case 'reply':
      const { generateReplies } = await import('../jobs/replyJob');
      await generateReplies();
      return { message: 'Reply generation completed' };
      
    case 'posting':
      const { processPostingQueue } = await import('../posting/orchestrator');
      await processPostingQueue();
      return { message: 'Posting queue processed' };
      
    case 'metrics':
    case 'metricsScraper':
      const { metricsScraperJob } = await import('../jobs/metricsScraperJob');
      await metricsScraperJob();
      return { message: 'Metrics scraping completed' };
      
    case 'weights':
    case 'offlineWeightMap':
      const { offlineWeightMapJob } = await import('../jobs/offlineWeightMapJob');
      await offlineWeightMapJob();
      return { message: 'Weight map generation completed' };
      
    case 'replyLearning':
    case 'replyPriorityLearning':
      const { replyLearningJob } = await import('../jobs/replyLearningJob');
      await replyLearningJob();
      return { message: 'Reply learning completed' };
      
    case 'backfillEmbeddings':
      const count = parseInt(params.count) || 100;
      const result = await backfillEmbeddings(count);
      return { message: `Backfilled embeddings for ${result.processed} items`, ...result };
      
    case 'harvester':
    case 'mega_viral_harvester':
      const { replyOpportunityHarvester } = await import('../jobs/replyOpportunityHarvester');
      await replyOpportunityHarvester();
      return { message: 'Viral tweet harvesting completed' };
      
    default:
      throw new Error(`Unknown job: ${jobName}. Available jobs: analyticsCollector, learn, plan, reply, posting, metrics, weights, replyLearning, backfillEmbeddings, harvester`);
  }
}

async function backfillEmbeddings(count: number): Promise<{processed: number, updated: number, errors: number}> {
  console.log(`[ADMIN_JOBS] 🔍 Backfilling embeddings for up to ${count} items...`);
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Get content without embeddings
    const { data: contentItems, error } = await supabase
      .from('content_metadata')
      .select('id, text')
      .is('embedding', null)
      .limit(count);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!contentItems || contentItems.length === 0) {
      return { processed: 0, updated: 0, errors: 0 };
    }
    
    let updated = 0;
    let errors = 0;
    
    // Process each item
    for (const item of contentItems) {
      try {
        // Generate embedding
        const { getEmbedding } = await import('../llm/embeddingService');
        const textValue = String(item.text ?? '');
        const embedding = await getEmbedding(textValue);
        
        // Calculate content hash
        const crypto = await import('crypto');
        const hashInput = typeof item.text === 'string' ? item.text : JSON.stringify(item.text);
        const contentHash = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex').substring(0, 16);
        
        // Update database
        const { error: updateError } = await supabase
          .from('content_metadata')
          .update({ 
            embedding,
            content_hash: contentHash,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        if (updateError) {
          console.error(`[ADMIN_JOBS] ❌ Failed to update embedding for ${item.id}:`, updateError.message);
          errors++;
        } else {
          updated++;
          console.log(`[ADMIN_JOBS] ✅ Updated embedding for content ${item.id}`);
        }
        
        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`[ADMIN_JOBS] ❌ Failed to process item ${item.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`[ADMIN_JOBS] 📊 Backfill complete: ${updated} updated, ${errors} errors`);
    
    return {
      processed: contentItems.length,
      updated,
      errors
    };
    
  } catch (error: any) {
    console.error(`[ADMIN_JOBS] ❌ Backfill embeddings failed:`, error.message);
    throw error;
  }
}

export function listAvailableJobs(req: Request, res: Response): void {
  const jobs = [
    { name: 'analyticsCollector', description: 'Collect real engagement metrics from posted tweets' },
    { name: 'learn', description: 'Run full learning cycle (bandits + predictors)' },
    { name: 'plan', description: 'Generate new content for posting queue' },
    { name: 'reply', description: 'Generate strategic replies to target accounts' },
    { name: 'posting', description: 'Process posting queue and publish to X' },
    { name: 'backfillEmbeddings', description: 'Generate embeddings for content missing them (params: count)' }
  ];
  
  res.json({
    available_jobs: jobs,
    usage: 'POST /admin/jobs/run?name={jobName} with Admin-Token header or ?token=... query param'
  });
}

// Exports for server.ts
export function requireAdminAuth(req: Request, res: Response, next: any): void {
  const adminToken = process.env.ADMIN_TOKEN;
  const providedToken = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!adminToken || !providedToken || providedToken !== adminToken) {
    res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    return;
  }
  
  next();
}

export const adminJobsHandler = listAvailableJobs;
export const adminJobRunHandler = runJob;