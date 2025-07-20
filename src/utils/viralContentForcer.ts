import { supabaseClient } from './supabaseClient';

/**
 * 🔥 VIRAL CONTENT FORCER
 * 
 * Forces ALL content to be viral, engaging, and follower-growth optimized
 * instead of academic and boring. This is the nuclear solution to engagement issues.
 */
export class ViralContentForcer {
  
  /**
   * 🚨 EMERGENCY VIRAL OVERRIDE
   * Forces the system to prioritize viral content over academic content
   */
  static async activateViralOverride(postsRemaining: number = 50): Promise<boolean> {
    try {
      console.log('🚨 ACTIVATING EMERGENCY VIRAL OVERRIDE...');
      console.log(`🔥 Forcing ${postsRemaining} viral posts to fix engagement`);

      // Set emergency viral override in database
      const { error } = await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'emergency_viral_override',
          value: {
            enabled: true,
            posts_remaining: postsRemaining,
            activated_at: new Date().toISOString(),
            reason: 'Fix academic content - force viral engagement'
          },
          description: 'Emergency override to force viral content generation'
        });

      if (error) {
        console.error('❌ Failed to activate viral override:', error);
        return false;
      }

      // Also block academic content
      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'block_academic_content',
          value: {
            enabled: true,
            activated_at: new Date().toISOString()
          },
          description: 'Block boring academic content'
        });

      // Enable viral follower growth agent
      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'viral_follower_growth_agent_enabled',
          value: {
            enabled: true,
            force_active: true,
            activated_at: new Date().toISOString()
          },
          description: 'Force viral follower growth agent active'
        });

      console.log('✅ VIRAL OVERRIDE ACTIVATED!');
      console.log('🔥 All future posts will be viral and engaging');
      console.log('🚫 Academic content has been blocked');
      console.log('📈 Follower growth mode enabled');

      return true;

    } catch (error) {
      console.error('❌ Failed to activate viral override:', error);
      return false;
    }
  }

  /**
   * 🎯 FORCE VIRAL CONTENT SELECTION
   * Override content mode selection to always choose viral options
   */
  static forceViralContentMode(): 'viral' | 'human_expert' | 'engagement' {
    const viralModes = ['viral', 'human_expert', 'engagement'];
    const weights = [70, 20, 10]; // 70% viral, 20% human expert, 10% engagement
    
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < viralModes.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        console.log(`🎯 FORCED VIRAL MODE: ${viralModes[i]}`);
        return viralModes[i] as 'viral' | 'human_expert' | 'engagement';
      }
    }
    
    return 'viral'; // Default to viral
  }

  /**
   * 💡 VIRAL CONTENT ENHANCEMENT
   * Take any content and make it more viral and engaging
   */
  static enhanceContentForViral(content: string): string {
    let enhanced = content;

    // Remove academic language
    enhanced = enhanced
      .replace(/Studies show that/gi, '')
      .replace(/Research indicates/gi, '')
      .replace(/According to/gi, '')
      .replace(/Therefore/gi, '')
      .replace(/Furthermore/gi, '')
      .replace(/Moreover/gi, '')
      .replace(/In conclusion/gi, '');

    // Add viral hooks at the beginning
    const viralHooks = [
      '🚨 Hot take:',
      '🔥 Plot twist:',
      '💥 Nobody talks about this:',
      '⚡ Wild stat:',
      '🤯 Mind-blowing:',
      '🎯 Real talk:',
      '🚀 Game changer:'
    ];

    // If content doesn't start with a hook, add one
    const hasHook = viralHooks.some(hook => enhanced.toLowerCase().startsWith(hook.toLowerCase()));
    if (!hasHook) {
      const randomHook = viralHooks[Math.floor(Math.random() * viralHooks.length)];
      enhanced = `${randomHook} ${enhanced}`;
    }

    // Add engagement triggers
    if (!enhanced.includes('?') && Math.random() < 0.3) {
      enhanced += ' Thoughts?';
    }

    // Add specific numbers for credibility
    enhanced = enhanced.replace(/many/gi, '87%');
    enhanced = enhanced.replace(/most/gi, '73%');
    enhanced = enhanced.replace(/few/gi, '12%');

    // Trim to Twitter length
    if (enhanced.length > 270) {
      enhanced = enhanced.substring(0, 267) + '...';
    }

    return enhanced;
  }

  /**
   * 📊 GET VIRAL CONTENT TEMPLATES
   * Pre-written viral content templates that always perform well
   */
  static getViralTemplates(): string[] {
    return [
      "🚨 Hot take: 90% of health apps are solving the wrong problem. Here's what actually moves the needle...",
      "🔥 Plot twist: The biggest health breakthrough of 2024 isn't what you think. It's something your phone already does.",
      "💥 Nobody talks about this: Your smartwatch knows more about your health than your doctor. Here's why that's both amazing and terrifying:",
      "⚡ Wild stat: AI can detect diabetes from your voice with 89% accuracy. Your annual checkup just became obsolete.",
      "🤯 Mind-blowing: This 30-second phone test is more accurate than a $10,000 MRI for detecting early Alzheimer's.",
      "🎯 Real talk: Big Pharma spent $200B on R&D last year. A kid with ChatGPT just found a better drug target in 3 hours.",
      "🚀 Game changer: Doctors are being replaced, but not by AI. By something way more powerful...",
      "🔥 The health tech bubble is about to burst. Only 3 types of companies will survive. Are you ready?",
      "💡 Unpopular opinion: Telemedicine is making healthcare worse, not better. Here's the data nobody wants to see:",
      "⚡ BREAKING: Apple just killed the medical device industry with one simple feature. Here's what it means:",
      "🚨 Your fitness tracker is lying to you. Here's the $50B fraud nobody's talking about:",
      "🤯 This AI diagnosed my condition better than 3 specialists. Cost? $0. Time? 30 seconds.",
      "🔥 Why every doctor should be terrified of TikTok (it's not what you think):",
      "💥 The pharmaceutical industry's worst nightmare just went public. Stock prices are about to crater.",
      "⚡ Your phone camera can now detect skin cancer better than dermatologists. Here's how:"
    ];
  }

  /**
   * 🎲 GET RANDOM VIRAL CONTENT
   * Quick viral content generation for emergency use
   */
  static getRandomViralContent(): string {
    const templates = this.getViralTemplates();
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * 📈 TRACK VIRAL PERFORMANCE
   * Monitor how viral content performs vs academic content
   */
  static async trackViralPerformance(tweetId: string, contentType: 'viral' | 'academic', engagementScore: number): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('viral_performance_tracking')
        .insert({
          tweet_id: tweetId,
          content_type: contentType,
          engagement_score: engagementScore,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('⚠️ Failed to track viral performance:', error);
    }
  }

  /**
   * 🔍 CHECK VIRAL OVERRIDE STATUS
   * See if viral override is currently active
   */
  static async isViralOverrideActive(): Promise<boolean> {
    try {
      const { data } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'emergency_viral_override')
        .single() || { data: null };

      if (data?.value?.enabled && data?.value?.posts_remaining > 0) {
        console.log(`🔥 Viral override ACTIVE: ${data.value.posts_remaining} posts remaining`);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Failed to check viral override status:', error);
      return false;
    }
  }

  /**
   * 🎯 CONTENT VIRAL SCORE
   * Calculate how viral a piece of content is
   */
  static calculateViralScore(content: string): number {
    let score = 0;

    // Viral indicators
    const viralWords = ['hot take', 'plot twist', 'nobody talks', 'wild stat', 'mind-blowing', 'game changer', 'breaking'];
    viralWords.forEach(word => {
      if (content.toLowerCase().includes(word)) score += 15;
    });

    // Engagement triggers
    if (content.includes('?')) score += 10;
    if (content.includes('...')) score += 5;
    if (content.includes('🚨') || content.includes('🔥') || content.includes('💥')) score += 10;

    // Specific numbers
    const numberPattern = /\d+%/g;
    const percentages = content.match(numberPattern);
    if (percentages) score += percentages.length * 5;

    // Controversy indicators
    const controversialWords = ['unpopular', 'wrong', 'lie', 'fraud', 'secret', 'terrified'];
    controversialWords.forEach(word => {
      if (content.toLowerCase().includes(word)) score += 12;
    });

    // Length optimization (punchy content performs better)
    if (content.length >= 100 && content.length <= 200) score += 10;
    else if (content.length < 100) score += 5;

    return Math.min(100, score);
  }
}

// Activate viral override immediately when this file is imported
ViralContentForcer.activateViralOverride(25).then(success => {
  if (success) {
    console.log('🚀 VIRAL CONTENT FORCER: Emergency override activated');
  }
}).catch(error => {
  console.warn('⚠️ VIRAL CONTENT FORCER: Failed to activate override:', error);
}); 