/**
 * 🔄 DATABASE RETRY QUEUE JOB
 * Background job that retries failed database saves
 * Runs every 10 minutes to process pending retry queue entries
 */

import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';

const RETRY_QUEUE_FILE = join(process.cwd(), 'logs', 'db_retry_queue.jsonl');
const MAX_RETRY_ATTEMPTS = 10;
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

interface RetryQueueEntry {
  decisionId: string;
  tweetId: string;
  tweetUrl?: string;
  tweetIds?: string[];
  content: string;
  timestamp: number;
  date: string;
  retryCount: number;
}

export async function processDbRetryQueue(): Promise<void> {
  console.log('[DB_RETRY_QUEUE] 🔄 Starting database retry queue processing...');
  
  if (!existsSync(RETRY_QUEUE_FILE)) {
    console.log('[DB_RETRY_QUEUE] ✅ No retry queue file found - nothing to process');
    return;
  }
  
  try {
    // Read all entries from retry queue
    const fileContent = readFileSync(RETRY_QUEUE_FILE, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.log('[DB_RETRY_QUEUE] ✅ Retry queue is empty');
      return;
    }
    
    console.log(`[DB_RETRY_QUEUE] 📋 Found ${lines.length} entries in retry queue`);
    
    const supabase = getSupabaseClient();
    const successfulEntries: number[] = [];
    const failedEntries: RetryQueueEntry[] = [];
    
    // Process each entry
    for (let i = 0; i < lines.length; i++) {
      try {
        const entry: RetryQueueEntry = JSON.parse(lines[i]);
        
        // Skip if too many retries
        if (entry.retryCount >= MAX_RETRY_ATTEMPTS) {
          console.log(`[DB_RETRY_QUEUE] ⏭️ Skipping entry ${i + 1} (max retries exceeded: ${entry.retryCount})`);
          failedEntries.push(entry);
          continue;
        }
        
        console.log(`[DB_RETRY_QUEUE] 🔄 Processing entry ${i + 1}/${lines.length}: decision_id=${entry.decisionId}, tweet_id=${entry.tweetId}, retry_count=${entry.retryCount}`);
        
        // Try to save to database
        const success = await retryDatabaseSave(entry, supabase);
        
        if (success) {
          console.log(`[DB_RETRY_QUEUE] ✅ Successfully saved entry ${i + 1} to database`);
          successfulEntries.push(i);
        } else {
          // Increment retry count and keep in queue
          entry.retryCount++;
          failedEntries.push(entry);
          console.log(`[DB_RETRY_QUEUE] ⚠️ Entry ${i + 1} failed, will retry (attempt ${entry.retryCount}/${MAX_RETRY_ATTEMPTS})`);
        }
        
        // Small delay between entries to avoid overwhelming database
        if (i < lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      } catch (parseError: any) {
        console.error(`[DB_RETRY_QUEUE] ❌ Failed to parse entry ${i + 1}: ${parseError.message}`);
        // Skip malformed entries
      }
    }
    
    // Write back failed entries (with incremented retry counts)
    if (failedEntries.length > 0) {
      const remainingContent = failedEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      writeFileSync(RETRY_QUEUE_FILE, remainingContent, 'utf-8');
      console.log(`[DB_RETRY_QUEUE] 💾 Wrote ${failedEntries.length} entries back to queue for retry`);
    } else {
      // All entries succeeded - delete the queue file
      unlinkSync(RETRY_QUEUE_FILE);
      console.log(`[DB_RETRY_QUEUE] ✅ All entries processed successfully - queue file deleted`);
    }
    
    log({ 
      op: 'db_retry_queue_processed', 
      total: lines.length, 
      successful: successfulEntries.length, 
      failed: failedEntries.length 
    });
    
    console.log(`[DB_RETRY_QUEUE] ✅ Processing complete: ${successfulEntries.length} succeeded, ${failedEntries.length} failed`);
  } catch (error: any) {
    console.error(`[DB_RETRY_QUEUE] ❌ Failed to process retry queue: ${error.message}`);
    log({ op: 'db_retry_queue_error', error: error.message });
  }
}

async function retryDatabaseSave(entry: RetryQueueEntry, supabase: any): Promise<boolean> {
  try {
    // Strategy 1: Full update with all fields
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({
        status: 'posted',
        tweet_id: entry.tweetId,
        thread_tweet_ids: entry.tweetIds ? JSON.stringify(entry.tweetIds) : null,
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('decision_id', entry.decisionId);
    
    if (updateError) {
      throw updateError;
    }
    
    // Strategy 2: Also update posted_decisions archive
    try {
      const { data: decisionData } = await supabase
        .from('content_metadata')
        .select('*')
        .eq('decision_id', entry.decisionId)
        .single();
      
      if (decisionData) {
        await supabase
          .from('posted_decisions')
          .insert([{
            decision_id: decisionData.decision_id,
            content: decisionData.content,
            tweet_id: entry.tweetId,
            decision_type: decisionData.decision_type || 'single',
            target_tweet_id: decisionData.target_tweet_id,
            target_username: decisionData.target_username,
            bandit_arm: decisionData.bandit_arm,
            timing_arm: decisionData.timing_arm,
            predicted_er: Math.min(1.0, Math.max(0.0, Number(decisionData.predicted_er) || 0)),
            quality_score: Math.min(1.0, Math.max(0.0, Number(decisionData.quality_score) || 0)),
            topic_cluster: decisionData.topic_cluster,
            posted_at: new Date().toISOString()
          }]);
      }
    } catch (archiveError: any) {
      // Archive update is best-effort, don't fail the whole operation
      console.warn(`[DB_RETRY_QUEUE] ⚠️ Failed to update archive (non-critical): ${archiveError.message}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`[DB_RETRY_QUEUE] ❌ Database save failed: ${error.message}`);
    return false;
  }
}



