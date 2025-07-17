/**
 * 🔥 ADDICTION INTEGRATION AGENT
 * =============================
 * 
 * Integrates the addiction viral engine with existing posting agents
 * Overrides emergency modes and enables dynamic posting based on engagement
 */

import { addictionViralEngine } from './addictionViralEngine';
import { viralThemeEngine } from './viralThemeEngine';
import { supabase } from '../utils/supabaseClient';

export class AddictionIntegrationAgent {
  private isActive: boolean = false;
  private lastCheck: Date = new Date();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('🔥 Addiction Integration Agent starting...');
    
    try {
      // Check if addiction system is active
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'ADDICTION_SYSTEM_ACTIVE')
        .single();

      this.isActive = data?.value === 'true';
      
      if (this.isActive) {
        console.log('✅ Addiction Integration Agent ACTIVE - overriding emergency restrictions');
        await this.overrideEmergencyModes();
      } else {
        console.log('⚠️ Addiction Integration Agent inactive');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Addiction Integration Agent:', error);
    }
  }

  /**
   * 🚨 Override all emergency modes for viral operation
   */
  private async overrideEmergencyModes(): Promise<void> {
    const overrides = [
      { key: 'emergency_mode', value: 'false' },
      { key: 'enable_emergency_mode', value: 'false' },
      { key: 'EMERGENCY_MODE', value: 'false' },
      { key: 'ENABLE_EMERGENCY_MODE', value: 'false' },
      { key: 'live_posting_enabled', value: 'true' },
      { key: 'LIVE_POSTING_ENABLED', value: 'true' },
      { key: 'dry_run_mode', value: 'false' },
      { key: 'DRY_RUN_MODE', value: 'false' }
    ];

    for (const override of overrides) {
      await supabase.from('bot_config').upsert(override);
    }

    console.log('🔥 Emergency mode overrides applied for addiction system');
  }

  /**
   * 🎯 Get posting decision from addiction engine
   */
  public async shouldPostNow(): Promise<boolean> {
    if (!this.isActive) {
      return false; // Normal system behavior
    }

    // Let addiction engine decide
    return addictionViralEngine.shouldPostNow();
  }

  /**
   * 📊 Get dynamic posting frequency
   */
  public async getTodaysPostingTarget(): Promise<number> {
    if (!this.isActive) {
      return 8; // Default posting frequency
    }

    return addictionViralEngine.getDynamicPostingFrequency();
  }

  /**
   * 🎪 Generate addictive themed content
   */
  public async generateContent(topic?: string): Promise<string> {
    if (!this.isActive) {
      throw new Error('Addiction system not active');
    }

    try {
      // Get today's posting target for theme planning
      const todayTarget = await this.getTodaysPostingTarget();
      
      // Generate daily theme plan if not exists
      const dailyPlan = viralThemeEngine.getDailyPlan();
      if (dailyPlan.length === 0) {
        await viralThemeEngine.generateDailyThemePlan(todayTarget);
      }
      
      // Get current post index (based on posts made today)
      const postsToday = await this.getPostsMadeToday();
      const planIndex = Math.min(postsToday, dailyPlan.length - 1);
      
      // Generate themed content
      const themedContent = await viralThemeEngine.generateThemedContent(planIndex, topic);
      
      console.log(`🎨 Generated themed content (index ${planIndex}): ${themedContent.substring(0, 100)}...`);
      
      return themedContent;
    } catch (error) {
      console.error('❌ Theme content generation failed, falling back to addiction engine:', error);
      return addictionViralEngine.generateAddictiveContent(topic);
    }
  }

  private async getPostsMadeToday(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('tweets')
        .select('id')
        .gte('created_at', today + 'T00:00:00.000Z')
        .lt('created_at', today + 'T23:59:59.999Z');
      
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting posts made today:', error);
      return 0;
    }
  }

  /**
   * ⚡ Get next posting time based on addiction psychology
   */
  public getNextPostingTime(): Date {
    if (!this.isActive) {
      // Default: next hour
      return new Date(Date.now() + 60 * 60 * 1000);
    }

    return addictionViralEngine.getNextPostingTime();
  }

  /**
   * 🧠 Trigger learning update
   */
  public async performLearningUpdate(): Promise<void> {
    if (!this.isActive) return;

    await addictionViralEngine.performLearningUpdate();
  }

  /**
   * 📈 Check if system should boost posting frequency
   */
  public async checkForViralMomentum(): Promise<{ shouldBoost: boolean; newTarget: number }> {
    if (!this.isActive) {
      return { shouldBoost: false, newTarget: 8 };
    }

    const currentTarget = await this.getTodaysPostingTarget();
    const baseTarget = 8;

    return {
      shouldBoost: currentTarget > baseTarget,
      newTarget: currentTarget
    };
  }

  /**
   * 🔍 Get system status for monitoring
   */
  public async getStatus(): Promise<{
    active: boolean;
    nextPosting: Date;
    todayTarget: number;
    momentumDetected: boolean;
  }> {
    const nextPosting = this.getNextPostingTime();
    const todayTarget = await this.getTodaysPostingTarget();
    const momentum = await this.checkForViralMomentum();

    return {
      active: this.isActive,
      nextPosting,
      todayTarget,
      momentumDetected: momentum.shouldBoost
    };
  }

  /**
   * 🚀 Force activation (override all restrictions)
   */
  public async forceActivation(): Promise<void> {
    console.log('🚨 FORCE ACTIVATING ADDICTION SYSTEM');
    
    await supabase.from('bot_config').upsert({
      key: 'ADDICTION_SYSTEM_ACTIVE',
      value: 'true',
      description: 'Force activation of addiction viral system'
    });

    this.isActive = true;
    await this.overrideEmergencyModes();
    
    console.log('✅ Addiction system force activated');
  }
}

// Export singleton instance
export const addictionIntegrationAgent = new AddictionIntegrationAgent(); 