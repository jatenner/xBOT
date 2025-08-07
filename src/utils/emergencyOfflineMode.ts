/**
 * 🚨 EMERGENCY OFFLINE MODE
 * For when Supabase is completely down
 */

import { promises as fs } from 'fs';
import path from 'path';

export class EmergencyOfflineMode {
  private static isOfflineMode = false;
  private static offlineDataPath = path.join(process.cwd(), 'data', 'emergency_offline.json');
  
  static async detectSupabaseOutage(): Promise<boolean> {
    try {
      // Quick test of Supabase connectivity
      const testUrl = process.env.SUPABASE_URL;
      if (!testUrl) return true; // No URL = outage
      
      const response = await fetch(`${testUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY || '',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      return !response.ok;
    } catch (error) {
      console.log('🚨 Supabase connectivity test failed:', error.message);
      return true; // Any error = treat as outage
    }
  }
  
  static async activateOfflineMode(): Promise<void> {
    this.isOfflineMode = true;
    console.log('🚨 EMERGENCY OFFLINE MODE ACTIVATED');
    console.log('📱 Bot will continue posting without database dependency');
    
    // Ensure offline data directory exists
    const dataDir = path.dirname(this.offlineDataPath);
    await fs.mkdir(dataDir, { recursive: true });
  }
  
  static isOffline(): boolean {
    return this.isOfflineMode;
  }
  
  static async storeOfflineData(type: string, data: any): Promise<void> {
    try {
      let offlineData: any = {};
      
      try {
        const existing = await fs.readFile(this.offlineDataPath, 'utf8');
        offlineData = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }
      
      if (!offlineData[type]) offlineData[type] = [];
      
      offlineData[type].push({
        ...data,
        offline_timestamp: new Date().toISOString(),
        sync_pending: true
      });
      
      await fs.writeFile(this.offlineDataPath, JSON.stringify(offlineData, null, 2));
      console.log(`💾 Stored ${type} data offline for later sync`);
    } catch (error) {
      console.log(`❌ Failed to store offline data:`, error);
    }
  }
  
  static async getOfflineContent(): Promise<{ content: string; type: string } | null> {
    // Simple fallback content when database is unreachable
    const fallbackContent = [
      "🧠 Health myths are everywhere. Question what you hear. Research what matters. Your wellness journey is unique to you. What health 'fact' surprised you when you dug deeper? 🔍",
      
      "💪 Small consistent actions > big sporadic efforts. 5 minutes of movement daily beats 2-hour workouts once a week. Your body craves consistency, not perfection. What's your smallest daily health win? ✨",
      
      "🥗 'Eat the rainbow' isn't just pretty advice. Different colored foods provide different nutrients your body needs. Red = lycopene, Orange = beta-carotene, Green = folate. Nature's pharmacy is colorful! 🌈",
      
      "😴 Sleep quality > sleep quantity. 6 hours of deep, restorative sleep beats 9 hours of tossing and turning. Your bedroom environment matters more than you think. What helps you sleep best? 💤",
      
      "🧘 Stress isn't the enemy—chronic unmanaged stress is. Acute stress can actually boost immune function and performance. The key is recovery. How do you help your body bounce back? 🌱"
    ];
    
    const randomContent = fallbackContent[Math.floor(Math.random() * fallbackContent.length)];
    
    return {
      content: randomContent,
      type: 'single_tweet'
    };
  }
}