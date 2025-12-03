/**
 * 🔄 ID RECOVERY QUEUE JOB
 * 
 * Processes file backups to recover missing tweet IDs
 * Runs every 5 minutes to ensure rapid recovery
 * 
 * Flow:
 * 1. Read tweet_id_backups.jsonl file
 * 2. Find entries that haven't been verified
 * 3. Match to posts with NULL tweet_id
 * 4. Update database with recovered IDs
 * 5. Mark backups as verified
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseClient } from '../db';
import { recordJobStart, recordJobSuccess, recordJobFailure } from './jobHeartbeat';

interface TweetIdBackup {
  decision_id?: string; // From tweet_id_backup.jsonl
  tweet_id?: string; // From tweet_id_backup.jsonl
  tweetId?: string; // From tweet_id_backups.jsonl (legacy)
  source?: string; // From tweet_id_backups.jsonl (legacy)
  content?: string | null;
  content_preview?: string; // From tweet_id_backup.jsonl
  decisionId?: string | null; // From tweet_id_backups.jsonl (legacy)
  timestamp: number;
  date: string;
  verified?: boolean;
}

export async function idRecoveryQueueJob(): Promise<void> {
  const startTime = Date.now();
  recordJobStart('id_recovery_queue');
  
  try {
    // 🔥 FIX: Use the main backup file (tweet_id_backup.jsonl) which has decision_id
    // This is more reliable than tweet_id_backups.jsonl (which doesn't have decision_id)
    const backupFile = join(process.cwd(), 'logs', 'tweet_id_backup.jsonl');
    
    if (!existsSync(backupFile)) {
      console.log('[ID_RECOVERY_QUEUE] ✅ No backup file found - nothing to recover');
      await recordJobSuccess('id_recovery_queue');
      return;
    }
    
    // Read backup file
    const fileContent = readFileSync(backupFile, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.log('[ID_RECOVERY_QUEUE] ✅ Backup file is empty');
      await recordJobSuccess('id_recovery_queue');
      return;
    }
    
    // Parse backup entries
    const backups: TweetIdBackup[] = [];
    for (const line of lines) {
      try {
        const backup = JSON.parse(line) as TweetIdBackup;
        // Normalize fields (handle both backup file formats)
        const decisionId = backup.decision_id || backup.decisionId || null;
        const tweetId = backup.tweet_id || backup.tweetId || null;
        
        // Only process unverified entries from last 24 hours with valid IDs
        if (tweetId && !backup.verified && (Date.now() - backup.timestamp) < 24 * 60 * 60 * 1000) {
          backups.push({
            ...backup,
            decision_id: decisionId || undefined,
            tweet_id: tweetId,
            decisionId: decisionId || undefined
          });
        }
      } catch (e) {
        console.warn(`[ID_RECOVERY_QUEUE] ⚠️ Failed to parse backup line: ${e}`);
      }
    }
    
    if (backups.length === 0) {
      console.log('[ID_RECOVERY_QUEUE] ✅ No unverified backups found');
      await recordJobSuccess('id_recovery_queue');
      return;
    }
    
    console.log(`[ID_RECOVERY_QUEUE] 📊 Found ${backups.length} unverified backups to process`);
    
    const supabase = getSupabaseClient();
    let recovered = 0;
    let failed = 0;
    const verifiedBackups: TweetIdBackup[] = [];
    
    // Process each backup
    for (const backup of backups) {
      try {
        const decisionId = backup.decision_id || backup.decisionId;
        const tweetId = backup.tweet_id || backup.tweetId;
        
        if (!tweetId) {
          console.warn(`[ID_RECOVERY_QUEUE] ⚠️ Backup missing tweet_id, skipping`);
          continue;
        }
        
        // Try to match by decision_id first (most reliable)
        if (decisionId) {
          const { data: post, error: fetchError } = await supabase
            .from('content_metadata')
            .select('decision_id, tweet_id, content, status')
            .eq('decision_id', decisionId)
            .single();
          
          if (!fetchError && post) {
            // 🔥 RACE CONDITION PROTECTION: Only update if tweet_id is still NULL
            // Prevents overwriting if another recovery job already updated it
            if (!post.tweet_id) {
              const { error: updateError, data: updated } = await supabase
                .from('content_metadata')
                .update({
                  tweet_id: tweetId,
                  updated_at: new Date().toISOString()
                })
                .eq('decision_id', decisionId)
                .is('tweet_id', null) // 🔥 RACE CONDITION: Only update if still NULL
                .select('decision_id')
                .single();
              
              if (updateError) {
                console.error(`[ID_RECOVERY_QUEUE] ❌ Failed to update decision ${decisionId}: ${updateError.message}`);
                failed++;
                continue;
              }
              
              // Check if update actually succeeded (race condition check)
              if (!updated) {
                console.log(`[ID_RECOVERY_QUEUE] ⚠️ Decision ${decisionId} already updated by another process (race condition)`);
                // Mark as verified anyway (another job handled it)
                backup.verified = true;
                verifiedBackups.push(backup);
                continue;
              }
              
              console.log(`[ID_RECOVERY_QUEUE] ✅ Recovered ID ${tweetId} for decision ${decisionId}`);
              recovered++;
              backup.verified = true;
              verifiedBackups.push(backup);
              continue;
            } else if (post.tweet_id === tweetId) {
              // Already has correct tweet_id, mark as verified
              backup.verified = true;
              verifiedBackups.push(backup);
              continue;
            } else {
              // Has different tweet_id - log warning but don't overwrite
              console.warn(`[ID_RECOVERY_QUEUE] ⚠️ Decision ${decisionId} already has different tweet_id ${post.tweet_id}, skipping`);
              failed++;
              continue;
            }
          }
        }
        
        // Fallback: Match by content (for entries without decision_id)
        const contentToMatch = backup.content || backup.content_preview || '';
        if (contentToMatch && contentToMatch.length > 20) {
          const contentMatch = contentToMatch.substring(0, 50);
          const { data: posts, error: searchError } = await supabase
            .from('content_metadata')
            .select('decision_id, tweet_id, content, status, posted_at')
            .eq('status', 'posted')
            .is('tweet_id', null)
            .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(10);
          
          if (!searchError && posts) {
            // Find best match by content similarity
            let bestMatch: typeof posts[0] | null = null;
            let bestScore = 0;
            
            for (const post of posts) {
              const postContent = String(post.content || '').substring(0, 50);
              const similarity = calculateSimilarity(contentMatch.toLowerCase(), postContent.toLowerCase());
              if (similarity > bestScore && similarity > 0.7) { // 70% similarity threshold
                bestScore = similarity;
                bestMatch = post;
              }
            }
            
            if (bestMatch) {
              // 🔥 RACE CONDITION PROTECTION: Only update if tweet_id is still NULL
              const { error: updateError, data: updated } = await supabase
                .from('content_metadata')
                .update({
                  tweet_id: tweetId,
                  updated_at: new Date().toISOString()
                })
                .eq('decision_id', bestMatch.decision_id)
                .is('tweet_id', null) // 🔥 RACE CONDITION: Only update if still NULL
                .select('decision_id'); // Select to get updated rows
              
              if (updateError) {
                console.error(`[ID_RECOVERY_QUEUE] ❌ Failed to update matched post: ${updateError.message}`);
                failed++;
                continue;
              }
              
              // Check if update actually succeeded (race condition check)
              if (!updated || (Array.isArray(updated) && updated.length === 0)) {
                console.log(`[ID_RECOVERY_QUEUE] ⚠️ Post ${bestMatch.decision_id} already updated by another process (race condition)`);
                // Mark as verified anyway (another job handled it)
                backup.verified = true;
                verifiedBackups.push(backup);
                continue;
              }
              
              console.log(`[ID_RECOVERY_QUEUE] ✅ Recovered ID ${tweetId} for post (content match: ${Math.round(bestScore * 100)}%)`);
              recovered++;
              backup.verified = true;
              verifiedBackups.push(backup);
              continue;
            }
          }
        }
        
        // No match found - mark as failed after 1 hour
        const ageHours = (Date.now() - backup.timestamp) / (60 * 60 * 1000);
        if (ageHours > 1) {
          console.warn(`[ID_RECOVERY_QUEUE] ⚠️ Backup ${tweetId} unmatched after ${Math.round(ageHours)}h - marking as failed`);
          failed++;
        }
        
      } catch (error: any) {
        console.error(`[ID_RECOVERY_QUEUE] ❌ Error processing backup ${backup.tweet_id || backup.tweetId}: ${error.message}`);
        failed++;
      }
    }
    
    // Update backup file with verified entries
    if (verifiedBackups.length > 0) {
      const updatedLines = lines.map(line => {
        try {
          const backup = JSON.parse(line) as TweetIdBackup;
          const backupTweetId = backup.tweet_id || backup.tweetId;
          const verified = verifiedBackups.find(v => {
            const vTweetId = v.tweet_id || v.tweetId;
            return vTweetId === backupTweetId && v.timestamp === backup.timestamp;
          });
          if (verified) {
            return JSON.stringify({ ...backup, verified: true });
          }
          return line;
        } catch {
          return line;
        }
      });
      
      writeFileSync(backupFile, updatedLines.join('\n') + '\n', 'utf-8');
      console.log(`[ID_RECOVERY_QUEUE] 💾 Updated backup file with ${verifiedBackups.length} verified entries`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[ID_RECOVERY_QUEUE] ✅ Recovery complete: ${recovered} recovered, ${failed} failed (${Math.round(duration)}ms)`);
    
    await recordJobSuccess('id_recovery_queue');
    
  } catch (error: any) {
    console.error(`[ID_RECOVERY_QUEUE] ❌ Fatal error: ${error.message}`);
    recordJobFailure('id_recovery_queue', error.message);
    throw error;
  }
}

/**
 * Calculate similarity between two strings (simple Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

