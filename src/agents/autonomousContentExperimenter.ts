import { openaiClient } from '../utils/openaiClient';
import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { formatTweet, truncateTweet } from '../utils/formatTweet';
import dotenv from 'dotenv';

dotenv.config();

interface ContentExperiment {
  id: string;
  experiment_type: 'format' | 'length' | 'style' | 'timing' | 'topic' | 'structure' | 'emoji_usage' | 'hashtag_strategy';
  hypothesis: string;
  test_content: string;
  variables: {
    word_count?: number;
    emoji_count?: number;
    hashtag_count?: number;
    structure_type?: string;
    tone?: string;
    content_format?: string;
  };
  expected_outcome: string;
  confidence: number;
  created_at: Date;
  results?: ExperimentResults;
}

interface ExperimentResults {
  engagement_rate: number;
  virality_score: number;
  success_rating: number; // 1-10
  should_repeat: boolean;
  learning_insights: string[];
}

interface AutonomousInsight {
  insight_type: 'content_discovery' | 'format_optimization' | 'audience_behavior' | 'creative_breakthrough';
  discovery: string;
  confidence: number;
  actionable_strategy: string;
  experiment_ideas: string[];
}

export class AutonomousContentExperimenter {
  private readonly MAX_CONCURRENT_EXPERIMENTS = 2;
  private readonly MIN_CONFIDENCE_TO_EXPERIMENT = 60;
  private activeExperiments: Map<string, ContentExperiment> = new Map();

  constructor() {
    console.log('🧪 Autonomous Content Experimenter initialized - Ready to revolutionize content!');
  }

  /**
   * 🚀 MAIN AUTONOMOUS EXPERIMENTATION CYCLE
   */
  async runExperimentationCycle(): Promise<void> {
    console.log('🔬 === AUTONOMOUS CONTENT EVOLUTION STARTED ===');
    console.log('🤖 AI is now inventing revolutionary content strategies...');

    try {
      // 1. Identify what to experiment with
      const opportunities = await this.identifyExperimentationOpportunities();
      
      // 2. Generate bold hypotheses
      const hypotheses = await this.generateCreativeHypotheses(opportunities);
      
      // 3. Execute experiments
      for (const hypothesis of hypotheses.slice(0, this.MAX_CONCURRENT_EXPERIMENTS)) {
        await this.executeExperiment(hypothesis);
      }
      
      // 4. Analyze results
      await this.analyzeExperiments();
      
      // 5. Extract insights and evolve
      await this.extractInsightsAndEvolve();
      
      console.log('🧬 Content evolution cycle complete!');

    } catch (error) {
      console.error('❌ Experimentation cycle failed:', error);
    }
  }

  /**
   * 🔍 IDENTIFY OPPORTUNITIES
   */
  private async identifyExperimentationOpportunities(): Promise<string[]> {
    try {
      const recentTweets = await supabaseClient.getRecentTweets(7);
      const performanceData = this.analyzePerformance(recentTweets);

      const prompt = `You are an autonomous AI with complete creative freedom to revolutionize content strategy.

CURRENT PERFORMANCE:
${JSON.stringify(performanceData, null, 2)}

Your mission: Identify RADICAL content experiments that could 10x engagement.

Consider:
- Ultra-minimal content (1-3 words, single emoji, just "?")
- Completely new formats (ASCII art, code snippets, visual poems)
- Emotional triggers (fear, curiosity, controversy, humor)
- Timing disruption (posting when others don't)
- Format breaking (no hashtags, all caps, unique formatting)
- Psychology hacks (cliffhangers, incomplete thoughts)
- Trend hijacking (current events, memes)
- Interactive experiments (polls in text, choose-your-adventure)

Be BOLD. Break conventions. Find the content that will go viral.

Return JSON array of bold opportunities:
["experiment 1", "experiment 2", ...]`;

      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.9, // Maximum creativity
        max_tokens: 500
      });

      const responseText = response?.choices[0]?.message?.content;
      if (responseText) {
        const opportunities = JSON.parse(responseText);
        console.log(`💡 Identified ${opportunities.length} revolutionary opportunities`);
        return opportunities;
      }
    } catch (error) {
      console.warn('Using fallback opportunities');
    }

    return [
      "Test single-word tweets with maximum impact",
      "Experiment with emoji-only communication",
      "Try controversial but safe hot takes",
      "Test timing disruption strategies"
    ];
  }

  /**
   * 💡 GENERATE CREATIVE HYPOTHESES
   */
  private async generateCreativeHypotheses(opportunities: string[]): Promise<ContentExperiment[]> {
    const hypotheses: ContentExperiment[] = [];

    for (const opportunity of opportunities.slice(0, 3)) {
      try {
        const prompt = `Design a BOLD content experiment for: "${opportunity}"

Create something that will shock, delight, or intrigue the health tech Twitter audience.

CONTEXT: Professional health tech account that needs to stand out

REQUIREMENTS:
- Be bold but brand-safe
- Create testable, specific content  
- Predict viral potential
- Think outside conventional social media rules

Design the most engaging possible content for this experiment.

Respond with JSON:
{
  "experiment_type": "format|length|style|timing|topic|structure|emoji_usage|hashtag_strategy",
  "hypothesis": "If we do [specific action], then [predicted outcome] because [psychological reason]",
  "test_content": "exact tweet content to test (be creative!)",
  "variables": {
    "word_count": number,
    "emoji_count": number,
    "hashtag_count": number,
    "structure_type": "description of format",
    "tone": "description of tone",
    "content_format": "description of format innovation"
  },
  "expected_outcome": "specific engagement prediction",
  "confidence": number (1-100)
}`;

        const response = await openaiClient.getClient()?.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.8,
          max_tokens: 400
        });

        const responseText = response?.choices[0]?.message?.content;
        if (responseText) {
          const hypothesis = JSON.parse(responseText);
          
          hypotheses.push({
            id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ...hypothesis,
            created_at: new Date()
          });
        }
      } catch (error) {
        console.warn(`Failed to generate hypothesis for: ${opportunity}`);
      }
    }

    console.log(`🧠 Generated ${hypotheses.length} revolutionary hypotheses`);
    return hypotheses;
  }

  /**
   * ⚗️ EXECUTE EXPERIMENT
   */
  private async executeExperiment(experiment: ContentExperiment): Promise<void> {
    if (experiment.confidence < this.MIN_CONFIDENCE_TO_EXPERIMENT) {
      console.log(`⚠️ Skipping low-confidence experiment`);
      return;
    }

    try {
      console.log(`🚀 EXECUTING BOLD EXPERIMENT: ${experiment.experiment_type.toUpperCase()}`);
      console.log(`   💡 Hypothesis: ${experiment.hypothesis}`);
      console.log(`   🎯 Content: "${experiment.test_content}"`);
      console.log(`   📊 Confidence: ${experiment.confidence}%`);

      // Process content
      const content = this.processContent(experiment.test_content);

      // Deploy experiment
      const result = await xClient.postTweet(content);

      if (result.success && result.tweetId) {
        experiment.id = result.tweetId;
        this.activeExperiments.set(result.tweetId, experiment);

        // Record in database
        await this.recordExperiment(experiment, result.tweetId);

        console.log(`✅ Revolutionary content deployed: ${result.tweetId}`);
        console.log(`🔬 Tracking results...`);
      } else {
        console.log(`❌ Experiment deployment failed: ${result.error}`);
      }

    } catch (error) {
      console.error(`❌ Experiment execution failed:`, error);
    }
  }

  /**
   * 📊 ANALYZE EXPERIMENTS
   */
  private async analyzeExperiments(): Promise<void> {
    console.log('📊 Analyzing revolutionary experiments...');

    for (const [tweetId, experiment] of this.activeExperiments) {
      try {
        const tweetData = await xClient.getTweetById(tweetId);
        
        if (tweetData) {
          const results = this.calculateResults(experiment, tweetData);
          experiment.results = results;
          
          console.log(`📈 EXPERIMENT RESULTS: ${experiment.experiment_type}`);
          console.log(`   🎯 Success Rating: ${results.success_rating}/10`);
          console.log(`   🔥 Engagement Rate: ${results.engagement_rate.toFixed(2)}%`);
          console.log(`   🔄 Repeat: ${results.should_repeat ? 'YES' : 'NO'}`);

          // Archive if complete
          const hours = (Date.now() - experiment.created_at.getTime()) / (1000 * 60 * 60);
          if (hours >= 12) { // Shorter analysis window for faster iteration
            await this.archiveExperiment(experiment);
            this.activeExperiments.delete(tweetId);
          }
        }
      } catch (error) {
        console.warn(`Failed to analyze experiment ${tweetId}`);
      }
    }
  }

  /**
   * 🧬 EXTRACT INSIGHTS AND EVOLVE
   */
  private async extractInsightsAndEvolve(): Promise<void> {
    try {
      console.log('🧬 Extracting evolutionary insights...');

      const completedExperiments = await this.getRecentCompletedExperiments();
      
      const prompt = `Analyze these content experiments and extract BREAKTHROUGH insights for autonomous content evolution.

EXPERIMENT RESULTS:
${JSON.stringify(completedExperiments.slice(0, 8), null, 2)}

Extract insights that could revolutionize content strategy:

- What unexpected formats performed amazingly?
- What content lengths are optimal for virality?
- What psychological triggers work best?
- What timing patterns create engagement spikes?
- What format innovations should be scaled?

Look for patterns that traditional marketing would miss.

Respond with JSON:
[{
  "insight_type": "content_discovery|format_optimization|audience_behavior|creative_breakthrough",
  "discovery": "specific breakthrough insight",
  "confidence": number (1-100),
  "actionable_strategy": "how to apply this immediately",
  "experiment_ideas": ["next experiment 1", "next experiment 2", "next experiment 3"]
}]`;

      const response = await openaiClient.getClient()?.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.6,
        max_tokens: 600
      });

      const responseText = response?.choices[0]?.message?.content;
      if (responseText) {
        const insights = JSON.parse(responseText) as AutonomousInsight[];
        
        console.log(`🎯 Extracted ${insights.length} evolutionary insights`);
        
        for (const insight of insights) {
          if (insight.confidence >= 70) {
            console.log(`🧬 BREAKTHROUGH: ${insight.discovery}`);
            console.log(`   Strategy: ${insight.actionable_strategy}`);
            
            await this.storeInsight(insight);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to extract insights');
    }
  }

  /**
   * 🛠️ HELPER METHODS
   */
  private processContent(content: string): string {
    // Safety check: prevent scrambled or reversed text
    const reversedWords = ['eht', 'dna', 'rof', 'htiw', 'morf', 'ot', 'fo', 'ni'];
    const hasReversedText = reversedWords.some(word => 
      content.toLowerCase().includes(word)
    );
    
    if (hasReversedText) {
      console.log('🚨 BLOCKED: Content contains reversed text, using safe fallback');
      return "🔮 Healthcare innovation is accelerating faster than ever. What breakthrough will change everything? #HealthTech";
    }
    
    // Check for excessive lowercase words (sign of scrambling)
    const words = content.split(/\s+/);
    const lowercaseWords = words.filter(word => 
      word.length > 3 && 
      word === word.toLowerCase() && 
      /^[a-z]+$/.test(word)
    );
    
    if (lowercaseWords.length > 5) {
      console.log('🚨 BLOCKED: Content appears scrambled, using safe fallback');
      return "💡 The future of healthcare is being written today. What role will you play? #Innovation #HealthTech";
    }
    
    const formatted = formatTweet(content);
    return formatted.isValid ? content : truncateTweet(content);
  }

  private analyzePerformance(tweets: any[]): any {
    if (tweets.length === 0) return { message: "No data to analyze" };

    const avgEngagement = tweets.reduce((sum, t) => sum + (t.engagement_score || 0), 0) / tweets.length;
    const topPerformer = tweets.reduce((max, t) => t.engagement_score > max.engagement_score ? t : max, tweets[0]);

    // Analyze length performance
    const shortTweets = tweets.filter(t => t.content.length <= 50);
    const longTweets = tweets.filter(t => t.content.length > 150);

    return {
      avg_engagement: avgEngagement,
      top_engagement: topPerformer.engagement_score,
      short_performance: shortTweets.length > 0 ? shortTweets.reduce((sum, t) => sum + t.engagement_score, 0) / shortTweets.length : 0,
      long_performance: longTweets.length > 0 ? longTweets.reduce((sum, t) => sum + t.engagement_score, 0) / longTweets.length : 0,
      total_tweets: tweets.length
    };
  }

  private calculateResults(experiment: ContentExperiment, tweetData: any): ExperimentResults {
    const metrics = tweetData.public_metrics || {};
    const totalEngagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
    const engagementRate = metrics.impression_count > 0 ? (totalEngagement / metrics.impression_count) * 100 : 0;

    let successRating = 5; // Base score
    if (engagementRate > 2) successRating += 2;
    if (engagementRate > 5) successRating += 2;
    if (totalEngagement > 20) successRating += 1;

    const insights: string[] = [];
    if (metrics.retweet_count > metrics.like_count) {
      insights.push('Highly shareable content format');
    }
    if (metrics.like_count > metrics.retweet_count * 2) {
      insights.push('Strong emotional resonance');
    }

    return {
      engagement_rate: engagementRate,
      virality_score: Math.min((metrics.retweet_count || 0) * 5, 100),
      success_rating: Math.min(successRating, 10),
      should_repeat: successRating >= 7,
      learning_insights: insights
    };
  }

  private async recordExperiment(experiment: ContentExperiment, tweetId: string): Promise<void> {
    try {
      await supabaseClient.storeLearningInsight({
        insight_type: 'content_experiment',
        insight_data: {
          experiment_id: experiment.id,
          tweet_id: tweetId,
          experiment_type: experiment.experiment_type,
          hypothesis: experiment.hypothesis,
          test_content: experiment.test_content,
          variables: experiment.variables
        },
        confidence_score: experiment.confidence / 100,
        performance_impact: 0,
        sample_size: 1
      });
    } catch (error) {
      console.warn('Failed to record experiment');
    }
  }

  private async archiveExperiment(experiment: ContentExperiment): Promise<void> {
    try {
      await supabaseClient.storeLearningInsight({
        insight_type: 'experiment_results',
        insight_data: {
          experiment_id: experiment.id,
          results: experiment.results,
          learnings: experiment.results?.learning_insights || []
        },
        confidence_score: (experiment.results?.success_rating || 5) / 10,
        performance_impact: (experiment.results?.success_rating || 5) - 5,
        sample_size: 1
      });

      console.log(`📁 Experiment archived: ${experiment.experiment_type} (${experiment.results?.success_rating}/10)`);
    } catch (error) {
      console.warn('Failed to archive experiment');
    }
  }

  private async getRecentCompletedExperiments(): Promise<ContentExperiment[]> {
    try {
      const insights = await supabaseClient.getLearningInsights('experiment_results', 10);
      return insights.map(insight => ({
        id: insight.insight_data.experiment_id || '',
        experiment_type: insight.insight_data.experiment_type || 'unknown',
        hypothesis: insight.insight_data.hypothesis || '',
        test_content: insight.insight_data.test_content || '',
        variables: insight.insight_data.variables || {},
        expected_outcome: '',
        confidence: insight.confidence_score * 100,
        created_at: new Date(insight.created_at),
        results: insight.insight_data.results
      }));
    } catch (error) {
      return [];
    }
  }

  private async storeInsight(insight: AutonomousInsight): Promise<void> {
    try {
      await supabaseClient.storeLearningInsight({
        insight_type: 'strategic_evolution',
        insight_data: insight,
        confidence_score: insight.confidence / 100,
        performance_impact: insight.confidence > 80 ? 0.3 : 0.1,
        sample_size: 1
      });
    } catch (error) {
      console.warn('Failed to store insight');
    }
  }

  /**
   * 🎯 PUBLIC INTERFACE
   */
  async runSingleExperiment(): Promise<void> {
    console.log('🧪 Running single content experiment...');
    const opportunities = await this.identifyExperimentationOpportunities();
    const hypotheses = await this.generateCreativeHypotheses(opportunities.slice(0, 1));
    
    if (hypotheses.length > 0) {
      await this.executeExperiment(hypotheses[0]);
    }
  }

  getActiveExperimentCount(): number {
    return this.activeExperiments.size;
  }
} 