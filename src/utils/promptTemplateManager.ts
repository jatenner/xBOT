/**
 * 🧪 PROMPT TEMPLATE A/B TESTING MANAGER
 * 
 * Performance-based evolution of prompt templates with:
 * - Engagement tracking per template
 * - A/B testing framework
 * - Automated template rotation
 * - Performance analytics
 * - Template generation via AI
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { OpenAI } from 'openai';

interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  type: 'health_tip' | 'myth_buster' | 'discovery' | 'controversial' | 'viral_hook' | 'data_driven';
  tone: 'authoritative' | 'friendly' | 'controversial' | 'scientific' | 'conversational';
  version: number;
  created_at: string;
  status: 'active' | 'testing' | 'retired' | 'champion';
  metadata: {
    created_by: 'human' | 'ai';
    parent_template?: string;
    target_audience: string;
    expected_engagement: 'high' | 'medium' | 'low';
  };
}

interface TemplatePerformance {
  template_id: string;
  total_uses: number;
  total_likes: number;
  total_retweets: number;
  total_replies: number;
  total_impressions: number;
  avg_engagement_rate: number;
  confidence_score: number; // Statistical confidence in the data
  last_used: string;
  performance_trend: 'improving' | 'declining' | 'stable';
}

interface ABTest {
  id: string;
  name: string;
  template_a: string;
  template_b: string;
  start_date: string;
  end_date?: string;
  status: 'running' | 'completed' | 'paused';
  winner?: string;
  statistical_significance: number;
  results: {
    template_a_performance: TemplatePerformance;
    template_b_performance: TemplatePerformance;
  };
}

export class PromptTemplateManager {
  private static readonly MIN_USES_FOR_ANALYSIS = 10;
  private static readonly ANALYSIS_INTERVAL = 48 * 60 * 60 * 1000; // 48 hours
  private static readonly CONFIDENCE_THRESHOLD = 0.8;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 GET BEST TEMPLATE FOR CONTENT TYPE
   */
  static async getBestTemplate(
    contentType: string,
    tone?: string
  ): Promise<PromptTemplate | null> {
    try {
      // First, try to get champion template
      const champion = await this.getChampionTemplate(contentType, tone);
      if (champion) {
        console.log(`🏆 Using champion template: ${champion.name}`);
        return champion;
      }

      // Fallback to best performing active template
      const bestTemplate = await this.getBestPerformingTemplate(contentType, tone);
      if (bestTemplate) {
        console.log(`📊 Using best performing template: ${bestTemplate.name}`);
        return bestTemplate;
      }

      // Last resort: get any active template
      return await this.getRandomActiveTemplate(contentType, tone);
    } catch (error) {
      console.error('❌ Failed to get best template:', error);
      return null;
    }
  }

  /**
   * 🧪 SELECT TEMPLATE FOR A/B TEST
   */
  static async selectTemplateForTest(contentType: string, tone?: string): Promise<PromptTemplate | null> {
    try {
      // Get running A/B tests
      const runningTests = await this.getRunningABTests();
      
      // 80% chance to use champion, 20% chance to test alternative
      if (Math.random() < 0.8) {
        return await this.getBestTemplate(contentType, tone);
      } else {
        // Select a testing template
        const testingTemplates = await this.getTestingTemplates(contentType, tone);
        if (testingTemplates.length > 0) {
          const randomTemplate = testingTemplates[Math.floor(Math.random() * testingTemplates.length)];
          console.log(`🧪 Using testing template: ${randomTemplate.name}`);
          return randomTemplate;
        }
        return await this.getBestTemplate(contentType, tone);
      }
    } catch (error) {
      console.error('❌ Failed to select test template:', error);
      return await this.getBestTemplate(contentType, tone);
    }
  }

  /**
   * 📊 RECORD TEMPLATE USAGE
   */
  static async recordTemplateUsage(
    templateId: string,
    tweetId: string,
    contentType: string
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('template_usage')
        .insert({
          template_id: templateId,
          tweet_id: tweetId,
          content_type: contentType,
          used_at: new Date().toISOString()
        });

      console.log(`📝 Recorded usage for template ${templateId}`);
    } catch (error) {
      console.error('❌ Failed to record template usage:', error);
    }
  }

  /**
   * 📈 UPDATE TEMPLATE AND IDEA PERFORMANCE
   */
  static async updateTemplatePerformance(
    tweetId: string,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions?: number;
    }
  ): Promise<void> {
    try {
      // Get template ID from usage record
      const { data: usageData, error } = await supabaseClient.supabase
        .from('template_usage')
        .select('template_id')
        .eq('tweet_id', tweetId)
        .single();

      if (error || !usageData) {
        console.log(`⚠️ No template usage found for tweet ${tweetId}`);
      } else {
        // Update template performance metrics
        await supabaseClient.supabase
          .from('template_performance')
          .upsert({
            template_id: usageData.template_id,
            tweet_id: tweetId,
            likes: engagement.likes,
            retweets: engagement.retweets,
            replies: engagement.replies,
            impressions: engagement.impressions || 0,
            engagement_rate: this.calculateEngagementRate(engagement),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'template_id,tweet_id'
          });

        console.log(`📊 Updated template performance for ${usageData.template_id}`);
      }

      // Update core idea performance
      const { coreIdeaTracker } = await import('./coreIdeaTracker');
      await coreIdeaTracker.updateIdeaPerformance(tweetId, engagement);
    } catch (error) {
      console.error('❌ Failed to update template performance:', error);
    }
  }

  /**
   * 🔄 ANALYZE AND ROTATE TEMPLATES
   */
  static async analyzeAndRotateTemplates(): Promise<{
    analyzed: number;
    promoted: string[];
    retired: string[];
    newTests: string[];
  }> {
    try {
      console.log('🔄 Starting template analysis and rotation...');

      const results = {
        analyzed: 0,
        promoted: [] as string[],
        retired: [] as string[],
        newTests: [] as string[]
      };

      // Get all templates with sufficient data
      const templates = await this.getTemplatesForAnalysis();
      results.analyzed = templates.length;

      for (const template of templates) {
        const performance = await this.calculateTemplatePerformance(template.id);
        
        if (performance.confidence_score >= this.CONFIDENCE_THRESHOLD) {
          // Decide on template fate
          if (performance.avg_engagement_rate > 0.05 && performance.performance_trend !== 'declining') {
            // Promote to champion or keep active
            await this.promoteTemplate(template.id);
            results.promoted.push(template.name);
          } else if (performance.avg_engagement_rate < 0.02 || performance.performance_trend === 'declining') {
            // Retire poor performing template
            await this.retireTemplate(template.id);
            results.retired.push(template.name);
          }
        }
      }

      // Generate new testing templates for retired ones
      for (const retiredTemplate of results.retired) {
        const newTemplate = await this.generateNewTemplate(retiredTemplate);
        if (newTemplate) {
          results.newTests.push(newTemplate.name);
        }
      }

      console.log(`🔄 Template rotation complete: ${results.promoted.length} promoted, ${results.retired.length} retired, ${results.newTests.length} new tests`);
      return results;

    } catch (error) {
      console.error('❌ Template analysis failed:', error);
      return {
        analyzed: 0,
        promoted: [],
        retired: [],
        newTests: []
      };
    }
  }

  /**
   * 🤖 GENERATE NEW TEMPLATE VARIATION
   */
  static async generateNewTemplate(
    baseTemplateName: string,
    improveFor: 'engagement' | 'clarity' | 'virality' = 'engagement'
  ): Promise<PromptTemplate | null> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('template-generation');

      // Get best performing templates for inspiration
      const topTemplates = await this.getTopPerformingTemplates(3);
      const baseTemplate = await this.getTemplateByName(baseTemplateName);

      const prompt = `You are an expert content strategist. Create a new, improved tweet template variation.

GOAL: Improve for ${improveFor}

BASE TEMPLATE TO IMPROVE:
${baseTemplate?.template || 'Health tip format'}

TOP PERFORMING PATTERNS FOR INSPIRATION:
${topTemplates.map(t => `- ${t.template}`).join('\n')}

REQUIREMENTS:
1. Keep the core health/wellness focus
2. Make it more engaging and shareable
3. Include specific placeholders like {claim}, {explanation}, {data}
4. Optimize for Twitter's algorithm (engagement, replies, saves)
5. Be authentic and valuable, not clickbait

TEMPLATE STYLE OPTIONS:
- Question hook + Answer format
- Controversial statement + Explanation
- Personal story + Lesson learned
- Data point + Why it matters
- Myth + Truth reveal
- Before/After transformation format

Return ONLY the new template text with placeholders, no explanations.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.8
      });

      const templateText = response.choices[0]?.message?.content?.trim();
      if (!templateText) return null;

      // Create new template record
      const newTemplate: PromptTemplate = {
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `AI Generated - ${improveFor} optimized`,
        template: templateText,
        type: baseTemplate?.type || 'health_tip',
        tone: baseTemplate?.tone || 'friendly',
        version: 1,
        created_at: new Date().toISOString(),
        status: 'testing',
        metadata: {
          created_by: 'ai',
          parent_template: baseTemplate?.id,
          target_audience: 'health enthusiasts',
          expected_engagement: 'high'
        }
      };

      // Save to database
      await this.saveTemplate(newTemplate);
      console.log(`🤖 Generated new template: ${newTemplate.name}`);

      return newTemplate;
    } catch (error) {
      console.error('❌ Failed to generate new template:', error);
      return null;
    }
  }

  /**
   * 📊 CALCULATE ENGAGEMENT RATE
   */
  private static calculateEngagementRate(engagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions?: number;
  }): number {
    const totalEngagement = engagement.likes + engagement.retweets + engagement.replies;
    const impressions = engagement.impressions || Math.max(totalEngagement * 10, 100); // Estimate if not available
    return impressions > 0 ? totalEngagement / impressions : 0;
  }

  /**
   * 🏆 GET CHAMPION TEMPLATE
   */
  private static async getChampionTemplate(
    contentType: string,
    tone?: string
  ): Promise<PromptTemplate | null> {
    try {
      const query = supabaseClient.supabase
        .from('prompt_templates')
        .select('*')
        .eq('type', contentType)
        .eq('status', 'champion');

      if (tone) {
        query.eq('tone', tone);
      }

      const { data, error } = await query.single();
      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  /**
   * 📈 GET BEST PERFORMING TEMPLATE
   */
  private static async getBestPerformingTemplate(
    contentType: string,
    tone?: string
  ): Promise<PromptTemplate | null> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_best_performing_template', {
          content_type: contentType,
          tone_filter: tone || null
        });

      return error ? null : data;
    } catch (error) {
      console.error('❌ Failed to get best performing template:', error);
      return null;
    }
  }

  /**
   * 🎲 GET RANDOM ACTIVE TEMPLATE
   */
  private static async getRandomActiveTemplate(
    contentType: string,
    tone?: string
  ): Promise<PromptTemplate | null> {
    try {
      const query = supabaseClient.supabase
        .from('prompt_templates')
        .select('*')
        .eq('type', contentType)
        .eq('status', 'active');

      if (tone) {
        query.eq('tone', tone);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) return null;

      return data[Math.floor(Math.random() * data.length)];
    } catch (error) {
      console.error('❌ Failed to get random template:', error);
      return null;
    }
  }

  /**
   * 🧪 GET TESTING TEMPLATES
   */
  private static async getTestingTemplates(
    contentType: string,
    tone?: string
  ): Promise<PromptTemplate[]> {
    try {
      const query = supabaseClient.supabase
        .from('prompt_templates')
        .select('*')
        .eq('type', contentType)
        .eq('status', 'testing');

      if (tone) {
        query.eq('tone', tone);
      }

      const { data, error } = await query;
      return error ? [] : data || [];
    } catch (error) {
      console.error('❌ Failed to get testing templates:', error);
      return [];
    }
  }

  /**
   * 💾 SAVE TEMPLATE
   */
  private static async saveTemplate(template: PromptTemplate): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('prompt_templates')
        .insert(template);
    } catch (error) {
      console.error('❌ Failed to save template:', error);
    }
  }

  /**
   * 📊 CALCULATE TEMPLATE PERFORMANCE
   */
  private static async calculateTemplatePerformance(templateId: string): Promise<TemplatePerformance> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('calculate_template_performance', { template_id_param: templateId });

      if (error) throw error;

      return data || {
        template_id: templateId,
        total_uses: 0,
        total_likes: 0,
        total_retweets: 0,
        total_replies: 0,
        total_impressions: 0,
        avg_engagement_rate: 0,
        confidence_score: 0,
        last_used: new Date().toISOString(),
        performance_trend: 'stable'
      };
    } catch (error) {
      console.error('❌ Failed to calculate template performance:', error);
      return {
        template_id: templateId,
        total_uses: 0,
        total_likes: 0,
        total_retweets: 0,
        total_replies: 0,
        total_impressions: 0,
        avg_engagement_rate: 0,
        confidence_score: 0,
        last_used: new Date().toISOString(),
        performance_trend: 'stable'
      };
    }
  }

  /**
   * Helper methods for template management
   */
  private static async getTemplatesForAnalysis(): Promise<PromptTemplate[]> {
    const { data } = await supabaseClient.supabase
      .from('prompt_templates')
      .select('*')
      .in('status', ['active', 'testing']);
    return data || [];
  }

  private static async promoteTemplate(templateId: string): Promise<void> {
    await supabaseClient.supabase
      .from('prompt_templates')
      .update({ status: 'champion' })
      .eq('id', templateId);
  }

  private static async retireTemplate(templateId: string): Promise<void> {
    await supabaseClient.supabase
      .from('prompt_templates')
      .update({ status: 'retired' })
      .eq('id', templateId);
  }

  private static async getTopPerformingTemplates(limit: number): Promise<PromptTemplate[]> {
    const { data } = await supabaseClient.supabase
      .rpc('get_top_performing_templates', { limit_count: limit });
    return data || [];
  }

  private static async getTemplateByName(name: string): Promise<PromptTemplate | null> {
    const { data } = await supabaseClient.supabase
      .from('prompt_templates')
      .select('*')
      .eq('name', name)
      .single();
    return data;
  }

  private static async getRunningABTests(): Promise<ABTest[]> {
    const { data } = await supabaseClient.supabase
      .from('ab_tests')
      .select('*')
      .eq('status', 'running');
    return data || [];
  }
}

export const promptTemplateManager = PromptTemplateManager; 