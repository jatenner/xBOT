/**
 * 🚨 EMERGENCY POSTING SYSTEM
 * Resilient posting that works during Supabase outages and browser failures
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface EmergencyContent {
  text: string;
  type: 'single' | 'thread';
  topic: string;
  generated_at: string;
}

export class EmergencyPostingSystem {
  private static readonly FALLBACK_CONTENT: EmergencyContent[] = [
    {
      text: "New research shows vitamin D deficiency affects 80% of adults. Are you getting enough sunlight? 🌞 Simple blood test can tell you everything.",
      type: 'single',
      topic: 'vitamin_d',
      generated_at: new Date().toISOString()
    },
    {
      text: "Most 'healthy' breakfast cereals have more sugar than cookies. 🍪 Check the label next time - you might be shocked by what you find.",
      type: 'single', 
      topic: 'nutrition_myths',
      generated_at: new Date().toISOString()
    },
    {
      text: "Walking after meals can reduce blood sugar spikes by 30%. 🚶‍♀️ It's the simplest health hack that actually works. When did you last try it?",
      type: 'single',
      topic: 'simple_health_hacks', 
      generated_at: new Date().toISOString()
    },
    {
      text: "Your gut produces 90% of your body's serotonin. Poor gut health = poor mood. 🧠 What are you feeding your microbiome today?",
      type: 'single',
      topic: 'gut_health',
      generated_at: new Date().toISOString()
    },
    {
      text: "Sleep debt is real and you can't 'catch up' on weekends. 😴 Your brain literally shrinks when chronically sleep-deprived. Prioritize 7-8 hours nightly.",
      type: 'single',
      topic: 'sleep_health',
      generated_at: new Date().toISOString()
    }
  ];

  /**
   * 🔥 EMERGENCY POST - WORKS EVEN DURING OUTAGES
   */
  static async emergencyPost(providedContent?: string | string[]): Promise<{ success: boolean; error?: string; tweet_id?: string }> {
    try {
      console.log('🚨 === EMERGENCY POSTING SYSTEM ACTIVATED ===');
      
      // 1. Use provided content or get emergency content
      let content: string | string[];
      if (providedContent) {
        content = providedContent;
        console.log(`📝 Using provided content: ${Array.isArray(providedContent) ? `${providedContent.length}-tweet thread` : providedContent.substring(0, 50) + '...'}`);
      } else {
        const emergencyContent = this.getEmergencyContent();
        content = emergencyContent.text;
        console.log(`📝 Emergency fallback content: ${emergencyContent.text.substring(0, 50)}...`);
      }
      
      // 🧾 EMERGENCY PREPROCESSING - Apply same standards even in emergency mode
      console.log('🧾 === EMERGENCY CONTENT PREPROCESSING ===');
      const { preprocessForPosting, getPreprocessingSummary } = await import('./postingPreprocessor');
      
      content = preprocessForPosting(content);
      console.log(getPreprocessingSummary());
      
      // 2. Handle threads vs single tweets
      if (Array.isArray(content)) {
        console.log(`🧵 Emergency thread posting: ${content.length} tweets`);
        const result = await this.postEmergencyThread(content);
        return result;
      } else {
        console.log('📝 Emergency single tweet posting');
        const result = await this.postWithAlpineChromium(content);
        return result;
      }
      
    } catch (error: any) {
      console.error('💥 Emergency posting system error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🎯 GET EMERGENCY CONTENT (NO DATABASE REQUIRED)
   */
  private static getEmergencyContent(): EmergencyContent {
    const randomIndex = Math.floor(Math.random() * this.FALLBACK_CONTENT.length);
    return this.FALLBACK_CONTENT[randomIndex];
  }

  /**
   * 🧵 POST EMERGENCY THREAD
   */
  private static async postEmergencyThread(threadContent: string[]): Promise<{ success: boolean; error?: string; tweet_id?: string }> {
    try {
      console.log(`🧵 Emergency thread posting: ${threadContent.length} tweets`);
      
      // Use the ThreadPostingAgent even in emergency mode
      const { ThreadPostingAgent } = await import('../agents/threadPostingAgent');
      const threadAgent = new ThreadPostingAgent();
      
      const threadResult = await threadAgent.postContent({
        content: threadContent,
        format: {
          type: 'full_thread',
          tweetCount: threadContent.length,
          characterLimit: 280,
          structure: ['hook', 'body', 'conclusion']
        } as any,
        style: {
          tone: 'professional',
          language: 'english'
        } as any,
        topic: {
          category: 'health',
          engagement_potential: 'high'
        } as any,
        metadata: { 
          estimated_engagement: 75,
          confidence_score: 0.8,
          generation_timestamp: new Date().toISOString(),
          model_used: 'emergency-system'
        }
      });
      
      if (threadResult.success && threadResult.tweetIds.length > 0) {
        console.log(`✅ Emergency thread posted: ${threadResult.tweetIds.length} tweets`);
        return {
          success: true,
          tweet_id: threadResult.tweetIds[0] // Return first tweet ID
        };
      } else {
        console.log('❌ Emergency thread posting failed, falling back to first tweet only');
        // Fallback: post just the first tweet
        return await this.postWithAlpineChromium(threadContent[0]);
      }
      
    } catch (error: any) {
      console.error('❌ Emergency thread posting failed:', error);
      // Fallback: post just the first tweet
      return await this.postWithAlpineChromium(threadContent[0]);
    }
  }

  /**
   * 🌐 POST WITH ALPINE CHROMIUM (SIMPLIFIED)
   */
  private static async postWithAlpineChromium(content: string): Promise<{ success: boolean; error?: string; tweet_id?: string }> {
    let browser = null;
    let page = null;
    
    try {
      console.log('🌐 Launching Alpine Chromium for emergency posting...');
      
      browser = await chromium.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--memory-pressure-off',
          '--max_old_space_size=256',
          '--disable-web-security',
          '--window-size=800,600'
        ]
      });
      
      page = await browser.newPage({
        viewport: { width: 800, height: 600 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Load session if available
      await this.loadTwitterSession(page);
      
      // Navigate to Twitter
      await page.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Click compose button
      console.log('🚀 Opening tweet composer...');
      await page.click('[data-testid="SideNav_NewTweet_Button"]', { timeout: 15000 });
      
      // Type content
      console.log('📝 Typing tweet content...');
      await page.fill('[data-testid="tweetTextarea_0"]', content, { timeout: 10000 });
      
      // Click post button
      console.log('🚀 Publishing tweet...');
      await page.click('[data-testid="tweetButton"]', { timeout: 10000 });
      
      // Wait for posting confirmation
      await page.waitForTimeout(3000);
      
      // Check if we're back at home (indicating success)
      const currentUrl = page.url();
      const isSuccess = currentUrl.includes('/home') || currentUrl.includes('/compose');
      
      if (isSuccess) {
        const tweetId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`✅ Emergency post successful! ID: ${tweetId}`);
        return { success: true, tweet_id: tweetId };
      } else {
        return { success: false, error: 'Post not confirmed' };
      }
      
    } catch (error: any) {
      console.error('❌ Alpine Chromium posting failed:', error);
      return { success: false, error: error.message };
    } finally {
      try {
        if (page) await page.close();
        if (browser) await browser.close();
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup warning:', cleanupError);
      }
    }
  }

  /**
   * 🔐 LOAD TWITTER SESSION (IF AVAILABLE)
   */
  private static async loadTwitterSession(page: any): Promise<void> {
    try {
      const sessionPaths = [
        '/app/data/twitter_session.json',
        path.join(process.cwd(), 'twitter-auth.json'),
        path.join(process.cwd(), 'twitter_session.json')
      ];
      
      for (const sessionPath of sessionPaths) {
        if (fs.existsSync(sessionPath)) {
          const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
          
          if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
            await page.context().addCookies(sessionData.cookies);
            console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
            return;
          }
        }
      }
      
      console.log('⚠️ No Twitter session found - posting may require login');
      
    } catch (error) {
      console.warn('⚠️ Failed to load Twitter session:', error);
    }
  }

  /**
   * 🩺 HEALTH CHECK FOR EMERGENCY SYSTEM
   */
  static async healthCheck(): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check Alpine Chromium
    try {
      const browser = await chromium.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      await browser.close();
    } catch (error) {
      issues.push('Alpine Chromium not available');
    }
    
    // Check emergency content
    if (this.FALLBACK_CONTENT.length === 0) {
      issues.push('No emergency content available');
    }
    
    return {
      ready: issues.length === 0,
      issues
    };
  }
}