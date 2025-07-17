/**
 * 🔥 ADDICTION INTEGRATION AGENT
 * =============================
 * 
 * Integrates the addiction viral engine with existing posting agents
 * Overrides emergency modes and enables dynamic posting based on engagement
 */

import { addictionViralEngine } from './addictionViralEngine';
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
   * 🎪 Generate addictive content
   */
  public async generateContent(topic?: string): Promise<string> {
    if (!this.isActive) {
      throw new Error('Addiction system not active');
    }

    return addictionViralEngine.generateAddictiveContent(topic);
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