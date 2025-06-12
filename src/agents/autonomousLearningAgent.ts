import { openaiClient } from '../utils/openaiClient';
import { supabaseClient } from '../utils/supabaseClient';
import { xClient } from '../utils/xClient';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface LearningInsight {
  category: 'content_strategy' | 'timing_optimization' | 'industry_intelligence' | 'competitive_analysis' | 'creativity_enhancement';
  insight: string;
  confidence: number;
  actionable: boolean;
  implementation_priority: number;
  learned_from: string;
  timestamp: Date;
}

interface IndustryPlayer {
  name: string;
  type: 'company' | 'researcher' | 'institution' | 'publication';
  expertise_areas: string[];
  influence_score: number;
  recent_developments: string[];
  twitter_handle?: string;
  key_personnel: string[];
  funding_info?: any;
  last_updated: Date;
}

interface CreativePattern {
  pattern_type: string;
  description: string;
  success_rate: number;
  engagement_metrics: any;
  usage_frequency: number;
  adaptation_potential: number;
}

export class AutonomousLearningAgent {
  private knowledgeBase: Map<string, any> = new Map();
  private learningPatterns: CreativePattern[] = [];
  private industryPlayers: IndustryPlayer[] = [];
  private adaptiveStrategies: Map<string, any> = new Map();

  constructor() {
    this.initializeKnowledgeBase();
  }

  async run(): Promise<void> {
    try {
      console.log('🧠 === Autonomous Learning Engine Activated ===');
      
      // Multi-threaded learning approach
      await Promise.all([
        this.analyzePerformancePatterns(),
        this.discoverIndustryIntelligence(),
        this.enhanceCreativeCapabilities(),
        this.optimizeContentStrategies(),
        this.buildCompetitiveIntelligence(),
        this.predictTrendEvolution(),
        this.adaptSystemBehavior()
      ]);

      // Synthesize all learning into actionable improvements
      await this.synthesizeLearningIntoImprovements();
      
      console.log('✨ Autonomous learning cycle completed - System evolved!');
      
    } catch (error) {
      console.error('❌ Error in autonomous learning:', error);
    }
  }

  private async analyzePerformancePatterns(): Promise<void> {
    console.log('📊 Analyzing performance patterns for optimization...');

    try {
      // Get recent tweet performance data
      const recentTweets = await supabaseClient.getTweets({ limit: 50 });
      
      if (!recentTweets || recentTweets.length === 0) {
        console.log('⚠️ No recent tweets to analyze');
        return;
      }

      // AI-powered pattern analysis
      const analysisPrompt = `Analyze these tweet performance patterns and extract actionable insights:

${recentTweets.map(tweet => `
Tweet: "${tweet.content}"
Engagement: ${tweet.engagement_score}
Likes: ${tweet.likes}
Retweets: ${tweet.retweets}
Replies: ${tweet.replies}
Time: ${tweet.created_at}
`).join('\n')}

Identify:
1. Content patterns that drive high engagement
2. Timing patterns for optimal posting
3. Topic themes that resonate most
4. Language styles that perform best
5. Format structures that increase virality
6. Unexpected insights that could improve performance

Respond with specific, actionable insights in JSON format:
{
  "content_insights": [],
  "timing_insights": [],
  "engagement_patterns": [],
  "creative_opportunities": [],
  "optimization_recommendations": []
}`;

      const response = await openaiClient.generateResponse(analysisPrompt);
      
      if (response) {
        try {
          const insights = JSON.parse(response);
          await this.storeAndImplementInsights(insights, 'performance_analysis');
          console.log('✅ Performance patterns analyzed and insights stored');
        } catch (parseError) {
          console.warn('⚠️ Could not parse performance insights');
        }
      }

    } catch (error) {
      console.error('Error analyzing performance patterns:', error);
    }
  }

  private async discoverIndustryIntelligence(): Promise<void> {
    console.log('🔍 Discovering latest AI health industry intelligence...');

    try {
      // Multi-source intelligence gathering
      const sources = [
        'https://www.mobihealthnews.com/rss',
        'https://www.healthcareitnews.com/rss.xml',
        'https://venturebeat.com/category/ai/feed/'
      ];

      const intelligenceData = await Promise.all(
        sources.map(async (source) => {
          try {
            const response = await axios.get(source, { timeout: 10000 });
            return this.parseIndustryNews(response.data, source);
          } catch (error) {
            console.warn(`Failed to fetch from ${source}`);
            return [];
          }
        })
      );

      const allNews = intelligenceData.flat();

      // AI-powered industry analysis
      const industryAnalysisPrompt = `Analyze this AI health industry intelligence and extract key insights:

${allNews.slice(0, 20).map(item => `
Title: ${item.title}
Summary: ${item.summary}
Source: ${item.source}
Date: ${item.date}
`).join('\n')}

Extract:
1. Emerging AI health companies to watch
2. Key technological breakthroughs
3. Industry trends and patterns
4. Major funding rounds and acquisitions
5. Regulatory developments
6. Competitive landscape changes
7. Innovation opportunities

Respond with structured intelligence in JSON format:
{
  "emerging_companies": [],
  "key_breakthroughs": [],
  "industry_trends": [],
  "funding_landscape": [],
  "regulatory_updates": [],
  "competitive_intelligence": [],
  "innovation_opportunities": []
}`;

      const intelligenceResponse = await openaiClient.generateResponse(industryAnalysisPrompt);
      
      if (intelligenceResponse) {
        try {
          const intelligence = JSON.parse(intelligenceResponse);
          await this.updateIndustryKnowledge(intelligence);
          console.log('✅ Industry intelligence updated');
        } catch (parseError) {
          console.warn('⚠️ Could not parse industry intelligence');
        }
      }

    } catch (error) {
      console.error('Error discovering industry intelligence:', error);
    }
  }

  private async enhanceCreativeCapabilities(): Promise<void> {
    console.log('🎨 Enhancing creative content generation capabilities...');

    try {
      // Analyze successful creative patterns from top health tech accounts
      const creativeAnalysisPrompt = `Based on current AI health trends, generate innovative content creation strategies:

Analyze successful patterns and create new creative approaches for:

1. Tweet formats that haven't been explored
2. Storytelling techniques for complex AI concepts
3. Visual content ideas that increase engagement
4. Interactive content opportunities
5. Series-based content strategies
6. Cross-platform content adaptation
7. Personalization approaches

Focus on:
- Making complex AI concepts accessible
- Creating emotional connections with health technology
- Building anticipation and curiosity
- Encouraging meaningful discussions
- Establishing thought leadership

Respond with creative strategies in JSON format:
{
  "new_formats": [],
  "storytelling_techniques": [],
  "visual_strategies": [],
  "interactive_ideas": [],
  "series_concepts": [],
  "engagement_tactics": [],
  "innovation_approaches": []
}`;

      const creativeResponse = await openaiClient.generateResponse(creativeAnalysisPrompt);
      
      if (creativeResponse) {
        try {
          const creativeStrategies = JSON.parse(creativeResponse);
          await this.implementCreativeStrategies(creativeStrategies);
          console.log('✅ Creative capabilities enhanced');
        } catch (parseError) {
          console.warn('⚠️ Could not parse creative strategies');
        }
      }

    } catch (error) {
      console.error('Error enhancing creative capabilities:', error);
    }
  }

  private async optimizeContentStrategies(): Promise<void> {
    console.log('⚡ Optimizing content strategies based on learning...');

    try {
      // Dynamic content strategy optimization
      const currentStrategies = this.adaptiveStrategies.get('content_strategies') || {};
      
      const optimizationPrompt = `Optimize content strategies for maximum impact in AI health space:

Current performance data:
${JSON.stringify(currentStrategies, null, 2)}

Recent industry developments from knowledge base:
${JSON.stringify(Array.from(this.knowledgeBase.entries()).slice(0, 10), null, 2)}

Create optimized strategies for:
1. Content topic prioritization
2. Audience engagement maximization
3. Thought leadership positioning
4. Trend anticipation and early adoption
5. Community building approaches
6. Influence network expansion
7. Knowledge authority establishment

Consider:
- Emerging AI health technologies
- Regulatory landscape changes
- Competitive positioning
- Audience behavior patterns
- Platform algorithm changes

Respond with optimization strategies in JSON format:
{
  "topic_priorities": [],
  "engagement_optimization": [],
  "leadership_positioning": [],
  "trend_strategies": [],
  "community_building": [],
  "network_expansion": [],
  "authority_building": []
}`;

      const optimizationResponse = await openaiClient.generateResponse(optimizationPrompt);
      
      if (optimizationResponse) {
        try {
          const optimizations = JSON.parse(optimizationResponse);
          await this.implementOptimizations(optimizations);
          console.log('✅ Content strategies optimized');
        } catch (parseError) {
          console.warn('⚠️ Could not parse optimization strategies');
        }
      }

    } catch (error) {
      console.error('Error optimizing content strategies:', error);
    }
  }

  private async buildCompetitiveIntelligence(): Promise<void> {
    console.log('🕵️ Building CROSS-INDUSTRY competitive intelligence database...');

    try {
      // EXPANDED: Multi-industry viral content creators
      const viralContentCreators = {
        // Tech/Business Leaders
        tech: ['elonmusk', 'sundarpichai', 'satyanadella', 'jeffweiner', 'reidhoffman', 'naval'],
        
        // Health Tech Specific
        healthTech: ['karendesalvo', 'ericxing1', 'fei_fei_li', 'JohnMattison', 'davidfeinberg', 'AmitGarg_MD'],
        
        // Sports (viral engagement masters)
        sports: ['stephencurry30', 'KingJames', 'usainbolt', 'Cristiano', 'neiltyson'],
        
        // News/Media (engagement experts)
        media: ['CNN', 'BBCBreaking', 'nytimes', 'WSJ', 'Reuters'],
        
        // General Viral Creators
        viral: ['TheEllenShow', 'rickygervais', 'ConanOBrien', 'StephenCurry30'],
        
        // Business/Finance (authority patterns)
        business: ['GaryVee', 'mcuban', 'MrBeast', 'naval', 'paulg'],
        
        // Science/Research (credibility patterns)
        science: ['neiltyson', 'BillNye', 'CERN', 'SpaceX', 'NIH']
      };

      // VIRAL CONTENT CATEGORIES to learn from
      const contentCategories = [
        'breakthrough announcement',
        'study results', 
        'controversial opinion',
        'behind-the-scenes',
        'prediction/future',
        'shocking statistic',
        'personal story',
        'list/ranking',
        'question to audience',
        'trending topic response'
      ];

      // Analyze different industries for viral patterns
      for (const [industry, creators] of Object.entries(viralContentCreators)) {
        console.log(`🔍 Analyzing ${industry} viral patterns...`);
        
        // Sample a few creators from each industry
        const sampleCreators = creators.slice(0, 2); // Limit for rate limits
        
        for (const creator of sampleCreators) {
          try {
            // Get their top engaging content (any topic)
            const topContent = await xClient.searchTweets(`from:${creator}`, 8);
            
            if (topContent && topContent.length > 0) {
              // Analyze for STRUCTURAL patterns, not content
              await this.analyzeViralStructures(creator, topContent, industry);
            }
          } catch (error) {
            console.warn(`Could not analyze ${creator}'s content from ${industry}`);
          }
        }
      }

             // TRENDING TOPIC ANALYSIS - learn from viral moments
       await this.analyzeCurrentViralMoments();

       console.log('✅ Cross-industry competitive intelligence updated');

    } catch (error) {
      console.error('Error building competitive intelligence:', error);
    }
  }

  private async predictTrendEvolution(): Promise<void> {
    console.log('🔮 Predicting future AI health trends...');

    try {
      const knowledgeSnapshot = Array.from(this.knowledgeBase.entries());
      
      const predictionPrompt = `Based on current data, predict future AI health trends:

Knowledge base insights:
${JSON.stringify(knowledgeSnapshot.slice(0, 15), null, 2)}

Industry intelligence:
${JSON.stringify(this.industryPlayers.slice(0, 10), null, 2)}

Predict:
1. Emerging technologies likely to gain traction
2. Regulatory changes on the horizon
3. Market opportunities and disruptions
4. Consumer behavior shifts
5. Investment pattern evolution
6. Technology convergence points
7. Potential breakthrough moments

Provide predictions with confidence levels and timeframes in JSON format:
{
  "emerging_tech": [],
  "regulatory_forecast": [],
  "market_opportunities": [],
  "consumer_shifts": [],
  "investment_trends": [],
  "convergence_points": [],
  "breakthrough_predictions": []
}`;

      const predictionResponse = await openaiClient.generateResponse(predictionPrompt);
      
      if (predictionResponse) {
        try {
          const predictions = JSON.parse(predictionResponse);
          await this.storePredictions(predictions);
          console.log('✅ Future trend predictions generated');
        } catch (parseError) {
          console.warn('⚠️ Could not parse trend predictions');
        }
      }

    } catch (error) {
      console.error('Error predicting trend evolution:', error);
    }
  }

  private async adaptSystemBehavior(): Promise<void> {
    console.log('🔄 Adapting system behavior based on learning...');

    try {
      // Dynamic system adaptation based on accumulated insights
      const allInsights = await this.getAllStoredInsights();
      
      const adaptationPrompt = `Based on accumulated learning, recommend system behavior adaptations:

Learning insights:
${JSON.stringify(allInsights.slice(0, 20), null, 2)}

Recommend specific adaptations for:
1. Posting frequency and timing
2. Content type prioritization
3. Engagement strategy adjustments
4. Topic focus evolution
5. Response pattern optimization
6. Learning algorithm improvements
7. Decision-making refinements

Provide concrete, implementable adaptations in JSON format:
{
  "posting_adaptations": [],
  "content_adaptations": [],
  "engagement_adaptations": [],
  "topic_adaptations": [],
  "response_adaptations": [],
  "learning_adaptations": [],
  "decision_adaptations": []
}`;

      const adaptationResponse = await openaiClient.generateResponse(adaptationPrompt);
      
      if (adaptationResponse) {
        try {
          const adaptations = JSON.parse(adaptationResponse);
          await this.implementSystemAdaptations(adaptations);
          console.log('✅ System behavior adapted');
        } catch (parseError) {
          console.warn('⚠️ Could not parse system adaptations');
        }
      }

    } catch (error) {
      console.error('Error adapting system behavior:', error);
    }
  }

  private async synthesizeLearningIntoImprovements(): Promise<void> {
    console.log('🧬 Synthesizing all learning into system improvements...');

    try {
      // Create comprehensive improvement plan
      const synthesisPrompt = `Synthesize all learning data into a comprehensive system improvement plan:

Knowledge base: ${this.knowledgeBase.size} insights
Learning patterns: ${this.learningPatterns.length} patterns
Industry players: ${this.industryPlayers.length} entities
Adaptive strategies: ${this.adaptiveStrategies.size} strategies

Create a prioritized improvement plan that:
1. Maximizes content quality and engagement
2. Positions the bot as an AI health thought leader
3. Builds authentic audience connections
4. Anticipates and capitalizes on trends
5. Continuously evolves and improves
6. Maintains authenticity while scaling intelligence

Provide a comprehensive improvement roadmap in JSON format:
{
  "immediate_improvements": [],
  "short_term_goals": [],
  "long_term_vision": [],
  "success_metrics": [],
  "risk_mitigation": [],
  "innovation_opportunities": []
}`;

      const synthesisResponse = await openaiClient.generateResponse(synthesisPrompt);
      
      if (synthesisResponse) {
        try {
          const improvements = JSON.parse(synthesisResponse);
          await this.implementImprovementPlan(improvements);
          console.log('✅ Learning synthesized into improvements');
        } catch (parseError) {
          console.warn('⚠️ Could not parse improvement plan');
        }
      }

    } catch (error) {
      console.error('Error synthesizing learning:', error);
    }
  }

  // Helper methods for learning implementation
  private async storeAndImplementInsights(insights: any, source: string): Promise<void> {
    // Store insights in knowledge base and implement actionable ones
    this.knowledgeBase.set(`${source}_${Date.now()}`, {
      insights,
      source,
      timestamp: new Date(),
      implemented: false
    });
  }

  private async updateIndustryKnowledge(intelligence: any): Promise<void> {
    // Update industry knowledge base
    this.knowledgeBase.set(`industry_intel_${Date.now()}`, {
      intelligence,
      timestamp: new Date(),
      relevance_score: 0.9
    });
  }

  private async implementCreativeStrategies(strategies: any): Promise<void> {
    // Implement creative strategies into content generation
    this.adaptiveStrategies.set('creative_strategies', strategies);
  }

  private async implementOptimizations(optimizations: any): Promise<void> {
    // Implement content optimizations
    this.adaptiveStrategies.set('content_optimizations', optimizations);
  }

  private async analyzeCompetitorContent(player: string, tweets: any[]): Promise<void> {
    // Analyze competitor content for insights
    const analysis = {
      player,
      content_patterns: tweets,
      analyzed_at: new Date(),
      insights: []
    };
    
    this.knowledgeBase.set(`competitor_${player}_${Date.now()}`, analysis);
  }

  private async storePredictions(predictions: any): Promise<void> {
    // Store trend predictions
    this.knowledgeBase.set(`predictions_${Date.now()}`, {
      predictions,
      timestamp: new Date(),
      confidence: 0.8
    });
  }

  private async implementSystemAdaptations(adaptations: any): Promise<void> {
    // Implement system behavior adaptations
    this.adaptiveStrategies.set('system_adaptations', adaptations);
  }

  private async getAllStoredInsights(): Promise<any[]> {
    // Retrieve all stored insights for analysis
    return Array.from(this.knowledgeBase.values());
  }

  private async implementImprovementPlan(plan: any): Promise<void> {
    // Implement comprehensive improvement plan
    this.adaptiveStrategies.set('improvement_plan', plan);
    
    // Save to file for persistence
    const planData = {
      plan,
      generated_at: new Date(),
      knowledge_base_size: this.knowledgeBase.size,
      strategies_count: this.adaptiveStrategies.size
    };
    
    fs.writeFileSync(
      path.join('./data', 'autonomous_learning_plan.json'),
      JSON.stringify(planData, null, 2)
    );
  }

  private parseIndustryNews(data: string, source: string): any[] {
    // Simple RSS parsing - would be enhanced with proper XML parser
    try {
      const items = [];
      // Basic extraction logic
      return items;
    } catch (error) {
      return [];
    }
  }

  private initializeKnowledgeBase(): void {
    // Initialize with foundational AI health knowledge
    const foundationalKnowledge = {
      'ai_health_foundations': {
        key_companies: ['Google Health', 'IBM Watson Health', 'Microsoft Healthcare', 'Apple Health', 'Amazon HealthLake'],
        key_technologies: ['Computer Vision', 'Natural Language Processing', 'Predictive Analytics', 'Digital Therapeutics'],
        regulatory_bodies: ['FDA', 'CE Mark', 'Health Canada', 'TGA'],
        research_institutions: ['Stanford HAI', 'MIT CSAIL', 'Harvard Medical School', 'Mayo Clinic'],
        key_conferences: ['HIMSS', 'JP Morgan Healthcare', 'Digital Medicine Society', 'AI in Healthcare Summit']
      }
    };
    
    this.knowledgeBase.set('foundational_knowledge', foundationalKnowledge);
  }

  // Public interface for other agents to access learning
  public getKnowledgeInsight(category: string): any {
    return this.knowledgeBase.get(category);
  }

  public getAdaptiveStrategy(strategy: string): any {
    return this.adaptiveStrategies.get(strategy);
  }

  public getIndustryPlayers(): IndustryPlayer[] {
    return this.industryPlayers;
  }

  public getLearningPatterns(): CreativePattern[] {
    return this.learningPatterns;
  }

  private async analyzeViralStructures(creator: string, tweets: any[], industry: string): Promise<void> {
    try {
      console.log(`🧠 Analyzing viral structures from ${creator} (${industry})`);
      
      // Extract structural patterns regardless of content topic
      for (const tweet of tweets) {
        const structure = this.extractTweetStructure(tweet.text);
        const engagement = tweet.public_metrics ? 
          (tweet.public_metrics.like_count + tweet.public_metrics.retweet_count + tweet.public_metrics.reply_count) : 0;
        
        // Store high-engagement structural patterns
        if (engagement > 100) { // Decent engagement threshold
          const pattern = {
            creator,
            industry,
            structure,
            engagement,
            original_content: tweet.text,
            analyzed_at: new Date()
          };
          
          this.knowledgeBase.set(`viral_structure_${creator}_${Date.now()}`, pattern);
        }
      }
      
    } catch (error) {
      console.warn(`Failed to analyze viral structures for ${creator}:`, error);
    }
  }

  private extractTweetStructure(text: string): any {
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
    return 'standard';
  }

  private async analyzeCurrentViralMoments(): Promise<void> {
    try {
      console.log('🔥 Analyzing current viral moments across all topics...');
      
      // Search for high-engagement tweets across different topics
      const viralSearches = [
        'AI breakthrough',
        'study shows',
        'BREAKING',
        'new research',
        'scientists discover',
        'game changer',
        'revolutionary',
        'first time ever'
      ];

      for (const searchTerm of viralSearches.slice(0, 3)) { // Limit for rate limits
        try {
          const viralTweets = await xClient.searchTweets(`${searchTerm} -is:retweet lang:en`, 5);
          
          if (viralTweets && viralTweets.length > 0) {
            for (const tweet of viralTweets) {
              const engagement = tweet.public_metrics ? 
                (tweet.public_metrics.like_count + tweet.public_metrics.retweet_count) : 0;
              
              // Only analyze tweets with significant engagement
              if (engagement > 50) {
                const viralPattern = {
                  search_term: searchTerm,
                  structure: this.extractTweetStructure(tweet.text),
                  engagement,
                  content_sample: tweet.text,
                  analyzed_at: new Date()
                };
                
                this.knowledgeBase.set(`viral_moment_${Date.now()}`, viralPattern);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze viral moment for "${searchTerm}"`);
        }
      }
      
      console.log('✅ Viral moments analysis completed');
      
    } catch (error) {
      console.error('Error analyzing current viral moments:', error);
    }
  }
} 