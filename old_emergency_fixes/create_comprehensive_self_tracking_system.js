#!/usr/bin/env node

/**
 * 🤖 COMPREHENSIVE SELF-TRACKING SYSTEM
 * =====================================
 * 
 * Creates a complete internal tracking system for the bot to monitor:
 * - Twitter posts (FREE TIER: 17/day)
 * - News API calls (FREE TIER: 100/day, 1000/month)
 * - Pexels API calls (FREE TIER: 200/hour, 20,000/month)
 * - OpenAI usage (track costs and requests)
 * 
 * Bot will be SELF-AWARE of its usage and stop before hitting limits.
 */

const fs = require('fs');
const path = require('path');

async function createComprehensiveSelfTrackingSystem() {
  console.log('🤖 CREATING COMPREHENSIVE SELF-TRACKING SYSTEM');
  console.log('===============================================');
  console.log('🎯 FREE TIER LIMITS:');
  console.log('  📱 Twitter: 17 tweets/day');
  console.log('  📰 News API: 100 requests/day, 1000/month');
  console.log('  📸 Pexels: 200/hour, 20,000/month');
  console.log('  🧠 OpenAI: Track costs and requests');
  
  try {
    // Create the self-tracking agent
    const selfTrackingAgent = `
import { supabaseClient } from './supabaseClient';

export interface UsageStats {
  twitter: {
    daily: { used: number; limit: number; remaining: number };
    monthly: { used: number; limit: number; remaining: number };
    lastReset: Date;
  };
  newsApi: {
    daily: { used: number; limit: number; remaining: number };
    monthly: { used: number; limit: number; remaining: number };
    lastReset: Date;
  };
  pexels: {
    hourly: { used: number; limit: number; remaining: number };
    monthly: { used: number; limit: number; remaining: number };
    lastReset: Date;
  };
  openai: {
    daily: { requests: number; tokens: number; cost: number };
    monthly: { requests: number; tokens: number; cost: number };
  };
}

export class SelfTrackingAgent {
  private usageCache: UsageStats | null = null;
  private lastCacheUpdate: Date | null = null;
  private cacheValidityMinutes = 5; // Cache for 5 minutes

  constructor() {
    console.log('🤖 Self-Tracking Agent initialized - Bot will monitor its own usage');
  }

  /**
   * 🎯 GET CURRENT USAGE STATS
   */
  async getCurrentUsage(forceRefresh: boolean = false): Promise<UsageStats> {
    if (!forceRefresh && this.usageCache && this.lastCacheUpdate) {
      const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
      if (cacheAge < this.cacheValidityMinutes * 60 * 1000) {
        return this.usageCache;
      }
    }

    console.log('📊 Calculating current usage from database...');
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    try {
      // Get Twitter usage (count our own tweets)
      const twitterDaily = await this.getTwitterDailyUsage(today);
      const twitterMonthly = await this.getTwitterMonthlyUsage(thisMonth);

      // Get News API usage
      const newsDaily = await this.getNewsApiDailyUsage(today);
      const newsMonthly = await this.getNewsApiMonthlyUsage(thisMonth);

      // Get Pexels usage
      const pexelsHourly = await this.getPexelsHourlyUsage(thisHour);
      const pexelsMonthly = await this.getPexelsMonthlyUsage(thisMonth);

      // Get OpenAI usage
      const openaiDaily = await this.getOpenAiDailyUsage(today);
      const openaiMonthly = await this.getOpenAiMonthlyUsage(thisMonth);

      this.usageCache = {
        twitter: {
          daily: { 
            used: twitterDaily, 
            limit: 17, // FREE TIER
            remaining: Math.max(0, 17 - twitterDaily) 
          },
          monthly: { 
            used: twitterMonthly, 
            limit: 500, // Estimated monthly for free tier
            remaining: Math.max(0, 500 - twitterMonthly) 
          },
          lastReset: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) // Tomorrow
        },
        newsApi: {
          daily: { 
            used: newsDaily, 
            limit: 100, // FREE TIER
            remaining: Math.max(0, 100 - newsDaily) 
          },
          monthly: { 
            used: newsMonthly, 
            limit: 1000, // FREE TIER
            remaining: Math.max(0, 1000 - newsMonthly) 
          },
          lastReset: new Date(now.getFullYear(), now.getMonth() + 1, 1) // Next month
        },
        pexels: {
          hourly: { 
            used: pexelsHourly, 
            limit: 200, // FREE TIER
            remaining: Math.max(0, 200 - pexelsHourly) 
          },
          monthly: { 
            used: pexelsMonthly, 
            limit: 20000, // FREE TIER
            remaining: Math.max(0, 20000 - pexelsMonthly) 
          },
          lastReset: new Date(now.getFullYear(), now.getMonth() + 1, 1) // Next month
        },
        openai: {
          daily: openaiDaily,
          monthly: openaiMonthly
        }
      };

      this.lastCacheUpdate = now;
      
      console.log('📊 Current Usage Summary:');
      console.log(\`  📱 Twitter: \${this.usageCache.twitter.daily.used}/17 today\`);
      console.log(\`  📰 News API: \${this.usageCache.newsApi.daily.used}/100 today\`);
      console.log(\`  📸 Pexels: \${this.usageCache.pexels.hourly.used}/200 this hour\`);
      console.log(\`  🧠 OpenAI: \${this.usageCache.openai.daily.requests} requests today\`);

      return this.usageCache;

    } catch (error) {
      console.error('❌ Failed to get usage stats:', error);
      // Return conservative fallback
      return this.getConservativeFallback();
    }
  }

  /**
   * 🚨 CHECK IF ACTION IS SAFE
   */
  async canPerformAction(action: 'tweet' | 'news' | 'image' | 'openai'): Promise<{ canDo: boolean; reason?: string; waitTime?: number }> {
    const usage = await this.getCurrentUsage();
    
    switch (action) {
      case 'tweet':
        if (usage.twitter.daily.remaining <= 0) {
          return { 
            canDo: false, 
            reason: \`Daily Twitter limit reached (\${usage.twitter.daily.used}/17)\`,
            waitTime: this.getTimeUntilReset(usage.twitter.lastReset)
          };
        }
        if (usage.twitter.daily.remaining <= 2) {
          console.log(\`⚠️ Twitter usage warning: Only \${usage.twitter.daily.remaining} tweets remaining today\`);
        }
        return { canDo: true };

      case 'news':
        if (usage.newsApi.daily.remaining <= 0) {
          return { 
            canDo: false, 
            reason: \`Daily News API limit reached (\${usage.newsApi.daily.used}/100)\`,
            waitTime: this.getTimeUntilReset(usage.newsApi.lastReset)
          };
        }
        if (usage.newsApi.monthly.remaining <= 0) {
          return { 
            canDo: false, 
            reason: \`Monthly News API limit reached (\${usage.newsApi.monthly.used}/1000)\`,
            waitTime: this.getTimeUntilReset(usage.newsApi.lastReset)
          };
        }
        return { canDo: true };

      case 'image':
        if (usage.pexels.hourly.remaining <= 0) {
          return { 
            canDo: false, 
            reason: \`Hourly Pexels limit reached (\${usage.pexels.hourly.used}/200)\`,
            waitTime: 60 // Wait 1 hour
          };
        }
        if (usage.pexels.monthly.remaining <= 0) {
          return { 
            canDo: false, 
            reason: \`Monthly Pexels limit reached (\${usage.pexels.monthly.used}/20000)\`,
            waitTime: this.getTimeUntilReset(usage.pexels.lastReset)
          };
        }
        return { canDo: true };

      case 'openai':
        if (usage.openai.daily.cost > 1.0) { // $1/day limit
          return { 
            canDo: false, 
            reason: \`Daily OpenAI cost limit reached ($\${usage.openai.daily.cost.toFixed(2)})\`,
            waitTime: this.getTimeUntilTomorrow()
          };
        }
        return { canDo: true };

      default:
        return { canDo: false, reason: 'Unknown action' };
    }
  }

  /**
   * 📝 RECORD USAGE
   */
  async recordUsage(action: 'tweet' | 'news' | 'image' | 'openai', metadata: any = {}): Promise<void> {
    try {
      const now = new Date();
      const usage_data = {
        action,
        timestamp: now.toISOString(),
        metadata,
        date: now.toISOString().split('T')[0],
        hour: now.getHours()
      };

      // Store in database
      await supabaseClient.client
        .from('bot_usage_tracking')
        .insert(usage_data);

      // Also update our internal API usage tracking
      if (action === 'tweet') {
        await this.updateApiUsageTracking('twitter', 1);
      } else if (action === 'news') {
        await this.updateApiUsageTracking('news_api', 1);
      } else if (action === 'image') {
        await this.updateApiUsageTracking('pexels', 1);
      } else if (action === 'openai') {
        await this.updateApiUsageTracking('openai', 1, metadata.cost || 0);
      }

      // Invalidate cache
      this.usageCache = null;
      this.lastCacheUpdate = null;

      console.log(\`✅ Usage recorded: \${action}\`, metadata);

    } catch (error) {
      console.error('❌ Failed to record usage:', error);
    }
  }

  // Private helper methods
  private async getTwitterDailyUsage(date: string): Promise<number> {
    try {
      const { data } = await supabaseClient.client
        .from('tweets')
        .select('*')
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting Twitter daily usage:', error);
      return 0;
    }
  }

  private async getTwitterMonthlyUsage(month: string): Promise<number> {
    try {
      const { data } = await supabaseClient.client
        .from('tweets')
        .select('*')
        .gte('created_at', month + '-01T00:00:00')
        .lte('created_at', month + '-31T23:59:59');
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting Twitter monthly usage:', error);
      return 0;
    }
  }

  private async getNewsApiDailyUsage(date: string): Promise<number> {
    try {
      const { data } = await supabaseClient.client
        .from('bot_usage_tracking')
        .select('*')
        .eq('action', 'news')
        .eq('date', date);
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting News API daily usage:', error);
      return 0;
    }
  }

  private async getNewsApiMonthlyUsage(month: string): Promise<number> {
    try {
      const { data } = await supabaseClient.client
        .from('bot_usage_tracking')
        .select('*')
        .eq('action', 'news')
        .gte('date', month + '-01')
        .lte('date', month + '-31');
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting News API monthly usage:', error);
      return 0;
    }
  }

  private async getPexelsHourlyUsage(hour: Date): Promise<number> {
    try {
      const hourStart = hour.toISOString();
      const hourEnd = new Date(hour.getTime() + 60 * 60 * 1000).toISOString();
      
      const { data } = await supabaseClient.client
        .from('bot_usage_tracking')
        .select('*')
        .eq('action', 'image')
        .gte('timestamp', hourStart)
        .lte('timestamp', hourEnd);
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting Pexels hourly usage:', error);
      return 0;
    }
  }

  private async getPexelsMonthlyUsage(month: string): Promise<number> {
    try {
      const { data } = await supabaseClient.client
        .from('bot_usage_tracking')
        .select('*')
        .eq('action', 'image')
        .gte('date', month + '-01')
        .lte('date', month + '-31');
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting Pexels monthly usage:', error);
      return 0;
    }
  }

  private async getOpenAiDailyUsage(date: string): Promise<{ requests: number; tokens: number; cost: number }> {
    try {
      const { data } = await supabaseClient.client
        .from('bot_usage_tracking')
        .select('*')
        .eq('action', 'openai')
        .eq('date', date);
      
      if (!data || data.length === 0) {
        return { requests: 0, tokens: 0, cost: 0 };
      }

      const requests = data.length;
      const tokens = data.reduce((sum, item) => sum + (item.metadata?.tokens || 0), 0);
      const cost = data.reduce((sum, item) => sum + (item.metadata?.cost || 0), 0);

      return { requests, tokens, cost };
    } catch (error) {
      console.error('Error getting OpenAI daily usage:', error);
      return { requests: 0, tokens: 0, cost: 0 };
    }
  }

  private async getOpenAiMonthlyUsage(month: string): Promise<{ requests: number; tokens: number; cost: number }> {
    try {
      const { data } = await supabaseClient.client
        .from('bot_usage_tracking')
        .select('*')
        .eq('action', 'openai')
        .gte('date', month + '-01')
        .lte('date', month + '-31');
      
      if (!data || data.length === 0) {
        return { requests: 0, tokens: 0, cost: 0 };
      }

      const requests = data.length;
      const tokens = data.reduce((sum, item) => sum + (item.metadata?.tokens || 0), 0);
      const cost = data.reduce((sum, item) => sum + (item.metadata?.cost || 0), 0);

      return { requests, tokens, cost };
    } catch (error) {
      console.error('Error getting OpenAI monthly usage:', error);
      return { requests: 0, tokens: 0, cost: 0 };
    }
  }

  private async updateApiUsageTracking(api: string, count: number, cost: number = 0): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if entry exists for today
      const { data: existing } = await supabaseClient.client
        .from('api_usage_tracking')
        .select('*')
        .eq('date', today)
        .eq('api_type', api)
        .single();

      if (existing) {
        // Update existing
        await supabaseClient.client
          .from('api_usage_tracking')
          .update({
            count: existing.count + count,
            cost: existing.cost + cost,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new
        await supabaseClient.client
          .from('api_usage_tracking')
          .insert({
            date: today,
            api_type: api,
            count,
            cost
          });
      }
    } catch (error) {
      console.error('Error updating API usage tracking:', error);
    }
  }

  private getTimeUntilReset(resetTime: Date): number {
    return Math.ceil((resetTime.getTime() - Date.now()) / (1000 * 60)); // Minutes
  }

  private getTimeUntilTomorrow(): number {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60)); // Minutes
  }

  private getConservativeFallback(): UsageStats {
    const now = new Date();
    return {
      twitter: {
        daily: { used: 17, limit: 17, remaining: 0 },
        monthly: { used: 500, limit: 500, remaining: 0 },
        lastReset: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      },
      newsApi: {
        daily: { used: 100, limit: 100, remaining: 0 },
        monthly: { used: 1000, limit: 1000, remaining: 0 },
        lastReset: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      },
      pexels: {
        hourly: { used: 200, limit: 200, remaining: 0 },
        monthly: { used: 20000, limit: 20000, remaining: 0 },
        lastReset: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      },
      openai: {
        daily: { requests: 1000, tokens: 50000, cost: 5.0 },
        monthly: { requests: 30000, tokens: 1500000, cost: 150.0 }
      }
    };
  }
}

export const selfTrackingAgent = new SelfTrackingAgent();`;

    // Write the self-tracking agent
    const agentPath = path.join(__dirname, 'src/utils/selfTrackingAgent.ts');
    fs.writeFileSync(agentPath, selfTrackingAgent);

    // Create the database schema for tracking
    const trackingSchema = `
-- Bot usage tracking table
CREATE TABLE IF NOT EXISTS bot_usage_tracking (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL, -- 'tweet', 'news', 'image', 'openai'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API usage tracking table (enhanced)
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  api_type VARCHAR(50) NOT NULL, -- 'twitter', 'news_api', 'pexels', 'openai'
  count INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, api_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_usage_tracking_action_date ON bot_usage_tracking(action, date);
CREATE INDEX IF NOT EXISTS idx_bot_usage_tracking_timestamp ON bot_usage_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date_api ON api_usage_tracking(date, api_type);

-- Add tracking function
CREATE OR REPLACE FUNCTION update_api_usage_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_usage_tracking (date, api_type, count)
  VALUES (CURRENT_DATE, 'twitter', 1)
  ON CONFLICT (date, api_type)
  DO UPDATE SET 
    count = api_usage_tracking.count + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tweets table
DROP TRIGGER IF EXISTS trigger_update_api_usage ON tweets;
CREATE TRIGGER trigger_update_api_usage
  AFTER INSERT ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_tracking();`;

    const schemaPath = path.join(__dirname, 'supabase/self_tracking_schema.sql');
    fs.writeFileSync(schemaPath, trackingSchema);

    console.log('✅ Self-tracking agent created');
    console.log('✅ Database schema created');

    console.log('\n🎉 COMPREHENSIVE SELF-TRACKING SYSTEM CREATED');
    console.log('==============================================');
    console.log('✅ Self-tracking agent with FREE TIER limits');
    console.log('✅ Database schema for usage tracking');
    console.log('✅ Bot will now track its own usage internally');
    
    console.log('\n🎯 FEATURES:');
    console.log('- 📱 Twitter: Tracks own tweets (17/day limit)');
    console.log('- 📰 News API: Tracks requests (100/day, 1000/month)');
    console.log('- 📸 Pexels: Tracks requests (200/hour, 20,000/month)');
    console.log('- 🧠 OpenAI: Tracks requests and costs');
    console.log('- 🛡️ Smart prevention: Stops before hitting limits');
    console.log('- 📊 Real-time monitoring: Always knows current usage');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Run the database schema: supabase/self_tracking_schema.sql');
    console.log('2. Deploy the updated system');
    console.log('3. Bot will start tracking its own usage');
    console.log('4. No more reliance on external API headers');

  } catch (error) {
    console.error('❌ Failed to create self-tracking system:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createComprehensiveSelfTrackingSystem()
    .then(() => {
      console.log('\n✅ Comprehensive self-tracking system created successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed to create self-tracking system:', error);
      process.exit(1);
    });
}

module.exports = { createComprehensiveSelfTrackingSystem }; 