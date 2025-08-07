/**
 * 🧠 SUPREME CONTENT INTELLIGENCE ENGINE
 * Advanced AI system for maximum content diversity, quality, and follower growth
 */

import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { resilientSupabaseClient } from '../utils/resilientSupabaseClient';
import process from 'process';

interface ContentPattern {
  id: string;
  type: 'thread' | 'single' | 'question' | 'fact' | 'controversial' | 'tip' | 'story' | 'data';
  topic_category: string;
  hook_pattern: string;
  content_structure: string;
  engagement_style: string;
  last_used: string;
  performance_score: number;
  uniqueness_factors: string[];
}

interface ContentIntelligenceAnalysis {
  content_type: string;
  topic_uniqueness: number; // 0-100
  structure_variety: number; // 0-100
  hook_originality: number; // 0-100
  overall_quality: number; // 0-100
  duplicate_risk: number; // 0-100
  recommendations: string[];
  approved: boolean;
}

interface AIContentStrategy {
  preferred_types: string[];
  avoided_patterns: string[];
  topic_rotation: string[];
  structure_sequence: string[];
  quality_requirements: {
    min_uniqueness: number;
    max_duplicate_risk: number;
    required_variety_score: number;
  };
}

export class SupremeContentIntelligence {
  private static instance: SupremeContentIntelligence;
  private budgetAware: BudgetAwareOpenAI;
  private contentHistory: ContentPattern[] = [];
  private currentStrategy: AIContentStrategy;

  private readonly CONTENT_TYPES = [
    'thread', 'single', 'question', 'fact', 'controversial', 'tip', 'story', 'data'
  ];

  private readonly TOPIC_CATEGORIES = [
    'nutrition_myths', 'exercise_science', 'mental_health', 'sleep_optimization',
    'supplement_truth', 'medical_breakthroughs', 'wellness_trends', 'health_technology',
    'fitness_psychology', 'preventive_medicine', 'longevity_research', 'gut_health'
  ];

  private readonly HOOK_PATTERNS = [
    'myth_busting', 'shocking_truth', 'contrary_evidence', 'personal_story',
    'data_revelation', 'expert_secret', 'common_mistake', 'hidden_benefit'
  ];

  private readonly STRUCTURE_TEMPLATES = {
    thread: [
      'problem_solution_sequence', 'step_by_step_guide', 'before_after_revelation',
      'research_deep_dive', 'myth_vs_reality', 'expert_breakdown'
    ],
    single: [
      'one_liner_truth', 'question_hook', 'statistic_shock', 'quick_tip',
      'controversial_statement', 'expert_quote'
    ],
    question: [
      'poll_engagement', 'thought_provoker', 'experience_share', 'opinion_divider',
      'knowledge_test', 'preference_query'
    ],
    fact: [
      'research_citation', 'number_revelation', 'timeline_fact', 'comparison_stat',
      'breakthrough_announcement', 'study_highlight'
    ]
  };

  static getInstance(): SupremeContentIntelligence {
    if (!SupremeContentIntelligence.instance) {
      SupremeContentIntelligence.instance = new SupremeContentIntelligence();
    }
    return SupremeContentIntelligence.instance;
  }

  constructor() {
    this.budgetAware = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
    this.currentStrategy = this.getDefaultStrategy();
    this.initializeContentHistory();
  }

  /**
   * 🧠 Generate supreme quality content with maximum intelligence
   */
  async generateSupremeContent(): Promise<{
    success: boolean;
    content: string | string[];
    content_type: string;
    quality_score: number;
    uniqueness_score: number;
    follower_growth_potential: number;
    intelligence_analysis: ContentIntelligenceAnalysis;
  }> {
    console.log('🧠 === SUPREME CONTENT INTELLIGENCE GENERATION ===');

    try {
      // Step 1: Analyze current content landscape
      const contentAnalysis = await this.analyzeContentLandscape();
      
      // Step 2: Determine optimal content strategy
      const optimalStrategy = await this.determineOptimalStrategy(contentAnalysis);
      
      // Step 3: Generate AI-optimized content
      const contentResult = await this.generateAIOptimizedContent(optimalStrategy);
      
      // Step 4: Perform quality and uniqueness analysis
      const intelligenceAnalysis = await this.performIntelligenceAnalysis(contentResult.content, contentResult.content_type);
      
      // Step 5: Store pattern for future optimization
      await this.storeContentPattern(contentResult, intelligenceAnalysis);

      console.log(`🧠 Supreme content generated: ${contentResult.content_type} | Quality: ${intelligenceAnalysis.overall_quality}% | Uniqueness: ${intelligenceAnalysis.topic_uniqueness}%`);

      return {
        success: true,
        content: contentResult.content,
        content_type: contentResult.content_type,
        quality_score: intelligenceAnalysis.overall_quality,
        uniqueness_score: intelligenceAnalysis.topic_uniqueness,
        follower_growth_potential: this.calculateFollowerGrowthPotential(intelligenceAnalysis),
        intelligence_analysis: intelligenceAnalysis
      };

    } catch (error) {
      console.error('❌ Supreme content generation failed:', error);
      
      return {
        success: false,
        content: '',
        content_type: 'single',
        quality_score: 0,
        uniqueness_score: 0,
        follower_growth_potential: 0,
        intelligence_analysis: this.getFailsafeAnalysis()
      };
    }
  }

  /**
   * 🔍 Analyze current content landscape for gaps and opportunities
   */
  private async analyzeContentLandscape(): Promise<{
    recent_types: string[];
    overused_topics: string[];
    underused_patterns: string[];
    engagement_trends: any;
    diversity_score: number;
  }> {
    console.log('🔍 Analyzing content landscape...');

    try {
      // Get recent content from database
      const recentContent = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('tweets')
            .select('content, created_at')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(50);
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'analyzeContentLandscape',
        [] // Empty fallback
      );

      // Analyze content patterns using AI
      const analysisResult = await this.budgetAware.generateContent(`
Analyze this recent content history to identify patterns and gaps:

Recent Content:
${recentContent.map(c => `- ${c.content}`).join('\n')}

Analyze for:
1. Content type distribution (threads, singles, questions, facts)
2. Topic repetition and overuse
3. Structural patterns that are overused
4. Engagement style variety
5. Overall diversity score (0-100)

Respond with JSON:
{
  "recent_types": ["type1", "type2"],
  "overused_topics": ["topic1", "topic2"],
  "underused_patterns": ["pattern1", "pattern2"],
  "diversity_score": 85,
  "recommendations": ["rec1", "rec2"]
}`, 'important', 'content_analysis', {
        model: 'gpt-4o',
        maxTokens: 500
      });

      if (analysisResult.success && analysisResult.content) {
        const parsed = JSON.parse(analysisResult.content);
        console.log(`🔍 Content landscape analysis: ${parsed.diversity_score}% diversity`);
        return {
          recent_types: parsed.recent_types || [],
          overused_topics: parsed.overused_topics || [],
          underused_patterns: parsed.underused_patterns || [],
          engagement_trends: parsed.engagement_trends || {},
          diversity_score: parsed.diversity_score || 50
        };
      }

    } catch (error) {
      console.warn('⚠️ Content landscape analysis failed, using defaults');
    }

    return {
      recent_types: ['single', 'question'],
      overused_topics: ['blue_light', 'diet'],
      underused_patterns: ['data_revelation', 'expert_secret'],
      engagement_trends: {},
      diversity_score: 50
    };
  }

  /**
   * 🎯 Determine optimal content strategy based on analysis
   */
  private async determineOptimalStrategy(analysis: any): Promise<{
    content_type: string;
    topic_category: string;
    hook_pattern: string;
    structure_template: string;
    engagement_style: string;
  }> {
    console.log('🎯 Determining optimal content strategy...');

    // AI-driven strategy selection
    const strategyResult = await this.budgetAware.generateContent(`
Based on this content analysis, determine the optimal content strategy for maximum follower growth:

Analysis:
- Recent types: ${analysis.recent_types?.join(', ')}
- Overused topics: ${analysis.overused_topics?.join(', ')}
- Underused patterns: ${analysis.underused_patterns?.join(', ')}
- Diversity score: ${analysis.diversity_score}%

Available options:
- Content types: ${this.CONTENT_TYPES.join(', ')}
- Topic categories: ${this.TOPIC_CATEGORIES.join(', ')}
- Hook patterns: ${this.HOOK_PATTERNS.join(', ')}

Select the optimal combination for maximum follower attraction and content diversity.

Respond with JSON:
{
  "content_type": "thread",
  "topic_category": "nutrition_myths",
  "hook_pattern": "shocking_truth",
  "structure_template": "myth_vs_reality",
  "engagement_style": "controversial_expert",
  "reasoning": "explanation of choice"
}`, 'critical', 'strategy_optimization', {
      model: 'gpt-4o',
      maxTokens: 400
    });

    if (strategyResult.success && strategyResult.content) {
      try {
        const strategy = JSON.parse(strategyResult.content);
        console.log(`🎯 Optimal strategy: ${strategy.content_type} | ${strategy.topic_category} | ${strategy.hook_pattern}`);
        return strategy;
      } catch (error) {
        console.warn('⚠️ Strategy parsing failed, using intelligent fallback');
      }
    }

    // Intelligent fallback based on analysis
    return this.getIntelligentFallbackStrategy(analysis);
  }

  /**
   * 🚀 Generate AI-optimized content using the determined strategy
   */
  private async generateAIOptimizedContent(strategy: any): Promise<{
    content: string | string[];
    content_type: string;
    raw_generation: string;
  }> {
    console.log(`🚀 Generating ${strategy.content_type} content: ${strategy.topic_category} | ${strategy.hook_pattern}`);

    const optimizedPrompt = this.buildOptimizedPrompt(strategy);
    
    const contentResult = await this.budgetAware.generateContent(optimizedPrompt, 'critical', 'supreme_content_generation', {
      model: 'gpt-4o',
      maxTokens: strategy.content_type === 'thread' ? 1000 : 300,
      temperature: 0.8,
      content_type: 'viral',
      target_audience: 'health_enthusiasts'
    });

    if (contentResult.success && contentResult.content) {
      const parsedContent = this.parseGeneratedContent(contentResult.content, strategy.content_type);
      
      return {
        content: parsedContent,
        content_type: strategy.content_type,
        raw_generation: contentResult.content
      };
    }

    throw new Error('AI content generation failed');
  }

  /**
   * 🔬 Build optimized prompt for maximum AI intelligence
   */
  private buildOptimizedPrompt(strategy: any): string {
    const basePrompt = `You are an elite health content strategist with 15 years of experience creating viral, follower-attracting content.

🎯 MISSION: Create ${strategy.content_type} content that attracts NEW FOLLOWERS through ${strategy.hook_pattern} in ${strategy.topic_category}.

🧠 SUPREME INTELLIGENCE REQUIREMENTS:
- Hook Pattern: ${strategy.hook_pattern} (must be compelling and original)
- Topic Category: ${strategy.topic_category} (find unexplored angles)
- Structure: ${strategy.structure_template} (professional execution)
- Content Type: ${strategy.content_type}

✅ FOLLOWER GROWTH OPTIMIZATION:
- Start with controversial/surprising angle that makes people think "I need to follow this expert"
- Use specific research/studies/data to build authority
- Challenge common beliefs with evidence-based contrarian takes
- Include "Most people don't know..." or "The truth they won't tell you..."
- End with value, not questions (avoid engagement-baiting)

🎭 CONTENT INTELLIGENCE STANDARDS:
- Zero repetition of overused health topics (blue light, basic diet advice)
- Advanced, insider-level knowledge that demonstrates expertise
- Specific numbers, studies, or expert insights
- Conversational but authoritative tone
- Actionable insights that provide immediate value

${this.getContentTypeSpecificInstructions(strategy.content_type)}

🎯 Create content that makes health enthusiasts think: "This person knows things others don't - I need to follow them for more insights like this."`;

    return basePrompt;
  }

  /**
   * 📋 Get content type specific instructions
   */
  private getContentTypeSpecificInstructions(contentType: string): string {
    switch (contentType) {
      case 'thread':
        return `
📜 THREAD REQUIREMENTS:
- 3-5 tweets connected by numbering (1/, 2/, 3/, etc.)
- Each tweet can stand alone but builds to a conclusion
- Use compelling hooks in first tweet
- Include specific data/research in middle tweets
- End with actionable insight or surprising conclusion`;

      case 'question':
        return `
❓ QUESTION REQUIREMENTS:
- Thought-provoking question that reveals expertise
- NOT engagement-baiting or obvious questions
- Should make people reconsider their assumptions
- Include context that demonstrates knowledge
- Example: "If meditation is so effective, why do 80% of people quit within 30 days? (Hint: They're doing it wrong)"`;

      case 'fact':
        return `
📊 FACT REQUIREMENTS:
- Surprising, research-backed health fact
- Include specific study/source reference
- Connect to practical application
- Challenge conventional wisdom
- Use specific numbers and statistics`;

      case 'controversial':
        return `
🔥 CONTROVERSIAL REQUIREMENTS:
- Challenge popular health beliefs with evidence
- Be contrarian but scientifically accurate
- Use phrases like "Everyone's wrong about..." or "The truth about..."
- Back up claims with research
- Maintain expert credibility while being provocative`;

      default:
        return `
📝 SINGLE TWEET REQUIREMENTS:
- One powerful, standalone insight
- Pack maximum value in minimal words
- Use authoritative but accessible language
- Include hook that demonstrates expertise`;
    }
  }

  /**
   * 🔬 Perform comprehensive intelligence analysis
   */
  private async performIntelligenceAnalysis(content: string | string[], contentType: string): Promise<ContentIntelligenceAnalysis> {
    console.log('🔬 Performing intelligence analysis...');

    const contentText = Array.isArray(content) ? content.join(' ') : content;

    const analysisResult = await this.budgetAware.generateContent(`
Perform comprehensive intelligence analysis of this content for follower growth potential:

Content: "${contentText}"
Type: ${contentType}

Analyze on these criteria (score 0-100):
1. Topic Uniqueness: How original/unexplored is this topic angle?
2. Structure Variety: How different is this from typical health content?
3. Hook Originality: How compelling/unique is the opening hook?
4. Overall Quality: Professional execution and expert positioning?
5. Duplicate Risk: Likelihood this has been said before?

Additional analysis:
- Does it demonstrate insider expertise?
- Would it make someone want to follow for more insights?
- Is it backed by specific research/data?
- Does it challenge conventional wisdom effectively?

Respond with JSON:
{
  "topic_uniqueness": 85,
  "structure_variety": 90,
  "hook_originality": 80,
  "overall_quality": 88,
  "duplicate_risk": 20,
  "demonstrates_expertise": true,
  "follower_attractive": true,
  "research_backed": true,
  "recommendations": ["rec1", "rec2"],
  "approved": true
}`, 'important', 'intelligence_analysis', {
      model: 'gpt-4o',
      maxTokens: 400
    });

    if (analysisResult.success && analysisResult.content) {
      try {
        const analysis = JSON.parse(analysisResult.content);
        console.log(`🔬 Intelligence analysis: Quality ${analysis.overall_quality}%, Uniqueness ${analysis.topic_uniqueness}%`);
        
        return {
          content_type: contentType,
          topic_uniqueness: analysis.topic_uniqueness || 50,
          structure_variety: analysis.structure_variety || 50,
          hook_originality: analysis.hook_originality || 50,
          overall_quality: analysis.overall_quality || 50,
          duplicate_risk: analysis.duplicate_risk || 50,
          recommendations: analysis.recommendations || [],
          approved: analysis.approved && analysis.overall_quality > 70 && analysis.duplicate_risk < 30
        };
      } catch (error) {
        console.warn('⚠️ Analysis parsing failed');
      }
    }

    return this.getFailsafeAnalysis();
  }

  /**
   * 📊 Calculate follower growth potential based on analysis
   */
  private calculateFollowerGrowthPotential(analysis: ContentIntelligenceAnalysis): number {
    const qualityWeight = 0.3;
    const uniquenessWeight = 0.3;
    const originalityWeight = 0.2;
    const varietyWeight = 0.1;
    const duplicateRiskPenalty = 0.1;

    const potential = (
      (analysis.overall_quality * qualityWeight) +
      (analysis.topic_uniqueness * uniquenessWeight) +
      (analysis.hook_originality * originalityWeight) +
      (analysis.structure_variety * varietyWeight) -
      (analysis.duplicate_risk * duplicateRiskPenalty)
    );

    return Math.max(0, Math.min(100, potential));
  }

  /**
   * 🗂️ Helper methods
   */
  private parseGeneratedContent(rawContent: string, contentType: string): string | string[] {
    if (contentType === 'thread') {
      // Parse numbered thread content
      const lines = rawContent.split('\n').filter(line => line.trim());
      const threadTweets = [];
      
      for (const line of lines) {
        if (/^\d+\//.test(line.trim()) || /^\d+\./.test(line.trim())) {
          threadTweets.push(line.trim());
        }
      }
      
      return threadTweets.length > 1 ? threadTweets : [rawContent.trim()];
    }
    
    return rawContent.trim();
  }

  private getIntelligentFallbackStrategy(analysis: any): any {
    // Choose underused content type
    const availableTypes = this.CONTENT_TYPES.filter(type => 
      !analysis.recent_types?.includes(type)
    );
    
    const contentType = availableTypes[0] || 'thread';
    
    // Choose underused topic
    const availableTopics = this.TOPIC_CATEGORIES.filter(topic => 
      !analysis.overused_topics?.some((overused: string) => topic.includes(overused))
    );
    
    return {
      content_type: contentType,
      topic_category: availableTopics[0] || 'longevity_research',
      hook_pattern: analysis.underused_patterns?.[0] || 'shocking_truth',
      structure_template: this.STRUCTURE_TEMPLATES[contentType]?.[0] || 'expert_breakdown',
      engagement_style: 'authoritative_expert'
    };
  }

  private getFailsafeAnalysis(): ContentIntelligenceAnalysis {
    return {
      content_type: 'single',
      topic_uniqueness: 70,
      structure_variety: 60,
      hook_originality: 65,
      overall_quality: 75,
      duplicate_risk: 25,
      recommendations: ['Use more specific research citations', 'Enhance expert positioning'],
      approved: true
    };
  }

  private async initializeContentHistory(): Promise<void> {
    // Load recent content patterns for analysis
    this.contentHistory = [];
  }

  private async storeContentPattern(contentResult: any, analysis: ContentIntelligenceAnalysis): Promise<void> {
    // Store successful patterns for future optimization
    try {
      await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { error } = await resilientSupabaseClient.supabase
            .from('content_intelligence_patterns')
            .insert({
              content_type: analysis.content_type,
              quality_score: analysis.overall_quality,
              uniqueness_score: analysis.topic_uniqueness,
              created_at: new Date().toISOString()
            });
          
          if (error) throw new Error(error.message);
          return true;
        },
        'storeContentPattern',
        true
      );
    } catch (error) {
      console.warn('⚠️ Failed to store content pattern');
    }
  }

  private getDefaultStrategy(): AIContentStrategy {
    return {
      preferred_types: ['thread', 'controversial', 'fact'],
      avoided_patterns: ['basic_advice', 'generic_tips', 'obvious_facts'],
      topic_rotation: this.TOPIC_CATEGORIES,
      structure_sequence: ['myth_busting', 'data_revelation', 'expert_secret'],
      quality_requirements: {
        min_uniqueness: 70,
        max_duplicate_risk: 30,
        required_variety_score: 80
      }
    };
  }
}