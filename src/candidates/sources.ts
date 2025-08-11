/**
 * 🎮 GAMING CONTENT SOURCES
 * 
 * PURPOSE: Pluggable content sources for gaming niche
 * STRATEGY: Trends, news, tips with fallback to local seeds
 */

import { createHash } from 'crypto';

export interface ContentCandidate {
  text: string;
  topic: string;
  tags: string[];
  mediaHint: 'clip' | 'image' | 'none';
  freshness: number; // 0-1 score
  hash: string;
  source: string;
  priority: number;
}

export interface SourceConfig {
  enabled: boolean;
  maxCandidates: number;
  freshnessWeight: number;
}

/**
 * Gaming trends source (X API integration)
 * TODO(api): Replace with real X API when available
 */
export class GamingTrendsSource {
  private config: SourceConfig;

  constructor(config: SourceConfig = { enabled: true, maxCandidates: 15, freshnessWeight: 0.8 }) {
    this.config = config;
  }

  async getCandidates(): Promise<ContentCandidate[]> {
    if (!this.config.enabled) return [];

    // TODO(api): Replace with real X API call
    // const trends = await xApi.getTrends({ category: 'gaming', limit: 20 });
    
    // Local gaming trends seed data
    const trendSeeds = [
      { keyword: 'Fortnite', engagement: 0.9, type: 'battle_royale' },
      { keyword: 'Valorant', engagement: 0.8, type: 'fps' },
      { keyword: 'League of Legends', engagement: 0.85, type: 'moba' },
      { keyword: 'Apex Legends', engagement: 0.7, type: 'battle_royale' },
      { keyword: 'CS2', engagement: 0.75, type: 'fps' },
      { keyword: 'Genshin Impact', engagement: 0.6, type: 'rpg' },
      { keyword: 'Minecraft', engagement: 0.8, type: 'sandbox' },
      { keyword: 'Overwatch 2', engagement: 0.65, type: 'fps' },
      { keyword: 'World of Warcraft', engagement: 0.7, type: 'mmorpg' },
      { keyword: 'Baldurs Gate 3', engagement: 0.9, type: 'rpg' },
      { keyword: 'Cyberpunk 2077', engagement: 0.6, type: 'rpg' },
      { keyword: 'Call of Duty', engagement: 0.8, type: 'fps' },
      { keyword: 'FIFA 24', engagement: 0.7, type: 'sports' },
      { keyword: 'Rocket League', engagement: 0.65, type: 'sports' },
      { keyword: 'Among Us', engagement: 0.5, type: 'social' }
    ];

    const candidates: ContentCandidate[] = [];
    const templates = [
      "Hot take: {keyword} {opinion}",
      "Why {keyword} players are {trait}",
      "{keyword} tip that pros don't want you to know",
      "Unpopular opinion: {keyword} {controversial_take}",
      "If you play {keyword}, you need to {advice}",
      "{keyword} community is {observation}",
      "Just watched {keyword} and {reaction}",
      "Remember when {keyword} {nostalgia}?",
      "{keyword} players: {relatable_struggle}",
      "POV: You're a {keyword} main and {situation}"
    ];

    const opinions = [
      "is overrated", "deserves more recognition", "changed gaming forever",
      "needs a major update", "has the best community", "is harder than it looks"
    ];

    const traits = [
      "built different", "the most toxic", "actually really skilled",
      "underestimated", "way too competitive", "surprisingly wholesome"
    ];

    const controversialTakes = [
      "peaked years ago", "was better in beta", "is pay-to-win now",
      "has too much RNG", "needs skill-based matchmaking", "is too casual now"
    ];

    for (const trend of trendSeeds.slice(0, this.config.maxCandidates)) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      let text = template.replace('{keyword}', trend.keyword);
      
      if (text.includes('{opinion}')) {
        text = text.replace('{opinion}', opinions[Math.floor(Math.random() * opinions.length)]);
      }
      if (text.includes('{trait}')) {
        text = text.replace('{trait}', traits[Math.floor(Math.random() * traits.length)]);
      }
      if (text.includes('{controversial_take}')) {
        text = text.replace('{controversial_take}', controversialTakes[Math.floor(Math.random() * controversialTakes.length)]);
      }
      if (text.includes('{advice}')) {
        text = text.replace('{advice}', 'master the fundamentals');
      }
      if (text.includes('{observation}')) {
        text = text.replace('{observation}', 'surprisingly supportive');
      }
      if (text.includes('{reaction}')) {
        text = text.replace('{reaction}', 'I\'m impressed');
      }
      if (text.includes('{nostalgia}')) {
        text = text.replace('{nostalgia}', 'was actually good');
      }
      if (text.includes('{relatable_struggle}')) {
        text = text.replace('{relatable_struggle}', 'we\'ve all been there');
      }
      if (text.includes('{situation}')) {
        text = text.replace('{situation}', 'everyone targets you');
      }

      const hash = createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
      
      candidates.push({
        text,
        topic: `gaming_${trend.type}`,
        tags: [`#${trend.keyword.replace(/\s+/g, '')}`, '#gaming'],
        mediaHint: Math.random() > 0.7 ? 'clip' : 'none',
        freshness: trend.engagement * this.config.freshnessWeight,
        hash,
        source: 'gaming_trends',
        priority: Math.floor(trend.engagement * 100)
      });
    }

    return candidates;
  }
}

/**
 * Gaming news source
 * TODO(api): Replace with real news API when available
 */
export class GamingNewsSource {
  private config: SourceConfig;

  constructor(config: SourceConfig = { enabled: true, maxCandidates: 10, freshnessWeight: 0.9 }) {
    this.config = config;
  }

  async getCandidates(): Promise<ContentCandidate[]> {
    if (!this.config.enabled) return [];

    // TODO(api): Replace with real news API call
    // const news = await newsApi.getGamingNews({ limit: 15, hours: 24 });

    // Local gaming news seed data
    const newsSeeds = [
      {
        headline: "New Fortnite season breaks player records",
        summary: "Epic Games reports highest concurrent players ever",
        category: "battle_royale",
        impact: 0.9
      },
      {
        headline: "Valorant announces new agent and map",
        summary: "Riot Games reveals Agent 25 with unique abilities",
        category: "fps",
        impact: 0.8
      },
      {
        headline: "CS2 major tournament prize pool announced",
        summary: "$2M prize pool for upcoming championship",
        category: "esports",
        impact: 0.85
      },
      {
        headline: "Indie game wins unexpected popularity",
        summary: "Small studio game goes viral on social media",
        category: "indie",
        impact: 0.7
      },
      {
        headline: "Gaming hardware shortage continues",
        summary: "Graphics cards still hard to find at reasonable prices",
        category: "hardware",
        impact: 0.6
      }
    ];

    const candidates: ContentCandidate[] = [];

    for (const news of newsSeeds) {
      // Generate 2-3 variants per news item
      const variants = [
        // Thread starter
        `🧵 Breaking: ${news.headline}\n\n${news.summary}\n\nWhat this means for gamers: [thread]`,
        // Hot take
        `Hot take: ${news.headline.toLowerCase()}\n\n${news.summary}\n\nThoughts?`,
        // Single tweet
        `${news.headline} 🎮\n\n${news.summary}`
      ];

      variants.forEach((text, index) => {
        const hash = createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
        
        candidates.push({
          text,
          topic: `gaming_${news.category}`,
          tags: ['#gaming', '#news'],
          mediaHint: index === 0 ? 'none' : 'image', // Threads usually no media
          freshness: news.impact * this.config.freshnessWeight,
          hash,
          source: 'gaming_news',
          priority: Math.floor(news.impact * 80) + index * 5
        });
      });
    }

    return candidates.slice(0, this.config.maxCandidates);
  }
}

/**
 * Gaming tips source
 */
export class GamingTipsSource {
  private config: SourceConfig;

  constructor(config: SourceConfig = { enabled: true, maxCandidates: 8, freshnessWeight: 0.6 }) {
    this.config = config;
  }

  async getCandidates(): Promise<ContentCandidate[]> {
    if (!this.config.enabled) return [];

    const tipCategories = [
      {
        category: 'fps',
        tips: [
          "Lower your mouse sensitivity for better aim precision",
          "Practice crosshair placement at head level",
          "Learn common angles and pre-aim them",
          "Use sound cues to track enemy movements",
          "Master the spray patterns of your main weapons"
        ]
      },
      {
        category: 'moba',
        tips: [
          "Last-hit minions for maximum gold efficiency",
          "Ward key areas to prevent ganks",
          "Learn to freeze lanes for map control",
          "Focus on objectives over kills",
          "Master 2-3 champions instead of playing everything"
        ]
      },
      {
        category: 'general',
        tips: [
          "Take regular breaks to prevent eye strain",
          "Stay hydrated during long gaming sessions",
          "Adjust your chair height for better posture",
          "Use blue light filters for late-night gaming",
          "Keep your gaming area clean and organized"
        ]
      }
    ];

    const candidates: ContentCandidate[] = [];
    const templates = [
      "Gaming tip #{index}: {tip} 💡",
      "Pro tip: {tip} 🎯",
      "If you want to improve at gaming: {tip}",
      "Underrated gaming advice: {tip}",
      "Quick tip for better gameplay: {tip}"
    ];

    let tipIndex = 1;
    for (const category of tipCategories) {
      for (const tip of category.tips.slice(0, Math.ceil(this.config.maxCandidates / tipCategories.length))) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        const text = template.replace('{tip}', tip).replace('{index}', tipIndex.toString());
        const hash = createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
        
        candidates.push({
          text,
          topic: `gaming_${category.category}`,
          tags: ['#gaming', '#tips'],
          mediaHint: 'none',
          freshness: this.config.freshnessWeight,
          hash,
          source: 'gaming_tips',
          priority: 60 + tipIndex
        });
        
        tipIndex++;
      }
    }

    return candidates.slice(0, this.config.maxCandidates);
  }
}

/**
 * Source aggregator
 */
export class ContentSourceManager {
  private sources: Map<string, any> = new Map();

  constructor() {
    this.sources.set('trends', new GamingTrendsSource());
    this.sources.set('news', new GamingNewsSource());
    this.sources.set('tips', new GamingTipsSource());
  }

  async getAllCandidates(): Promise<ContentCandidate[]> {
    const allCandidates: ContentCandidate[] = [];

    for (const [name, source] of this.sources) {
      try {
        const candidates = await source.getCandidates();
        console.log(`✅ ${name}: Generated ${candidates.length} candidates`);
        allCandidates.push(...candidates);
      } catch (error: any) {
        console.error(`❌ ${name}: Failed to generate candidates:`, error.message);
      }
    }

    // Sort by priority descending
    return allCandidates.sort((a, b) => b.priority - a.priority);
  }

  getSourceStats(): Record<string, { enabled: boolean; expectedCandidates: number }> {
    const stats: Record<string, { enabled: boolean; expectedCandidates: number }> = {};
    
    for (const [name, source] of this.sources) {
      stats[name] = {
        enabled: source.config?.enabled ?? true,
        expectedCandidates: source.config?.maxCandidates ?? 10
      };
    }

    return stats;
  }
}