/**
 * 🎯 FOLLOWER CONVERSION HOOKS
 * 
 * Hooks optimized for FOLLOWER CONVERSION, not just engagement.
 * Based on follower psychology: authority, controversy, transformation, exclusivity.
 */

export type HookStrategy = 'authority' | 'controversy' | 'transformation' | 'exclusivity';

export class FollowerConversionHooks {
  private static instance: FollowerConversionHooks;

  public static getInstance(): FollowerConversionHooks {
    if (!FollowerConversionHooks.instance) {
      FollowerConversionHooks.instance = new FollowerConversionHooks();
    }
    return FollowerConversionHooks.instance;
  }

  /**
   * Get hook optimized for follower conversion (not just engagement)
   * 
   * Strategy breakdown:
   * - Authority (40%): Shows expertise and investment
   * - Controversy (30%): Challenges beliefs, creates discussion
   * - Transformation (20%): Shows results and outcomes
   * - Exclusivity (10%): Insider knowledge, secret info
   */
  getFollowerHook(strategy: HookStrategy, topic: string): string {
    const hooks = {
      authority: [
        `I spent $10K learning about ${topic}. Here's what actually works:`,
        `After testing 47 ${topic} protocols, this one changed everything:`,
        `Top experts know this about ${topic} but it never makes the news:`,
        `$15K biohacking course taught me this ${topic} secret:`,
        `After 200+ client experiments with ${topic}, here's what works:`,
        `Flew to Switzerland to learn this ${topic} protocol:`,
        `3 months with Stanford researchers revealed this about ${topic}:`,
        `Elite practitioners have been using this ${topic} technique for years:`,
      ],
      controversy: [
        `Unpopular opinion: Everyone's ${topic} approach is backwards.`,
        `The ${topic} industry doesn't want you to know this:`,
        `Your doctor won't tell you this about ${topic}:`,
        `Most ${topic} advice is wrong. Here's what the data shows:`,
        `Everything you know about ${topic} is backwards:`,
        `The ${topic} myth is destroying your progress:`,
        `Stop doing ${topic} the conventional way. Here's why:`,
        `The ${topic} industry is scamming you. Here's the truth:`,
      ],
      transformation: [
        `This ${topic} protocol changed everything for me:`,
        `I went from X to Y using this ${topic} approach:`,
        `Results shocked me after trying this ${topic} method:`,
        `This ${topic} strategy reversed my condition:`,
        `This ${topic} approach gave me results in 30 days:`,
        `I tested this ${topic} protocol for 6 months. Results:`,
        `This ${topic} method transformed my health:`,
        `After 1 year of this ${topic} protocol, here's what changed:`,
      ],
      exclusivity: [
        `Only 1% of people know this about ${topic}:`,
        `Secret ${topic} protocol that researchers use:`,
        `Insider knowledge about ${topic} that's not public:`,
        `Elite practitioners have been hiding this ${topic} technique:`,
        `This ${topic} secret isn't in any book:`,
        `Researchers know this about ${topic} but it never makes headlines:`,
        `The ${topic} protocol that costs $500/hour to learn:`,
        `This ${topic} technique is only shared in private circles:`,
      ],
    };

    const strategyHooks = hooks[strategy] || hooks.authority;
    return strategyHooks[Math.floor(Math.random() * strategyHooks.length)];
  }

  /**
   * Select optimal hook strategy based on content type and context
   */
  selectOptimalStrategy(contentType: 'single' | 'thread', context?: {
    recentPerformance?: { hook: HookStrategy; followers: number }[];
    topic?: string;
  }): HookStrategy {
    // If we have performance data, use it
    if (context?.recentPerformance && context.recentPerformance.length > 0) {
      const bestPerformer = context.recentPerformance.reduce((best, current) => 
        current.followers > best.followers ? current : best
      );
      return bestPerformer.hook;
    }

    // Default strategy based on content type
    if (contentType === 'thread') {
      // Threads benefit from authority (shows expertise across multiple tweets)
      return Math.random() < 0.4 ? 'authority' :
             Math.random() < 0.7 ? 'controversy' :
             Math.random() < 0.9 ? 'transformation' : 'exclusivity';
    } else {
      // Singles benefit from controversy (quick engagement)
      return Math.random() < 0.3 ? 'authority' :
             Math.random() < 0.6 ? 'controversy' :
             Math.random() < 0.85 ? 'transformation' : 'exclusivity';
    }
  }

  /**
   * Get hook with context (more natural, less template-like)
   */
  getContextualHook(strategy: HookStrategy, topic: string, angle?: string): string {
    const baseHook = this.getFollowerHook(strategy, topic);
    
    // If angle provided, integrate it naturally
    if (angle) {
      return `${baseHook} ${angle}`;
    }
    
    return baseHook;
  }
}

