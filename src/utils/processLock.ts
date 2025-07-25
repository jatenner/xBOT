/**
 * 🔒 PROCESS LOCK SYSTEM
 * 
 * Prevents multiple bot instances from running simultaneously
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export class ProcessLock {
  private static readonly LOCK_FILE = path.join(process.cwd(), '.bot-lock');
  private static readonly MAX_LOCK_AGE = 5 * 60 * 1000; // 5 minutes
  
  private static lockAcquired = false;

  /**
   * 🔒 Acquire process lock
   */
  static async acquire(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if lock file exists
      if (fs.existsSync(this.LOCK_FILE)) {
        const lockData = this.readLockFile();
        
        if (lockData) {
          // Check if lock is stale
          const now = Date.now();
          const lockAge = now - lockData.timestamp;
          
          if (lockAge < this.MAX_LOCK_AGE) {
            // Lock is still fresh
            return {
              success: false,
              error: `Another bot instance is running (PID: ${lockData.pid}, started: ${new Date(lockData.timestamp).toLocaleString()})`
            };
          } else {
            // Lock is stale, remove it
            console.log('⚠️ Removing stale lock file');
            this.release();
          }
        }
      }

      // Create new lock
      const lockData = {
        pid: process.pid,
        timestamp: Date.now(),
        startedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.LOCK_FILE, JSON.stringify(lockData, null, 2));
      this.lockAcquired = true;

      console.log(`🔒 Process lock acquired (PID: ${process.pid})`);

      // Setup cleanup on exit
      this.setupCleanup();

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Failed to acquire lock: ${error.message}`
      };
    }
  }

  /**
   * 🔓 Release process lock
   */
  static release(): void {
    try {
      if (fs.existsSync(this.LOCK_FILE)) {
        fs.unlinkSync(this.LOCK_FILE);
        console.log('🔓 Process lock released');
      }
      this.lockAcquired = false;
    } catch (error) {
      console.error('❌ Error releasing lock:', error);
    }
  }

  /**
   * 📖 Read lock file data
   */
  private static readLockFile(): { pid: number; timestamp: number; startedAt: string } | null {
    try {
      const data = fs.readFileSync(this.LOCK_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('⚠️ Could not read lock file:', error);
      return null;
    }
  }

  /**
   * 🧹 Setup cleanup handlers
   */
  private static setupCleanup(): void {
    const cleanup = () => {
      if (this.lockAcquired) {
        console.log('🧹 Cleaning up process lock...');
        this.release();
      }
    };

    // Handle various exit scenarios
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      cleanup();
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled rejection:', reason);
      cleanup();
      process.exit(1);
    });
  }

  /**
   * ✅ Check if we have the lock
   */
  static hasLock(): boolean {
    return this.lockAcquired;
  }

  /**
   * 🔍 Check lock status
   */
  static checkStatus(): { 
    hasLock: boolean; 
    lockExists: boolean; 
    lockData?: any;
    isStale?: boolean;
  } {
    const lockExists = fs.existsSync(this.LOCK_FILE);
    
    if (!lockExists) {
      return { hasLock: this.lockAcquired, lockExists: false };
    }

    const lockData = this.readLockFile();
    if (!lockData) {
      return { hasLock: this.lockAcquired, lockExists: true };
    }

    const now = Date.now();
    const lockAge = now - lockData.timestamp;
    const isStale = lockAge > this.MAX_LOCK_AGE;

    return {
      hasLock: this.lockAcquired,
      lockExists: true,
      lockData,
      isStale
    };
  }
}

export default ProcessLock; 