import { admin as supabase } from '../lib/supabaseClients';

/**
 * CONTENT DIVERSITY TRACKER
 * 
 * Analyzes recent posts to identify repetitive patterns and forces
 * the AI to explore NEW health domains instead of repeating magnesium/sleep advice
 */

interface ContentAnalysis {
  recentTopics: string[];
  overusedWords: string[];
  missingDomains: string[];
  diversityScore: number;
  recommendedFocus: string[];
}

export class ContentDiversityTracker {
  private static instance: ContentDiversityTracker;
  
  // Health domains to rotate through
  private readonly healthDomains = [
    'supplements_advanced', 'exercise_science', 'circadian_biology', 
    'gut_microbiome', 'hormonal_health', 'metabolic_flexibility',
    'stress_physiology', 'cognitive_enhancement', 'longevity_research',
    'biohacking_tools', 'nutrition_timing', 'thermal_therapy',
    'breathing_techniques', 'genetic_optimization', 'inflammation_control'
  ];

  private readonly specificTopics = {
    supplements_advanced: ['NAD+', 'phosphatidylserine', 'PQQ', 'berberine', 'ashwagandha timing'],
    exercise_science: ['zone 2 cardio', 'eccentric training', 'blood flow restriction', 'HRV-guided training'],
    circadian_biology: ['light therapy', 'temperature regulation', 'meal timing', 'blue light blocking'],
    gut_microbiome: ['resistant starch', 'fermented foods', 'prebiotic fiber', 'gut-brain axis'],
    hormonal_health: ['testosterone optimization', 'insulin sensitivity', 'cortisol management', 'thyroid function'],
    metabolic_flexibility: ['ketosis cycling', 'fasting protocols', 'glucose monitoring', 'mitochondrial health'],
    stress_physiology: ['HRV training', 'cold exposure', 'breathwork', 'vagus nerve stimulation'],
    cognitive_enhancement: ['nootropics', 'brain training', 'meditation techniques', 'flow states'],
    longevity_research: ['telomere health', 'autophagy', 'caloric restriction', 'rapamycin'],
    biohacking_tools: ['red light therapy', 'grounding', 'EMF protection', 'sleep tracking'],
    nutrition_timing: ['protein synthesis', 'carb cycling', 'intermittent fasting', 'nutrient timing'],
    thermal_therapy: ['sauna protocols', 'cold plunging', 'contrast therapy', 'brown fat activation'],
    breathing_techniques: ['Wim Hof method', 'box breathing', 'CO2 tolerance', 'breath holds'],
    genetic_optimization: ['SNP testing', 'methylation', 'detox pathways', 'personalized nutrition'],
    inflammation_control: ['omega-3 ratios', 'polyphenols', 'curcumin', 'anti-inflammatory foods']
  };

  public static getInstance(): ContentDiversityTracker {
    if (!ContentDiversityTracker.instance) {
      ContentDiversityTracker.instance = new ContentDiversityTracker();
    }
    return ContentDiversityTracker.instance;
  }

  /**
   * Analyze recent content to identify repetitive patterns
   */
  async analyzeRecentContent(dayRange: number = 7): Promise<ContentAnalysis> {
    console.log(`🔍 DIVERSITY_ANALYSIS: Analyzing last ${dayRange} days of content...`);

    try {
      // Get recent posts from learning_posts table
      const { data: recentPosts } = await supabase
        .from('learning_posts')
        .select('content, created_at')
        .gte('created_at', new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recentPosts || recentPosts.length === 0) {
        console.log('📝 NO_RECENT_POSTS: No content to analyze, all domains available');
        return {
          recentTopics: [],
          overusedWords: [],
          missingDomains: this.healthDomains,
          diversityScore: 100,
          recommendedFocus: this.getRandomDomains(3)
        };
      }

      const analysis = this.performContentAnalysis(recentPosts);
      console.log(`📊 DIVERSITY_SCORE: ${analysis.diversityScore}/100`);
      console.log(`🔁 OVERUSED_TOPICS: ${analysis.overusedWords.join(', ')}`);
      console.log(`🎯 RECOMMENDED_FOCUS: ${analysis.recommendedFocus.join(', ')}`);

      return analysis;

    } catch (error: any) {
      console.error('❌ DIVERSITY_ANALYSIS_ERROR:', error.message);
      
      // Return safe defaults that encourage variety
      return {
        recentTopics: ['supplements'], // Assume supplements are overused
        overusedWords: ['magnesium', 'sleep', 'supplement'],
        missingDomains: this.healthDomains.slice(0, -3), // Most domains available
        diversityScore: 50,
        recommendedFocus: this.getRandomDomains(3)
      };
    }
  }

  /**
   * Perform deep analysis of content patterns
   */
  private performContentAnalysis(posts: any[]): ContentAnalysis {
    const allContent = posts.map(p => p.content.toLowerCase()).join(' ');
    const words = allContent.split(/\s+/);
    
    // Count word frequency
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Identify overused words (mentioned more than 2 times)
    const overusedWords = Object.entries(wordFreq)
      .filter(([word, count]) => count > 2)
      .map(([word]) => word)
      .slice(0, 10);

    // Identify covered health domains
    const coveredDomains = this.healthDomains.filter(domain => {
      const domainTopics = this.specificTopics[domain as keyof typeof this.specificTopics] || [];
      return domainTopics.some(topic => allContent.includes(topic.toLowerCase()));
    });

    // Find missing domains (not covered recently)
    const missingDomains = this.healthDomains.filter(domain => !coveredDomains.includes(domain));

    // Calculate diversity score
    const domainCoverage = coveredDomains.length / this.healthDomains.length;
    const repetitionPenalty = Math.min(overusedWords.length * 5, 50);
    const diversityScore = Math.max(0, (domainCoverage * 100) - repetitionPenalty);

    // Recommend focus areas (prioritize missing domains)
    const recommendedFocus = missingDomains.length > 0 
      ? missingDomains.slice(0, 3)
      : this.getRandomDomains(3);

    return {
      recentTopics: coveredDomains,
      overusedWords,
      missingDomains,
      diversityScore,
      recommendedFocus
    };
  }

  /**
   * Get specific topic suggestions to force diversity
   */
  async getTopicSuggestions(): Promise<{
    avoidTopics: string[];
    recommendedTopics: string[];
    specificSuggestions: string[];
  }> {
    const analysis = await this.analyzeRecentContent();

    const avoidTopics = analysis.overusedWords;
    const recommendedTopics = analysis.recommendedFocus;
    
    // Get specific suggestions from recommended domains
    const specificSuggestions: string[] = [];
    recommendedTopics.forEach(domain => {
      const domainTopics = this.specificTopics[domain as keyof typeof this.specificTopics] || [];
      specificSuggestions.push(...domainTopics.slice(0, 2));
    });

    return {
      avoidTopics,
      recommendedTopics,
      specificSuggestions
    };
  }

  /**
   * Force content to explore new domain
   */
  async forceNewDomain(): Promise<string> {
    const analysis = await this.analyzeRecentContent();
    
    if (analysis.missingDomains.length > 0) {
      const newDomain = analysis.missingDomains[Math.floor(Math.random() * analysis.missingDomains.length)];
      const topics = this.specificTopics[newDomain as keyof typeof this.specificTopics] || [];
      const specificTopic = topics[Math.floor(Math.random() * topics.length)];
      
      console.log(`🎯 FORCING_NEW_DOMAIN: ${newDomain} → ${specificTopic}`);
      return `${newDomain}: ${specificTopic}`;
    }

    // All domains covered, pick random advanced topic
    const randomDomain = this.getRandomDomains(1)[0];
    const topics = this.specificTopics[randomDomain as keyof typeof this.specificTopics] || [];
    const specificTopic = topics[Math.floor(Math.random() * topics.length)];
    
    console.log(`🔄 CYCLING_DOMAINS: ${randomDomain} → ${specificTopic}`);
    return `${randomDomain}: ${specificTopic}`;
  }

  /**
   * Get random health domains
   */
  private getRandomDomains(count: number): string[] {
    const shuffled = [...this.healthDomains].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Check if a topic should be avoided due to recent overuse
   */
  async shouldAvoidTopic(topic: string): Promise<boolean> {
    const analysis = await this.analyzeRecentContent(3); // Check last 3 days
    const topicLower = topic.toLowerCase();
    
    return analysis.overusedWords.some(word => 
      topicLower.includes(word) || word.includes(topicLower)
    );
  }

  /**
   * Get content variety report for monitoring
   */
  async getVarietyReport(): Promise<string> {
    const analysis = await this.analyzeRecentContent();
    
    return `
📊 CONTENT DIVERSITY REPORT:
Score: ${analysis.diversityScore}/100
Recent topics: ${analysis.recentTopics.join(', ')}
Overused words: ${analysis.overusedWords.join(', ')}
Missing domains: ${analysis.missingDomains.length}/${this.healthDomains.length}
Recommended focus: ${analysis.recommendedFocus.join(', ')}
    `.trim();
  }
}
