/**
 * VIRAL THREAD GENERATOR
 * Creates viral Twitter threads optimized for maximum follower growth
 * Uses proven viral mechanics and psychological triggers
 */

import { FollowerGrowthOptimizer } from '../intelligence/followerGrowthOptimizer';

export interface ThreadRequest {
  topic?: string;
  strategy?: 'controversial' | 'value_bomb' | 'story' | 'list' | 'insight';
  targetFollowers?: number;
  urgency?: 'low' | 'medium' | 'high';
}

export interface GeneratedThread {
  parts: string[];
  viralScore: number;
  followerPotential: number;
  strategy: string;
  hooks: string[];
}

export class ViralThreadGenerator {
  private static instance: ViralThreadGenerator;
  private followerOptimizer: FollowerGrowthOptimizer;

  private constructor() {
    this.followerOptimizer = FollowerGrowthOptimizer.getInstance();
  }

  public static getInstance(): ViralThreadGenerator {
    if (!ViralThreadGenerator.instance) {
      ViralThreadGenerator.instance = new ViralThreadGenerator();
    }
    return ViralThreadGenerator.instance;
  }

  /**
   * Generate a viral thread optimized for follower growth
   */
  public async generateViralThread(request: ThreadRequest = {}): Promise<GeneratedThread> {
    console.log('🧵 Generating viral thread for maximum follower growth...');

    const strategy = request.strategy || this.selectOptimalStrategy();
    const topic = request.topic || this.selectViralTopic();

    let threadParts: string[] = [];
    let viralScore = 0;
    let followerPotential = 0;

    switch (strategy) {
      case 'controversial':
        threadParts = await this.generateControversialThread(topic);
        viralScore = 85;
        followerPotential = 90;
        break;
      case 'value_bomb':
        threadParts = await this.generateValueBombThread(topic);
        viralScore = 75;
        followerPotential = 85;
        break;
      case 'story':
        threadParts = await this.generateStoryThread(topic);
        viralScore = 70;
        followerPotential = 75;
        break;
      case 'list':
        threadParts = await this.generateListThread(topic);
        viralScore = 65;
        followerPotential = 70;
        break;
      default:
        threadParts = await this.generateInsightThread(topic);
        viralScore = 60;
        followerPotential = 65;
    }

    // Add viral boosters
    threadParts = this.addViralBoosters(threadParts, strategy);

    const hooks = this.extractHooks(threadParts);

    console.log(`✅ Generated ${strategy} thread with ${threadParts.length} parts`);
    console.log(`🔥 Viral score: ${viralScore}/100, Follower potential: ${followerPotential}/100`);

    return {
      parts: threadParts,
      viralScore,
      followerPotential,
      strategy,
      hooks
    };
  }

  /**
   * Generate controversial thread that sparks debate and follows
   */
  private async generateControversialThread(topic: string): Promise<string[]> {
    const controversialHooks = [
      "Unpopular opinion that will probably get me unfollowed:",
      "Hot take that 99% of people get wrong:",
      "Controversial truth that most won't admit:",
      "I'm about to piss off a lot of people, but:",
      "The uncomfortable truth nobody talks about:"
    ];

    const hook = controversialHooks[Math.floor(Math.random() * controversialHooks.length)];

    return [
      `${hook} ${topic} 🧵`,
      "1/ Most people believe [popular belief]",
      "2/ But here's what the data actually shows:",
      "3/ The real reason everyone gets this wrong:",
      "4/ What you should do instead:",
      "5/ The results will shock you:",
      "6/ Here's proof this works:",
      "7/ Why most 'experts' won't tell you this:",
      "8/ The action plan:",
      "Agree or disagree? Let me know below 👇",
      "Follow @SignalAndSynapse for more uncomfortable truths 🔥"
    ];
  }

  /**
   * Generate value bomb thread with actionable insights
   */
  private async generateValueBombThread(topic: string): Promise<string[]> {
    const valueBombHooks = [
      "Free advice that's worth more than most courses:",
      "I spent 10 years learning this the hard way. Here's the shortcut:",
      "Save yourself 5 years and learn this now:",
      "Million-dollar insights I wish I knew earlier:",
      "Game-changing advice that transformed my life:"
    ];

    const hook = valueBombHooks[Math.floor(Math.random() * valueBombHooks.length)];

    return [
      `${hook} ${topic} 🧵`,
      "1/ The biggest mistake everyone makes:",
      "2/ The counterintuitive approach that works:",
      "3/ Step-by-step implementation:",
      "4/ Common pitfalls to avoid:",
      "5/ How to measure success:",
      "6/ Advanced strategies:",
      "7/ Tools and resources:",
      "8/ Real-world examples:",
      "Hope this helps! Bookmark for later 📌",
      "Follow for more insights like this 🚀"
    ];
  }

  /**
   * Generate story-based thread with emotional connection
   */
  private async generateStoryThread(topic: string): Promise<string[]> {
    const storyHooks = [
      "A quick story about why I was completely wrong about",
      "This embarrassing story taught me everything about",
      "The moment that changed how I think about",
      "True story: I almost gave up on",
      "Plot twist: Everything I knew about [X] was wrong."
    ];

    const hook = storyHooks[Math.floor(Math.random() * storyHooks.length)];

    return [
      `${hook} ${topic} 🧵`,
      "1/ It started 3 years ago when...",
      "2/ I was doing everything 'right' but...",
      "3/ Then I discovered something that changed everything:",
      "4/ The turning point came when...",
      "5/ Here's what I learned:",
      "6/ The results were incredible:",
      "7/ Now I teach others this exact method:",
      "8/ Key takeaways:",
      "What's your experience with this? 👇",
      "Follow for more stories and insights ✨"
    ];
  }

  /**
   * Generate list-based thread with clear structure
   */
  private async generateListThread(topic: string): Promise<string[]> {
    const listHooks = [
      "10 things I wish I knew about",
      "7 mistakes everyone makes with",
      "5 secrets to mastering",
      "8 game-changing tips for",
      "6 lessons learned from"
    ];

    const hook = listHooks[Math.floor(Math.random() * listHooks.length)];

    return [
      `${hook} ${topic} 🧵`,
      "1/ First principle that changes everything:",
      "2/ The method 90% of people ignore:",
      "3/ Counterintuitive strategy that works:",
      "4/ Tool/hack that saves massive time:",
      "5/ Mindset shift that unlocks results:",
      "6/ Common mistake that kills progress:",
      "7/ Advanced technique for pros:",
      "8/ Bonus tip that ties it all together:",
      "Which resonated most with you? 💭",
      "Follow for more practical tips 🎯"
    ];
  }

  /**
   * Generate insight-based thread with valuable perspectives
   */
  private async generateInsightThread(topic: string): Promise<string[]> {
    const insightHooks = [
      "Just realized something profound about",
      "Breakthrough insight that changed my perspective on",
      "Deep dive into why",
      "The hidden psychology behind",
      "What most people misunderstand about"
    ];

    const hook = insightHooks[Math.floor(Math.random() * insightHooks.length)];

    return [
      `${hook} ${topic} 🧵`,
      "1/ The surface-level understanding:",
      "2/ But here's what's really happening:",
      "3/ The deeper psychology at work:",
      "4/ Why this matters more than you think:",
      "5/ Practical applications:",
      "6/ How to implement this:",
      "7/ Expected outcomes:",
      "8/ Taking it to the next level:",
      "Thoughts? Let me know below 🤔",
      "Follow for more insights 🧠"
    ];
  }

  /**
   * Add viral boosters to increase engagement and follows
   */
  private addViralBoosters(parts: string[], strategy: string): string[] {
    const boostedParts = [...parts];

    // Add engagement boosters to key parts
    if (parts.length > 3) {
      // Add social proof to middle parts
      boostedParts[Math.floor(parts.length / 2)] += " (This changed everything for me)";
      
      // Add curiosity gap
      const lastContentIndex = parts.length - 3;
      boostedParts[lastContentIndex] += " But wait, there's more...";
    }

    // Enhance the final CTA
    const ctaIndex = parts.length - 1;
    if (ctaIndex > 0) {
      boostedParts[ctaIndex] = "🔄 RT to share with others who need this\n👥 Follow @SignalAndSynapse for daily insights\n💬 What's your experience? Share below!";
    }

    return boostedParts;
  }

  /**
   * Extract hooks used in the thread for analysis
   */
  private extractHooks(parts: string[]): string[] {
    const hooks: string[] = [];
    
    parts.forEach(part => {
      // Extract question marks (engagement hooks)
      if (part.includes('?')) {
        hooks.push('question');
      }
      
      // Extract emotional triggers
      if (/(changed|transformed|breakthrough|shock|amazing)/i.test(part)) {
        hooks.push('emotional_trigger');
      }
      
      // Extract authority signals
      if (/(study|research|data|proof|evidence)/i.test(part)) {
        hooks.push('authority');
      }
      
      // Extract curiosity gaps
      if (/(secret|truth|nobody tells you|hidden)/i.test(part)) {
        hooks.push('curiosity_gap');
      }
    });
    
    return [...new Set(hooks)]; // Remove duplicates
  }

  /**
   * Select optimal strategy based on current performance
   */
  private selectOptimalStrategy(): 'controversial' | 'value_bomb' | 'story' | 'list' | 'insight' {
    const strategies = ['controversial', 'value_bomb', 'story', 'list', 'insight'] as const;
    
    // In the future, this would be based on performance data
    // For now, return random with bias toward high-performing strategies
    const weights = [0.3, 0.25, 0.2, 0.15, 0.1]; // Favor controversial and value bombs
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < strategies.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return strategies[i];
      }
    }
    
    return 'value_bomb'; // Default fallback
  }

  /**
   * Select viral topic with high follower potential
   */
  private selectViralTopic(): string {
    const viralTopics = [
      'productivity habits that 99% of people ignore',
      'money psychology that schools never teach',
      'relationship patterns that predict success',
      'career moves that separate winners from losers',
      'health myths that are keeping you sick',
      'learning techniques that unlock genius',
      'social dynamics most people misunderstand',
      'business principles that guarantee success',
      'mindset shifts that change everything',
      'life optimization strategies for peak performance'
    ];
    
    return viralTopics[Math.floor(Math.random() * viralTopics.length)];
  }

  /**
   * Get follower magnet hooks for maximum conversion
   */
  public getFollowerMagnetHooks(): string[] {
    return this.followerOptimizer.getFollowerMagnetHooks();
  }
}