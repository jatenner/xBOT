/**
 * 🎪 VIRAL THEME ENGINE
 * =====================
 * 
 * Creates a cohesive brand experience that makes @SignalAndSynapse
 * the go-to destination for healthcare insights that hook users
 * 
 * Core Themes:
 * 1. Healthcare Reality Check (expose industry secrets)
 * 2. Future Health Tech (what's coming next)
 * 3. Data-Driven Insights (actionable health data)
 * 4. Industry Insider (behind-the-scenes perspectives)
 * 5. Contrarian Health Takes (challenge conventional wisdom)
 */

import { supabase } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';

interface ViralTheme {
  id: string;
  name: string;
  description: string;
  hook_templates: string[];
  content_pillars: string[];
  engagement_triggers: string[];
  personality_voice: string;
  target_emotions: string[];
  success_metrics: {
    min_likes: number;
    min_retweets: number;
    target_replies: number;
  };
}

interface ContentPlan {
  theme: string;
  hook: string;
  content_type: 'hot_take' | 'insider_secret' | 'future_prediction' | 'reality_check' | 'data_insight';
  engagement_goal: 'viral' | 'debate' | 'education' | 'curiosity';
  posting_priority: 'high' | 'medium' | 'low';
}

export class ViralThemeEngine {
  private themes: ViralTheme[] = [];
  private activeTheme: ViralTheme | null = null;
  private dailyThemePlan: ContentPlan[] = [];
  private themeRotationSchedule: string[] = [];

  constructor() {
    this.initializeThemes();
  }

  private initializeThemes(): void {
    this.themes = [
      {
        id: 'healthcare_reality_check',
        name: 'Healthcare Reality Check',
        description: 'Expose what really happens behind the scenes in healthcare',
        hook_templates: [
          "🎭 Reality check: What your doctor isn't telling you about {topic}",
          "💀 The dark truth about {topic} that healthcare execs don't want you to know",
          "⚠️ Plot twist: Your {topic} assumptions are probably wrong",
          "🔍 Behind the curtain: How {topic} decisions are really made",
          "💡 Industry secret: The real reason {topic} costs so much"
        ],
        content_pillars: [
          'Healthcare costs reality',
          'Doctor-patient communication gaps',
          'Insurance industry secrets',
          'Medical device markup truth',
          'Pharmaceutical pricing reality'
        ],
        engagement_triggers: [
          'Industry insider knowledge',
          'Cost transparency reveals',
          'System inefficiency exposure',
          'Patient advocacy angles',
          'Reform necessity arguments'
        ],
        personality_voice: 'Informed insider who cares about patients',
        target_emotions: ['surprise', 'outrage', 'validation', 'empowerment'],
        success_metrics: {
          min_likes: 25,
          min_retweets: 5,
          target_replies: 10
        }
      },
      {
        id: 'future_health_tech',
        name: 'Future Health Tech Oracle',
        description: 'Predict and analyze emerging healthcare technologies',
        hook_templates: [
          "🚀 Future shock: Healthcare in 2030 will be unrecognizable because of {topic}",
          "⚡ Plot twist: {topic} will make your current health routine obsolete",
          "🔮 Prediction: {topic} will be the next healthcare unicorn",
          "💎 Hidden gem: {topic} is quietly revolutionizing healthcare",
          "🎯 Hot take: Everyone's missing the real opportunity in {topic}"
        ],
        content_pillars: [
          'AI diagnostics evolution',
          'Wearable technology trends',
          'Telemedicine innovations',
          'Personalized medicine advances',
          'Digital health platforms'
        ],
        engagement_triggers: [
          'Early trend identification',
          'Investment opportunities',
          'Disruption predictions',
          'Technology explanations',
          'Market timing insights'
        ],
        personality_voice: 'Visionary technologist with healthcare expertise',
        target_emotions: ['excitement', 'curiosity', 'FOMO', 'anticipation'],
        success_metrics: {
          min_likes: 30,
          min_retweets: 8,
          target_replies: 12
        }
      },
      {
        id: 'data_driven_insights',
        name: 'Data-Driven Health Detective',
        description: 'Reveal actionable insights from health data analysis',
        hook_templates: [
          "📊 Data revelation: After analyzing {number} {topic} cases, this shocked me",
          "🔬 Study surprise: {topic} data reveals something doctors miss",
          "📈 Trend alert: {topic} numbers show something nobody's talking about",
          "💡 Data insight: The {topic} metric that predicts everything",
          "🎯 Analytics gold: {topic} patterns reveal the secret to {outcome}"
        ],
        content_pillars: [
          'Health outcome correlations',
          'Lifestyle factor analysis',
          'Medical intervention effectiveness',
          'Population health trends',
          'Predictive health indicators'
        ],
        engagement_triggers: [
          'Surprising correlations',
          'Actionable recommendations',
          'Myth-busting evidence',
          'Personal relevance',
          'Quantified self insights'
        ],
        personality_voice: 'Data scientist who makes numbers meaningful',
        target_emotions: ['enlightenment', 'motivation', 'confidence', 'clarity'],
        success_metrics: {
          min_likes: 20,
          min_retweets: 6,
          target_replies: 8
        }
      },
      {
        id: 'industry_insider',
        name: 'Healthcare Industry Insider',
        description: 'Share exclusive behind-the-scenes healthcare industry knowledge',
        hook_templates: [
          "🎪 Inside scoop: How {topic} decisions are really made in healthcare",
          "💼 Boardroom reality: What healthcare execs actually discuss about {topic}",
          "🤝 Industry confession: The {topic} truth we don't tell patients",
          "💰 Follow the money: Why {topic} works the way it does",
          "🎭 Power play: The real stakeholders controlling {topic}"
        ],
        content_pillars: [
          'Healthcare business models',
          'Regulatory impact reality',
          'Stakeholder motivations',
          'Decision-making processes',
          'Industry transformation forces'
        ],
        engagement_triggers: [
          'Exclusive access knowledge',
          'Power structure reveals',
          'Business model explanations',
          'Conflict of interest exposure',
          'Reform opportunity identification'
        ],
        personality_voice: 'Experienced insider who understands the system',
        target_emotions: ['insider knowledge', 'understanding', 'frustration', 'hope'],
        success_metrics: {
          min_likes: 35,
          min_retweets: 10,
          target_replies: 15
        }
      },
      {
        id: 'contrarian_health',
        name: 'Contrarian Health Thinker',
        description: 'Challenge conventional health wisdom with evidence-based contrarian takes',
        hook_templates: [
          "⚡ Unpopular opinion: {topic} advice you're getting is probably wrong",
          "🔥 Hot take: The {topic} conventional wisdom is outdated",
          "💥 Controversial truth: {topic} might be the opposite of what you think",
          "🎯 Contrarian view: Everyone's wrong about {topic}",
          "⭐ Uncomfortable truth: {topic} isn't what the experts claim"
        ],
        content_pillars: [
          'Nutrition myth-busting',
          'Exercise science updates',
          'Mental health misconceptions',
          'Preventive care gaps',
          'Treatment alternative analysis'
        ],
        engagement_triggers: [
          'Challenge popular beliefs',
          'Evidence-based arguments',
          'Personal experience validation',
          'Expert opinion questioning',
          'New research integration'
        ],
        personality_voice: 'Evidence-based contrarian who challenges assumptions',
        target_emotions: ['skepticism', 'validation', 'controversy', 'enlightenment'],
        success_metrics: {
          min_likes: 40,
          min_retweets: 12,
          target_replies: 20
        }
      }
    ];

    console.log(`🎪 Viral Theme Engine initialized with ${this.themes.length} themes`);
  }

  /**
   * 🎯 Generate daily theme-based content plan
   */
  public async generateDailyThemePlan(targetPosts: number): Promise<ContentPlan[]> {
    console.log(`🎪 Generating daily theme plan for ${targetPosts} posts`);
    
    // Rotate through themes to ensure variety
    this.rotateActiveTheme();
    
    const plan: ContentPlan[] = [];
    
    for (let i = 0; i < targetPosts; i++) {
      const theme = this.selectThemeForPost(i, targetPosts);
      const contentType = this.selectContentType(theme, i);
      const hook = this.selectHookTemplate(theme, contentType);
      
      plan.push({
        theme: theme.name,
        hook,
        content_type: contentType,
        engagement_goal: this.selectEngagementGoal(contentType, i),
        posting_priority: this.calculatePostingPriority(i, targetPosts)
      });
    }
    
    this.dailyThemePlan = plan;
    
    // Store plan in database for tracking
    await this.storeDailyPlan(plan);
    
    console.log(`✅ Daily theme plan generated: ${plan.length} posts across ${new Set(plan.map(p => p.theme)).size} themes`);
    
    return plan;
  }

  /**
   * 🎨 Generate themed content based on plan
   */
  public async generateThemedContent(planIndex: number, topic?: string): Promise<string> {
    if (planIndex >= this.dailyThemePlan.length) {
      throw new Error('Invalid plan index');
    }
    
    const plan = this.dailyThemePlan[planIndex];
    const theme = this.themes.find(t => t.name === plan.theme);
    
    if (!theme) {
      throw new Error(`Theme not found: ${plan.theme}`);
    }
    
    const prompt = this.buildThemedPrompt(theme, plan, topic);
    
    try {
      const content = await openaiClient.generateCompletion(prompt, {
        model: 'gpt-4o-mini',
        maxTokens: 280,
        temperature: 0.8
      });
      
      // Track theme usage
      await this.trackThemeUsage(theme.id, plan.content_type, content);
      
      console.log(`🎨 Generated ${plan.content_type} content for theme: ${theme.name}`);
      
      return content || plan.hook; // Fallback to hook if generation fails
    } catch (error) {
      console.error('❌ Error generating themed content:', error);
      return plan.hook; // Fallback to hook
    }
  }

  /**
   * 🔄 Smart theme rotation based on performance
   */
  private rotateActiveTheme(): void {
    if (!this.activeTheme) {
      this.activeTheme = this.themes[0];
      return;
    }
    
    // Find current theme index
    const currentIndex = this.themes.findIndex(t => t.id === this.activeTheme!.id);
    
    // Move to next theme, wrapping around
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.activeTheme = this.themes[nextIndex];
    
    console.log(`🔄 Rotated to theme: ${this.activeTheme.name}`);
  }

  private selectThemeForPost(postIndex: number, totalPosts: number): ViralTheme {
    // Distribute themes evenly throughout the day
    const themeIndex = Math.floor((postIndex * this.themes.length) / totalPosts);
    return this.themes[themeIndex % this.themes.length];
  }

  private selectContentType(theme: ViralTheme, postIndex: number): ContentPlan['content_type'] {
    const types: ContentPlan['content_type'][] = [
      'hot_take', 'insider_secret', 'future_prediction', 'reality_check', 'data_insight'
    ];
    
    // First post should be high-impact
    if (postIndex === 0) return 'hot_take';
    
    // Distribute content types based on theme
    const themeTypeMap: Record<string, ContentPlan['content_type'][]> = {
      'Healthcare Reality Check': ['reality_check', 'insider_secret', 'hot_take'],
      'Future Health Tech Oracle': ['future_prediction', 'hot_take', 'data_insight'],
      'Data-Driven Health Detective': ['data_insight', 'reality_check', 'future_prediction'],
      'Healthcare Industry Insider': ['insider_secret', 'reality_check', 'hot_take'],
      'Contrarian Health Thinker': ['hot_take', 'reality_check', 'data_insight']
    };
    
    const preferredTypes = themeTypeMap[theme.name] || types;
    return preferredTypes[postIndex % preferredTypes.length];
  }

  private selectHookTemplate(theme: ViralTheme, contentType: ContentPlan['content_type']): string {
    // Filter hooks by content type preference
    const relevantHooks = theme.hook_templates.filter(hook => {
      if (contentType === 'hot_take') return hook.includes('Hot take') || hook.includes('Unpopular');
      if (contentType === 'insider_secret') return hook.includes('secret') || hook.includes('Inside');
      if (contentType === 'future_prediction') return hook.includes('Future') || hook.includes('Prediction');
      if (contentType === 'reality_check') return hook.includes('Reality') || hook.includes('truth');
      if (contentType === 'data_insight') return hook.includes('Data') || hook.includes('Study');
      return true;
    });
    
    const selectedHooks = relevantHooks.length > 0 ? relevantHooks : theme.hook_templates;
    return selectedHooks[Math.floor(Math.random() * selectedHooks.length)];
  }

  private selectEngagementGoal(contentType: ContentPlan['content_type'], postIndex: number): ContentPlan['engagement_goal'] {
    // Prime time posts should aim for viral
    if (postIndex === 0 || postIndex === 1) return 'viral';
    
    const goalMap: Record<ContentPlan['content_type'], ContentPlan['engagement_goal']> = {
      'hot_take': 'debate',
      'insider_secret': 'curiosity',
      'future_prediction': 'viral',
      'reality_check': 'debate',
      'data_insight': 'education'
    };
    
    return goalMap[contentType] || 'viral';
  }

  private calculatePostingPriority(postIndex: number, totalPosts: number): ContentPlan['posting_priority'] {
    // First and last posts are high priority
    if (postIndex === 0 || postIndex === totalPosts - 1) return 'high';
    
    // Middle posts vary
    return postIndex % 2 === 0 ? 'medium' : 'low';
  }

  private buildThemedPrompt(theme: ViralTheme, plan: ContentPlan, topic?: string): string {
    const randomPillar = theme.content_pillars[Math.floor(Math.random() * theme.content_pillars.length)];
    const randomTrigger = theme.engagement_triggers[Math.floor(Math.random() * theme.engagement_triggers.length)];
    const targetTopic = topic || randomPillar;
    
    return `You are the ${theme.name} for @SignalAndSynapse, creating ${plan.content_type} content.

THEME: ${theme.description}
HOOK: "${plan.hook.replace('{topic}', targetTopic).replace('{number}', String(Math.floor(Math.random() * 9000) + 1000))}"
CONTENT TYPE: ${plan.content_type}
ENGAGEMENT GOAL: ${plan.engagement_goal}
VOICE: ${theme.personality_voice}
TARGET EMOTIONS: ${theme.target_emotions.join(', ')}

CONTENT REQUIREMENTS:
1. Start with the provided hook
2. Use ${theme.personality_voice} voice throughout
3. Focus on ${randomTrigger}
4. Aim for ${plan.engagement_goal} engagement
5. Target emotions: ${theme.target_emotions.join(', ')}
6. Include healthcare expertise but make it accessible
7. End with engagement driver (question, cliffhanger, or call-to-action)

BANNED PHRASES: "BREAKTHROUGH:", "Research shows", "Studies indicate", "According to research"

SUCCESS METRICS TARGET:
- Minimum ${theme.success_metrics.min_likes} likes
- Minimum ${theme.success_metrics.min_retweets} retweets
- Target ${theme.success_metrics.target_replies} replies

Generate ONE compelling tweet that makes people addicted to @SignalAndSynapse content:`;
  }

  private async storeDailyPlan(plan: ContentPlan[]): Promise<void> {
    try {
      await supabase.from('daily_theme_plans').insert({
        date: new Date().toISOString().split('T')[0],
        plan: JSON.stringify(plan),
        themes_used: [...new Set(plan.map(p => p.theme))],
        total_posts: plan.length
      });
    } catch (error) {
      console.error('Error storing daily plan:', error);
    }
  }

  private async trackThemeUsage(themeId: string, contentType: string, content: string): Promise<void> {
    try {
      await supabase.from('theme_usage_tracking').insert({
        theme_id: themeId,
        content_type: contentType,
        content: content,
        generated_at: new Date().toISOString(),
        performance_score: 0 // Will be updated when engagement data comes in
      });
    } catch (error) {
      console.error('Error tracking theme usage:', error);
    }
  }

  /**
   * 📊 Get theme performance analytics
   */
  public async getThemePerformance(): Promise<any> {
    try {
      const { data } = await supabase
        .from('theme_usage_tracking')
        .select('*')
        .gte('generated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const performance = this.themes.map(theme => {
        const themeData = data?.filter(d => d.theme_id === theme.id) || [];
        const avgScore = themeData.reduce((sum, d) => sum + (d.performance_score || 0), 0) / themeData.length || 0;
        
        return {
          theme: theme.name,
          usage_count: themeData.length,
          avg_performance: avgScore,
          success_rate: themeData.filter(d => (d.performance_score || 0) >= theme.success_metrics.min_likes).length / themeData.length || 0
        };
      });

      return performance;
    } catch (error) {
      console.error('Error getting theme performance:', error);
      return [];
    }
  }

  /**
   * 🎪 Get current active theme info
   */
  public getCurrentTheme(): ViralTheme | null {
    return this.activeTheme;
  }

  /**
   * 📋 Get today's content plan
   */
  public getDailyPlan(): ContentPlan[] {
    return this.dailyThemePlan;
  }
}

// Export singleton instance
export const viralThemeEngine = new ViralThemeEngine(); 