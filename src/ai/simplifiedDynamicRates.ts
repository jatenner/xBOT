/**
 * 🎯 SIMPLIFIED DYNAMIC RATE CONTROLLER
 * 
 * A lightweight version that works with the current system architecture
 * - Uses existing database tables and patterns
 * - Provides basic rate adjustment based on simple performance metrics
 * - Integrates cleanly with the current job system
 */

export interface SimpleRateRecommendation {
  posts_per_hour: number;
  replies_per_hour: number;
  confidence: number;
  reasoning: string;
}

export class SimplifiedDynamicRates {
  private static instance: SimplifiedDynamicRates;

  private constructor() {}

  public static getInstance(): SimplifiedDynamicRates {
    if (!SimplifiedDynamicRates.instance) {
      SimplifiedDynamicRates.instance = new SimplifiedDynamicRates();
    }
    return SimplifiedDynamicRates.instance;
  }

  /**
   * Get recommended rates based on simple heuristics
   */
  public async getRecommendedRates(): Promise<SimpleRateRecommendation> {
    console.log('🎯 SIMPLIFIED_DYNAMIC: Calculating optimal rates...');

    try {
      // Get current time and basic metrics
      const currentHour = new Date().getHours();
      const isActiveTime = currentHour >= 9 && currentHour <= 21; // 9 AM to 9 PM

      // Base rates
      let postsPerHour = 2;
      let repliesPerHour = 3;
      let reasoning = 'Using baseline rates';

      // Time-based adjustments
      if (isActiveTime) {
        postsPerHour = Math.min(3, postsPerHour + 1);
        repliesPerHour = Math.min(4, repliesPerHour + 1);
        reasoning = 'Peak hours - increased activity';
      } else {
        postsPerHour = Math.max(1, postsPerHour - 1);
        repliesPerHour = Math.max(2, repliesPerHour - 1);
        reasoning = 'Off-peak hours - reduced activity';
      }

      // Weekend adjustments
      const isWeekend = [0, 6].includes(new Date().getDay());
      if (isWeekend) {
        repliesPerHour = Math.min(5, repliesPerHour + 1);
        reasoning += ' + weekend boost for replies';
      }

      const recommendation: SimpleRateRecommendation = {
        posts_per_hour: postsPerHour,
        replies_per_hour: repliesPerHour,
        confidence: 0.8,
        reasoning
      };

      console.log(`✅ SIMPLIFIED_DYNAMIC: Recommended ${postsPerHour}p/h, ${repliesPerHour}r/h - ${reasoning}`);
      return recommendation;

    } catch (error: any) {
      console.error('❌ SIMPLIFIED_DYNAMIC: Error calculating rates:', error.message);
      return {
        posts_per_hour: 2,
        replies_per_hour: 3,
        confidence: 0.3,
        reasoning: 'Error - using fallback rates'
      };
    }
  }

  /**
   * Apply the recommended rates to the system
   */
  public async applyRecommendedRates(): Promise<{
    applied: boolean;
    rates: SimpleRateRecommendation;
    message: string;
  }> {
    try {
      const recommendation = await this.getRecommendedRates();

      if (recommendation.confidence < 0.5) {
        return {
          applied: false,
          rates: recommendation,
          message: 'Low confidence - rates not applied'
        };
      }

      // Update environment variables for this session
      process.env.MAX_POSTS_PER_HOUR = recommendation.posts_per_hour.toString();
      process.env.REPLY_MAX_PER_DAY = (recommendation.replies_per_hour * 24).toString();
      process.env.REPLY_MINUTES_BETWEEN = Math.floor(60 / recommendation.replies_per_hour).toString();

      console.log(`🎯 SIMPLIFIED_DYNAMIC: Applied rates - ${recommendation.posts_per_hour}p/h, ${recommendation.replies_per_hour}r/h`);

      return {
        applied: true,
        rates: recommendation,
        message: `Rates updated: ${recommendation.posts_per_hour}p/h, ${recommendation.replies_per_hour}r/h`
      };

    } catch (error: any) {
      console.error('❌ SIMPLIFIED_DYNAMIC: Error applying rates:', error.message);
      return {
        applied: false,
        rates: { posts_per_hour: 2, replies_per_hour: 3, confidence: 0, reasoning: 'Error occurred' },
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Get current status
   */
  public getCurrentStatus(): {
    current_rates: { posts_per_hour: number; replies_per_hour: number };
    last_update: string;
    system_info: { active_hours: string; weekend_boost: boolean };
  } {
    const currentHour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());

    return {
      current_rates: {
        posts_per_hour: parseInt(process.env.MAX_POSTS_PER_HOUR || '1', 10),
        replies_per_hour: Math.ceil(parseInt(process.env.REPLY_MAX_PER_DAY || '72', 10) / 24)
      },
      last_update: new Date().toISOString(),
      system_info: {
        active_hours: '9 AM - 9 PM',
        weekend_boost: isWeekend
      }
    };
  }
}
