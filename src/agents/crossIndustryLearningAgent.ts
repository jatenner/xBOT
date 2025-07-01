import { xClient } from '../utils/xClient';

interface ViralPattern {
  creator: string;
  industry: string;
  structure: ContentStructure;
  engagement: number;
  original_content: string;
  analyzed_at: Date;
}

interface ContentStructure {
  length: number;
  starts_with_number: boolean;
  starts_with_emoji: boolean;
  has_question: boolean;
  has_exclamation: boolean;
  hashtag_count: number;
  emoji_count: number;
  word_count: number;
  caps_ratio: number;
  ends_with_cta: boolean;
  has_thread_indicator: boolean;
  structure_type: string;
}

export class CrossIndustryLearningAgent {
  private viralPatterns: Map<string, ViralPattern> = new Map();
  private industryInsights: Map<string, any> = new Map();

  constructor() {
    console.log('🌐 Cross-Industry Learning Agent initialized');
  }

  async run(): Promise<void> {
    console.log('🚀 Starting cross-industry viral analysis...');
    
    try {
      await this.analyzeMultiIndustryCreators();
      await this.analyzeCurrentViralTrends();
      await this.synthesizePatterns();
      
      console.log('✅ Cross-industry analysis completed');
    } catch (error) {
      console.error('Error in cross-industry analysis:', error);
    }
  }

  private async analyzeMultiIndustryCreators(): Promise<void> {
    console.log('🕵️ Analyzing viral creators across ALL industries...');

    // EXPANDED: Multi-industry viral content creators (50+ creators)
    const viralContentCreators = {
      // Tech/Business Leaders (proven viral content)
      tech: ['elonmusk', 'sundarpichai', 'satyanadella', 'jeffweiner', 'reidhoffman', 'naval', 'paulg', 'balajis'],
      
      // Sports (engagement masters - they know how to make content viral)
      sports: ['stephencurry30', 'KingJames', 'usainbolt', 'Cristiano', 'SerenaWilliams', 'tombrady', 'TheRock'],
      
      // News/Media (viral news format experts)
      media: ['CNN', 'BBCBreaking', 'nytimes', 'WSJ', 'Reuters', 'AP', 'business'],
      
      // Entertainment (viral content creators)
      entertainment: ['TheEllenShow', 'rickygervais', 'ConanOBrien', 'StephenAtHome', 'neilpatrickharris'],
      
      // Business/Finance (authority + viral combination)
      business: ['GaryVee', 'mcuban', 'naval', 'chamath', 'elonmusk', 'reidhoffman', 'jeffweiner'],
      
      // Science/Research (credibility + engagement)
      science: ['neiltyson', 'BillNye', 'CERN', 'SpaceX', 'NIH', 'MIT', 'Stanford'],
      
      // Content Creators (pure viral expertise)
      creators: ['MrBeast', 'mkbhd', 'GaryVee', 'naval', 'balajis', 'chamath'],
      
      // Health Tech Specific (our niche)
      healthTech: ['karendesalvo', 'ericxing1', 'fei_fei_li', 'JohnMattison', 'davidfeinberg', 'AmitGarg_MD']
    };

    // Analyze different industries for viral patterns
    for (const [industry, creators] of Object.entries(viralContentCreators)) {
      console.log(`🔍 Analyzing ${industry} viral patterns...`);
      
      // Sample creators from each industry (limit for API efficiency)
      const sampleCreators = creators.slice(0, 2);
      
      for (const creator of sampleCreators) {
        try {
          // Get their recent high-engagement content
          const topContent = await xClient.searchTweets(`from:${creator}`, 8);
          
          if (topContent && topContent.success && topContent.tweets.length > 0) {
            await this.analyzeViralStructures(creator, topContent.tweets, industry);
          }
          
          // Rate limiting
          await this.delay(2000);
        } catch (error) {
          console.warn(`Could not analyze ${creator} from ${industry}`);
        }
      }
    }
  }

  private async analyzeCurrentViralTrends(): Promise<void> {
    console.log('🔥 Analyzing current viral trends across all topics...');
    
    // Viral content triggers (what makes content go viral)
    const viralTriggers = [
      'BREAKING',
      'first time ever',
      'scientists discover',
      'game changer',
      'revolutionary',
      'study shows',
      'AI breakthrough',
      'major announcement',
      'unprecedented',
      'mind-blowing'
    ];

    for (const trigger of viralTriggers.slice(0, 4)) { // Limit for API
      try {
        const viralTweets = await xClient.searchTweets(`${trigger} -is:retweet lang:en`, 5);
        
        if (viralTweets && viralTweets.success && viralTweets.tweets.length > 0) {
          for (const tweet of viralTweets.tweets || []) {
            const engagement = this.calculateEngagement(tweet);
            
            // Only analyze high-engagement content
            if (engagement > 100) {
              const pattern: ViralPattern = {
                creator: 'viral_trend',
                industry: 'cross_industry',
                structure: this.extractTweetStructure(tweet.text),
                engagement,
                original_content: tweet.text,
                analyzed_at: new Date()
              };
              
              this.viralPatterns.set(`viral_trend_${Date.now()}`, pattern);
            }
          }
        }
        
        await this.delay(3000); // Rate limiting
      } catch (error) {
        console.warn(`Failed to analyze viral trend: ${trigger}`);
      }
    }
  }

  private async analyzeViralStructures(creator: string, tweets: any[], industry: string): Promise<void> {
    try {
      console.log(`🧠 Analyzing viral structures from ${creator} (${industry})`);
      
      for (const tweet of tweets) {
        const engagement = this.calculateEngagement(tweet);
        
        // Focus on high-engagement content
        if (engagement > 50) {
          const pattern: ViralPattern = {
            creator,
            industry,
            structure: this.extractTweetStructure(tweet.text),
            engagement,
            original_content: tweet.text,
            analyzed_at: new Date()
          };
          
          this.viralPatterns.set(`${creator}_${Date.now()}`, pattern);
        }
      }
      
      console.log(`📊 Found ${this.viralPatterns.size} viral patterns from ${creator}`);
      
    } catch (error) {
      console.warn(`Failed to analyze structures for ${creator}:`, error);
    }
  }

  private extractTweetStructure(text: string): ContentStructure {
    return {
      length: text.length,
      starts_with_number: /^\d/.test(text),
      starts_with_emoji: /^[\u{1F600}-\u{1F64F}]|^[\u{1F300}-\u{1F5FF}]|^[\u{1F680}-\u{1F6FF}]/u.test(text),
      has_question: text.includes('?'),
      has_exclamation: text.includes('!'),
      hashtag_count: (text.match(/#\w+/g) || []).length,
      emoji_count: (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length,
      word_count: text.split(' ').length,
      caps_ratio: (text.match(/[A-Z]/g) || []).length / text.length,
      ends_with_cta: /\.(com|ai|org)$|\?$|!$|👇$|🧵$/.test(text.trim()),
      has_thread_indicator: text.includes('🧵') || text.includes('Thread') || text.includes('1/'),
      structure_type: this.classifyStructureType(text)
    };
  }

  private classifyStructureType(text: string): string {
    if (text.includes('🧵') || text.includes('1/')) return 'thread_starter';
    if (text.startsWith('Breaking:') || text.startsWith('BREAKING:')) return 'breaking_news';
    if (text.includes('?') && !text.includes('.')) return 'question_only';
    if (/^\d+\./.test(text)) return 'numbered_list';
    if (text.includes('%') || text.includes('study') || text.includes('research')) return 'statistic_fact';
    if (text.includes('Imagine') || text.includes('Picture') || text.includes('What if')) return 'hypothetical';
    if (text.startsWith('"') || text.startsWith('"')) return 'quote_style';
    return 'standard';
  }

  private calculateEngagement(tweet: any): number {
    if (!tweet.publicMetrics) return 0;
    
    const metrics = tweet.publicMetrics;
    return (metrics.like_count || 0) + 
           (metrics.retweet_count || 0) + 
           (metrics.reply_count || 0);
  }

  private async synthesizePatterns(): Promise<void> {
    console.log('🧬 Synthesizing viral patterns for health tech application...');
    
    // Group patterns by structure type
    const structureGroups = new Map<string, ViralPattern[]>();
    
    for (const pattern of this.viralPatterns.values()) {
      const structureType = pattern.structure.structure_type;
      
      if (!structureGroups.has(structureType)) {
        structureGroups.set(structureType, []);
      }
      structureGroups.get(structureType)!.push(pattern);
    }

    // Analyze what works best
    const insights = new Map<string, any>();
    
    for (const [structureType, patterns] of structureGroups) {
      const avgEngagement = patterns.reduce((sum, p) => sum + p.engagement, 0) / patterns.length;
      const industries = [...new Set(patterns.map(p => p.industry))];
      
      insights.set(structureType, {
        average_engagement: avgEngagement,
        sample_size: patterns.length,
        cross_industries: industries,
        top_performers: patterns
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 3)
          .map(p => ({
            creator: p.creator,
            industry: p.industry,
            engagement: p.engagement,
            sample: p.original_content.substring(0, 100) + '...'
          }))
      });
    }

    this.industryInsights = insights;
    
    console.log(`🎯 Synthesized ${insights.size} viral structure types from ${this.viralPatterns.size} patterns`);
    
    // Log key insights
    for (const [type, data] of insights) {
      console.log(`📈 ${type}: Avg ${data.average_engagement} engagement across ${data.cross_industries.length} industries`);
    }
  }

  // Public methods for other agents to use
  public getTopViralStructures(limit: number = 10): any[] {
    return Array.from(this.industryInsights.entries())
      .sort(([, a], [, b]) => b.average_engagement - a.average_engagement)
      .slice(0, limit)
      .map(([type, data]) => ({ structure_type: type, ...data }));
  }

  public getIndustrySpecificPatterns(industry: string): ViralPattern[] {
    return Array.from(this.viralPatterns.values())
      .filter(pattern => pattern.industry === industry);
  }

  public getBestPerformingPatterns(minEngagement: number = 1000): ViralPattern[] {
    return Array.from(this.viralPatterns.values())
      .filter(pattern => pattern.engagement >= minEngagement)
      .sort((a, b) => b.engagement - a.engagement);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 