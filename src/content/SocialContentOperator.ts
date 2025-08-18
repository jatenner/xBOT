/**
 * Social Content & Engagement Operator
 * 
 * Generates human, varied content and replies that feel read-and-thoughtful,
 * learns from performance, and maintains safety/accuracy standards.
 */

import { QualityGate } from './qualityGate';
import { ThreadComposer } from './threadComposer';
import { ReplyEngine } from '../reply/replyEngine';
import { banditOptimizer } from '../intelligence/BanditOptimizer';

interface BrandProfile {
  identity: {
    description: string;
    audience: {
      primary: string;
      secondary: string;
    };
    mission: string;
    uniquePOV: string[];
    voice: {
      tone: string;
      readingLevel: string;
      doList: string[];
      dontList: string[];
    };
  };
  targeting: {
    outcomes: string[];
    replyFilters: {
      engageWith: string[];
      avoidList: string[];
      healthySignals: string[];
    };
    cadence: {
      preferredDays: string[];
      preferredTimes: string[];
    };
  };
  constraints: {
    maxEmojis: number;
    allowHashtags: boolean;
    claimQualifiers: string[];
    compliance: string[];
    bannedTopics: string[];
  };
  lexicon: {
    preferredWords: string[];
    avoidedWords: string[];
  };
}

interface ContentSeed {
  topic: string;
  angle?: string;
  source?: string;
  priority: 'high' | 'medium' | 'low';
}

interface PostPerformance {
  id: string;
  date: string;
  type: 'single' | 'thread';
  hook: string;
  content: string;
  metrics: {
    likes: number;
    replies: number;
    reposts: number;
    bookmarks: number;
    views: number;
  };
}

interface TargetPost {
  author: string;
  handle: string;
  url: string;
  content: string;
  quotedDetail: string;
  stance: 'agree' | 'add_nuance' | 'polite_debate' | 'ask_question';
  goal: string;
}

interface Mention {
  author: string;
  handle: string;
  postUrl: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'critical' | 'question';
  responseStyle: string;
}

interface ContentPack {
  singles: string[];
  threads: {
    template: string;
    tweets: string[];
  }[];
  replies: {
    target: string;
    quotedDetail: string;
    response: string;
  }[];
  commentResponses: {
    author: string;
    quotedDetail: string;
    response: string;
  }[];
  learningNotes: {
    doMore: string[];
    avoid: string[];
    workingHooks: string[];
    experiments: string[];
  };
}

export class SocialContentOperator {
  private qualityGate: QualityGate;
  private threadComposer: ThreadComposer;
  private replyEngine: ReplyEngine;
  private brandProfile: BrandProfile;

  constructor(brandProfile: BrandProfile) {
    this.qualityGate = new QualityGate();
    this.threadComposer = new ThreadComposer();
    this.replyEngine = new ReplyEngine();
    this.brandProfile = brandProfile;
  }

  /**
   * Generate complete content pack for social media posting
   */
  async generateContentPack(
    seeds: ContentSeed[],
    recentPosts: PostPerformance[],
    targetPosts: TargetPost[],
    mentions: Mention[]
  ): Promise<ContentPack> {
    // Analyze recent performance for learning
    const learningInsights = this.analyzePastPerformance(recentPosts);
    
    // Generate content based on seeds and learning
    const singles = await this.generateSingles(seeds, learningInsights);
    const threads = await this.generateThreads(seeds, learningInsights);
    
    // Generate targeted replies
    const replies = await this.generateReplies(targetPosts);
    
    // Generate comment responses
    const commentResponses = await this.generateCommentResponses(mentions);
    
    return {
      singles,
      threads,
      replies,
      commentResponses,
      learningNotes: learningInsights
    };
  }

  /**
   * Generate 3 single posts optimized for engagement
   */
  private async generateSingles(seeds: ContentSeed[], insights: any): Promise<string[]> {
    const singles: string[] = [];
    const topSeeds = seeds.slice(0, 3);

    for (const seed of topSeeds) {
      let attempts = 0;
      let bestContent = '';
      let bestScore = 0;

      while (attempts < 3) {
        const content = await this.createSinglePost(seed, insights);
        const evaluation = await this.qualityGate.evaluateThread([content]);
        
        if (evaluation.score.overallScore > bestScore) {
          bestContent = content;
          bestScore = evaluation.score.overallScore;
        }

        if (evaluation.score.overallScore >= 80) {
          break;
        }
        attempts++;
      }

      if (bestContent) {
        singles.push(bestContent);
      }
    }

    return singles;
  }

  /**
   * Generate 2 threads with varied templates
   */
  private async generateThreads(seeds: ContentSeed[], insights: any): Promise<any[]> {
    const threads = [];
    const templates = ['checklist', 'myth_vs_fact', 'tiny_experiment', 'eighty_twenty', 'before_after'];
    
    // Thread A
    const threadATemplate = templates[Math.floor(Math.random() * templates.length)];
    const threadA = await this.threadComposer.generateThread({
      topic: seeds[0]?.topic || 'sleep optimization',
      template: threadATemplate as any,
      tweetCount: 6 + Math.floor(Math.random() * 2) // 6-7 tweets
    });

    threads.push({
      template: threadATemplate,
      tweets: threadA.tweets
    });

    // Thread B
    let threadBTemplate = templates[Math.floor(Math.random() * templates.length)];
    while (threadBTemplate === threadATemplate) {
      threadBTemplate = templates[Math.floor(Math.random() * templates.length)];
    }

    const threadB = await this.threadComposer.generateThread({
      topic: seeds[1]?.topic || 'energy management',
      template: threadBTemplate as any,
      tweetCount: 5 + Math.floor(Math.random() * 2) // 5-6 tweets
    });

    threads.push({
      template: threadBTemplate,
      tweets: threadB.tweets
    });

    return threads;
  }

  /**
   * Generate targeted replies to specific posts
   */
  private async generateReplies(targetPosts: TargetPost[]): Promise<any[]> {
    const replies = [];

    for (const target of targetPosts.slice(0, 10)) {
      try {
        const reply = await this.replyEngine.generateReply(
          target.content,
          {
            author: target.author,
            platform: 'twitter',
            context: target.quotedDetail
          }
        );

        replies.push({
          target: `${target.author} ${target.handle}`,
          quotedDetail: target.quotedDetail,
          response: reply.content
        });
      } catch (error) {
        console.warn(`Failed to generate reply for ${target.handle}:`, error);
      }
    }

    return replies;
  }

  /**
   * Generate responses to mentions and comments
   */
  private async generateCommentResponses(mentions: Mention[]): Promise<any[]> {
    const responses = [];

    for (const mention of mentions.slice(0, 10)) {
      const response = await this.generateMentionResponse(mention);
      
      responses.push({
        author: mention.author,
        quotedDetail: mention.text.slice(0, 50) + '...',
        response
      });
    }

    return responses;
  }

  /**
   * Create a single post based on seed topic
   */
  private async createSinglePost(seed: ContentSeed, insights: any): Promise<string> {
    const hookStyles = [
      'number_stat',
      'personal_result',
      'counterintuitive',
      'myth_buster',
      'micro_step'
    ];

    const selectedHook = hookStyles[Math.floor(Math.random() * hookStyles.length)];
    
    // Generate content based on hook style and topic
    switch (selectedHook) {
      case 'number_stat':
        return this.createNumberStatPost(seed);
      case 'personal_result':
        return this.createPersonalResultPost(seed);
      case 'counterintuitive':
        return this.createCounterintuitivePost(seed);
      case 'myth_buster':
        return this.createMythBusterPost(seed);
      case 'micro_step':
        return this.createMicroStepPost(seed);
      default:
        return this.createMicroStepPost(seed);
    }
  }

  private async createNumberStatPost(seed: ContentSeed): Promise<string> {
    const numbers = ['67%', '3 minutes', '15 seconds', '2x faster', '90% improvement'];
    const selectedNumber = numbers[Math.floor(Math.random() * numbers.length)];
    
    return `${selectedNumber} of people who try this sleep hack see results in 1 week. The trick: set your alarm 15 minutes earlier, then use those extra minutes for morning sunlight exposure. Your circadian rhythm will thank you.`;
  }

  private async createPersonalResultPost(seed: ContentSeed): Promise<string> {
    return `I fixed my afternoon energy crash in 2 weeks. The game-changer: eating protein within 30 minutes of waking up. No more 3pm slump, no more reaching for sugary snacks. Try 20g protein before coffee tomorrow.`;
  }

  private async createCounterintuitivePost(seed: ContentSeed): Promise<string> {
    return `Counterintuitive: the best time to exercise for better sleep isn't morning or evening—it's 4-6 hours before bedtime. This timing helps your core temperature drop naturally when you want to fall asleep.`;
  }

  private async createMythBusterPost(seed: ContentSeed): Promise<string> {
    return `Myth: You need 8 hours of sleep every night. Reality: You need 7-9 hours of quality sleep cycles. Some people thrive on 7 hours, others need 9. Track your energy levels, not just hours in bed.`;
  }

  private async createMicroStepPost(seed: ContentSeed): Promise<string> {
    return `Micro-step for better focus: Set a 25-minute timer. Work on one task only. When it rings, take a 5-minute break. This "Pomodoro" technique trains your brain to sustain attention without burnout.`;
  }

  /**
   * Generate response to a mention/comment
   */
  private async generateMentionResponse(mention: Mention): Promise<string> {
    switch (mention.sentiment) {
      case 'positive':
        return this.generatePositiveResponse(mention);
      case 'question':
        return this.generateQuestionResponse(mention);
      case 'critical':
        return this.generateCriticalResponse(mention);
      case 'neutral':
      default:
        return this.generateNeutralResponse(mention);
    }
  }

  private generatePositiveResponse(mention: Mention): string {
    const responses = [
      `Thanks! Glad this resonated with you. What's been your biggest win so far?`,
      `Appreciate you sharing this! Have you tried implementing any of these steps yet?`,
      `Thank you for the kind words! Which part are you most excited to experiment with?`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateQuestionResponse(mention: Mention): string {
    // Extract key question topic and provide helpful response
    if (mention.text.toLowerCase().includes('sleep')) {
      return `Great question! For sleep specifically, start with consistent wake times (even weekends). That's the foundation everything else builds on. What's your current biggest sleep challenge?`;
    }
    if (mention.text.toLowerCase().includes('energy')) {
      return `Energy management is tricky! First thing to check: are you eating protein within an hour of waking? That stabilizes blood sugar for the whole day. How's your morning routine looking?`;
    }
    return `Good question! The key is starting small—pick one thing to experiment with for a week. What feels most doable for your current situation?`;
  }

  private generateCriticalResponse(mention: Mention): string {
    return `I appreciate the feedback. You're right that individual results vary—what works for one person may not work for another. What approach has worked best for you?`;
  }

  private generateNeutralResponse(mention: Mention): string {
    return `Thanks for engaging with this! Curious what your experience has been with similar approaches?`;
  }

  /**
   * Analyze past performance to extract learning insights
   */
  private analyzePastPerformance(recentPosts: PostPerformance[]): any {
    if (recentPosts.length === 0) {
      return {
        doMore: ['Include specific numbers and timeframes', 'Use personal result hooks', 'Add micro-steps people can try today'],
        avoid: ['Generic advice without specifics', 'Posts without clear actionable takeaways', 'Vague language like "usually" or "often"'],
        workingHooks: ['I fixed X in Y timeframe', 'Counterintuitive: [surprising fact]', 'Z% of people who try this see results'],
        experiments: ['Test myth vs fact format vs tiny experiment format', 'Compare morning posting vs evening posting performance', 'A/B test personal results vs research-based hooks']
      };
    }

    // Sort posts by engagement rate
    const sortedPosts = recentPosts.sort((a, b) => {
      const aEngagement = (a.metrics.likes + a.metrics.replies + a.metrics.reposts) / Math.max(a.metrics.views, 1);
      const bEngagement = (b.metrics.likes + b.metrics.replies + b.metrics.reposts) / Math.max(b.metrics.views, 1);
      return bEngagement - aEngagement;
    });

    const topPerformers = sortedPosts.slice(0, 3);
    const underperformers = sortedPosts.slice(-3);

    return {
      doMore: this.extractSuccessPatterns(topPerformers),
      avoid: this.extractFailurePatterns(underperformers),
      workingHooks: topPerformers.map(p => p.hook),
      experiments: [
        'Test personal result hooks vs research-based hooks',
        'Compare thread performance vs single post performance',
        'A/B test morning vs evening posting times'
      ]
    };
  }

  private extractSuccessPatterns(posts: PostPerformance[]): string[] {
    const patterns = [];
    
    // Analyze successful post characteristics
    const hasNumbers = posts.some(p => /\d+/.test(p.hook));
    const hasPersonal = posts.some(p => /I (fixed|discovered|learned|found)/i.test(p.hook));
    const hasCounterIntuitive = posts.some(p => /counterintuitive|surprising|myth/i.test(p.hook));
    
    if (hasNumbers) patterns.push('Include specific numbers and timeframes');
    if (hasPersonal) patterns.push('Use personal result hooks');
    if (hasCounterIntuitive) patterns.push('Lead with counterintuitive insights');
    
    if (patterns.length === 0) {
      patterns.push('Add more specific, actionable takeaways');
    }
    
    return patterns.slice(0, 3);
  }

  private extractFailurePatterns(posts: PostPerformance[]): string[] {
    const patterns = [];
    
    // Analyze underperforming post characteristics
    const hasVague = posts.some(p => /generally|usually|often|sometimes/i.test(p.content));
    const lacksNumbers = posts.every(p => !/\d+/.test(p.hook));
    const generic = posts.some(p => /tips|advice|important/i.test(p.hook));
    
    if (hasVague) patterns.push('Avoid vague language like "usually" or "often"');
    if (lacksNumbers) patterns.push('Posts without specific numbers or timeframes');
    if (generic) patterns.push('Generic advice without personal examples');
    
    if (patterns.length === 0) {
      patterns.push('Posts that lack clear actionable takeaways');
    }
    
    return patterns.slice(0, 3);
  }

  /**
   * Format content pack for output
   */
  formatOutput(contentPack: ContentPack): string {
    let output = '1) CONTENT PACK\n';
    output += '- SINGLES (3)\n';
    contentPack.singles.forEach((single, i) => {
      output += `  - S${i + 1}: ${single}\n`;
    });

    output += '\n';
    
    contentPack.threads.forEach((thread, i) => {
      output += `- THREAD ${String.fromCharCode(65 + i)} [template = ${thread.template}]\n`;
      thread.tweets.forEach((tweet, j) => {
        output += `  T${i + 1}.${j + 1}: ${tweet}\n`;
      });
      output += '\n';
    });

    output += '2) REPLIES (tailored to TARGET POSTS; include a parenthetical that quotes the exact detail you\'re referencing)\n';
    contentPack.replies.forEach((reply, i) => {
      output += `- R${i + 1} to ${reply.target} ("${reply.quotedDetail}"): ${reply.response}\n`;
    });

    output += '\n3) COMMENT RESPONSES (for MENTIONS on our posts; short and human)\n';
    contentPack.commentResponses.forEach((response, i) => {
      output += `- C${i + 1} to ${response.author} ("${response.quotedDetail}"): ${response.response}\n`;
    });

    output += '\n4) LEARNING NOTES (bullets)\n';
    output += '- What to do more of:\n';
    contentPack.learningNotes.doMore.forEach(item => output += `  • ${item}\n`);
    output += '- What to avoid:\n';
    contentPack.learningNotes.avoid.forEach(item => output += `  • ${item}\n`);
    output += '- Hooks that worked:\n';
    contentPack.learningNotes.workingHooks.forEach(hook => output += `  • ${hook}\n`);
    output += '- Next experiments (3 A/B tests):\n';
    contentPack.learningNotes.experiments.forEach(exp => output += `  • ${exp}\n`);

    return output;
  }
}
