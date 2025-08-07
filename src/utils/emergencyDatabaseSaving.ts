/**
 * 🚨 EMERGENCY DATABASE SAVING SYSTEM
 * 
 * This is a bulletproof fallback system that ensures tweets are saved
 * to the database even if all other storage systems fail.
 * 
 * Used as absolute last resort when Ultimate Storage fails.
 */

import { secureSupabaseClient } from './secureSupabaseClient';

export interface EmergencyTweetData {
  tweet_id: string;
  content: string;
  content_type?: string;
  viral_score?: number;
  success?: boolean;
  posted_to_twitter?: boolean;
  emergency_save?: boolean;
}

export class EmergencyDatabaseSaving {
  /**
   * 🚨 EMERGENCY SAVE: Absolutely bulletproof tweet saving
   */
  static async emergencySave(tweetData: EmergencyTweetData): Promise<{
    success: boolean;
    database_id?: number;
    error?: string;
    method: string;
  }> {
    console.log('🚨 === EMERGENCY DATABASE SAVING ACTIVATED ===');
    console.log(`📝 Saving tweet: ${tweetData.tweet_id}`);
    
    const attempts = [
      () => this.attemptSupabaseInsert(tweetData),
      () => this.attemptMinimalInsert(tweetData),
      () => this.attemptRawInsert(tweetData),
      () => this.attemptFileBackup(tweetData)
    ];
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`🔄 Emergency attempt ${i + 1}/4...`);
        const result = await attempts[i]();
        
        if (result.success) {
          console.log(`✅ EMERGENCY SAVE SUCCESS via method ${i + 1}`);
          return result;
        } else {
          console.log(`❌ Emergency method ${i + 1} failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`💥 Emergency method ${i + 1} crashed: ${error.message}`);
      }
    }
    
    console.log('🔥 ALL EMERGENCY METHODS FAILED - CRITICAL SYSTEM FAILURE');
    return {
      success: false,
      error: 'All emergency saving methods failed',
      method: 'none'
    };
  }
  
  /**
   * Method 1: Standard Supabase insert with all data
   */
  private static async attemptSupabaseInsert(tweetData: EmergencyTweetData): Promise<{
    success: boolean;
    database_id?: number;
    error?: string;
    method: string;
  }> {
    if (!secureSupabaseClient.supabase) {
      return {
        success: false,
        error: 'Supabase client not initialized',
        method: 'supabase_full'
      };
    }
    
    const insertData = {
      tweet_id: tweetData.tweet_id,
      content: tweetData.content,
      content_type: tweetData.content_type || 'emergency_save',
      viral_score: tweetData.viral_score || 5,
      ai_optimized: true,
      generation_method: 'emergency_save',
      success: tweetData.success ?? true,
      posted_to_twitter: tweetData.posted_to_twitter ?? true,
      emergency_save: true,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await secureSupabaseClient.supabase
      .from('tweets')
      .insert(insertData)
      .select('id')
      .single();
    
    if (error) {
      return {
        success: false,
        error: error.message,
        method: 'supabase_full'
      };
    }
    
    return {
      success: true,
      database_id: data?.id,
      method: 'supabase_full'
    };
  }
  
  /**
   * Method 2: Minimal insert with only essential fields
   */
  private static async attemptMinimalInsert(tweetData: EmergencyTweetData): Promise<{
    success: boolean;
    database_id?: number;
    error?: string;
    method: string;
  }> {
    if (!secureSupabaseClient.supabase) {
      return {
        success: false,
        error: 'Supabase client not initialized',
        method: 'supabase_minimal'
      };
    }
    
    // Only include absolutely essential fields that should always exist
    const minimalData = {
      tweet_id: tweetData.tweet_id,
      content: tweetData.content,
      emergency_save: true,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await secureSupabaseClient.supabase
      .from('tweets')
      .insert(minimalData)
      .select('id')
      .single();
    
    if (error) {
      return {
        success: false,
        error: error.message,
        method: 'supabase_minimal'
      };
    }
    
    return {
      success: true,
      database_id: data?.id,
      method: 'supabase_minimal'
    };
  }
  
  /**
   * Method 3: Raw SQL insert bypassing any ORM issues
   */
  private static async attemptRawInsert(tweetData: EmergencyTweetData): Promise<{
    success: boolean;
    database_id?: number;
    error?: string;
    method: string;
  }> {
    if (!secureSupabaseClient.supabase) {
      return {
        success: false,
        error: 'Supabase client not initialized',
        method: 'raw_sql'
      };
    }
    
    const sql = `
      INSERT INTO tweets (tweet_id, content, emergency_save, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    
    const { data, error } = await secureSupabaseClient.supabase!.rpc('execute_sql', {
      sql_query: sql,
      params: [
        tweetData.tweet_id,
        tweetData.content,
        true,
        new Date().toISOString()
      ]
    });
    
    if (error) {
      return {
        success: false,
        error: error.message,
        method: 'raw_sql'
      };
    }
    
    return {
      success: true,
      database_id: data?.[0]?.id,
      method: 'raw_sql'
    };
  }
  
  /**
   * Method 4: File system backup as absolute last resort
   */
  private static async attemptFileBackup(tweetData: EmergencyTweetData): Promise<{
    success: boolean;
    database_id?: number;
    error?: string;
    method: string;
  }> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Create emergency backup directory
      const backupDir = path.join(process.cwd(), 'emergency_tweet_backups');
      
      try {
        await fs.mkdir(backupDir, { recursive: true });
      } catch (mkdirError) {
        // Directory might already exist, that's fine
      }
      
      // Create backup file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `emergency_tweet_${timestamp}_${tweetData.tweet_id}.json`;
      const filepath = path.join(backupDir, filename);
      
      const backupData = {
        ...tweetData,
        emergency_backup: true,
        backup_timestamp: new Date().toISOString(),
        system_note: 'This tweet was posted to Twitter but database saving failed'
      };
      
      await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8');
      
      console.log(`📁 Emergency file backup created: ${filename}`);
      
      return {
        success: true,
        database_id: undefined, // No database ID for file backup
        method: 'file_backup'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'file_backup'
      };
    }
  }
  
  /**
   * 🔄 RECOVERY: Attempt to restore file backups to database
   */
  static async recoverFileBackups(): Promise<{
    attempted: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    console.log('🔄 === EMERGENCY BACKUP RECOVERY ===');
    
    const stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const backupDir = path.join(process.cwd(), 'emergency_tweet_backups');
      
      try {
        const files = await fs.readdir(backupDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        console.log(`📁 Found ${jsonFiles.length} backup files`);
        
        for (const file of jsonFiles) {
          stats.attempted++;
          
          try {
            const filepath = path.join(backupDir, file);
            const content = await fs.readFile(filepath, 'utf8');
            const tweetData = JSON.parse(content);
            
            // Attempt to save to database
            const result = await this.attemptSupabaseInsert(tweetData);
            
            if (result.success) {
              stats.successful++;
              // Move file to processed folder
              const processedDir = path.join(backupDir, 'processed');
              await fs.mkdir(processedDir, { recursive: true });
              await fs.rename(filepath, path.join(processedDir, file));
              console.log(`✅ Recovered: ${file}`);
            } else {
              stats.failed++;
              stats.errors.push(`${file}: ${result.error}`);
              console.log(`❌ Failed to recover: ${file}`);
            }
            
          } catch (fileError) {
            stats.failed++;
            stats.errors.push(`${file}: ${fileError.message}`);
            console.log(`💥 Error processing ${file}: ${fileError.message}`);
          }
        }
        
      } catch (dirError) {
        console.log('📁 No backup directory found - no files to recover');
      }
      
    } catch (error) {
      stats.errors.push(`Recovery system error: ${error.message}`);
    }
    
    console.log(`🔄 Recovery complete: ${stats.successful}/${stats.attempted} successful`);
    return stats;
  }
}

// Export for use throughout the application
export const emergencyDatabaseSaving = EmergencyDatabaseSaving; 