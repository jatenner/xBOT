/**
 * 🎨 STYLE MIXER
 * 
 * Adds varied tones and personality to tweets to avoid robotic patterns
 */

import { secureSupabaseClient } from './secureSupabaseClient';

export const STYLE_VARIATIONS = {
  '🧠 Data-driven': {
    prefix: '🧠 Data-driven',
    hooks: ['Research shows', 'Studies indicate', 'Data reveals', 'Evidence suggests'],
    modifiers: ['based on X studies', 'in Y population', 'over Z years'],
    tone: 'analytical'
  },
  '🔥 Contrarian': {
    prefix: '🔥 Contrarian',
    hooks: ['Actually', 'Contrary to popular belief', 'Plot twist', 'Here\'s what most miss'],
    modifiers: ['but here\'s why', 'the real story is', 'what they don\'t tell you'],
    tone: 'challenging'
  },
  '💡 Quick Tip': {
    prefix: '💡 Quick Tip',
    hooks: ['Pro tip', 'Quick hack', 'Simple truth', 'Easy win'],
    modifiers: ['that works instantly', 'most people ignore', 'backed by science'],
    tone: 'helpful'
  },
  '📝 Mini-Story': {
    prefix: '📝 Mini-Story',
    hooks: ['True story', 'Just happened', 'Real talk', 'Patient case'],
    modifiers: ['that changed everything', 'nobody talks about', 'worth sharing'],
    tone: 'narrative'
  },
  '📊 Research Reveal': {
    prefix: '📊 Research Reveal',
    hooks: ['New study', 'Breaking research', 'Just published', 'Meta-analysis finds'],
    modifiers: ['challenges assumptions', 'confirms what we suspected', 'changes the game'],
    tone: 'authoritative'
  },
  '🎯 Action-Oriented': {
    prefix: '🎯 Action-Oriented',
    hooks: ['Do this', 'Try this', 'Start here', 'Take action'],
    modifiers: ['for immediate results', 'that most skip', 'proven to work'],
    tone: 'directive'
  }
};

export type StyleLabel = keyof typeof STYLE_VARIATIONS;

export interface StyleMixResult {
  styledContent: string;
  styleUsed: StyleLabel;
  shouldUseStyle: boolean;
  reasoning: string;
  originalLength: number;
  finalLength: number;
}

export class StyleMixer {
  private static instance: StyleMixer;

  private constructor() {}

  static getInstance(): StyleMixer {
    if (!StyleMixer.instance) {
      StyleMixer.instance = new StyleMixer();
    }
    return StyleMixer.instance;
  }

  /**
   * 🎨 Apply style variation to content
   */
  async mixStyle(content: string, options: {
    forceStyle?: StyleLabel;
    maxLength?: number;
    topic?: string;
    timeOfDay?: number;
    lastStyleUsed?: StyleLabel;
  } = {}): Promise<StyleMixResult> {
    try {
      console.log(`🎨 Style mixing for: "${content.substring(0, 50)}..."`);

      // Determine if we should apply styling (30% chance normally)
      const shouldStyle = options.forceStyle || Math.random() < 0.3;
      
      if (!shouldStyle) {
        return {
          styledContent: content,
          styleUsed: '🧠 Data-driven', // Default
          shouldUseStyle: false,
          reasoning: 'Random selection chose no styling',
          originalLength: content.length,
          finalLength: content.length
        };
      }

      // Select optimal style
      const selectedStyle = await this.selectOptimalStyle(content, options);
      
      // Apply the style
      const styledContent = this.applyStyle(content, selectedStyle, options);
      
      // Update usage statistics
      await this.updateStyleUsage(selectedStyle, styledContent.length);

      console.log(`✨ Applied ${selectedStyle} style: "${styledContent}"`);

      return {
        styledContent,
        styleUsed: selectedStyle,
        shouldUseStyle: true,
        reasoning: `Applied ${selectedStyle} based on ${this.getSelectionReasoning(selectedStyle, options)}`,
        originalLength: content.length,
        finalLength: styledContent.length
      };

    } catch (error) {
      console.error('❌ Style mixing failed:', error);
      return {
        styledContent: content,
        styleUsed: '🧠 Data-driven',
        shouldUseStyle: false,
        reasoning: `Error: ${error.message}`,
        originalLength: content.length,
        finalLength: content.length
      };
    }
  }

  /**
   * 🎯 Select optimal style based on context
   */
  private async selectOptimalStyle(content: string, options: any): Promise<StyleLabel> {
    if (options.forceStyle) {
      return options.forceStyle;
    }

    // Get style performance data
    const stylePerformance = await this.getStylePerformance();
    
    // Content-based selection
    const contentBasedStyle = this.selectStyleByContent(content);
    
    // Time-based selection
    const timeBasedStyle = this.selectStyleByTime(options.timeOfDay || new Date().getHours());
    
    // Avoid recent style if specified
    const availableStyles = options.lastStyleUsed ? 
      Object.keys(STYLE_VARIATIONS).filter(s => s !== options.lastStyleUsed) as StyleLabel[] :
      Object.keys(STYLE_VARIATIONS) as StyleLabel[];

    // Weighted selection based on performance
    const weightedStyle = this.selectWeightedStyle(availableStyles, stylePerformance);

    // Priority: forced > content-based > time-based > weighted > random
    return contentBasedStyle || timeBasedStyle || weightedStyle || this.getRandomStyle(availableStyles);
  }

  /**
   * 📝 Select style based on content analysis
   */
  private selectStyleByContent(content: string): StyleLabel | null {
    const contentLower = content.toLowerCase();

    // Research/study content
    if (contentLower.includes('study') || contentLower.includes('research') || contentLower.includes('data')) {
      return '📊 Research Reveal';
    }

    // Actionable content
    if (contentLower.includes('do this') || contentLower.includes('try') || contentLower.includes('start')) {
      return '🎯 Action-Oriented';
    }

    // Contrarian content
    if (contentLower.includes('actually') || contentLower.includes('contrary') || contentLower.includes('but')) {
      return '🔥 Contrarian';
    }

    // Story content
    if (contentLower.includes('patient') || contentLower.includes('case') || contentLower.includes('story')) {
      return '📝 Mini-Story';
    }

    // Quick tips
    if (contentLower.includes('tip') || contentLower.includes('hack') || contentLower.includes('simple')) {
      return '💡 Quick Tip';
    }

    return null; // No specific match
  }

  /**
   * ⏰ Select style based on time of day
   */
  private selectStyleByTime(hour: number): StyleLabel | null {
    // Morning: Data-driven, research-focused
    if (hour >= 6 && hour < 10) {
      return '🧠 Data-driven';
    }

    // Mid-day: Action-oriented, tips
    if (hour >= 10 && hour < 14) {
      return Math.random() < 0.5 ? '🎯 Action-Oriented' : '💡 Quick Tip';
    }

    // Afternoon: Stories, research reveals
    if (hour >= 14 && hour < 18) {
      return Math.random() < 0.5 ? '📝 Mini-Story' : '📊 Research Reveal';
    }

    // Evening: Contrarian, thought-provoking
    if (hour >= 18 && hour < 22) {
      return '🔥 Contrarian';
    }

    return null; // Late night - no specific preference
  }

  /**
   * ⚖️ Select style based on performance weights
   */
  private selectWeightedStyle(availableStyles: StyleLabel[], performance: any): StyleLabel | null {
    if (!performance || Object.keys(performance).length === 0) {
      return null;
    }

    // Calculate weights based on engagement rates
    const weights: { [key: string]: number } = {};
    let totalWeight = 0;

    for (const style of availableStyles) {
      const engagement = performance[style]?.avg_engagement || 0.05; // Default 5%
      const usageBonus = Math.max(1 - (performance[style]?.usage_count || 0) / 20, 0.1); // Variety bonus
      weights[style] = engagement * usageBonus;
      totalWeight += weights[style];
    }

    // Random selection based on weights
    const random = Math.random() * totalWeight;
    let current = 0;

    for (const style of availableStyles) {
      current += weights[style];
      if (random <= current) {
        return style;
      }
    }

    return null;
  }

  /**
   * 🎲 Get random style from available options
   */
  private getRandomStyle(availableStyles: StyleLabel[]): StyleLabel {
    return availableStyles[Math.floor(Math.random() * availableStyles.length)];
  }

  /**
   * ✨ Apply selected style to content
   */
  private applyStyle(content: string, style: StyleLabel, options: any): string {
    const styleConfig = STYLE_VARIATIONS[style];
    const maxLength = options.maxLength || 280;

    // Calculate available space for prefix
    const availableSpace = maxLength - content.length - 3; // 3 chars for " • "

    if (availableSpace < 10) {
      // Not enough space for styling
      return content;
    }

    // 70% chance to use prefix, 30% chance to use modifier
    if (Math.random() < 0.7) {
      // Use prefix style
      const styledContent = `${styleConfig.prefix} • ${content}`;
      
      if (styledContent.length <= maxLength) {
        return styledContent;
      }
    }

    // Use hook-based styling if prefix doesn't fit
    const hook = styleConfig.hooks[Math.floor(Math.random() * styleConfig.hooks.length)];
    const hookStyled = `${hook}: ${content}`;
    
    if (hookStyled.length <= maxLength) {
      return hookStyled;
    }

    // Fallback: return original if styling makes it too long
    return content;
  }

  /**
   * 📊 Get style performance data from database
   */
  private async getStylePerformance(): Promise<any> {
    try {
      if (!secureSupabaseClient.supabase) {
        return {};
      }

      const { data } = await secureSupabaseClient.supabase
        .from('content_style_variations')
        .select('*');

      if (!data) {
        return {};
      }

      const performance: any = {};
      data.forEach(row => {
        performance[row.style_label] = {
          avg_engagement: row.avg_engagement,
          usage_count: row.usage_count,
          last_used: row.last_used
        };
      });

      return performance;
    } catch (error) {
      console.error('❌ Failed to get style performance:', error);
      return {};
    }
  }

  /**
   * 📈 Update style usage statistics
   */
  private async updateStyleUsage(style: StyleLabel, contentLength: number): Promise<void> {
    try {
      if (!secureSupabaseClient.supabase) {
        return;
      }

      // Get current data for calculating new average
      const { data: currentData } = await secureSupabaseClient.supabase
        .from('content_style_variations')
        .select('usage_count')
        .eq('style_label', style)
        .single();

      const newUsageCount = (currentData?.usage_count || 0) + 1;

      const { error } = await secureSupabaseClient.supabase
        .from('content_style_variations')
        .upsert({
          style_label: style,
          usage_count: newUsageCount,
          last_used: new Date().toISOString()
        }, { 
          onConflict: 'style_label' 
        });

      if (error) {
        console.error('❌ Failed to update style usage:', error);
      }
    } catch (error) {
      console.error('❌ Style usage update error:', error);
    }
  }

  /**
   * 📝 Get selection reasoning for logging
   */
  private getSelectionReasoning(style: StyleLabel, options: any): string {
    if (options.forceStyle) return 'forced selection';
    if (options.timeOfDay) return `time-based (${options.timeOfDay}h)`;
    return 'performance-weighted selection';
  }

  /**
   * 🔄 Update style engagement based on tweet performance
   */
  async updateStyleEngagement(style: StyleLabel, engagementRate: number): Promise<void> {
    try {
      if (!secureSupabaseClient.supabase) {
        return;
      }

      // Get current stats
      const { data: currentData } = await secureSupabaseClient.supabase
        .from('content_style_variations')
        .select('avg_engagement, usage_count')
        .eq('style_label', style)
        .single();

      if (!currentData) {
        console.warn(`⚠️ No data found for style: ${style}`);
        return;
      }

      // Calculate new average engagement
      const currentAvg = currentData.avg_engagement || 0;
      const usageCount = currentData.usage_count || 1;
      const newAvg = (currentAvg * (usageCount - 1) + engagementRate) / usageCount;

      const { error } = await secureSupabaseClient.supabase
        .from('content_style_variations')
        .update({ avg_engagement: newAvg })
        .eq('style_label', style);

      if (error) {
        console.error('❌ Failed to update style engagement:', error);
      } else {
        console.log(`📊 Updated ${style} engagement: ${newAvg.toFixed(3)}`);
      }
    } catch (error) {
      console.error('❌ Style engagement update error:', error);
    }
  }

  /**
   * 📊 Get style mixer statistics
   */
  async getStyleStats(): Promise<{
    styleUsage: Array<{ style: StyleLabel; usage: number; engagement: number }>;
    totalStyled: number;
    topPerformingStyle: StyleLabel | null;
    leastUsedStyle: StyleLabel | null;
  }> {
    try {
      if (!secureSupabaseClient.supabase) {
        return {
          styleUsage: [],
          totalStyled: 0,
          topPerformingStyle: null,
          leastUsedStyle: null
        };
      }

      const { data } = await secureSupabaseClient.supabase
        .from('content_style_variations')
        .select('*')
        .order('avg_engagement', { ascending: false });

      if (!data || data.length === 0) {
        return {
          styleUsage: [],
          totalStyled: 0,
          topPerformingStyle: null,
          leastUsedStyle: null
        };
      }

      const styleUsage = data.map(row => ({
        style: row.style_label as StyleLabel,
        usage: row.usage_count,
        engagement: row.avg_engagement
      }));

      const totalStyled = data.reduce((sum, row) => sum + row.usage_count, 0);
      const topPerformingStyle = data[0]?.style_label as StyleLabel || null;
      const leastUsedStyle = data
        .sort((a, b) => a.usage_count - b.usage_count)[0]?.style_label as StyleLabel || null;

      return {
        styleUsage,
        totalStyled,
        topPerformingStyle,
        leastUsedStyle
      };
    } catch (error) {
      console.error('❌ Failed to get style stats:', error);
      return {
        styleUsage: [],
        totalStyled: 0,
        topPerformingStyle: null,
        leastUsedStyle: null
      };
    }
  }
}

export const styleMixer = StyleMixer.getInstance();