/**
 * Contextual Intelligence - Time/trend/season awareness
 * 
 * Makes content decisions based on:
 * - Time of day (morning = productivity, evening = relaxation)
 * - Day of week (Monday = motivation, Friday = experiments)
 * - Season (winter = immunity, summer = outdoor fitness)
 * - Current trends (react to what's happening NOW)
 */

export interface ContextualFactors {
  timeOfDay: 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  season: 'spring' | 'summer' | 'fall' | 'winter';
  isWeekend: boolean;
  currentHour: number;
}

export interface ContextualGuidance {
  recommended_topics: string[];
  recommended_tone: 'energizing' | 'calming' | 'motivating' | 'educational' | 'entertaining';
  recommended_length: 'short' | 'medium' | 'long';
  recommended_format: 'single' | 'thread' | 'both';
  reasoning: string;
}

export class ContextualIntelligence {
  private static instance: ContextualIntelligence;
  
  private constructor() {}
  
  public static getInstance(): ContextualIntelligence {
    if (!ContextualIntelligence.instance) {
      ContextualIntelligence.instance = new ContextualIntelligence();
    }
    return ContextualIntelligence.instance;
  }
  
  /**
   * Get current contextual factors
   */
  public getCurrentContext(): ContextualFactors {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const month = now.getMonth(); // 0 = January, 11 = December
    
    // Determine time of day
    let timeOfDay: ContextualFactors['timeOfDay'];
    if (hour >= 5 && hour < 7) timeOfDay = 'early_morning';
    else if (hour >= 7 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 14) timeOfDay = 'midday';
    else if (hour >= 14 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    // Determine day of week
    const dayNames: ContextualFactors['dayOfWeek'][] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    ];
    const dayOfWeek = dayNames[day];
    
    // Determine season (Northern Hemisphere)
    let season: ContextualFactors['season'];
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'fall';
    else season = 'winter';
    
    const isWeekend = day === 0 || day === 6;
    
    return {
      timeOfDay,
      dayOfWeek,
      season,
      isWeekend,
      currentHour: hour
    };
  }
  
  /**
   * Get contextual guidance for content generation
   */
  public getContextualGuidance(): ContextualGuidance {
    const context = this.getCurrentContext();
    
    console.log(`[CONTEXT] 📅 ${context.dayOfWeek}, ${context.timeOfDay}, ${context.season}`);
    
    // Time-based recommendations
    let guidance: ContextualGuidance;
    
    // MORNING (7am-12pm) - Energy, productivity, fresh starts
    if (context.timeOfDay === 'morning' || context.timeOfDay === 'early_morning') {
      guidance = {
        recommended_topics: [
          'morning routines',
          'productivity hacks',
          'coffee and caffeine science',
          'fasting and breakfast',
          'morning exercise benefits',
          'focus and attention'
        ],
        recommended_tone: 'energizing',
        recommended_length: 'short',
        recommended_format: 'single',
        reasoning: 'Morning: People want quick, energizing content before work'
      };
    }
    
    // MIDDAY (12pm-2pm) - Quick tips, breaks, nutrition
    else if (context.timeOfDay === 'midday') {
      guidance = {
        recommended_topics: [
          'lunch nutrition',
          'afternoon energy slumps',
          'walking benefits',
          'mental breaks',
          'hydration science',
          'quick health hacks'
        ],
        recommended_tone: 'educational',
        recommended_length: 'short',
        recommended_format: 'single',
        reasoning: 'Midday: Quick consumption during lunch break'
      };
    }
    
    // AFTERNOON (2pm-6pm) - Deep dives, learning, discovery
    else if (context.timeOfDay === 'afternoon') {
      guidance = {
        recommended_topics: [
          'productivity optimization',
          'study breakdowns',
          'deep health topics',
          'biohacking protocols',
          'science discoveries',
          'focus techniques'
        ],
        recommended_tone: 'educational',
        recommended_length: 'medium',
        recommended_format: 'both',
        reasoning: 'Afternoon: People have time for deeper content'
      };
    }
    
    // EVENING (6pm-10pm) - Relaxation, wind-down, threads
    else if (context.timeOfDay === 'evening') {
      guidance = {
        recommended_topics: [
          'sleep optimization',
          'stress management',
          'evening routines',
          'meal timing',
          'recovery strategies',
          'longevity practices'
        ],
        recommended_tone: 'calming',
        recommended_length: 'long',
        recommended_format: 'thread',
        reasoning: 'Evening: People have time for threads and deep content'
      };
    }
    
    // NIGHT (10pm+) - Minimal posting, calming content if needed
    else {
      guidance = {
        recommended_topics: [
          'sleep science',
          'circadian rhythms',
          'night shift health',
          'insomnia solutions',
          'meditation science'
        ],
        recommended_tone: 'calming',
        recommended_length: 'short',
        recommended_format: 'single',
        reasoning: 'Night: Minimal posting, focus on sleep-related content'
      };
    }
    
    // Day-specific adjustments
    if (context.dayOfWeek === 'monday') {
      guidance.recommended_tone = 'motivating';
      guidance.recommended_topics = [
        'fresh start strategies',
        'motivation science',
        'goal setting',
        ...guidance.recommended_topics
      ];
      guidance.reasoning += ' | Monday: Motivational content performs well';
    }
    
    if (context.dayOfWeek === 'friday' || context.isWeekend) {
      guidance.recommended_topics = [
        'weekend experiments',
        'self-experimentation',
        'new protocols to try',
        'biohacking challenges',
        ...guidance.recommended_topics
      ];
      guidance.reasoning += ' | Weekend: Experimental content works well';
    }
    
    // Season-specific adjustments
    if (context.season === 'winter') {
      guidance.recommended_topics = [
        'immune system optimization',
        'vitamin D importance',
        'cold exposure benefits',
        'seasonal affective disorder',
        ...guidance.recommended_topics
      ];
    } else if (context.season === 'summer') {
      guidance.recommended_topics = [
        'heat adaptation',
        'outdoor exercise benefits',
        'sun exposure and health',
        'hydration optimization',
        ...guidance.recommended_topics
      ];
    }
    
    return guidance;
  }
  
  /**
   * Should we post right now? (Avoid dead hours)
   */
  public shouldPostNow(): { should: boolean; reason: string } {
    const context = this.getCurrentContext();
    
    // Dead zone: 2am - 6am
    if (context.currentHour >= 2 && context.currentHour < 6) {
      return {
        should: false,
        reason: 'Dead hours: 2am-6am has minimal engagement'
      };
    }
    
    // All other times are good
    return {
      should: true,
      reason: 'Optimal posting window'
    };
  }
}

export const getContextualIntelligence = () => ContextualIntelligence.getInstance();

