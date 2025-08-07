/**
 * 🔄 OFFLINE DATA SYNCHRONIZER
 * Syncs all offline data when Supabase comes back online
 */

import { EmergencyOfflineMode } from './emergencyOfflineMode';
import { bulletproofTwitterDataCollector } from './bulletproofTwitterDataCollector';
import { resilientSupabaseClient } from './resilientSupabaseClient';
import { promises as fs } from 'fs';
import path from 'path';

interface SyncStatus {
  tweets_synced: number;
  analytics_synced: number;
  posts_synced: number;
  errors: string[];
  last_sync: string;
}

export class OfflineDataSynchronizer {
  private static instance: OfflineDataSynchronizer;
  private syncInProgress = false;
  private lastSyncAttempt = 0;
  private syncInterval = 5 * 60 * 1000; // 5 minutes

  static getInstance(): OfflineDataSynchronizer {
    if (!this.instance) {
      this.instance = new OfflineDataSynchronizer();
    }
    return this.instance;
  }

  /**
   * 🔄 Start automatic sync monitoring
   */
  startAutoSync(): void {
    console.log('🔄 Starting automatic offline data sync monitoring...');
    
    setInterval(async () => {
      await this.attemptSync();
    }, this.syncInterval);

    // Also try sync on startup
    setTimeout(() => this.attemptSync(), 10000); // Wait 10 seconds after startup
  }

  /**
   * 🔍 Attempt to sync if conditions are right
   */
  async attemptSync(): Promise<void> {
    const now = Date.now();
    
    // Don't attempt too frequently
    if (now - this.lastSyncAttempt < 60000) return; // Min 1 minute between attempts
    
    this.lastSyncAttempt = now;

    // Check if Supabase is available
    const isSupabaseDown = await EmergencyOfflineMode.detectSupabaseOutage();
    if (isSupabaseDown) {
      console.log('📡 Supabase still down, skipping sync attempt');
      return;
    }

    // Check if we have offline data to sync
    const hasOfflineData = await this.hasOfflineDataToSync();
    if (!hasOfflineData) {
      console.log('📭 No offline data to sync');
      return;
    }

    console.log('🔄 Supabase is back online! Starting data synchronization...');
    await this.performFullSync();
  }

  /**
   * 🔍 Check if we have offline data to sync
   */
  private async hasOfflineDataToSync(): Promise<boolean> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      
      // Check emergency offline data
      const emergencyFile = path.join(dataDir, 'emergency_offline.json');
      try {
        const emergencyData = await fs.readFile(emergencyFile, 'utf-8');
        const data = JSON.parse(emergencyData);
        if (data.tweets?.length > 0 || data.analytics?.length > 0 || data.posts?.length > 0) {
          return true;
        }
      } catch (error) {
        // File doesn't exist or is empty
      }

      // Check Twitter data
      const twitterDataDir = path.join(dataDir, 'offline_twitter_data');
      try {
        const files = await fs.readdir(twitterDataDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('processed'));
        if (jsonFiles.length > 0) return true;
      } catch (error) {
        // Directory doesn't exist
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking for offline data:', error);
      return false;
    }
  }

  /**
   * 🔄 Perform full synchronization
   */
  async performFullSync(): Promise<SyncStatus> {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping...');
      return this.getLastSyncStatus();
    }

    this.syncInProgress = true;
    const syncStatus: SyncStatus = {
      tweets_synced: 0,
      analytics_synced: 0,
      posts_synced: 0,
      errors: [],
      last_sync: new Date().toISOString()
    };

    try {
      console.log('🚀 FULL OFFLINE DATA SYNC STARTING...');

      // 1. Sync emergency offline data
      await this.syncEmergencyData(syncStatus);

      // 2. Sync Twitter data
      await this.syncTwitterData(syncStatus);

      // 3. Sync any other offline data
      await this.syncMiscellaneousData(syncStatus);

      // 4. Clean up offline files after successful sync
      await this.cleanupSyncedData(syncStatus);

      console.log('✅ FULL OFFLINE DATA SYNC COMPLETE!');
      console.log(`📊 Sync Summary:
        🐦 Tweets: ${syncStatus.tweets_synced}
        📈 Analytics: ${syncStatus.analytics_synced}
        📝 Posts: ${syncStatus.posts_synced}
        ❌ Errors: ${syncStatus.errors.length}`);

      // Save sync status
      await this.saveSyncStatus(syncStatus);

    } catch (error) {
      console.error('❌ SYNC FAILED:', error);
      syncStatus.errors.push(`Sync failed: ${error.message}`);
    } finally {
      this.syncInProgress = false;
    }

    return syncStatus;
  }

  /**
   * 🚨 Sync emergency offline data
   */
  private async syncEmergencyData(syncStatus: SyncStatus): Promise<void> {
    try {
      console.log('🚨 Syncing emergency offline data...');
      
      const dataDir = path.join(process.cwd(), 'data');
      const emergencyFile = path.join(dataDir, 'emergency_offline.json');
      
      try {
        const fileContent = await fs.readFile(emergencyFile, 'utf-8');
        const offlineData = JSON.parse(fileContent);

        // Sync tweets
        if (offlineData.tweets && offlineData.tweets.length > 0) {
          for (const tweet of offlineData.tweets) {
            try {
              await resilientSupabaseClient.upsert('tweets', tweet);
              syncStatus.tweets_synced++;
              console.log(`✅ Synced tweet: ${tweet.tweet_id}`);
            } catch (error) {
              console.error(`❌ Failed to sync tweet ${tweet.tweet_id}:`, error);
              syncStatus.errors.push(`Tweet sync failed: ${tweet.tweet_id}`);
            }
          }
        }

        // Sync analytics
        if (offlineData.analytics && offlineData.analytics.length > 0) {
          for (const analytics of offlineData.analytics) {
            try {
              await resilientSupabaseClient.upsert('tweet_analytics', analytics);
              syncStatus.analytics_synced++;
              console.log(`✅ Synced analytics: ${analytics.tweet_id}`);
            } catch (error) {
              console.error(`❌ Failed to sync analytics ${analytics.tweet_id}:`, error);
              syncStatus.errors.push(`Analytics sync failed: ${analytics.tweet_id}`);
            }
          }
        }

        // Sync posts
        if (offlineData.posts && offlineData.posts.length > 0) {
          for (const post of offlineData.posts) {
            try {
              await resilientSupabaseClient.insert('post_history', post);
              syncStatus.posts_synced++;
              console.log(`✅ Synced post: ${post.tweet_id}`);
            } catch (error) {
              console.error(`❌ Failed to sync post ${post.tweet_id}:`, error);
              syncStatus.errors.push(`Post sync failed: ${post.tweet_id}`);
            }
          }
        }

      } catch (error) {
        console.log('📭 No emergency offline data file found or empty');
      }

    } catch (error) {
      console.error('❌ Emergency data sync failed:', error);
      syncStatus.errors.push(`Emergency sync failed: ${error.message}`);
    }
  }

  /**
   * 🐦 Sync Twitter data
   */
  private async syncTwitterData(syncStatus: SyncStatus): Promise<void> {
    try {
      console.log('🐦 Syncing Twitter data...');
      await bulletproofTwitterDataCollector.syncOfflineData();
      
      // Count synced items (estimate)
      const dataDir = path.join(process.cwd(), 'data', 'offline_twitter_data');
      try {
        const files = await fs.readdir(dataDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('processed'));
        
        for (const file of jsonFiles) {
          const filepath = path.join(dataDir, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            syncStatus.tweets_synced += data.length;
          }
        }
      } catch (error) {
        console.log('📭 No Twitter data directory found');
      }

    } catch (error) {
      console.error('❌ Twitter data sync failed:', error);
      syncStatus.errors.push(`Twitter sync failed: ${error.message}`);
    }
  }

  /**
   * 📋 Sync miscellaneous data
   */
  private async syncMiscellaneousData(syncStatus: SyncStatus): Promise<void> {
    try {
      console.log('📋 Syncing miscellaneous offline data...');
      
      // Check for any other offline data files
      const dataDir = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dataDir);
      
      for (const file of files) {
        if (file.startsWith('offline_') && file.endsWith('.json') && file !== 'emergency_offline.json') {
          try {
            const filepath = path.join(dataDir, file);
            const content = await fs.readFile(filepath, 'utf-8');
            const data = JSON.parse(content);
            
            console.log(`📋 Found offline data file: ${file}`);
            // Process based on file type
            if (file.includes('engagement')) {
              // Sync engagement data
              if (Array.isArray(data)) {
                for (const item of data) {
                  try {
                    await resilientSupabaseClient.upsert('engagement_history', item);
                    syncStatus.analytics_synced++;
                  } catch (error) {
                    syncStatus.errors.push(`Engagement sync failed: ${item.id || 'unknown'}`);
                  }
                }
              }
            }
            
          } catch (error) {
            console.error(`❌ Failed to process ${file}:`, error);
            syncStatus.errors.push(`File ${file} sync failed`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Miscellaneous data sync failed:', error);
      syncStatus.errors.push(`Misc sync failed: ${error.message}`);
    }
  }

  /**
   * 🧹 Clean up synced data
   */
  private async cleanupSyncedData(syncStatus: SyncStatus): Promise<void> {
    try {
      console.log('🧹 Cleaning up successfully synced data...');
      
      // Only clean up if sync was mostly successful
      if (syncStatus.errors.length === 0 || 
          (syncStatus.tweets_synced + syncStatus.analytics_synced + syncStatus.posts_synced) > syncStatus.errors.length * 3) {
        
        const dataDir = path.join(process.cwd(), 'data');
        
        // Move emergency file to backup
        const emergencyFile = path.join(dataDir, 'emergency_offline.json');
        try {
          const backupDir = path.join(dataDir, 'synced_backups');
          await fs.mkdir(backupDir, { recursive: true });
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(backupDir, `emergency_offline_${timestamp}.json`);
          
          await fs.rename(emergencyFile, backupFile);
          console.log(`✅ Emergency data backed up to: ${backupFile}`);
        } catch (error) {
          console.log('📭 No emergency file to clean up');
        }

        console.log('✅ Cleanup complete');
      } else {
        console.log('⚠️ Too many sync errors, keeping offline data for retry');
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      syncStatus.errors.push(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * 💾 Save sync status
   */
  private async saveSyncStatus(syncStatus: SyncStatus): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const statusFile = path.join(dataDir, 'last_sync_status.json');
      await fs.writeFile(statusFile, JSON.stringify(syncStatus, null, 2));
      
      console.log(`💾 Sync status saved: ${statusFile}`);
    } catch (error) {
      console.error('❌ Failed to save sync status:', error);
    }
  }

  /**
   * 📊 Get last sync status
   */
  private async getLastSyncStatus(): Promise<SyncStatus> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const statusFile = path.join(dataDir, 'last_sync_status.json');
      
      const content = await fs.readFile(statusFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return {
        tweets_synced: 0,
        analytics_synced: 0,
        posts_synced: 0,
        errors: ['No previous sync status found'],
        last_sync: 'Never'
      };
    }
  }

  /**
   * 🔄 Manual sync trigger
   */
  async manualSync(): Promise<SyncStatus> {
    console.log('🔄 Manual sync triggered...');
    return await this.performFullSync();
  }
}

// Export singleton instance
export const offlineDataSynchronizer = OfflineDataSynchronizer.getInstance();