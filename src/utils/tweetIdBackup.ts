/**
 * 🛡️ TWEET ID BACKUP SYSTEM
 * 
 * CRITICAL: Saves tweet_ids to file IMMEDIATELY after Twitter post
 * This prevents duplicate posts even if database save fails
 * 
 * Priority 1 Fix: Prevents duplicate posts when database save fails
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const BACKUP_FILE = join(process.cwd(), 'logs', 'tweet_id_backup.jsonl');
const BACKUP_DIR = join(process.cwd(), 'logs');

interface TweetIdBackup {
  decision_id: string;
  tweet_id: string;
  content_hash: string;
  content_preview: string; // First 100 chars for debugging
  timestamp: number;
  date: string;
  verified: boolean; // Whether database save succeeded
}

/**
 * Generate content hash for duplicate detection
 */
function hashContent(content: string): string {
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Save tweet_id to backup file IMMEDIATELY after Twitter post
 * This runs BEFORE database save to prevent duplicates
 */
export function saveTweetIdToBackup(
  decisionId: string,
  tweetId: string,
  content: string
): void {
  try {
    // Ensure logs directory exists
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const backup: TweetIdBackup = {
      decision_id: decisionId,
      tweet_id: tweetId,
      content_hash: hashContent(content),
      content_preview: content.substring(0, 100),
      timestamp: Date.now(),
      date: new Date().toISOString(),
      verified: false // Will be updated when database save succeeds
    };
    
    appendFileSync(BACKUP_FILE, JSON.stringify(backup) + '\n');
    console.log(`[TWEET_ID_BACKUP] 💾 Saved tweet_id ${tweetId} to backup file (decision: ${decisionId.substring(0, 8)}...)`);
  } catch (error: any) {
    console.error(`[TWEET_ID_BACKUP] ⚠️ Failed to save backup: ${error.message}`);
    // Don't throw - backup failure shouldn't block posting
  }
}

/**
 * Mark backup entry as verified (database save succeeded)
 */
export function markBackupAsVerified(decisionId: string, tweetId: string): void {
  try {
    if (!existsSync(BACKUP_FILE)) {
      return; // No backup file, nothing to verify
    }
    
    const fileContent = readFileSync(BACKUP_FILE, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    const updatedLines = lines.map(line => {
      try {
        const backup: TweetIdBackup = JSON.parse(line);
        if (backup.decision_id === decisionId && backup.tweet_id === tweetId) {
          backup.verified = true;
          return JSON.stringify(backup);
        }
        return line;
      } catch {
        return line; // Keep malformed lines as-is
      }
    });
    
    // Write back updated content
    const { writeFileSync } = require('fs');
    writeFileSync(BACKUP_FILE, updatedLines.join('\n') + '\n', 'utf-8');
  } catch (error: any) {
    console.warn(`[TWEET_ID_BACKUP] ⚠️ Failed to mark as verified: ${error.message}`);
  }
}

/**
 * Check if content was already posted (using backup file)
 * This prevents duplicates even if database save failed
 */
export function checkBackupForDuplicate(content: string): string | null {
  try {
    if (!existsSync(BACKUP_FILE)) {
      return null; // No backup file, no duplicates
    }
    
    const contentHash = hashContent(content);
    const fileContent = readFileSync(BACKUP_FILE, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    // Check most recent entries first (reverse order)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const backup: TweetIdBackup = JSON.parse(lines[i]);
        if (backup.content_hash === contentHash) {
          // Found duplicate - return tweet_id
          console.log(`[TWEET_ID_BACKUP] 🚫 DUPLICATE DETECTED in backup: tweet_id ${backup.tweet_id} (decision: ${backup.decision_id.substring(0, 8)}...)`);
          return backup.tweet_id;
        }
      } catch {
        // Skip malformed lines
        continue;
      }
    }
    
    return null; // No duplicate found
  } catch (error: any) {
    console.warn(`[TWEET_ID_BACKUP] ⚠️ Failed to check backup: ${error.message}`);
    return null; // Fail open - don't block posting if backup check fails
  }
}

/**
 * Get tweet_id from backup file for a given decision_id
 * Used when verification fails but we know post succeeded
 */
export function getTweetIdFromBackup(decisionId: string): string | null {
  try {
    if (!existsSync(BACKUP_FILE)) {
      return null;
    }
    
    const fileContent = readFileSync(BACKUP_FILE, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    // Check most recent entries first
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const backup: TweetIdBackup = JSON.parse(lines[i]);
        if (backup.decision_id === decisionId) {
          return backup.tweet_id;
        }
      } catch {
        continue;
      }
    }
    
    return null;
  } catch (error: any) {
    console.warn(`[TWEET_ID_BACKUP] ⚠️ Failed to get tweet_id from backup: ${error.message}`);
    return null;
  }
}

/**
 * Clean up old backup entries (older than 30 days)
 * Keeps backup file from growing too large
 */
export function cleanupOldBackups(): void {
  try {
    if (!existsSync(BACKUP_FILE)) {
      return;
    }
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const fileContent = readFileSync(BACKUP_FILE, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    const recentLines = lines.filter(line => {
      try {
        const backup: TweetIdBackup = JSON.parse(line);
        return backup.timestamp > thirtyDaysAgo;
      } catch {
        return true; // Keep malformed lines (they'll be cleaned up later)
      }
    });
    
    if (recentLines.length < lines.length) {
      const { writeFileSync } = require('fs');
      writeFileSync(BACKUP_FILE, recentLines.join('\n') + '\n', 'utf-8');
      console.log(`[TWEET_ID_BACKUP] 🧹 Cleaned up ${lines.length - recentLines.length} old backup entries`);
    }
  } catch (error: any) {
    console.warn(`[TWEET_ID_BACKUP] ⚠️ Failed to cleanup backups: ${error.message}`);
  }
}



