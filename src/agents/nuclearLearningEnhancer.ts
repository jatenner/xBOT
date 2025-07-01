import { supabase } from '../utils/supabaseClient';

interface ViralPattern {
  type: string;
  success_rate: number;
  elements: string[];
  examples: string[];
}

interface TrendingTopic {
  topic: string;
  trend_score: number;
  engagement_potential: number;
  viral_hooks: string[];
}

interface CompetitiveIntelligence {
  top_performers: Array<{
    username: string;
    followers: number;
    patterns: string[];
    best_content: string[];
  }>;
  successful_formulas: Array<{
    formula: string;
    success_rate: number;
    example: string;
  }>;
}

export class NuclearLearningEnhancer {
  private static instance: NuclearLearningEnhancer | null = null;
  
  private viralPatterns: ViralPattern[] = [];
  private trendingTopics: TrendingTopic[] = [];
  private competitiveIntelligence: CompetitiveIntelligence | null = null;
  private lastLearningUpdate: Date = new Date(0);
  
  public static getInstance(): NuclearLearningEnhancer {
    if (!NuclearLearningEnhancer.instance) {
      NuclearLearningEnhancer.instance = new NuclearLearningEnhancer();
    }
    return NuclearLearningEnhancer.instance;
  }

  constructor() {
    this.initializeLearningData();
  }

  private async initializeLearningData(): Promise<void> {
    try {
      console.log('🧠 Initializing nuclear learning intelligence...');
      await this.loadViralPatterns();
      await this.loadTrendingTopics();
      await this.loadCompetitiveIntelligence();
      console.log('✅ Nuclear learning intelligence loaded');
    } catch (error) {
      console.warn('⚠️ Error initializing learning data:', error);
    }
  }

  private async loadViralPatterns(): Promise<void> {
    try {
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'viral_intelligence_patterns')
        .single();
      
      if (data?.value?.patterns) {
        this.viralPatterns = data.value.patterns;
        console.log(`📊 Loaded ${this.viralPatterns.length} viral patterns`);
      }
    } catch (error) {
      console.warn('Failed to load viral patterns:', error);
    }
  }

  private async loadTrendingTopics(): Promise<void> {
    try {
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'trending_topics_intelligence')
        .single();
      
      if (data?.value?.topics) {
        this.trendingTopics = data.value.topics;
        console.log(`📈 Loaded ${this.trendingTopics.length} trending topics`);
      }
    } catch (error) {
      console.warn('Failed to load trending topics:', error);
    }
  }

  private async loadCompetitiveIntelligence(): Promise<void> {
    try {
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'competitive_intelligence')
        .single();
      
      if (data?.value) {
        this.competitiveIntelligence = data.value;
        console.log(`🕵️ Loaded competitive intelligence from ${this.competitiveIntelligence?.top_performers?.length || 0} top performers`);
      }
    } catch (error) {
      console.warn('Failed to load competitive intelligence:', error);
    }
  }

  public async generateCreativeContent(): Promise<string> {
    console.log('🎨 Generating NUCLEAR creative content...');
    
    // Refresh data if it's been more than 1 hour
    if (Date.now() - this.lastLearningUpdate.getTime() > 3600000) {
      await this.initializeLearningData();
      this.lastLearningUpdate = new Date();
    }

    // Choose the most viral pattern
    const topViralPattern = this.viralPatterns
      .sort((a, b) => b.success_rate - a.success_rate)[0];
    
    if (!topViralPattern) {
      return this.generateFallbackCreativeContent();
    }

    console.log(`🔥 Using top viral pattern: ${topViralPattern.type} (${topViralPattern.success_rate}% success)`);

    switch (topViralPattern.type) {
      case 'breaking_news':
        return this.generateBreakingNewsContent();
      case 'hot_take':
        return this.generateHotTakeContent();
      case 'data_bomb':
        return this.generateDataBombContent();
      case 'thread_starter':
        return this.generateThreadStarterContent();
      default:
        return this.generateFallbackCreativeContent();
    }
  }

  private async generateBreakingNewsContent(): Promise<string> {
    const topTrend = this.trendingTopics
      .sort((a, b) => b.trend_score - a.trend_score)[0];
    
    if (topTrend?.viral_hooks?.length > 0) {
      const hook = topTrend.viral_hooks[Math.floor(Math.random() * topTrend.viral_hooks.length)];
      return `🚨 BREAKING: ${hook}\n\nThis could revolutionize healthcare within the next 5 years. The implications are staggering.`;
    }

    const fallbackHooks = [
      'AI just achieved 99.2% accuracy in early cancer detection',
      'New brain implant allows paralyzed patients to control devices with thoughts',
      'Digital therapeutics approved by FDA as prescription treatments',
      'Quantum computing breakthrough accelerates drug discovery by 1000x'
    ];

    const hook = fallbackHooks[Math.floor(Math.random() * fallbackHooks.length)];
    return `🚨 BREAKING: ${hook}\n\nThis changes everything we know about modern medicine.`;
  }

  private async generateHotTakeContent(): Promise<string> {
    const controversialTakes = [
      'AI will replace 80% of medical diagnosis within 10 years, and that\'s actually good news for patients',
      'Digital therapeutics are more effective than pills for most mental health conditions',
      'Healthcare AI bias isn\'t a tech problem, it\'s a data problem we\'re afraid to fix',
      'Telemedicine will make 70% of doctor visits obsolete by 2030',
      'Most health apps are digital snake oil - only 3% have real clinical evidence'
    ];

    const take = controversialTakes[Math.floor(Math.random() * controversialTakes.length)];
    return `💡 Hot take: ${take}\n\nChange my mind in the comments 👇`;
  }

  private async generateDataBombContent(): Promise<string> {
    const dataBombs = [
      '📊 Wild stat: Healthcare AI market will hit $148B by 2030 (10x growth from today)',
      '📈 Crazy numbers: Telemedicine reduces healthcare costs by $2,400 per patient annually',
      '📊 Mind-blowing fact: AI can detect diabetic retinopathy with 90% accuracy from a single photo',
      '📈 Shocking data: Remote patient monitoring reduces hospital readmissions by 50%',
      '📊 Insane metric: AI-powered drug discovery reduces development time from 15 years to 3 years'
    ];

    const bomb = dataBombs[Math.floor(Math.random() * dataBombs.length)];
    return `${bomb}\n\nThe numbers don't lie - we're witnessing the transformation of healthcare in real-time.`;
  }

  private async generateThreadStarterContent(): Promise<string> {
    const threadTopics = [
      '5 healthcare AI breakthroughs that will blow your mind (and why #3 changes everything)',
      '7 digital health innovations that are silently revolutionizing medicine',
      '4 ways AI is already saving lives (but most people don\'t know about #2)',
      '6 healthcare technologies that will dominate 2025 (insider predictions)'
    ];

    const topic = threadTopics[Math.floor(Math.random() * threadTopics.length)];
    return `🧵 Thread: ${topic}\n\n1/ AI diagnostics just achieved superhuman accuracy in cancer detection, but that's just the beginning...`;
  }

  private generateFallbackCreativeContent(): string {
    return '💡 The future of healthcare is being written right now.\n\nAI, digital therapeutics, and precision medicine are converging to create possibilities we never imagined.';
  }

  public async getOptimalContentStrategy(): Promise<any> {
    try {
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'intelligent_content_strategy')
        .single();
      
      return data?.value || this.getDefaultStrategy();
    } catch (error) {
      console.warn('Failed to get content strategy:', error);
      return this.getDefaultStrategy();
    }
  }

  private getDefaultStrategy(): any {
    return {
      enabled: true,
      strategy_mode: 'adaptive_learning',
      content_mix: {
        breaking_news: 25,
        hot_takes: 20,
        data_insights: 20,
        trending_topics: 15,
        threads: 10,
        educational: 10
      },
      creativity_level: 'maximum'
    };
  }

  public async generateCompetitorInspiredContent(): Promise<string> {
    if (!this.competitiveIntelligence?.successful_formulas) {
      return this.generateFallbackCreativeContent();
    }

    const bestFormula = this.competitiveIntelligence.successful_formulas
      .sort((a, b) => b.success_rate - a.success_rate)[0];

    console.log(`🕵️ Using competitive formula: ${bestFormula.formula} (${bestFormula.success_rate}% success)`);

    if (bestFormula.formula.includes('SHOCKING_STAT')) {
      return 'AI accuracy in cancer detection just hit 99.2% (better than human doctors). This will save millions of lives. Are we ready for AI-first healthcare?';
    }

    if (bestFormula.formula.includes('CONTRARIAN_TAKE')) {
      return 'Unpopular opinion: Most health apps are useless. Only 3% have clinical evidence. But those 3% will revolutionize healthcare in the next 5 years.';
    }

    return bestFormula.example || this.generateFallbackCreativeContent();
  }

  public async enhanceContentWithViralElements(content: string): Promise<string> {
    let enhancedContent = content;

    try {
      // Add viral elements from top patterns
      const topPattern = this.viralPatterns
        .sort((a, b) => b.success_rate - a.success_rate)[0];

      if (topPattern?.elements) {
        // Add breaking news element if not present
        if (topPattern.elements.includes('🚨') && !enhancedContent.includes('🚨')) {
          enhancedContent = '🚨 ' + enhancedContent;
        }

        // Add hot take element if appropriate
        if (topPattern.elements.includes('💡') && !enhancedContent.includes('💡') && 
            enhancedContent.toLowerCase().includes('opinion') || enhancedContent.toLowerCase().includes('take')) {
          enhancedContent = '💡 ' + enhancedContent;
        }

        // Add data element if contains numbers
        if (topPattern.elements.includes('📊') && !enhancedContent.includes('📊') &&
            /\d+%|\d+x|\$\d+/.test(enhancedContent)) {
          enhancedContent = '📊 ' + enhancedContent;
        }

        // Add thread element if long enough
        if (topPattern.elements.includes('🧵') && !enhancedContent.includes('🧵') &&
            enhancedContent.length > 200) {
          enhancedContent = '🧵 ' + enhancedContent;
        }
      }

    } catch (error) {
      console.warn('Error enhancing content with viral elements:', error);
    }

    return enhancedContent;
  }

  public getTopTrendingTopic(): TrendingTopic | null {
    return this.trendingTopics
      .sort((a, b) => b.trend_score - a.trend_score)[0] || null;
  }

  public getBestViralPattern(): ViralPattern | null {
    return this.viralPatterns
      .sort((a, b) => b.success_rate - a.success_rate)[0] || null;
  }

  public async updateLearningData(): Promise<void> {
    console.log('🔄 Updating nuclear learning data...');
    await this.initializeLearningData();
    this.lastLearningUpdate = new Date();
    console.log('✅ Learning data updated');
  }
} 