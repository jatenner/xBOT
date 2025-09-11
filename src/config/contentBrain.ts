// src/config/contentBrain.ts - Health-First Content Brain Configuration
import { safeLog } from '../utils/redact';

export interface ContentBrainConfig {
  budget: {
    daily_limit_usd: number;
    smooth_pacing: {
      max_early_spend_pct: number;
      active_window_hours: number;
    };
    cost_tracking: {
      log_every_call: boolean;
      table: string;
      degrade_threshold: number;
    };
  };
  posting: {
    cadence: {
      target_posts_per_day: [number, number];
      target_replies_per_day: [number, number];
      min_post_interval_minutes: number;
      max_posts_per_hour: number;
    };
    formats: {
      single: { max_chars: number; weight: number };
      thread: { length_range: [number, number]; weight: number };
      reply: { 
        weight: number;
        modes: {
          explanation: number;
          actionable: number;
          clarification: number;
          contrarian: number;
        };
      };
    };
  };
  topics: {
    health_core: string[];
    health_adjacent: string[];
    blacklist: string[];
    trending_integration: {
      enabled: boolean;
      quality_gate_threshold: number;
    };
  };
  quality_gates: {
    regret_checker: {
      required_checks: string[];
      confidence_threshold: number;
      reframe_as_question_if_uncertain: boolean;
    };
  };
  learning: {
    bandit: {
      algorithm: string;
      exploit_ratio: number;
      explore_ratio: number;
      update_frequency_hours: number;
      metrics_half_life_days: number;
    };
    arms: {
      dimensions: string[];
    };
    metrics: {
      primary: string;
      secondary: string[];
      backfill_frequency_minutes: number;
    };
  };
  style: {
    hashtags: string;
    emojis: string;
    tone: string;
    citations: string;
  };
}

// Default configuration for health-first content brain
export const DEFAULT_CONTENT_BRAIN_CONFIG: ContentBrainConfig = {
  budget: {
    daily_limit_usd: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0'),
    smooth_pacing: {
      max_early_spend_pct: 35,
      active_window_hours: 16
    },
    cost_tracking: {
      log_every_call: true,
      table: 'api_usage',
      degrade_threshold: 0.8
    }
  },
  posting: {
    cadence: {
      target_posts_per_day: [10, 25],
      target_replies_per_day: [20, 40],
      min_post_interval_minutes: parseInt(process.env.MIN_POST_INTERVAL_MINUTES || '45'),
      max_posts_per_hour: parseInt(process.env.MAX_POSTS_PER_HOUR || '3')
    },
    formats: {
      single: { max_chars: 279, weight: 0.4 },
      thread: { length_range: [5, 9], weight: 0.4 },
      reply: { 
        weight: 0.2,
        modes: {
          explanation: 0.4,
          actionable: 0.3,
          clarification: 0.2,
          contrarian: 0.1
        }
      }
    }
  },
  topics: {
    health_core: [
      'nutrition',
      'exercise',
      'sleep',
      'recovery',
      'stress_management',
      'hydration',
      'metabolism',
      'longevity',
      'mental_health',
      'preventive_care'
    ],
    health_adjacent: [
      'policy_health_relevant',
      'product_recalls',
      'insurance_updates',
      'cdc_nih_guidance',
      'research_summaries',
      'medical_breakthroughs'
    ],
    blacklist: (process.env.TOPIC_BLACKLIST || 'nsfw,conspiracy_theories,political_sniping').split(','),
    trending_integration: {
      enabled: true,
      quality_gate_threshold: 0.9
    }
  },
  quality_gates: {
    regret_checker: {
      required_checks: [
        'non_trivial_insight',
        'mechanism_or_consensus',
        'no_hallucinated_facts',
        'helpful_tone'
      ],
      confidence_threshold: 0.9,
      reframe_as_question_if_uncertain: true
    }
  },
  learning: {
    bandit: {
      algorithm: 'thompson_sampling',
      exploit_ratio: 0.7,
      explore_ratio: 0.3,
      update_frequency_hours: 3,
      metrics_half_life_days: 3
    },
    arms: {
      dimensions: ['topic', 'format', 'length_bucket', 'time_slot']
    },
    metrics: {
      primary: 'engagement_rate',
      secondary: ['likes', 'reposts', 'comments', 'bookmarks'],
      backfill_frequency_minutes: 60
    }
  },
  style: {
    hashtags: 'minimal',
    emojis: 'sparse',
    tone: 'helpful_crisp_human',
    citations: 'preferred_when_available'
  }
};

// Environment-aware configuration loader
export function loadContentBrainConfig(): ContentBrainConfig {
  const config = { ...DEFAULT_CONTENT_BRAIN_CONFIG };
  
  // Override with environment variables
  if (process.env.POSTING_DISABLED === 'true') {
    config.posting.cadence.target_posts_per_day = [0, 0];
    config.posting.cadence.target_replies_per_day = [0, 0];
    safeLog.info('📵 CONTENT_BRAIN: Posting disabled via environment variable');
  }
  
  if (process.env.BLOCK_POLITICS === 'true') {
    config.topics.blacklist.push('politics', 'partisan_content', 'political_debates');
    safeLog.info('🚫 CONTENT_BRAIN: Political content blocked');
  }
  
  if (process.env.REPLY_TOPIC_MODE === 'broad') {
    config.posting.formats.reply.weight = 0.3; // Increase reply weight
    safeLog.info('💬 CONTENT_BRAIN: Broad reply mode enabled');
  }
  
  if (process.env.ENABLE_REPLIES === 'false') {
    config.posting.formats.reply.weight = 0;
    config.posting.cadence.target_replies_per_day = [0, 0];
    safeLog.info('🔇 CONTENT_BRAIN: Replies disabled');
  }
  
  safeLog.info('🧠 CONTENT_BRAIN: Configuration loaded successfully');
  safeLog.info(`📊 Daily budget: $${config.budget.daily_limit_usd}`);
  safeLog.info(`📝 Target posts: ${config.posting.cadence.target_posts_per_day[0]}-${config.posting.cadence.target_posts_per_day[1]}`);
  safeLog.info(`💬 Target replies: ${config.posting.cadence.target_replies_per_day[0]}-${config.posting.cadence.target_replies_per_day[1]}`);
  
  return config;
}

// Bandit arm key generator
export function generateBanditArmKey(topic: string, format: string, timeSlot: string): string {
  return `${topic}:${format}:${timeSlot}`;
}

// Time slot detector
export function getCurrentTimeSlot(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// Topic validator
export function isTopicAllowed(topic: string, config: ContentBrainConfig): boolean {
  const normalizedTopic = topic.toLowerCase();
  
  // Check blacklist
  for (const blocked of config.topics.blacklist) {
    if (normalizedTopic.includes(blocked.toLowerCase())) {
      return false;
    }
  }
  
  // Check if it's a core health topic
  const isHealthCore = config.topics.health_core.some(ht => 
    normalizedTopic.includes(ht.toLowerCase())
  );
  
  // Check if it's health-adjacent
  const isHealthAdjacent = config.topics.health_adjacent.some(ha => 
    normalizedTopic.includes(ha.toLowerCase())
  );
  
  return isHealthCore || isHealthAdjacent;
}

// Budget checker
export function canAffordOperation(costUsd: number, config: ContentBrainConfig): boolean {
  // This would check against daily spend tracking
  // Implementation depends on database integration
  return costUsd <= config.budget.daily_limit_usd;
}

// Export singleton instance
let configInstance: ContentBrainConfig | null = null;

export function getContentBrainConfig(): ContentBrainConfig {
  if (!configInstance) {
    configInstance = loadContentBrainConfig();
  }
  return configInstance;
}
