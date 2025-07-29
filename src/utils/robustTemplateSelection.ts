/**
 * 🛡️ ROBUST TEMPLATE SELECTION SYSTEM
 * 
 * Ensures template selection NEVER returns undefined with multiple fallback layers:
 * - Database template selection
 * - Emergency fallback templates
 * - Hardcoded backup templates
 * - Comprehensive error handling
 */

import { supabaseClient } from './supabaseClient';

interface Template {
  id: string;
  name: string;
  template: string;
  tone: 'friendly' | 'controversial' | 'scientific' | 'personal';
  content_type: 'tip' | 'fact' | 'myth_bust' | 'insight' | 'question';
  time_preference: 'morning' | 'afternoon' | 'evening' | 'any';
  performance_score?: number;
  usage_count?: number;
  active?: boolean;
}

interface TemplateSelectionResult {
  success: boolean;
  template: Template;
  selection_method: string;
  error?: string;
}

export class RobustTemplateSelection {
  private static readonly EMERGENCY_TEMPLATES: Template[] = [
    {
      id: 'emergency_health_tip',
      name: 'Emergency Health Tip',
      template: 'Health tip: {health_fact} This simple change can make a big difference in your wellness journey. What health goal are you working on today? #HealthTip #Wellness',
      tone: 'friendly',
      content_type: 'tip',
      time_preference: 'any',
      performance_score: 0.5,
      usage_count: 0,
      active: true
    },
    {
      id: 'emergency_health_fact',
      name: 'Emergency Health Fact',
      template: 'Did you know: {health_fact} The human body is truly amazing! What health fact surprised you the most? #HealthFacts #Wellness',
      tone: 'friendly',
      content_type: 'fact',
      time_preference: 'any',
      performance_score: 0.5,
      usage_count: 0,
      active: true
    },
    {
      id: 'emergency_myth_bust',
      name: 'Emergency Myth Buster',
      template: 'Myth buster: {controversial_statement} The science shows: {scientific_reasoning} What health myths have you heard? #MythBuster #HealthScience',
      tone: 'scientific',
      content_type: 'myth_bust',
      time_preference: 'any',
      performance_score: 0.5,
      usage_count: 0,
      active: true
    },
    {
      id: 'emergency_insight',
      name: 'Emergency Health Insight',
      template: 'Health insight: {health_insight} This is why understanding your body matters. What insights have changed your health habits? #HealthInsights #Wellness',
      tone: 'personal',
      content_type: 'insight',
      time_preference: 'any',
      performance_score: 0.5,
      usage_count: 0,
      active: true
    },
    {
      id: 'emergency_question',
      name: 'Emergency Health Question',
      template: 'Question for you: {thought_provoking_question} I find this fascinating because {reasoning}. What are your thoughts? #HealthChat #Wellness',
      tone: 'friendly',
      content_type: 'question',
      time_preference: 'any',
      performance_score: 0.5,
      usage_count: 0,
      active: true
    }
  ];

  /**
   * 🎯 GUARANTEED TEMPLATE SELECTION (NEVER RETURNS UNDEFINED)
   */
  static async getTemplate(options: {
    content_type?: string;
    tone?: string;
    current_hour?: number;
  } = {}): Promise<TemplateSelectionResult> {
    console.log('🎯 Starting robust template selection...');
    
    try {
      // Method 1: Try enhanced prompt template rotation
      const rotationResult = await this.tryPromptTemplateRotation(options);
      if (rotationResult.success && rotationResult.template) {
        console.log(`✅ Selected via rotation: ${rotationResult.template.name}`);
        return {
          success: true,
          template: rotationResult.template,
          selection_method: 'prompt_template_rotation'
        };
      }

      // Method 2: Try direct database query
      const databaseResult = await this.tryDatabaseSelection(options);
      if (databaseResult.success && databaseResult.template) {
        console.log(`✅ Selected via database: ${databaseResult.template.name}`);
        return {
          success: true,
          template: databaseResult.template,
          selection_method: 'database_direct'
        };
      }

      // Method 3: Try simple active template selection
      const activeResult = await this.tryActiveTemplateSelection();
      if (activeResult.success && activeResult.template) {
        console.log(`✅ Selected active template: ${activeResult.template.name}`);
        return {
          success: true,
          template: activeResult.template,
          selection_method: 'active_template'
        };
      }

      // Method 4: Emergency fallback templates
      console.log('⚠️ All database methods failed, using emergency templates');
      const emergencyTemplate = this.selectEmergencyTemplate(options);
      
      return {
        success: true,
        template: emergencyTemplate,
        selection_method: 'emergency_fallback'
      };

    } catch (error) {
      console.error('❌ All template selection methods failed:', error);
      
      // Ultimate fallback - guaranteed to work
      const ultimateTemplate = this.EMERGENCY_TEMPLATES[0];
      
      return {
        success: true,
        template: ultimateTemplate,
        selection_method: 'ultimate_fallback',
        error: `Template selection failed: ${error.message}`
      };
    }
  }

  /**
   * 🔄 TRY PROMPT TEMPLATE ROTATION
   */
  private static async tryPromptTemplateRotation(options: any): Promise<{ success: boolean; template?: Template }> {
    try {
      const { promptTemplateRotation } = await import('./promptTemplateRotation');
      
      const result = await promptTemplateRotation.getOptimalTemplate({
        currentHour: options.current_hour || new Date().getHours(),
        contentType: options.content_type,
        tone: options.tone
      });

      if (result.success && result.template && result.template.template && result.template.template.trim()) {
        return {
          success: true,
          template: this.normalizeTemplate(result.template)
        };
      }

      return { success: false };
    } catch (error) {
      console.log('⚠️ Prompt template rotation failed:', error.message);
      return { success: false };
    }
  }

  /**
   * 🗃️ TRY DIRECT DATABASE SELECTION
   */
  private static async tryDatabaseSelection(options: any): Promise<{ success: boolean; template?: Template }> {
    try {
      const currentHour = options.current_hour || new Date().getHours();
      
      // Determine time preference
      let timePreference = 'any';
      if (currentHour >= 6 && currentHour <= 11) {
        timePreference = 'morning';
      } else if (currentHour >= 12 && currentHour <= 17) {
        timePreference = 'afternoon';
      } else if (currentHour >= 18 && currentHour <= 23) {
        timePreference = 'evening';
      }

      // Build query conditions
      let query = supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('*')
        .eq('active', true);

      // Add filters based on options
      if (options.content_type) {
        query = query.eq('content_type', options.content_type);
      }
      
      if (options.tone) {
        query = query.eq('tone', options.tone);
      }

      // Try time-specific first, then any time
      const timeQueries = [
        query.eq('time_preference', timePreference),
        query.in('time_preference', [timePreference, 'any'])
      ];

      for (const timeQuery of timeQueries) {
        const { data, error } = await timeQuery
          .order('performance_score', { ascending: false })
          .order('usage_count', { ascending: true })
          .limit(5);

        if (!error && data && data.length > 0) {
          // Pick a random template from top performers
          const randomTemplate = data[Math.floor(Math.random() * data.length)];
          
          if (randomTemplate && randomTemplate.template && randomTemplate.template.trim()) {
            return {
              success: true,
              template: this.normalizeTemplate(randomTemplate)
            };
          }
        }
      }

      return { success: false };
    } catch (error) {
      console.log('⚠️ Database template selection failed:', error.message);
      return { success: false };
    }
  }

  /**
   * 📋 TRY ACTIVE TEMPLATE SELECTION
   */
  private static async tryActiveTemplateSelection(): Promise<{ success: boolean; template?: Template }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('*')
        .eq('active', true)
        .limit(20);

      if (!error && data && data.length > 0) {
        // Filter out templates with empty template text
        const validTemplates = data.filter(t => t.template && t.template.trim().length > 0);
        
        if (validTemplates.length > 0) {
          const randomTemplate = validTemplates[Math.floor(Math.random() * validTemplates.length)];
          
          return {
            success: true,
            template: this.normalizeTemplate(randomTemplate)
          };
        }
      }

      return { success: false };
    } catch (error) {
      console.log('⚠️ Active template selection failed:', error.message);
      return { success: false };
    }
  }

  /**
   * 🚨 SELECT EMERGENCY TEMPLATE
   */
  private static selectEmergencyTemplate(options: any): Template {
    // Filter by content type if specified
    let candidates = this.EMERGENCY_TEMPLATES;
    
    if (options.content_type) {
      const filtered = candidates.filter(t => t.content_type === options.content_type);
      if (filtered.length > 0) {
        candidates = filtered;
      }
    }
    
    if (options.tone) {
      const filtered = candidates.filter(t => t.tone === options.tone);
      if (filtered.length > 0) {
        candidates = filtered;
      }
    }

    // Return random emergency template
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 🔧 NORMALIZE TEMPLATE FORMAT
   */
  private static normalizeTemplate(rawTemplate: any): Template {
    return {
      id: rawTemplate.id || `template_${Date.now()}`,
      name: rawTemplate.name || 'Health Template',
      template: rawTemplate.template || 'Health tip: {health_fact} Stay healthy! #Health',
      tone: rawTemplate.tone || 'friendly',
      content_type: rawTemplate.content_type || 'tip',
      time_preference: rawTemplate.time_preference || 'any',
      performance_score: rawTemplate.performance_score || 0.5,
      usage_count: rawTemplate.usage_count || 0,
      active: rawTemplate.active !== false
    };
  }

  /**
   * 🔍 VALIDATE TEMPLATE
   */
  static validateTemplate(template: any): boolean {
    if (!template) return false;
    if (!template.template || typeof template.template !== 'string') return false;
    if (template.template.trim().length === 0) return false;
    if (!template.id || !template.name) return false;
    
    return true;
  }

  /**
   * 📊 GET SELECTION ANALYTICS
   */
  static async getSelectionAnalytics(): Promise<{
    total_templates: number;
    active_templates: number;
    by_tone: Record<string, number>;
    by_content_type: Record<string, number>;
    avg_performance: number;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('*');

      if (error || !data) {
        return {
          total_templates: 0,
          active_templates: 0,
          by_tone: {},
          by_content_type: {},
          avg_performance: 0
        };
      }

      const analytics = {
        total_templates: data.length,
        active_templates: data.filter(t => t.active).length,
        by_tone: {} as Record<string, number>,
        by_content_type: {} as Record<string, number>,
        avg_performance: 0
      };

      // Count by tone
      data.forEach(template => {
        const tone = template.tone || 'unknown';
        analytics.by_tone[tone] = (analytics.by_tone[tone] || 0) + 1;
        
        const contentType = template.content_type || 'unknown';
        analytics.by_content_type[contentType] = (analytics.by_content_type[contentType] || 0) + 1;
      });

      // Calculate average performance
      const validScores = data.filter(t => typeof t.performance_score === 'number');
      if (validScores.length > 0) {
        analytics.avg_performance = validScores.reduce((sum, t) => sum + t.performance_score, 0) / validScores.length;
      }

      return analytics;
    } catch (error) {
      console.error('❌ Failed to get selection analytics:', error);
      return {
        total_templates: 0,
        active_templates: 0,
        by_tone: {},
        by_content_type: {},
        avg_performance: 0
      };
    }
  }

  /**
   * 🧪 TEST TEMPLATE SELECTION
   */
  static async testTemplateSelection(): Promise<{
    test_passed: boolean;
    results: Array<{
      method: string;
      success: boolean;
      template_id?: string;
      template_name?: string;
      error?: string;
    }>;
  }> {
    console.log('🧪 Testing template selection system...');
    
    const testResults = [];
    let allTestsPassed = true;

    // Test various scenarios
    const testCases = [
      { content_type: 'tip', tone: 'friendly' },
      { content_type: 'fact', tone: 'scientific' },
      { content_type: 'myth_bust', tone: 'controversial' },
      { current_hour: 9 }, // Morning
      { current_hour: 15 }, // Afternoon
      { current_hour: 20 }, // Evening
      {} // No preferences
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        const result = await this.getTemplate(testCase);
        
        const testResult = {
          method: `test_case_${i + 1}`,
          success: result.success && this.validateTemplate(result.template),
          template_id: result.template?.id,
          template_name: result.template?.name,
          error: result.error
        };

        testResults.push(testResult);
        
        if (!testResult.success) {
          allTestsPassed = false;
        }

        console.log(`Test ${i + 1}: ${testResult.success ? '✅' : '❌'} ${testResult.template_name || 'No template'}`);

      } catch (error) {
        const testResult = {
          method: `test_case_${i + 1}`,
          success: false,
          error: error.message
        };
        
        testResults.push(testResult);
        allTestsPassed = false;
        
        console.log(`Test ${i + 1}: ❌ Error: ${error.message}`);
      }
    }

    console.log(`🎯 Template selection test ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
    
    return {
      test_passed: allTestsPassed,
      results: testResults
    };
  }
}

export const robustTemplateSelection = RobustTemplateSelection; 