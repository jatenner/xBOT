/**
 * Follower Acquisition Content Generator
 * Creates magnetic content specifically designed to attract and convert followers
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { learningSystem } from '../learning/learningSystem';
// import { performanceTracker } from '../learning/performanceTracker'; // Temporarily disabled

export interface FollowerMagnetContent {
  content: string | string[]; // Single tweet or thread
  format: 'single' | 'thread';
  
  // Follower acquisition metrics
  follower_magnet_score: number; // 0-1 score for follower attraction potential
  viral_potential: number; // 0-1 score for viral spread potential
  conversion_hooks: string[]; // Elements that drive follows
  
  // Content characteristics optimized for followers
  hook_strategy: 'authority_builder' | 'controversy_magnet' | 'value_bomb' | 'curiosity_gap' | 'social_proof';
  credibility_signals: string[]; // Elements that build trust/authority
  follow_triggers: string[]; // Specific elements that make people want to follow
  
  // Learning metadata
  topic: string;
  angle: string;
  uniqueness_indicators: string[];
  target_audience: 'health_seekers' | 'fitness_enthusiasts' | 'wellness_beginners' | 'biohackers';
}

export interface ViralFormula {
  formula_id: string;
  name: string;
  description: string;
  
  // Formula components
  hook_pattern: string;
  content_structure: string;
  evidence_type: string;
  call_to_action: string;
  
  // Performance data
  success_rate: number; // % of posts using this formula that go viral
  avg_follower_growth: number; // Average new followers per post
  avg_engagement_rate: number;
  sample_size: number;
  
  // Usage recommendations
  best_topics: string[];
  optimal_timing: string[];
  audience_segments: string[];
}

export class FollowerAcquisitionGenerator {
  private viralFormulas: ViralFormula[] = [];
  private followerPatterns: any[] = [];
  
  constructor() {
    this.initializeViralFormulas();
  }
  
  /**
   * Generate content specifically optimized for follower acquisition
   */
  async generateFollowerMagnetContent(request: {
    target_audience?: string;
    content_goal?: 'viral' | 'authority' | 'value' | 'controversy';
    topic_preference?: string;
    format_preference?: 'single' | 'thread';
    // CONTENT TYPE DIVERSITY - Use selected type details
    content_type_name?: string;
    content_type_structure?: string;
    content_type_hook_style?: string;
    content_type_length?: string;
    content_type_value_prop?: string;
  } = {}): Promise<FollowerMagnetContent> {
    
    console.log('[FOLLOWER_GENERATOR] 🧲 Generating follower magnet content...');
    
    try {
      // Get learning insights to inform content generation (simplified)
      const learningInsights = await this.getLearningInsights();
      
      // Select optimal viral formula based on recent performance
      const selectedFormula = await this.selectOptimalViralFormula(request, learningInsights);
      
      // Generate content using the selected formula
      const content = await this.generateContentWithFormula(selectedFormula, request);
      
      // Enhance with follower acquisition elements
      const enhancedContent = await this.enhanceForFollowerAcquisition(content, selectedFormula);
      
      console.log(`[FOLLOWER_GENERATOR] ✅ Generated ${enhancedContent.format} content with ${(enhancedContent.follower_magnet_score * 100).toFixed(1)}% follower magnet score`);
      
      return enhancedContent;
      
    } catch (error: any) {
      console.error('[FOLLOWER_GENERATOR] ❌ Error generating follower magnet content:', error.message);
      
      // Fallback to basic high-value content
      return this.generateFallbackFollowerContent();
    }
  }
  
  /**
   * Learn from successful posts to improve follower acquisition
   */
  async learnFromFollowerGrowth(postData: {
    post_id: string;
    content: string;
    followers_gained: number;
    engagement_rate: number;
    viral_coefficient: number;
    content_characteristics: any;
  }): Promise<void> {
    
    console.log(`[FOLLOWER_GENERATOR] 📚 Learning from post that gained ${postData.followers_gained} followers`);
    
    try {
      // Analyze what made this content successful for follower acquisition
      const successFactors = await this.analyzeFollowerSuccessFactors(postData);
      
      // Update viral formulas based on success
      await this.updateViralFormulas(successFactors);
      
      // Store follower patterns for future use
      await this.storeFollowerPattern(postData, successFactors);
      
      console.log('[FOLLOWER_GENERATOR] ✅ Learning complete - formulas updated');
      
    } catch (error: any) {
      console.error('[FOLLOWER_GENERATOR] ❌ Error learning from follower growth:', error.message);
    }
  }
  
  /**
   * Get top-performing viral formulas
   */
  async getTopViralFormulas(): Promise<ViralFormula[]> {
    return this.viralFormulas
      .filter(f => f.success_rate > 0.3 && f.sample_size >= 3)
      .sort((a, b) => b.avg_follower_growth - a.avg_follower_growth)
      .slice(0, 5);
  }
  
  /**
   * Private methods
   */
  private initializeViralFormulas(): void {
    this.viralFormulas = [
      {
        formula_id: 'authority_stat_bomb',
        name: 'Authority Statistical Bomb',
        description: 'Establish authority with surprising statistics',
        hook_pattern: 'X% of people believe Y, but new research shows Z',
        content_structure: 'Hook + Surprising Stat + Mechanism + Actionable Advice',
        evidence_type: 'recent_studies_with_sample_sizes',
        call_to_action: 'Follow for more evidence-based health insights',
        success_rate: 0.45,
        avg_follower_growth: 12.3,
        avg_engagement_rate: 0.067,
        sample_size: 8,
        best_topics: ['metabolism', 'sleep', 'nutrition myths'],
        optimal_timing: ['Tuesday 2PM', 'Thursday 11AM'],
        audience_segments: ['health_seekers', 'biohackers']
      },
      {
        formula_id: 'controversy_curiosity',
        name: 'Controversial Curiosity Gap',
        description: 'Create curiosity with controversial takes',
        hook_pattern: 'Everything you know about X is wrong. Here\'s why:',
        content_structure: 'Controversial Hook + Evidence + Mechanism + Mind-blown moment',
        evidence_type: 'contrarian_research',
        call_to_action: 'Follow for health truths they don\'t want you to know',
        success_rate: 0.38,
        avg_follower_growth: 15.7,
        avg_engagement_rate: 0.089,
        sample_size: 6,
        best_topics: ['fitness myths', 'diet industry', 'supplement truth'],
        optimal_timing: ['Monday 9AM', 'Wednesday 3PM'],
        audience_segments: ['wellness_beginners', 'fitness_enthusiasts']
      },
      {
        formula_id: 'value_bomb_thread',
        name: 'High-Value Thread Bomb',
        description: 'Deliver massive value in thread format',
        hook_pattern: 'I spent $10,000 learning X. Here\'s everything for free:',
        content_structure: 'Value Hook + 5-7 actionable insights + Implementation guide',
        evidence_type: 'practical_experience',
        call_to_action: 'Follow for more high-value health content',
        success_rate: 0.52,
        avg_follower_growth: 23.4,
        avg_engagement_rate: 0.112,
        sample_size: 4,
        best_topics: ['biohacking', 'longevity', 'optimization'],
        optimal_timing: ['Sunday 7PM', 'Tuesday 6PM'],
        audience_segments: ['biohackers', 'health_seekers']
      },
      {
        formula_id: 'social_proof_authority',
        name: 'Social Proof Authority Builder',
        description: 'Build authority through social proof and results',
        hook_pattern: 'After helping 1000+ people optimize their X, here\'s what works:',
        content_structure: 'Social Proof + Pattern Recognition + Proven Method + Results',
        evidence_type: 'case_studies_and_results',
        call_to_action: 'Follow for proven health optimization strategies',
        success_rate: 0.41,
        avg_follower_growth: 18.9,
        avg_engagement_rate: 0.078,
        sample_size: 5,
        best_topics: ['weight loss', 'energy optimization', 'habit formation'],
        optimal_timing: ['Thursday 1PM', 'Friday 10AM'],
        audience_segments: ['wellness_beginners', 'health_seekers']
      }
    ];
  }
  
  private async getLearningInsights(): Promise<any> {
    try {
      // AI-driven learning insights - hook templates are handled by hookEvolutionEngine
      // These are just guidance for the AI, not templates
      return {
        top_hooks: [
          'contrarian_statement',
          'surprising_statistic',
          'common_mistake_revelation'
        ],
        best_topics: ['sleep optimization', 'nutrition myths', 'exercise science'],
        optimal_timing: ['morning', 'evening'],
        recommendations: {
          hook_recommendations: ['Use contrarian statements', 'Include statistics'],
          timing_optimizations: ['Post during peak hours'],
          content_insights: ['Focus on actionable advice']
        }
      };
    } catch (error) {
      console.warn('[FOLLOWER_GENERATOR] Warning: Could not get learning insights, using defaults');
      return { top_hooks: [], best_topics: [], optimal_timing: [], recommendations: {} };
    }
  }
  
  private async selectOptimalViralFormula(request: any, insights: any): Promise<ViralFormula> {
    console.log('[FOLLOWER_GENERATOR] 🎯 Selecting optimal viral formula with diversity...');
    
    // Filter formulas based on request preferences
    let candidateFormulas = this.viralFormulas.filter(f => {
      // Include formulas with decent performance
      if (f.success_rate < 0.2) return false;
      
      // Filter by format if specified
      if (request.format_preference === 'thread' && !f.name.includes('Thread')) {
        return false;
      }
      if (request.format_preference === 'single' && f.name.includes('Thread')) {
        return false;
      }
      
      return true;
    });
    
    if (candidateFormulas.length === 0) {
      candidateFormulas = this.viralFormulas; // Use all if none match
    }
    
    // Get recent formula usage to avoid repetition
    const recentUse = await this.getRecentFormulaUsage();
    
    // Calculate weighted scores with recency penalty
    const scoredFormulas = candidateFormulas.map(f => {
      // Base score: weighted by follower growth (60%) + engagement (20%) + success rate (20%)
      const baseScore = (f.avg_follower_growth * 0.6) + 
                       (f.avg_engagement_rate * 100 * 0.2) + 
                       (f.success_rate * 100 * 0.2);
      
      // Recency penalty: heavily penalize recently used formulas
      const recentCount = recentUse.filter(id => id === f.formula_id).length;
      const recencyPenalty = Math.pow(0.4, recentCount); // 0.4^n - very aggressive penalty
      
      // Final weighted score
      const finalScore = baseScore * recencyPenalty;
      
      return { formula: f, score: finalScore, recentCount };
    });
    
    // Sort by score
    scoredFormulas.sort((a, b) => b.score - a.score);
    
    // Thompson Sampling: 70% exploit best, 30% explore others
    const random = Math.random();
    
    if (random < 0.7 && scoredFormulas.length > 0) {
      // Exploit: Use best scoring formula
      const selected = scoredFormulas[0];
      console.log(`[FORMULA_SELECT] Exploiting: ${selected.formula.name} (score: ${selected.score.toFixed(2)}, recent: ${selected.recentCount})`);
      return selected.formula;
    } else {
      // Explore: Weighted random selection across top formulas
      const topCandidates = scoredFormulas.slice(0, Math.min(4, scoredFormulas.length));
      const totalScore = topCandidates.reduce((sum, s) => sum + Math.max(s.score, 1), 0);
      const randomScore = Math.random() * totalScore;
      
      let cumulative = 0;
      for (const candidate of topCandidates) {
        cumulative += Math.max(candidate.score, 1);
        if (randomScore <= cumulative) {
          console.log(`[FORMULA_SELECT] Exploring: ${candidate.formula.name} (score: ${candidate.score.toFixed(2)})`);
          return candidate.formula;
        }
      }
      
      return topCandidates[0].formula;
    }
  }
  
  /**
   * Get recent formula usage to avoid repetition
   */
  private async getRecentFormulaUsage(): Promise<string[]> {
    try {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('content_decisions')
        .select('generation_metadata')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error || !data) {
        return [];
      }
      
      return data
        .map((d: any) => d.generation_metadata?.viral_formula_used)
        .filter(Boolean);
    } catch (error) {
      // Fallback if database query fails
      return [];
    }
  }
  
  private async generateContentWithFormula(formula: ViralFormula, request: any): Promise<any> {
    const topics = formula.best_topics.length > 0 ? formula.best_topics : [
      'metabolism optimization', 'sleep quality', 'nutrition myths', 'exercise science'
    ];
    
    const selectedTopic = request.topic_preference || topics[Math.floor(Math.random() * topics.length)];
    
    // Determine format
    const format = request.format_preference === 'auto' 
      ? (formula.name.includes('Thread') ? 'thread' : 'single')
      : (request.format_preference || 'single');
    
    const systemPrompt = `You are @SignalAndSynapse, a health optimization expert known for viral, follower-attracting content.

VIRAL FORMULA: ${formula.name}
HOOK PATTERN: ${formula.hook_pattern}
CONTENT STRUCTURE: ${formula.content_structure}
EVIDENCE TYPE: ${formula.evidence_type}

FOLLOWER MAGNET REQUIREMENTS:
- Create content that makes people IMMEDIATELY want to follow for more
- Include credibility signals that build trust and authority
- Use specific, surprising insights that showcase expertise
- End with subtle follow triggers that feel natural
- Make the value so high that NOT following feels like a mistake

CONTENT RULES:
- NEVER use hashtags or emojis
- Lead with surprising, counterintuitive insights
- Include specific numbers, studies, or mechanisms
- Build authority through demonstration of expertise
- Create "aha moments" that make people think differently
- End with value that makes following feel essential

FORMAT: ${format === 'thread' ? 'Create 4-6 tweets for a thread' : 'Create a single powerful tweet'}
TOPIC: ${selectedTopic}
MAX CHARS PER TWEET: 250`;

    const userPrompt = `Create ${format} content about ${selectedTopic} using the ${formula.name} formula.

Requirements:
- Hook: ${formula.hook_pattern}
- Structure: ${formula.content_structure}  
- Evidence: ${formula.evidence_type}
- Goal: Attract new followers who want more insights like this

Make it so valuable and authoritative that people immediately want to follow for more content like this.

${format === 'thread' ? `
Output as JSON:
{
  "content": ["tweet 1", "tweet 2", "tweet 3", "tweet 4"],
  "hook_strategy": "authority_builder/controversy_magnet/value_bomb/curiosity_gap",
  "credibility_signals": ["signal1", "signal2"],
  "follow_triggers": ["trigger1", "trigger2"]
}` : `
Output as JSON:
{
  "content": "Your tweet text here",
  "hook_strategy": "authority_builder/controversy_magnet/value_bomb/curiosity_gap", 
  "credibility_signals": ["signal1", "signal2"],
  "follow_triggers": ["trigger1", "trigger2"]
}`}`;

    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: format === 'thread' ? 800 : 400,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'follower_magnet_content_generation',
      requestId: `follower_${format}_${Date.now()}`
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(rawContent);
  }
  
  private async enhanceForFollowerAcquisition(content: any, formula: ViralFormula): Promise<FollowerMagnetContent> {
    // Calculate follower magnet score based on formula performance and content characteristics
    const followerMagnetScore = this.calculateFollowerMagnetScore(content, formula);
    
    // Calculate viral potential
    const viralPotential = this.calculateViralPotential(content, formula);
    
    // Extract conversion hooks
    const conversionHooks = this.extractConversionHooks(content);
    
    return {
      content: content.content,
      format: Array.isArray(content.content) ? 'thread' : 'single',
      follower_magnet_score: followerMagnetScore,
      viral_potential: viralPotential,
      conversion_hooks: conversionHooks,
      hook_strategy: content.hook_strategy || 'authority_builder',
      credibility_signals: content.credibility_signals || [],
      follow_triggers: content.follow_triggers || [],
      topic: 'health_optimization', // Simplified for now
      angle: 'follower_magnet',
      uniqueness_indicators: content.credibility_signals || [],
      target_audience: 'health_seekers'
    };
  }
  
  private calculateFollowerMagnetScore(content: any, formula: ViralFormula): number {
    let score = formula.avg_follower_growth / 30; // Base score from formula performance
    
    // Boost for credibility signals
    if (content.credibility_signals && content.credibility_signals.length > 0) {
      score += 0.1 * content.credibility_signals.length;
    }
    
    // Boost for follow triggers
    if (content.follow_triggers && content.follow_triggers.length > 0) {
      score += 0.15 * content.follow_triggers.length;
    }
    
    // Boost for value-packed content
    const contentText = Array.isArray(content.content) ? content.content.join(' ') : content.content;
    if (contentText.includes('study') || contentText.includes('%') || contentText.includes('research')) {
      score += 0.1;
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }
  
  private calculateViralPotential(content: any, formula: ViralFormula): number {
    let potential = formula.success_rate; // Base potential from formula
    
    // Boost for controversial or surprising content
    const contentText = Array.isArray(content.content) ? content.content.join(' ') : content.content;
    if (contentText.includes('wrong') || contentText.includes('myth') || contentText.includes('actually')) {
      potential += 0.2;
    }
    
    // Boost for threads (typically more viral)
    if (Array.isArray(content.content)) {
      potential += 0.1;
    }
    
    return Math.min(1.0, Math.max(0.0, potential));
  }
  
  private extractConversionHooks(content: any): string[] {
    const hooks: string[] = [];
    const contentText = Array.isArray(content.content) ? content.content.join(' ') : content.content;
    
    // Common follower conversion patterns
    if (contentText.includes('follow')) hooks.push('explicit_follow_cta');
    if (contentText.includes('more') && contentText.includes('insights')) hooks.push('promise_more_value');
    if (contentText.includes('research') || contentText.includes('study')) hooks.push('authority_signal');
    if (contentText.includes('%') || contentText.includes('people')) hooks.push('social_proof');
    
    return hooks;
  }
  
  private generateFallbackFollowerContent(): FollowerMagnetContent {
    return {
      content: "New research challenges 73% of common health assumptions. Here's what the data actually shows about optimizing your daily habits for better outcomes. Follow for evidence-based health insights.",
      format: 'single',
      follower_magnet_score: 0.6,
      viral_potential: 0.4,
      conversion_hooks: ['authority_signal', 'promise_more_value', 'explicit_follow_cta'],
      hook_strategy: 'authority_builder',
      credibility_signals: ['research_reference', 'statistical_evidence'],
      follow_triggers: ['promise_more_insights', 'evidence_based_authority'],
      topic: 'health_optimization',
      angle: 'evidence_based',
      uniqueness_indicators: ['statistical_evidence', 'research_based'],
      target_audience: 'health_seekers'
    };
  }
  
  private async analyzeFollowerSuccessFactors(postData: any): Promise<any> {
    // Analyze what made this post successful for follower acquisition
    const factors = {
      high_follower_gain: postData.followers_gained > 10,
      high_engagement: postData.engagement_rate > 0.05,
      viral_spread: postData.viral_coefficient > 0.3,
      content_elements: this.extractContentElements(postData.content)
    };
    
    return factors;
  }
  
  private extractContentElements(content: string): any {
    return {
      has_statistics: /\d+%|\d+x|\d+ people/i.test(content),
      has_controversy: /wrong|myth|actually|but|however/i.test(content),
      has_authority: /research|study|data|evidence/i.test(content),
      has_follow_cta: /follow/i.test(content),
      content_length: content.length
    };
  }
  
  private async updateViralFormulas(successFactors: any): Promise<void> {
    // Update viral formulas based on successful posts
    // This would typically update the formula performance metrics
    console.log('[FOLLOWER_GENERATOR] 📈 Updating viral formulas based on success factors');
  }
  
  private async storeFollowerPattern(postData: any, successFactors: any): Promise<void> {
    // Store successful patterns for future learning
    this.followerPatterns.push({
      post_id: postData.post_id,
      followers_gained: postData.followers_gained,
      success_factors: successFactors,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const followerAcquisitionGenerator = new FollowerAcquisitionGenerator();
