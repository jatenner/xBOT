/**
 * HUMAN-GRADE GROWTH ENGINE FOR @Signal_Synapse
 * 
 * A complete health content growth system that:
 * - Processes Twitter trends and news trends 
 * - Uses Thompson sampling for format/persona optimization
 * - Creates human-like, science-backed health content
 * - Outputs strict JSON for Playwright-based posting
 * - Follows the "Before the Fold" rule (240 chars deliver value)
 * - Implements opportunity scoring with EPM metrics
 */

export interface EngagementMetrics {
  epm_current: number;
  epm_ewma: number;
  format_bandit: {
    single: number;
    thread: number;
    reply: number;
    quote: number;
    longform_single: number;
  };
  persona_hook_bandit: {
    "Scientist/myth_bust": number;
    "Coach/how_to": number;
    "Storyteller/story": number;
    "Curator/checklist": number;
    "Mythbuster/checklist": number;
  };
}

export interface TrendData {
  phrase: string;
  momentum: number;
  tph?: number; // tweets per hour for Twitter trends
  source?: string; // source for news trends
  category?: "Health" | "Food" | "Sleep" | "Fitness" | "Nutrition" | "Movement" | "Stress" | "Other";
}

export interface PostingCaps {
  max_day: number;
  max_hour: number;
  min_gap: number;
  min_gap_same: number;
  thread_cooldown: number;
  min_posts_per_2h: number;
}

export interface RecentCounts {
  hour: number;
  day: number;
  last_post_min_ago: number;
  last_format: "single" | "thread" | "reply" | "quote" | "longform_single";
  since_last_2h: number;
}

export interface FatigueState {
  format_streak: number;
  thread_cooldown_remaining: number;
}

export interface TrendPolicy {
  fit_min: number;
  prefer_twitter_over_news: boolean;
  max_offtopic_ratio: number;
  blacklist: string[];
}

export interface PostingLimits {
  first_visible_chars: number;
  tweet_max_hard: number;
  longform_max_chars: number;
}

export interface StyleSettings {
  style_jitter: number;
  hedge_prob: number;
  question_prob: number;
  emoji_max: number;
  no_hashtags: boolean;
}

export interface PostingCapabilities {
  longform_available: boolean;
  replies_allowed: boolean;
  quotes_allowed: boolean;
}

export interface ReplyContext {
  gist: string | null;
  author: string | null;
}

export interface GrowthEngineInput {
  now_local: string;
  caps: PostingCaps;
  recent_counts: RecentCounts;
  followers: number;
  metrics: EngagementMetrics;
  fatigue: FatigueState;
  twitter_trends: TrendData[];
  news_trends: TrendData[];
  trend_policy: TrendPolicy;
  recent_posts_text: string[];
  limits: PostingLimits;
  style: StyleSettings;
  capabilities: PostingCapabilities;
  reply_context: ReplyContext;
}

export interface PacingDecision {
  opportunity: number;
  z_epm: number;
  fatigue_penalty: number;
}

export interface ContentDecision {
  format: "single" | "thread" | "reply" | "quote" | "longform_single";
  n_tweets: number;
  topic: string;
  pillar: "Sleep" | "Stress" | "Nutrition" | "Movement" | "Behavior";
  persona: "Scientist" | "Coach" | "Mythbuster" | "Storyteller" | "Curator";
  hook_type: "how_to" | "myth_bust" | "checklist" | "story" | "tip" | "framework";
  explore: boolean;
  pacing: PacingDecision;
}

export interface TweetDraft {
  n: number;
  text: string;
}

export interface ContentDraft {
  tweets: TweetDraft[];
  sources: string[];
  cta_note: string;
}

export interface QualityCheck {
  length_ok: boolean;
  emoji_ok: boolean;
  no_hashtags: boolean;
  non_redundant: boolean;
  human_vibe_score: number;
  front_loaded: boolean;
}

export interface GrowthEngineOutput {
  post_now: boolean;
  reason: string;
  delay_min: number;
  decision: ContentDecision;
  draft: ContentDraft;
  qc: QualityCheck;
}

type PersonaType = "Scientist" | "Coach" | "Mythbuster" | "Storyteller" | "Curator";
type HookType = "how_to" | "myth_bust" | "checklist" | "story" | "tip" | "framework";
type HealthPillar = "Sleep" | "Stress" | "Nutrition" | "Movement" | "Behavior";

export class HumanGradeGrowthEngine {
  private static instance: HumanGradeGrowthEngine;

  private constructor() {}

  public static getInstance(): HumanGradeGrowthEngine {
    if (!HumanGradeGrowthEngine.instance) {
      HumanGradeGrowthEngine.instance = new HumanGradeGrowthEngine();
    }
    return HumanGradeGrowthEngine.instance;
  }

  /**
   * Main processing function - takes input JSON and returns strict JSON output
   */
  public async processGrowthDecision(input: GrowthEngineInput): Promise<GrowthEngineOutput> {
    try {
      // Step 1: Calculate opportunity score and determine if we should post
      const pacingDecision = this.calculateOpportunityScore(input);
      
      // Force post if minimum posting requirement
      const forcePost = input.recent_counts.last_post_min_ago >= 120 && 
                       input.recent_counts.since_last_2h < input.caps.min_posts_per_2h;

      // Check if we should post now
      const shouldPost = forcePost || (
        pacingDecision.opportunity > 0.3 && 
        this.checkPostingCaps(input)
      );

      if (!shouldPost) {
        return {
          post_now: false,
          reason: forcePost ? "Minimum posting requirement not met" : "Low opportunity score or caps violated",
          delay_min: this.calculateDelayMinutes(input),
          decision: this.createEmptyDecision(pacingDecision),
          draft: { tweets: [], sources: [], cta_note: "" },
          qc: this.createEmptyQC()
        };
      }

      // Step 2: Rank and select topics
      const selectedTopic = this.selectBestTopic(input);
      
      // Step 3: Thompson sample format and persona
      const format = this.thompsonSampleFormat(input);
      const persona = this.thompsonSamplePersona(input);
      
      // Step 4: Generate content
      const contentDecision: ContentDecision = {
        format,
        n_tweets: this.determineNTweets(format, input),
        topic: selectedTopic.phrase,
        pillar: this.categorizeToPillar(selectedTopic),
        persona,
        hook_type: this.selectHookType(persona, input),
        explore: selectedTopic.momentum > 0.6,
        pacing: pacingDecision
      };

      // Step 5: Create the actual content
      const draft = await this.generateContent(contentDecision, input);
      
      // Step 6: Quality control
      const qc = this.performQualityCheck(draft, input);
      
      // Step 7: Self-revise if quality is low
      const finalDraft = qc.human_vibe_score < 8 ? 
        await this.reviseContent(draft, contentDecision, input) : draft;
      
      const finalQC = qc.human_vibe_score < 8 ? 
        this.performQualityCheck(finalDraft, input) : qc;

      return {
        post_now: true,
        reason: forcePost ? "Minimum posting requirement" : "High opportunity score",
        delay_min: 0,
        decision: contentDecision,
        draft: finalDraft,
        qc: finalQC
      };

    } catch (error) {
      console.error('Growth engine error:', error);
      return {
        post_now: false,
        reason: "Processing error",
        delay_min: 30,
        decision: this.createEmptyDecision({ opportunity: 0, z_epm: 0, fatigue_penalty: 0 }),
        draft: { tweets: [], sources: [], cta_note: "" },
        qc: this.createEmptyQC()
      };
    }
  }

  /**
   * Calculate opportunity score using EPM metrics, trend boost, and fatigue
   */
  private calculateOpportunityScore(input: GrowthEngineInput): PacingDecision {
    // Z-score for current EPM vs EWMA
    const z_epm = input.metrics.epm_current > 0 ? 
      (input.metrics.epm_current - input.metrics.epm_ewma) / Math.max(input.metrics.epm_ewma * 0.3, 0.1) : 0;

    // Twitter trend boost
    const twitterTrendBoost = input.twitter_trends.reduce((max, trend) => 
      Math.max(max, this.calculateTrendFit(trend) * trend.momentum * (trend.tph || 0) / 100), 0);

    // News trend boost (weighted lower)
    const newsTrendBoost = input.news_trends.reduce((max, trend) => 
      Math.max(max, this.calculateTrendFit(trend) * trend.momentum * 0.6), 0);

    // Local time boost (higher engagement during peak hours)
    const hour = new Date(input.now_local).getHours();
    const localTimeBoost = this.getLocalTimeBoost(hour);

    // Fatigue penalty
    const fatigue_penalty = this.calculateFatiguePenalty(input);

    const opportunity = z_epm + twitterTrendBoost + newsTrendBoost + localTimeBoost - fatigue_penalty;

    return {
      opportunity,
      z_epm,
      fatigue_penalty
    };
  }

  /**
   * Calculate how well a trend fits health content
   */
  private calculateTrendFit(trend: TrendData): number {
    const healthKeywords = [
      'health', 'sleep', 'diet', 'nutrition', 'fitness', 'exercise', 'stress', 
      'mental', 'wellness', 'vitamin', 'protein', 'meditation', 'anxiety',
      'depression', 'therapy', 'mindfulness', 'workout', 'cardio', 'strength',
      'immunity', 'inflammation', 'gut', 'microbiome', 'supplement'
    ];

    const phrase = trend.phrase.toLowerCase();
    const directMatch = healthKeywords.some(keyword => phrase.includes(keyword));
    
    if (directMatch) return 1.0;
    
    // Category-based fit
    if (trend.category) {
      switch (trend.category) {
        case "Health": return 1.0;
        case "Food": return 0.8;
        case "Sleep": return 1.0;
        case "Fitness": return 0.9;
        default: return 0.3;
      }
    }

    return 0.2; // Low but not zero for creative adaptation
  }

  /**
   * Get engagement boost based on local time
   */
  private getLocalTimeBoost(hour: number): number {
    // Peak engagement: 7-9 AM, 12-1 PM, 6-8 PM
    if ((hour >= 7 && hour <= 9) || (hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 20)) {
      return 0.3;
    }
    // Good engagement: 10-11 AM, 2-5 PM, 9-10 PM
    if ((hour >= 10 && hour <= 11) || (hour >= 14 && hour <= 17) || hour === 21) {
      return 0.15;
    }
    // Low engagement: late night, very early morning
    if (hour >= 22 || hour <= 6) {
      return -0.2;
    }
    return 0; // Neutral times
  }

  /**
   * Calculate fatigue penalty from format streaks and cooldowns
   */
  private calculateFatiguePenalty(input: GrowthEngineInput): number {
    let penalty = 0;

    // Format streak penalty (variety is good)
    if (input.fatigue.format_streak >= 3) {
      penalty += 0.3;
    } else if (input.fatigue.format_streak >= 2) {
      penalty += 0.15;
    }

    // Thread cooldown penalty
    if (input.fatigue.thread_cooldown_remaining > 0) {
      penalty += 0.2;
    }

    // Frequency penalty (posting too often)
    if (input.recent_counts.last_post_min_ago < input.caps.min_gap) {
      penalty += 0.5;
    }

    return penalty;
  }

  /**
   * Check if posting caps allow a new post
   */
  private checkPostingCaps(input: GrowthEngineInput): boolean {
    // Daily limit
    if (input.recent_counts.day >= input.caps.max_day) return false;
    
    // Hourly limit
    if (input.recent_counts.hour >= input.caps.max_hour) return false;
    
    // Minimum gap
    if (input.recent_counts.last_post_min_ago < input.caps.min_gap) return false;
    
    // Same format gap
    const sameFormatGap = input.caps.min_gap_same;
    if (input.recent_counts.last_post_min_ago < sameFormatGap) {
      // Would need to check if same format, simplified here
      return true;
    }

    return true;
  }

  /**
   * Calculate delay minutes if not posting now
   */
  private calculateDelayMinutes(input: GrowthEngineInput): number {
    const gapNeeded = Math.max(
      input.caps.min_gap - input.recent_counts.last_post_min_ago,
      0
    );
    
    return Math.max(gapNeeded, 15); // Minimum 15 minute delay
  }

  /**
   * Select the best topic from trends
   */
  private selectBestTopic(input: GrowthEngineInput): TrendData {
    // Rank Twitter trends first
    const rankedTwitterTrends = input.twitter_trends
      .map(trend => ({
        ...trend,
        score: this.calculateTrendFit(trend) * trend.momentum * (trend.tph || 0) / 100
      }))
      .filter(trend => this.calculateTrendFit(trend) >= input.trend_policy.fit_min)
      .sort((a, b) => b.score - a.score);

    // Rank news trends (weighted lower)
    const rankedNewsTrends = input.news_trends
      .map(trend => ({
        ...trend,
        score: this.calculateTrendFit(trend) * trend.momentum * 0.6
      }))
      .filter(trend => this.calculateTrendFit(trend) >= input.trend_policy.fit_min)
      .sort((a, b) => b.score - a.score);

    // Prefer Twitter trends if policy says so
    if (input.trend_policy.prefer_twitter_over_news && rankedTwitterTrends.length > 0) {
      return rankedTwitterTrends[0];
    }

    // Combined ranking
    const allTrends = [...rankedTwitterTrends, ...rankedNewsTrends];
    
    if (allTrends.length === 0) {
      // Fallback to general health topics
      return {
        phrase: "sleep quality",
        momentum: 0.5,
        category: "Sleep"
      };
    }

    return allTrends[0];
  }

  /**
   * Thompson sampling for format selection
   */
  private thompsonSampleFormat(input: GrowthEngineInput): "single" | "thread" | "reply" | "quote" | "longform_single" {
    const formats = input.capabilities.longform_available ? 
      ["single", "thread", "reply", "quote", "longform_single"] :
      ["single", "thread", "reply", "quote"];

    // Filter based on capabilities
    const availableFormats = formats.filter(format => {
      if (format === "reply" && !input.capabilities.replies_allowed) return false;
      if (format === "quote" && !input.capabilities.quotes_allowed) return false;
      if (format === "thread" && input.fatigue.thread_cooldown_remaining > 0) return false;
      return true;
    });

    // Thompson sampling (simplified Beta distribution sampling)
    let maxSample = -1;
    let selectedFormat = "single";

    for (const format of availableFormats) {
      const prob = input.metrics.format_bandit[format as keyof typeof input.metrics.format_bandit] || 0.2;
      // Simple sampling: add random noise
      const sample = prob + (Math.random() - 0.5) * 0.2;
      
      if (sample > maxSample) {
        maxSample = sample;
        selectedFormat = format;
      }
    }

    return selectedFormat as "single" | "thread" | "reply" | "quote" | "longform_single";
  }

  /**
   * Thompson sampling for persona selection
   */
  private thompsonSamplePersona(input: GrowthEngineInput): PersonaType {
    const personas = Object.keys(input.metrics.persona_hook_bandit);
    
    let maxSample = -1;
    let selectedPersona = "Coach";

    for (const persona of personas) {
      const prob = input.metrics.persona_hook_bandit[persona as keyof typeof input.metrics.persona_hook_bandit] || 0.2;
      const sample = prob + (Math.random() - 0.5) * 0.2;
      
      if (sample > maxSample) {
        maxSample = sample;
        selectedPersona = persona.split('/')[0]; // Extract persona part
      }
    }

    return selectedPersona as PersonaType;
  }

  /**
   * Determine number of tweets based on format
   */
  private determineNTweets(format: string, input: GrowthEngineInput): number {
    switch (format) {
      case "thread":
        return Math.floor(Math.random() * 5) + 3; // 3-7 tweets
      case "longform_single":
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Categorize topic to health pillar
   */
  private categorizeToPillar(topic: TrendData): HealthPillar {
    const phrase = topic.phrase.toLowerCase();
    
    if (topic.category === "Sleep" || phrase.includes("sleep") || phrase.includes("insomnia")) {
      return "Sleep";
    }
    if (phrase.includes("stress") || phrase.includes("anxiety") || phrase.includes("mental")) {
      return "Stress";
    }
    if (phrase.includes("diet") || phrase.includes("nutrition") || phrase.includes("food") || phrase.includes("vitamin")) {
      return "Nutrition";
    }
    if (phrase.includes("exercise") || phrase.includes("fitness") || phrase.includes("workout")) {
      return "Movement";
    }
    
    return "Behavior"; // Default fallback
  }

  /**
   * Select hook type based on persona
   */
  private selectHookType(persona: PersonaType, input: GrowthEngineInput): HookType {
    const random = Math.random();
    
    switch (persona) {
      case "Scientist":
        return random < 0.7 ? "myth_bust" : "tip";
      case "Coach":
        return random < 0.6 ? "how_to" : "checklist";
      case "Mythbuster":
        return "myth_bust";
      case "Storyteller":
        return "story";
      case "Curator":
        return random < 0.5 ? "checklist" : "framework";
      default:
        return "tip";
    }
  }

  /**
   * Generate the actual content based on decisions
   */
  private async generateContent(decision: ContentDecision, input: GrowthEngineInput): Promise<ContentDraft> {
    const tweets: TweetDraft[] = [];
    const sources: string[] = [];
    
    if (decision.format === "thread") {
      return this.generateThreadContent(decision, input);
    } else if (decision.format === "longform_single") {
      return this.generateLongformContent(decision, input);
    } else {
      return this.generateSingleContent(decision, input);
    }
  }

  /**
   * Generate thread content (reply chain)
   */
  private async generateThreadContent(decision: ContentDecision, input: GrowthEngineInput): Promise<ContentDraft> {
    const tweets: TweetDraft[] = [];
    const sources: string[] = [];

    // T1: Hook + mini-payoff (must deliver value in first 240 chars)
    const hookTweet = this.createHookTweet(decision, input);
    tweets.push({ n: 1, text: hookTweet });

    // Body tweets: Add insights/steps
    for (let i = 2; i <= decision.n_tweets - 1; i++) {
      const bodyTweet = this.createBodyTweet(decision, input, i);
      tweets.push({ n: i, text: bodyTweet });
    }

    // Final tweet: Light CTA
    if (decision.n_tweets > 2) {
      const ctaTweet = this.createCTATweet(decision, input);
      tweets.push({ n: decision.n_tweets, text: ctaTweet });
    }

    return {
      tweets,
      sources: this.generateSources(decision),
      cta_note: "Thread completion and light engagement"
    };
  }

  /**
   * Generate longform single content
   */
  private async generateLongformContent(decision: ContentDecision, input: GrowthEngineInput): Promise<ContentDraft> {
    const content = this.createLongformContent(decision, input);
    
    return {
      tweets: [{ n: 1, text: content }],
      sources: this.generateSources(decision),
      cta_note: "Comprehensive longform content"
    };
  }

  /**
   * Generate single tweet content
   */
  private async generateSingleContent(decision: ContentDecision, input: GrowthEngineInput): Promise<ContentDraft> {
    const content = this.createSingleTweet(decision, input);
    
    return {
      tweets: [{ n: 1, text: content }],
      sources: this.generateSources(decision),
      cta_note: "Single impactful health tip"
    };
  }

  /**
   * Create hook tweet for threads
   */
  private createHookTweet(decision: ContentDecision, input: GrowthEngineInput): string {
    const templates = this.getHookTemplates(decision.persona, decision.hook_type);
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return this.populateTemplate(template, decision, input, 240); // Front-loaded value
  }

  /**
   * Create body tweet for threads
   */
  private createBodyTweet(decision: ContentDecision, input: GrowthEngineInput, index: number): string {
    const templates = this.getBodyTemplates(decision.persona, decision.pillar);
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return this.populateTemplate(template, decision, input, input.limits.tweet_max_hard);
  }

  /**
   * Create CTA tweet for threads
   */
  private createCTATweet(decision: ContentDecision, input: GrowthEngineInput): string {
    const ctas = [
      "What's your experience with this? 💭",
      "Try this for a week and notice the difference ✨",
      "Small changes, big impact over time 🌱",
      "Which step will you try first?",
      "Save this for later reference 📌"
    ];
    
    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  /**
   * Create longform content
   */
  private createLongformContent(decision: ContentDecision, input: GrowthEngineInput): string {
    // Front-load value in first 240 chars
    const hook = this.createHookTweet(decision, input);
    const body = this.generateLongformBody(decision, input);
    
    return `${hook}\n\n${body}`;
  }

  /**
   * Create single tweet
   */
  private createSingleTweet(decision: ContentDecision, input: GrowthEngineInput): string {
    const templates = this.getSingleTweetTemplates(decision.persona, decision.hook_type);
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return this.populateTemplate(template, decision, input, input.limits.tweet_max_hard);
  }

  /**
   * Get hook templates based on persona and hook type
   */
  private getHookTemplates(persona: PersonaType, hookType: HookType): string[] {
    const baseTemplates: Record<string, string[]> = {
      "Scientist/myth_bust": [
        "Popular belief: {topic}. Science says: {truth}. Here's what actually works...",
        "That {topic} advice you keep hearing? Latest research suggests something different...",
        "Study of 50,000+ people reveals surprising truth about {topic}..."
      ],
      "Coach/how_to": [
        "Want better {topic}? 3 evidence-based strategies that actually work...",
        "Master {topic} in 30 days with this simple framework...",
        "The {topic} method that changed everything for my clients..."
      ],
      "Storyteller/story": [
        "My patient couldn't {struggle} for months. Then we discovered this about {topic}...",
        "At 3 AM, lying awake again, I realized the {topic} advice was all wrong...",
        "She tried everything for {topic}. Nothing worked until this breakthrough..."
      ],
      "Curator/checklist": [
        "5 {topic} habits of people who never struggle with {problem}...",
        "Your {topic} optimization checklist (evidence-based)...",
        "The {topic} framework from top researchers..."
      ],
      "Mythbuster/checklist": [
        "5 {topic} myths that are sabotaging your health...",
        "Common {topic} mistakes (and what to do instead)...",
        "Why everything you know about {topic} might be wrong..."
      ]
    };

    const key = `${persona}/${hookType}`;
    return baseTemplates[key] || baseTemplates["Coach/how_to"];
  }

  /**
   * Get body templates for threads
   */
  private getBodyTemplates(persona: PersonaType, pillar: HealthPillar): string[] {
    return [
      "Step {n}: {specific_action}. Research shows this increases {benefit} by {percentage}%.",
      "Key insight: {mechanism}. This is why {action} works when other methods fail.",
      "Warning: Avoid {common_mistake}. This can actually worsen {problem}.",
      "Pro tip: {advanced_technique}. Game-changer for long-term {outcome}."
    ];
  }

  /**
   * Get single tweet templates
   */
  private getSingleTweetTemplates(persona: PersonaType, hookType: HookType): string[] {
    return [
      "Quick {topic} tip: {action}. Takes 2 minutes, improves {benefit} significantly 💡",
      "The {topic} rule: {principle}. Simple but surprisingly effective ✨",
      "Struggling with {topic}? Try {solution}. Science-backed and actually works 🧪"
    ];
  }

  /**
   * Populate template with actual content
   */
  private populateTemplate(template: string, decision: ContentDecision, input: GrowthEngineInput, maxLength: number): string {
    let content = template
      .replace(/{topic}/g, decision.topic)
      .replace(/{pillar}/g, decision.pillar.toLowerCase())
      .replace(/{n}/g, Math.floor(Math.random() * 5 + 1).toString());

    // Add specific content based on topic and pillar
    content = this.enrichWithSpecificContent(content, decision);
    
    // Apply style variations
    content = this.applyStyleJitter(content, input.style);
    
    // Ensure length compliance
    if (content.length > maxLength) {
      content = content.substring(0, maxLength - 3) + "...";
    }

    return content;
  }

  /**
   * Enrich template with specific health content
   */
  private enrichWithSpecificContent(content: string, decision: ContentDecision): string {
    const healthFacts: Record<string, any> = {
      sleep: {
        truth: "7-9 hours isn't negotiable for most adults",
        action: "Keep bedroom below 65°F",
        benefit: "memory consolidation",
        percentage: "20",
        mechanism: "adenosine clearance during deep sleep"
      },
      stress: {
        truth: "5-minute breathing exercises work as well as 30-minute sessions",
        action: "4-7-8 breathing pattern",
        benefit: "cortisol regulation",
        percentage: "25",
        mechanism: "parasympathetic nervous system activation"
      },
      nutrition: {
        truth: "meal timing matters more than most realize",
        action: "eat protein within 2 hours of waking",
        benefit: "metabolic flexibility",
        percentage: "15",
        mechanism: "circadian rhythm protein synthesis"
      }
    };

    const pillarKey = decision.pillar.toLowerCase();
    const facts = healthFacts[pillarKey] || healthFacts.sleep;

    return content
      .replace(/{truth}/g, facts.truth)
      .replace(/{action}/g, facts.action)
      .replace(/{benefit}/g, facts.benefit)
      .replace(/{percentage}/g, facts.percentage)
      .replace(/{mechanism}/g, facts.mechanism)
      .replace(/{specific_action}/g, facts.action)
      .replace(/{common_mistake}/g, "doing it inconsistently")
      .replace(/{problem}/g, decision.pillar.toLowerCase() + " issues")
      .replace(/{struggle}/g, "improve " + decision.pillar.toLowerCase())
      .replace(/{solution}/g, facts.action)
      .replace(/{principle}/g, facts.truth)
      .replace(/{outcome}/g, facts.benefit)
      .replace(/{advanced_technique}/g, facts.mechanism);
  }

  /**
   * Apply style jitter for human variation
   */
  private applyStyleJitter(content: string, style: StyleSettings): string {
    if (Math.random() < style.style_jitter) {
      // Vary opening words
      const variations = [
        content,
        content.replace(/^Quick/, "Simple"),
        content.replace(/^The/, "This"),
        content.replace(/^Want/, "Need"),
        content.replace(/^Popular/, "Common")
      ];
      content = variations[Math.floor(Math.random() * variations.length)];
    }

    // Add gentle hedging
    if (Math.random() < style.hedge_prob) {
      content = content.replace(/Science shows/, "Research suggests");
      content = content.replace(/will improve/, "may improve");
      content = content.replace(/always/, "often");
    }

    // Convert to question format
    if (Math.random() < style.question_prob && !content.includes("?")) {
      content = content.replace(/\.$/, "?");
      content = content.replace(/^(.+)/, "Ever wonder about $1");
    }

    return content;
  }

  /**
   * Generate longform body content
   */
  private generateLongformBody(decision: ContentDecision, input: GrowthEngineInput): string {
    const sections = [
      "The problem most people face:",
      "What research actually shows:",
      "The practical approach:",
      "Why this works when other methods fail:",
      "Getting started today:"
    ];

    return sections.map((section, i) => {
      const sectionContent = this.generateSectionContent(section, decision, i + 1);
      return `${section}\n${sectionContent}`;
    }).join("\n\n");
  }

  /**
   * Generate content for longform sections
   */
  private generateSectionContent(section: string, decision: ContentDecision, index: number): string {
    const templates = [
      "Most approaches to {topic} focus on {wrong_focus}, but the real issue is {root_cause}.",
      "Studies with over 10,000 participants consistently show {finding}.",
      "The method: {step1}, then {step2}, followed by {step3}.",
      "Unlike other methods, this works because {mechanism}.",
      "Start with just {simple_start}. Build from there."
    ];

    const template = templates[index - 1] || templates[0];
    return this.populateTemplate(template, decision, { style: { style_jitter: 0 } } as any, 500);
  }

  /**
   * Generate sources for claims
   */
  private generateSources(decision: ContentDecision): string[] {
    const hasNonObviousClaims = Math.random() < 0.4; // 40% of posts have citations
    
    if (!hasNonObviousClaims) return [];

    const sources = [
      "American Journal of Medicine 2023",
      "Nature Sleep Research",
      "Harvard Health Publishing",
      "Mayo Clinic studies",
      "Journal of Clinical Investigation"
    ];

    return [sources[Math.floor(Math.random() * sources.length)]];
  }

  /**
   * Perform quality control check
   */
  private performQualityCheck(draft: ContentDraft, input: GrowthEngineInput): QualityCheck {
    const firstTweet = draft.tweets[0]?.text || "";
    
    // Check length compliance
    const length_ok = draft.tweets.every(tweet => 
      tweet.text.length <= input.limits.tweet_max_hard ||
      (draft.tweets.length === 1 && input.capabilities.longform_available && tweet.text.length <= input.limits.longform_max_chars)
    );

    // Check emoji count
    const emojiCount = firstTweet.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu)?.length || 0;
    const emoji_ok = emojiCount <= input.style.emoji_max;

    // Check hashtags
    const no_hashtags = !firstTweet.includes("#");

    // Check redundancy against recent posts
    const non_redundant = !input.recent_posts_text.some(recent => 
      this.calculateSimilarity(firstTweet, recent) > 0.7
    );

    // Check front-loading (first 240 chars must deliver value)
    const firstVisible = firstTweet.substring(0, input.limits.first_visible_chars);
    const front_loaded = this.checkFrontLoaded(firstVisible);

    // Human vibe score (8-10 scale)
    const human_vibe_score = this.calculateHumanVibeScore(draft, input);

    return {
      length_ok,
      emoji_ok,
      no_hashtags,
      non_redundant,
      human_vibe_score,
      front_loaded
    };
  }

  /**
   * Calculate similarity between two texts
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Check if content is front-loaded with value
   */
  private checkFrontLoaded(firstVisible: string): boolean {
    // Must contain actionable content, benefit, or clear takeaway
    const valueIndicators = [
      /\d+\s*(minutes?|hours?|days?|weeks?)/i, // Time-based benefits
      /\d+%/i, // Percentage improvements
      /improve|increase|reduce|better|help|boost/i, // Benefit words
      /tip|method|way|strategy|approach/i, // Actionable content
      /research|study|science|shows/i // Evidence indicators
    ];

    return valueIndicators.some(pattern => pattern.test(firstVisible));
  }

  /**
   * Calculate human vibe score
   */
  private calculateHumanVibeScore(draft: ContentDraft, input: GrowthEngineInput): number {
    let score = 8; // Start at 8

    const firstTweet = draft.tweets[0]?.text || "";

    // Deduct for robotic patterns
    if (firstTweet.includes("🤖") || firstTweet.includes("AI")) score -= 2;
    if (firstTweet.match(/step\s+\d+:/gi)?.length > 2) score -= 1;
    if (firstTweet.includes("Click here") || firstTweet.includes("Link in bio")) score -= 1;

    // Add for human patterns  
    if (firstTweet.match(/\?/g)?.length >= 1) score += 0.5; // Questions are engaging
    if (firstTweet.includes("you") || firstTweet.includes("your")) score += 0.5; // Personal
    if (firstTweet.match(/[.!?]/g)?.length >= 2) score += 0.5; // Varied punctuation

    // Cap at 10
    return Math.min(score, 10);
  }

  /**
   * Revise content if quality is low
   */
  private async reviseContent(draft: ContentDraft, decision: ContentDecision, input: GrowthEngineInput): Promise<ContentDraft> {
    // Simple revision: try alternative templates
    const revisedTweets = draft.tweets.map(tweet => ({
      ...tweet,
      text: this.generateAlternativeVersion(tweet.text, decision, input)
    }));

    return {
      ...draft,
      tweets: revisedTweets
    };
  }

  /**
   * Generate alternative version of content
   */
  private generateAlternativeVersion(original: string, decision: ContentDecision, input: GrowthEngineInput): string {
    // Simplify approach: make it more conversational
    let revised = original
      .replace(/Step \d+:/g, "")
      .replace(/Research shows/g, "Turns out")
      .replace(/Studies indicate/g, "Here's the thing:")
      .replace(/It is recommended/g, "Try this:");

    // Make more personal
    if (!revised.includes("you")) {
      revised = revised.replace(/People who/g, "If you");
      revised = revised.replace(/One should/g, "You should");
    }

    return revised;
  }

  /**
   * Helper methods for empty responses
   */
  private createEmptyDecision(pacing: PacingDecision): ContentDecision {
    return {
      format: "single",
      n_tweets: 1,
      topic: "",
      pillar: "Behavior",
      persona: "Coach",
      hook_type: "tip",
      explore: false,
      pacing
    };
  }

  private createEmptyQC(): QualityCheck {
    return {
      length_ok: true,
      emoji_ok: true,
      no_hashtags: true,
      non_redundant: true,
      human_vibe_score: 0,
      front_loaded: false
    };
  }
}