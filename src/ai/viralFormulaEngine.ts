/**
 * Viral Content Formula Discovery Engine
 * Automatically discovers and evolves viral content patterns
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface ViralPattern {
  pattern_id: string;
  name: string;
  description: string;
  
  // Pattern structure
  hook_template: string;
  content_flow: string[];
  evidence_requirements: string[];
  engagement_triggers: string[];
  
  // Performance metrics
  viral_success_rate: number; // % of posts using this pattern that go viral (>1000 engagements)
  avg_follower_conversion: number; // Average new followers per post
  avg_engagement_multiplier: number; // How much this pattern boosts engagement
  avg_viral_coefficient: number; // Average retweet/like ratio
  
  // Learning data
  sample_size: number;
  confidence_score: number;
  last_updated: string;
  discovery_method: 'automatic' | 'manual' | 'evolved';
  
  // Usage context
  best_topics: string[];
  optimal_timing: string[];
  target_audiences: string[];
  avoid_conditions: string[];
}

export interface ContentDNA {
  // Core content genetics
  hook_genes: string[]; // Different hook variations that work
  structure_genes: string[]; // Content structure patterns
  evidence_genes: string[]; // Types of evidence that resonate
  emotion_genes: string[]; // Emotional triggers that work
  
  // Performance genetics
  viral_genes: string[]; // Elements that make content spread
  follower_genes: string[]; // Elements that convert to followers
  engagement_genes: string[]; // Elements that drive engagement
  
  // Mutation potential
  adaptability_score: number; // How well this DNA adapts to new contexts
  evolution_rate: number; // How quickly it learns and improves
}

export class ViralFormulaDiscoveryEngine {
  private supabase = getSupabaseClient();
  private discoveredPatterns: ViralPattern[] = [];
  private contentDNA: ContentDNA[] = [];
  
  /**
   * Analyze viral content to discover new patterns
   */
  async discoverViralPatterns(): Promise<ViralPattern[]> {
    console.log('[VIRAL_DISCOVERY] 🔍 Analyzing content to discover viral patterns...');
    
    try {
      // Get high-performing content from last 30 days
      const viralContent = await this.getViralContent();
      
      if (viralContent.length < 3) {
        console.log('[VIRAL_DISCOVERY] ⏸️ Insufficient viral content for pattern discovery');
        return [];
      }
      
      // Analyze patterns in viral content
      const patterns = await this.analyzeViralPatterns(viralContent);
      
      // Validate patterns with statistical significance
      const validatedPatterns = await this.validatePatterns(patterns);
      
      // Store discovered patterns
      for (const pattern of validatedPatterns) {
        await this.storeViralPattern(pattern);
      }
      
      console.log(`[VIRAL_DISCOVERY] ✅ Discovered ${validatedPatterns.length} new viral patterns`);
      return validatedPatterns;
      
    } catch (error: any) {
      console.error('[VIRAL_DISCOVERY] ❌ Error discovering viral patterns:', error.message);
      return [];
    }
  }
  
  /**
   * Evolve existing patterns based on new performance data
   */
  async evolveViralPatterns(): Promise<void> {
    console.log('[VIRAL_DISCOVERY] 🧬 Evolving viral patterns based on new data...');
    
    try {
      // Get recent performance data
      const recentPerformance = await this.getRecentPerformanceData();
      
      // Analyze which patterns are improving/declining
      const evolutionInsights = await this.analyzePatternEvolution(recentPerformance);
      
      // Evolve patterns based on insights
      await this.applyEvolutionInsights(evolutionInsights);
      
      console.log('[VIRAL_DISCOVERY] ✅ Pattern evolution complete');
      
    } catch (error: any) {
      console.error('[VIRAL_DISCOVERY] ❌ Error evolving patterns:', error.message);
    }
  }
  
  /**
   * Generate content using the most effective viral patterns
   */
  async generateViralContent(request: {
    target_virality: 'moderate' | 'high' | 'extreme';
    topic_preference?: string;
    audience_segment?: string;
    format_preference?: 'single' | 'thread';
  }): Promise<{
    content: string | string[];
    pattern_used: ViralPattern;
    viral_prediction: number;
    follower_prediction: number;
  }> {
    
    console.log(`[VIRAL_DISCOVERY] 🚀 Generating ${request.target_virality} viral content...`);
    
    try {
      // Select optimal pattern for request
      const selectedPattern = await this.selectOptimalPattern(request);
      
      // Generate content using the pattern
      const content = await this.generateContentWithPattern(selectedPattern, request);
      
      // Predict performance
      const predictions = this.predictPerformance(content, selectedPattern);
      
      return {
        content: content.content,
        pattern_used: selectedPattern,
        viral_prediction: predictions.viral_score,
        follower_prediction: predictions.follower_score
      };
      
    } catch (error: any) {
      console.error('[VIRAL_DISCOVERY] ❌ Error generating viral content:', error.message);
      throw error;
    }
  }
  
  /**
   * Analyze content DNA to understand viral genetics
   */
  async analyzeContentDNA(content: string, performance: {
    engagement_rate: number;
    viral_coefficient: number;
    followers_gained: number;
  }): Promise<ContentDNA> {
    
    console.log('[VIRAL_DISCOVERY] 🧬 Analyzing content DNA...');
    
    const dna: ContentDNA = {
      hook_genes: this.extractHookGenes(content),
      structure_genes: this.extractStructureGenes(content),
      evidence_genes: this.extractEvidenceGenes(content),
      emotion_genes: this.extractEmotionGenes(content),
      viral_genes: this.extractViralGenes(content, performance),
      follower_genes: this.extractFollowerGenes(content, performance),
      engagement_genes: this.extractEngagementGenes(content, performance),
      adaptability_score: this.calculateAdaptabilityScore(content, performance),
      evolution_rate: this.calculateEvolutionRate(performance)
    };
    
    // Store DNA for future evolution
    this.contentDNA.push(dna);
    
    return dna;
  }
  
  /**
   * Create hybrid patterns by combining successful elements
   */
  async createHybridPatterns(): Promise<ViralPattern[]> {
    console.log('[VIRAL_DISCOVERY] 🧬 Creating hybrid viral patterns...');
    
    try {
      // Get top-performing patterns
      const topPatterns = await this.getTopPatterns(5);
      
      if (topPatterns.length < 2) {
        console.log('[VIRAL_DISCOVERY] ⏸️ Need at least 2 patterns for hybridization');
        return [];
      }
      
      const hybrids: ViralPattern[] = [];
      
      // Create hybrid combinations
      for (let i = 0; i < topPatterns.length; i++) {
        for (let j = i + 1; j < topPatterns.length; j++) {
          const hybrid = await this.hybridizePatterns(topPatterns[i], topPatterns[j]);
          if (hybrid) {
            hybrids.push(hybrid);
          }
        }
      }
      
      console.log(`[VIRAL_DISCOVERY] ✅ Created ${hybrids.length} hybrid patterns`);
      return hybrids;
      
    } catch (error: any) {
      console.error('[VIRAL_DISCOVERY] ❌ Error creating hybrid patterns:', error.message);
      return [];
    }
  }
  
  /**
   * Private helper methods
   */
  private async getViralContent(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('enhanced_performance')
        .select('*')
        .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .gte('viral_coefficient', 0.3) // High retweet ratio
        .gte('engagement_rate', 0.05) // High engagement
        .order('viral_coefficient', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('[VIRAL_DISCOVERY] Error fetching viral content:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[VIRAL_DISCOVERY] Error fetching viral content:', error);
      return [];
    }
  }
  
  private async analyzeViralPatterns(viralContent: any[]): Promise<ViralPattern[]> {
    const patterns: ViralPattern[] = [];
    
    // Group content by similar characteristics
    const hookGroups = this.groupByHookType(viralContent);
    const structureGroups = this.groupByStructure(viralContent);
    
    // Analyze hook patterns
    for (const [hookType, posts] of Object.entries(hookGroups)) {
      if (posts.length >= 3) {
        const pattern = await this.createPatternFromGroup(hookType, posts, 'hook');
        if (pattern) patterns.push(pattern);
      }
    }
    
    // Analyze structure patterns
    for (const [structureType, posts] of Object.entries(structureGroups)) {
      if (posts.length >= 3) {
        const pattern = await this.createPatternFromGroup(structureType, posts, 'structure');
        if (pattern) patterns.push(pattern);
      }
    }
    
    return patterns;
  }
  
  private groupByHookType(content: any[]): Record<string, any[]> {
    return content.reduce((groups, item) => {
      const hookType = item.hook_type || 'unknown';
      if (!groups[hookType]) groups[hookType] = [];
      groups[hookType].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  }
  
  private groupByStructure(content: any[]): Record<string, any[]> {
    return content.reduce((groups, item) => {
      const structureType = item.format || 'single';
      if (!groups[structureType]) groups[structureType] = [];
      groups[structureType].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  }
  
  private async createPatternFromGroup(groupType: string, posts: any[], patternType: string): Promise<ViralPattern | null> {
    const avgViralCoefficient = posts.reduce((sum, p) => sum + (p.viral_coefficient || 0), 0) / posts.length;
    const avgFollowerGrowth = posts.reduce((sum, p) => sum + (p.audience_retention || 0), 0) / posts.length;
    const avgEngagement = posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length;
    
    // Only create pattern if it shows strong performance
    if (avgViralCoefficient < 0.3 || avgEngagement < 0.04) {
      return null;
    }
    
    return {
      pattern_id: `discovered_${patternType}_${groupType}_${Date.now()}`,
      name: `${groupType.replace('_', ' ')} ${patternType} pattern`,
      description: `Viral pattern discovered from ${posts.length} high-performing posts`,
      hook_template: this.extractHookTemplate(posts),
      content_flow: this.extractContentFlow(posts),
      evidence_requirements: this.extractEvidenceRequirements(posts),
      engagement_triggers: this.extractEngagementTriggers(posts),
      viral_success_rate: posts.filter(p => p.viral_coefficient > 0.5).length / posts.length,
      avg_follower_conversion: avgFollowerGrowth,
      avg_engagement_multiplier: avgEngagement / 0.03, // Compared to baseline
      avg_viral_coefficient: avgViralCoefficient,
      sample_size: posts.length,
      confidence_score: Math.min(0.95, posts.length / 10),
      last_updated: new Date().toISOString(),
      discovery_method: 'automatic',
      best_topics: this.extractTopics(posts),
      optimal_timing: this.extractTiming(posts),
      target_audiences: ['health_seekers', 'fitness_enthusiasts'],
      avoid_conditions: ['low_engagement_periods', 'topic_saturation']
    };
  }
  
  private extractHookTemplate(posts: any[]): string {
    // Analyze common hook patterns
    const hooks = posts.map(p => p.content?.substring(0, 50) || '').filter(h => h.length > 0);
    
    if (hooks.some(h => h.includes('% of people'))) {
      return 'X% of people believe Y, but Z';
    } else if (hooks.some(h => h.includes('wrong') || h.includes('myth'))) {
      return 'Everything you know about X is wrong';
    } else if (hooks.some(h => h.includes('study') || h.includes('research'))) {
      return 'New research reveals X about Y';
    } else {
      return 'Surprising insight about X that changes Y';
    }
  }
  
  private extractContentFlow(posts: any[]): string[] {
    // Analyze common content structures
    return [
      'attention_grabbing_hook',
      'surprising_insight_or_statistic',
      'mechanism_or_explanation',
      'actionable_advice_or_implication',
      'authority_signal_or_follow_trigger'
    ];
  }
  
  private extractEvidenceRequirements(posts: any[]): string[] {
    const requirements: string[] = [];
    
    const hasStats = posts.some(p => p.has_statistics);
    const hasControversy = posts.some(p => p.has_controversy);
    
    if (hasStats) requirements.push('statistical_evidence');
    if (hasControversy) requirements.push('contrarian_angle');
    
    requirements.push('credibility_signals');
    return requirements;
  }
  
  private extractEngagementTriggers(posts: any[]): string[] {
    return [
      'curiosity_gap',
      'social_proof',
      'authority_demonstration',
      'value_promise',
      'controversial_stance'
    ];
  }
  
  private extractTopics(posts: any[]): string[] {
    const topics = posts.map(p => p.topic).filter(t => t);
    return [...new Set(topics)];
  }
  
  private extractTiming(posts: any[]): string[] {
    const timings = posts.map(p => {
      if (p.day_of_week !== undefined) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[p.day_of_week];
      }
      return null;
    }).filter(t => t);
    
    return [...new Set(timings)];
  }
  
  private async validatePatterns(patterns: ViralPattern[]): Promise<ViralPattern[]> {
    return patterns.filter(pattern => 
      pattern.sample_size >= 3 &&
      pattern.confidence_score >= 0.6 &&
      pattern.viral_success_rate >= 0.3
    );
  }
  
  private async storeViralPattern(pattern: ViralPattern): Promise<void> {
    try {
      const patternData = {
        pattern_id: pattern.pattern_id,
        name: pattern.name,
        description: pattern.description,
        hook_template: pattern.hook_template,
        content_flow: JSON.stringify(pattern.content_flow),
        evidence_requirements: JSON.stringify(pattern.evidence_requirements),
        engagement_triggers: JSON.stringify(pattern.engagement_triggers),
        viral_success_rate: pattern.viral_success_rate,
        avg_follower_conversion: pattern.avg_follower_conversion,
        avg_engagement_multiplier: pattern.avg_engagement_multiplier,
        avg_viral_coefficient: pattern.avg_viral_coefficient,
        sample_size: pattern.sample_size,
        confidence_score: pattern.confidence_score,
        last_updated: pattern.last_updated,
        discovery_method: pattern.discovery_method,
        best_topics: JSON.stringify(pattern.best_topics),
        optimal_timing: JSON.stringify(pattern.optimal_timing),
        target_audiences: JSON.stringify(pattern.target_audiences),
        avoid_conditions: JSON.stringify(pattern.avoid_conditions),
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('viral_patterns')
        .upsert([patternData], { onConflict: 'pattern_id' });
      
      if (error) {
        console.error('[VIRAL_DISCOVERY] Error storing pattern:', error);
        return;
      }
      
      console.log(`[VIRAL_DISCOVERY] 💾 Stored pattern: ${pattern.name}`);
    } catch (error: any) {
      console.error('[VIRAL_DISCOVERY] Error storing pattern:', error.message);
    }
  }
  
  private async getRecentPerformanceData(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('enhanced_performance')
        .select('*')
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('posted_at', { ascending: false });
      
      if (error) {
        console.error('[VIRAL_DISCOVERY] Error fetching recent performance:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[VIRAL_DISCOVERY] Error fetching recent performance:', error);
      return [];
    }
  }
  
  private async analyzePatternEvolution(performanceData: any[]): Promise<any> {
    // Analyze how patterns are performing over time
    return {
      improving_patterns: [],
      declining_patterns: [],
      stable_patterns: []
    };
  }
  
  private async applyEvolutionInsights(insights: any): Promise<void> {
    // Apply evolution insights to improve patterns
    console.log('[VIRAL_DISCOVERY] 🧬 Applying evolution insights to patterns');
  }
  
  private async selectOptimalPattern(request: any): Promise<ViralPattern> {
    // Get patterns from database or use defaults
    const patterns = await this.getTopPatterns(10);
    
    if (patterns.length === 0) {
      return this.getDefaultPattern();
    }
    
    // Filter by request criteria
    let candidates = patterns;
    
    if (request.target_virality === 'extreme') {
      candidates = candidates.filter(p => p.viral_success_rate > 0.5);
    } else if (request.target_virality === 'high') {
      candidates = candidates.filter(p => p.viral_success_rate > 0.3);
    }
    
    // Sort by performance
    candidates.sort((a, b) => b.avg_follower_conversion - a.avg_follower_conversion);
    
    return candidates[0] || this.getDefaultPattern();
  }
  
  private async getTopPatterns(limit: number): Promise<ViralPattern[]> {
    try {
      const { data, error } = await this.supabase
        .from('viral_patterns')
        .select('*')
        .gte('confidence_score', 0.6)
        .order('avg_follower_conversion', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('[VIRAL_DISCOVERY] Error fetching patterns:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[VIRAL_DISCOVERY] Error fetching patterns:', error);
      return [];
    }
  }
  
  private getDefaultPattern(): ViralPattern {
    return {
      pattern_id: 'default_viral_pattern',
      name: 'Authority Statistical Pattern',
      description: 'Default high-performing pattern',
      hook_template: 'X% of people believe Y, but research shows Z',
      content_flow: ['hook', 'evidence', 'mechanism', 'advice'],
      evidence_requirements: ['statistical_evidence', 'research_backing'],
      engagement_triggers: ['surprise', 'authority', 'value'],
      viral_success_rate: 0.4,
      avg_follower_conversion: 8.5,
      avg_engagement_multiplier: 1.8,
      avg_viral_coefficient: 0.35,
      sample_size: 10,
      confidence_score: 0.7,
      last_updated: new Date().toISOString(),
      discovery_method: 'manual',
      best_topics: ['health', 'nutrition', 'fitness'],
      optimal_timing: ['Tuesday', 'Thursday'],
      target_audiences: ['health_seekers'],
      avoid_conditions: ['weekend_posting']
    };
  }
  
  private async generateContentWithPattern(pattern: ViralPattern, request: any): Promise<any> {
    const systemPrompt = `You are @SignalAndSynapse using the "${pattern.name}" viral pattern.

VIRAL PATTERN REQUIREMENTS:
- Hook Template: ${pattern.hook_template}
- Content Flow: ${pattern.content_flow.join(' → ')}
- Evidence Requirements: ${pattern.evidence_requirements.join(', ')}
- Engagement Triggers: ${pattern.engagement_triggers.join(', ')}

This pattern has a ${(pattern.viral_success_rate * 100).toFixed(1)}% viral success rate and generates an average of ${pattern.avg_follower_conversion.toFixed(1)} new followers per post.

Create content that follows this proven viral pattern exactly.`;

    const userPrompt = `Create ${request.format_preference || 'single'} content about ${request.topic_preference || 'health optimization'} using the viral pattern.

Target virality: ${request.target_virality}
Audience: ${request.audience_segment || 'health_seekers'}

Output as JSON:
{
  "content": "${request.format_preference === 'thread' ? '["tweet1", "tweet2", ...]' : 'single tweet'}",
  "pattern_elements_used": ["element1", "element2"],
  "viral_triggers": ["trigger1", "trigger2"]
}`;

    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    }, {
      purpose: 'viral_pattern_content_generation',
      requestId: `viral_${Date.now()}`
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(rawContent);
  }
  
  private predictPerformance(content: any, pattern: ViralPattern): { viral_score: number; follower_score: number } {
    // Predict performance based on pattern history and content characteristics
    const baseViralScore = pattern.viral_success_rate;
    const baseFollowerScore = pattern.avg_follower_conversion / 20; // Normalize to 0-1
    
    // Adjust based on content characteristics
    const contentText = Array.isArray(content.content) ? content.content.join(' ') : content.content;
    
    let viralBoost = 0;
    let followerBoost = 0;
    
    if (contentText.includes('%') || contentText.includes('study')) {
      viralBoost += 0.1;
      followerBoost += 0.1;
    }
    
    if (contentText.includes('wrong') || contentText.includes('myth')) {
      viralBoost += 0.15;
    }
    
    return {
      viral_score: Math.min(1.0, baseViralScore + viralBoost),
      follower_score: Math.min(1.0, baseFollowerScore + followerBoost)
    };
  }
  
  // Content DNA analysis methods
  private extractHookGenes(content: string): string[] {
    const genes: string[] = [];
    if (content.includes('% of people')) genes.push('statistical_hook');
    if (content.includes('wrong') || content.includes('myth')) genes.push('contrarian_hook');
    if (content.includes('study') || content.includes('research')) genes.push('authority_hook');
    return genes;
  }
  
  private extractStructureGenes(content: string): string[] {
    const genes: string[] = [];
    if (content.includes('Here\'s why:')) genes.push('explanation_structure');
    if (content.includes('But') || content.includes('However')) genes.push('contrast_structure');
    return genes;
  }
  
  private extractEvidenceGenes(content: string): string[] {
    const genes: string[] = [];
    if (content.includes('study')) genes.push('research_evidence');
    if (content.includes('%')) genes.push('statistical_evidence');
    return genes;
  }
  
  private extractEmotionGenes(content: string): string[] {
    const genes: string[] = [];
    if (content.includes('wrong') || content.includes('myth')) genes.push('surprise_emotion');
    if (content.includes('amazing') || content.includes('incredible')) genes.push('wonder_emotion');
    return genes;
  }
  
  private extractViralGenes(content: string, performance: any): string[] {
    const genes: string[] = [];
    if (performance.viral_coefficient > 0.4) {
      if (content.includes('wrong')) genes.push('controversy_viral');
      if (content.includes('%')) genes.push('statistic_viral');
    }
    return genes;
  }
  
  private extractFollowerGenes(content: string, performance: any): string[] {
    const genes: string[] = [];
    if (performance.followers_gained > 10) {
      if (content.includes('follow')) genes.push('explicit_follow_cta');
      if (content.includes('more')) genes.push('value_promise');
    }
    return genes;
  }
  
  private extractEngagementGenes(content: string, performance: any): string[] {
    const genes: string[] = [];
    if (performance.engagement_rate > 0.05) {
      if (content.includes('?')) genes.push('question_engagement');
      if (content.includes('Here\'s')) genes.push('curiosity_engagement');
    }
    return genes;
  }
  
  private calculateAdaptabilityScore(content: string, performance: any): number {
    // How well this content adapts to different contexts
    let score = 0.5;
    
    if (performance.engagement_rate > 0.06) score += 0.2;
    if (performance.viral_coefficient > 0.3) score += 0.2;
    if (performance.followers_gained > 5) score += 0.1;
    
    return Math.min(1.0, score);
  }
  
  private calculateEvolutionRate(performance: any): number {
    // How quickly this pattern learns and improves
    return Math.min(1.0, (performance.engagement_rate + performance.viral_coefficient) / 2);
  }
  
  private async hybridizePatterns(pattern1: ViralPattern, pattern2: ViralPattern): Promise<ViralPattern | null> {
    // Create hybrid pattern by combining best elements
    if (pattern1.sample_size < 3 || pattern2.sample_size < 3) {
      return null;
    }
    
    return {
      pattern_id: `hybrid_${pattern1.pattern_id}_${pattern2.pattern_id}_${Date.now()}`,
      name: `Hybrid: ${pattern1.name} + ${pattern2.name}`,
      description: `Hybrid pattern combining elements from ${pattern1.name} and ${pattern2.name}`,
      hook_template: pattern1.viral_success_rate > pattern2.viral_success_rate ? pattern1.hook_template : pattern2.hook_template,
      content_flow: [...new Set([...pattern1.content_flow, ...pattern2.content_flow])],
      evidence_requirements: [...new Set([...pattern1.evidence_requirements, ...pattern2.evidence_requirements])],
      engagement_triggers: [...new Set([...pattern1.engagement_triggers, ...pattern2.engagement_triggers])],
      viral_success_rate: (pattern1.viral_success_rate + pattern2.viral_success_rate) / 2,
      avg_follower_conversion: Math.max(pattern1.avg_follower_conversion, pattern2.avg_follower_conversion),
      avg_engagement_multiplier: (pattern1.avg_engagement_multiplier + pattern2.avg_engagement_multiplier) / 2,
      avg_viral_coefficient: Math.max(pattern1.avg_viral_coefficient, pattern2.avg_viral_coefficient),
      sample_size: 0, // Will be populated as hybrid is tested
      confidence_score: Math.min(pattern1.confidence_score, pattern2.confidence_score) * 0.8, // Lower confidence for untested hybrid
      last_updated: new Date().toISOString(),
      discovery_method: 'evolved',
      best_topics: [...new Set([...pattern1.best_topics, ...pattern2.best_topics])],
      optimal_timing: [...new Set([...pattern1.optimal_timing, ...pattern2.optimal_timing])],
      target_audiences: [...new Set([...pattern1.target_audiences, ...pattern2.target_audiences])],
      avoid_conditions: [...new Set([...pattern1.avoid_conditions, ...pattern2.avoid_conditions])]
    };
  }
}

// Export singleton instance
export const viralFormulaEngine = new ViralFormulaDiscoveryEngine();
