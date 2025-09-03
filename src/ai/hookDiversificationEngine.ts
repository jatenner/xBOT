/**
 * HOOK DIVERSIFICATION ENGINE
 * 
 * Prevents repetitive hook usage and ensures variety in content openings.
 * Your tweets showed "Most people don't know..." 3+ times - this fixes that!
 */

interface HookUsage {
  pattern: string;
  lastUsed: Date;
  useCount: number;
}

export class HookDiversificationEngine {
  private static instance: HookDiversificationEngine;
  private hookHistory: Map<string, HookUsage> = new Map();
  
  // All available hook patterns with variety
  private readonly hookPatterns = [
    // Scientific Authority
    "99% of people are doing {topic} wrong. Here's what actually works:",
    "Scientists found {discovery} but no one talks about it:",
    "Your doctor will NEVER tell you this about {topic}:",
    "Only 1% of people know this {category} secret:",
    "The {industry} buried this study because {reason}:",
    
    // Personal Discovery  
    "I was skeptical about {topic} until I discovered {result}:",
    "I discovered this {protocol} that {result} in {timeframe}:",
    "After {timeframe} of research, I found the real secret to {goal}:",
    "I tested {number} {methods}. Only one worked:",
    
    // Contrarian/Shocking
    "Big pharma doesn't want you to know {secret}:",
    "This common {habit} is secretly destroying your {aspect}:",
    "The {industry} has been lying about {topic} for decades:",
    "Most people think {belief}. They're dangerously wrong:",
    "Everything you know about {topic} is backwards:",
    
    // Results-Focused
    "{Number} people tried this protocol. Results were insane:",
    "This {timeframe} routine increased my {metric} by {percent}%:",
    "One simple change boosted my {aspect} by {percent}% in {timeframe}:",
    "This {daily_habit} transformed my {health_aspect} completely:",
    
    // Curiosity/Mystery
    "The real reason you can't {goal} isn't what you think:",
    "There's a hidden cause of {problem} that nobody mentions:",
    "The missing piece in your {routine} that changes everything:",
    "Why {common_practice} is actually making you worse:",
    
    // Urgent/Time-Sensitive
    "If you do {action} after {time}, you're wasting your effort:",
    "Stop doing {common_action}. Here's what works instead:",
    "The timing of {action} matters more than you think:",
    "You have {timeframe} to fix this before it's too late:",
    
    // Simple/Direct
    "Try this: {specific_action}. Result: {benefit}:",
    "Here's why {simple_fact} changes everything:",
    "One weird trick that actually works for {goal}:",
    "The simplest way to {goal} that nobody tries:",
    
    // Social Proof
    "Biohackers are obsessed with {topic}. Here's why:",
    "Top {professionals} all do this {habit}. You should too:",
    "The elite {group} secretly use this {method}:",
    "Longevity experts agree: {statement} is crucial:"
  ];

  private constructor() {
    this.initializeHookHistory();
  }

  public static getInstance(): HookDiversificationEngine {
    if (!HookDiversificationEngine.instance) {
      HookDiversificationEngine.instance = new HookDiversificationEngine();
    }
    return HookDiversificationEngine.instance;
  }

  /**
   * Initialize hook history from any recent patterns
   */
  private initializeHookHistory(): void {
    // Initialize with common overused patterns to avoid them
    const commonOverusedPatterns = [
      "Most people don't know",
      "Here's why 99% of people",
      "Try this:",
      "Most people think"
    ];

    commonOverusedPatterns.forEach(pattern => {
      this.hookHistory.set(pattern, {
        pattern,
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        useCount: 3 // Mark as heavily used
      });
    });
  }

  /**
   * Get a diverse hook pattern, avoiding recent/overused ones
   */
  public getDiverseHook(topic: string, contentType: 'simple' | 'thread' = 'simple'): string {
    const now = new Date();
    const availablePatterns = this.hookPatterns.filter(pattern => {
      const usage = this.hookHistory.get(pattern);
      
      if (!usage) return true; // Never used
      
      const hoursElapsed = (now.getTime() - usage.lastUsed.getTime()) / (1000 * 60 * 60);
      
      // Avoid patterns used in last 4 hours, or patterns used 3+ times in 24 hours
      return hoursElapsed > 4 || (hoursElapsed > 12 && usage.useCount < 3);
    });

    if (availablePatterns.length === 0) {
      // If all patterns are "overused", use least recently used
      const leastRecentPattern = this.hookPatterns.reduce((oldest, current) => {
        const currentUsage = this.hookHistory.get(current);
        const oldestUsage = this.hookHistory.get(oldest);
        
        if (!currentUsage) return current;
        if (!oldestUsage) return oldest;
        
        return currentUsage.lastUsed < oldestUsage.lastUsed ? current : oldest;
      });
      
      return this.personalizeHook(leastRecentPattern, topic);
    }

    // Select random pattern from available ones
    const selectedPattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
    
    // Record usage
    this.recordHookUsage(selectedPattern);
    
    return this.personalizeHook(selectedPattern, topic);
  }

  /**
   * Personalize hook pattern with topic-specific content
   */
  private personalizeHook(pattern: string, topic: string): string {
    const healthTopics = {
      sleep: { discovery: "sleep debt damages DNA", category: "circadian", aspect: "recovery" },
      fasting: { discovery: "autophagy peaks at 18 hours", category: "metabolic", aspect: "longevity" },
      exercise: { discovery: "Zone 2 burns fat better", category: "fitness", aspect: "endurance" },
      nutrition: { discovery: "seed oils cause inflammation", category: "dietary", aspect: "metabolism" },
      supplements: { discovery: "timing doubles effectiveness", category: "biohacking", aspect: "absorption" },
      stress: { discovery: "cortisol blocks fat loss", category: "hormonal", aspect: "recovery" },
      hydration: { discovery: "electrolytes matter more than water", category: "cellular", aspect: "performance" }
    };

    const topicData = healthTopics[topic as keyof typeof healthTopics] || {
      discovery: "optimization is possible",
      category: "health",
      aspect: "wellness"
    };

    // Replace placeholders with topic-specific content
    return pattern
      .replace(/{topic}/g, topic)
      .replace(/{discovery}/g, topicData.discovery)
      .replace(/{category}/g, topicData.category)
      .replace(/{aspect}/g, topicData.aspect)
      .replace(/{goal}/g, `optimize ${topic}`)
      .replace(/{timeframe}/g, this.getRandomTimeframe())
      .replace(/{number}/g, this.getRandomNumber().toString())
      .replace(/{percent}/g, this.getRandomPercent().toString())
      .replace(/{habit}/g, this.getRandomHabit())
      .replace(/{protocol}/g, this.getRandomProtocol())
      .replace(/{method}/g, this.getRandomMethod())
      .replace(/{industry}/g, this.getRandomIndustry())
      .replace(/{professionals}/g, this.getRandomProfessionals())
      .replace(/{group}/g, this.getRandomGroup());
  }

  /**
   * Record hook usage for diversity tracking
   */
  private recordHookUsage(pattern: string): void {
    const existing = this.hookHistory.get(pattern);
    
    if (existing) {
      existing.lastUsed = new Date();
      existing.useCount++;
    } else {
      this.hookHistory.set(pattern, {
        pattern,
        lastUsed: new Date(),
        useCount: 1
      });
    }
  }

  /**
   * Helper methods for randomization
   */
  private getRandomTimeframe(): string {
    const timeframes = ["2 weeks", "30 days", "3 months", "6 weeks", "90 days", "4 weeks"];
    return timeframes[Math.floor(Math.random() * timeframes.length)];
  }

  private getRandomNumber(): number {
    const numbers = [1000, 500, 2000, 100, 300, 50, 1500];
    return numbers[Math.floor(Math.random() * numbers.length)];
  }

  private getRandomPercent(): number {
    const percents = [30, 50, 70, 25, 40, 60, 80, 20];
    return percents[Math.floor(Math.random() * percents.length)];
  }

  private getRandomHabit(): string {
    const habits = ["morning routine", "eating pattern", "sleep schedule", "workout timing", "supplement timing"];
    return habits[Math.floor(Math.random() * habits.length)];
  }

  private getRandomProtocol(): string {
    const protocols = ["morning protocol", "fasting method", "sleep routine", "recovery system", "optimization strategy"];
    return protocols[Math.floor(Math.random() * protocols.length)];
  }

  private getRandomMethod(): string {
    const methods = ["biohacks", "techniques", "strategies", "protocols", "approaches"];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  private getRandomIndustry(): string {
    const industries = ["supplement industry", "food industry", "pharma industry", "fitness industry"];
    return industries[Math.floor(Math.random() * industries.length)];
  }

  private getRandomProfessionals(): string {
    const professionals = ["longevity doctors", "biohackers", "elite athletes", "sleep specialists", "nutritionists"];
    return professionals[Math.floor(Math.random() * professionals.length)];
  }

  private getRandomGroup(): string {
    const groups = ["biohackers", "longevity enthusiasts", "elite performers", "health optimizers"];
    return groups[Math.floor(Math.random() * groups.length)];
  }

  /**
   * Get usage statistics for monitoring
   */
  public getUsageStats(): { pattern: string; lastUsed: Date; useCount: number }[] {
    return Array.from(this.hookHistory.values()).sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }

  /**
   * Reset hook history (for testing or fresh start)
   */
  public resetHistory(): void {
    this.hookHistory.clear();
    this.initializeHookHistory();
  }
}
