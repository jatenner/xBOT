/**
 * 🎯 ROBUST TEMPLATE SELECTION SYSTEM (2024)
 * 
 * Enhanced template selection system with bulletproof error handling.
 * Fixes undefined.match errors and provides intelligent fallbacks.
 * 
 * Key Features:
 * - Multi-layer fallback system
 * - Safe string handling with null checks
 * - Performance-based template selection
 * - Time-of-day optimization
 * - Error recovery and logging
 */

import { minimalSupabaseClient } from './minimalSupabaseClient';

interface RobustPromptTemplate {
  id: string;
  name: string;
  template: string;
  tone: string;
  contentType: string;
  timePreference: string;
  performanceScore: number;
  usageCount: number;
  active: boolean;
  lastUsed?: string;
}

interface TemplateSelectionResult {
  success: boolean;
  template?: RobustPromptTemplate;
  selectionReason: string;
  error?: string;
}

interface TemplateSelectionOptions {
  currentHour?: number;
  tone?: string;
  contentType?: string;
  excludeRecentlyUsed?: boolean;
}

export class RobustTemplateSelection {
  private static readonly MIN_HOURS_BETWEEN_SAME_TEMPLATE = 12;
  private static readonly PERFORMANCE_WEIGHT = 0.4;
  private static readonly TIME_WEIGHT = 0.3;
  private static readonly FRESHNESS_WEIGHT = 0.3;

  // Emergency fallback templates
  private static readonly EMERGENCY_TEMPLATES: RobustPromptTemplate[] = [
    {
      id: 'emergency_1',
      name: 'Health Tip Emergency',
      template: 'Health reminder: {health_fact} Small daily changes lead to big wellness improvements! #HealthTip #Wellness',
      tone: 'friendly',
      contentType: 'tip',
      timePreference: 'any',
      performanceScore: 0.6,
      usageCount: 0,
      active: true
    },
    {
      id: 'emergency_2', 
      name: 'Motivation Emergency',
      template: 'Your wellness journey matters: {motivational_insight} Every step forward counts! #Motivation #Health',
      tone: 'motivational',
      contentType: 'motivation',
      timePreference: 'any',
      performanceScore: 0.6,
      usageCount: 0,
      active: true
    },
    {
      id: 'emergency_3',
      name: 'Science Emergency',
      template: 'Research shows: {science_fact} Understanding your body helps optimize your health! #HealthScience #Wellness',
      tone: 'educational',
      contentType: 'science',
      timePreference: 'any',
      performanceScore: 0.6,
      usageCount: 0,
      active: true
    }
  ];

  /**
   * 🎯 MAIN TEMPLATE SELECTION
   * Robust selection with multiple fallback layers
   */
  static async getTemplate(options: TemplateSelectionOptions = {}): Promise<TemplateSelectionResult> {
    try {
      console.log('🎯 Starting robust template selection...');

      // Step 1: Try database selection
      const databaseResult = await this.selectFromDatabase(options);
      if (databaseResult.success && databaseResult.template) {
        return databaseResult;
      }

      console.log('⚠️ Database selection failed, trying emergency templates...');

      // Step 2: Try emergency templates
      const emergencyResult = this.selectEmergencyTemplate(options);
      if (emergencyResult.success && emergencyResult.template) {
        return emergencyResult;
      }

      console.log('🚨 All template selection failed, using absolute fallback...');

      // Step 3: Absolute fallback
      return this.getAbsoluteFallback();

    } catch (error: any) {
      console.error('❌ Template selection system failed:', error);
      return this.getAbsoluteFallback();
    }
  }

  /**
   * 🗃️ SELECT FROM DATABASE
   * Try to get optimal template from database
   */
  private static async selectFromDatabase(options: TemplateSelectionOptions): Promise<TemplateSelectionResult> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return { success: false, selectionReason: 'Database not available' };
      }

      // Get active templates
      const { data: templates, error } = await minimalSupabaseClient.supabase
        .from('enhanced_prompt_templates')
        .select('*')
        .eq('active', true)
        .order('performance_score', { ascending: false })
        .limit(20);

      if (error || !templates || templates.length === 0) {
        console.log('⚠️ No templates found in database');
        return { success: false, selectionReason: 'No templates available' };
      }

      // Convert and validate templates
      const validTemplates = templates
        .map(t => this.safeMapTemplate(t))
        .filter(t => t !== null) as RobustPromptTemplate[];

      if (validTemplates.length === 0) {
        return { success: false, selectionReason: 'No valid templates found' };
      }

      // Score and select best template
      const scoredTemplates = validTemplates.map(template => ({
        template,
        score: this.calculateTemplateScore(template, options)
      }));

      // Sort by score (highest first)
      scoredTemplates.sort((a, b) => b.score - a.score);

      const selectedTemplate = scoredTemplates[0].template;
      
      console.log(`✅ Selected database template: ${selectedTemplate.name} (score: ${scoredTemplates[0].score.toFixed(2)})`);

      return {
        success: true,
        template: selectedTemplate,
        selectionReason: `Database selection - score: ${scoredTemplates[0].score.toFixed(2)}`
      };

    } catch (error: any) {
      console.error('❌ Database template selection failed:', error);
      return { success: false, selectionReason: 'Database selection error', error: error.message };
    }
  }

  /**
   * 🚨 SELECT EMERGENCY TEMPLATE
   * Use hardcoded emergency templates when database fails
   */
  private static selectEmergencyTemplate(options: TemplateSelectionOptions): TemplateSelectionResult {
    try {
      console.log('🚨 Using emergency template selection...');

      // Filter templates by criteria if provided
      let candidateTemplates = [...this.EMERGENCY_TEMPLATES];

      if (options.tone) {
        const toneFiltered = candidateTemplates.filter(t => 
          this.safeStringIncludes(t.tone, options.tone!) || 
          this.safeStringIncludes(options.tone!, t.tone)
        );
        if (toneFiltered.length > 0) {
          candidateTemplates = toneFiltered;
        }
      }

      if (options.contentType) {
        const typeFiltered = candidateTemplates.filter(t => 
          this.safeStringIncludes(t.contentType, options.contentType!) ||
          this.safeStringIncludes(options.contentType!, t.contentType)
        );
        if (typeFiltered.length > 0) {
          candidateTemplates = typeFiltered;
        }
      }

      // Select random template from candidates
      const selectedTemplate = candidateTemplates[Math.floor(Math.random() * candidateTemplates.length)];

      console.log(`✅ Selected emergency template: ${selectedTemplate.name}`);

      return {
        success: true,
        template: selectedTemplate,
        selectionReason: 'Emergency template selection'
      };

    } catch (error: any) {
      console.error('❌ Emergency template selection failed:', error);
      return { success: false, selectionReason: 'Emergency selection error', error: error.message };
    }
  }

  /**
   * 🛡️ ABSOLUTE FALLBACK
   * Last resort template that should always work
   */
  private static getAbsoluteFallback(): TemplateSelectionResult {
    const fallbackTemplate: RobustPromptTemplate = {
      id: 'absolute_fallback',
      name: 'Absolute Fallback',
      template: 'Remember: Your health is your wealth. Take one small step today toward better wellness! #Health #Wellness #SelfCare',
      tone: 'motivational',
      contentType: 'general',
      timePreference: 'any',
      performanceScore: 0.5,
      usageCount: 0,
      active: true
    };

    console.log('🛡️ Using absolute fallback template');

    return {
      success: true,
      template: fallbackTemplate,
      selectionReason: 'Absolute fallback - system recovery'
    };
  }

  /**
   * 📊 CALCULATE TEMPLATE SCORE
   * Score templates based on multiple factors
   */
  private static calculateTemplateScore(template: RobustPromptTemplate, options: TemplateSelectionOptions): number {
    let score = 0;

    // Performance score component (0-1)
    const performanceComponent = Math.min(1, Math.max(0, template.performanceScore)) * this.PERFORMANCE_WEIGHT;
    score += performanceComponent;

    // Time preference component (0-1)
    const timeComponent = this.calculateTimeScore(template, options.currentHour || new Date().getHours()) * this.TIME_WEIGHT;
    score += timeComponent;

    // Freshness component (0-1) - prefer less used templates
    const maxUsage = 100; // Assume max usage for normalization
    const freshnessComponent = Math.max(0, 1 - (template.usageCount / maxUsage)) * this.FRESHNESS_WEIGHT;
    score += freshnessComponent;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * 🕐 CALCULATE TIME SCORE
   * Score based on time preference match
   */
  private static calculateTimeScore(template: RobustPromptTemplate, currentHour: number): number {
    const timeOfDay = this.getTimeOfDay(currentHour);
    
    if (!template.timePreference || template.timePreference === 'any') {
      return 0.7; // Neutral score for any-time templates
    }

    if (this.safeStringIncludes(template.timePreference, timeOfDay)) {
      return 1.0; // Perfect match
    }

    // Partial matches
    if (timeOfDay === 'morning' && this.safeStringIncludes(template.timePreference, 'day')) {
      return 0.8;
    }
    if (timeOfDay === 'afternoon' && this.safeStringIncludes(template.timePreference, 'day')) {
      return 0.8;
    }

    return 0.3; // Low score for mismatch
  }

  /**
   * 🕐 GET TIME OF DAY
   * Safe time categorization
   */
  private static getTimeOfDay(hour: number): string {
    const safeHour = Math.max(0, Math.min(23, hour || 12)); // Default to noon if invalid

    if (safeHour >= 6 && safeHour < 12) return 'morning';
    if (safeHour >= 12 && safeHour < 18) return 'afternoon';
    if (safeHour >= 18 && safeHour < 24) return 'evening';
    return 'late_night';
  }

  /**
   * 🛡️ SAFE TEMPLATE MAPPING
   * Safely map database template with extensive validation
   */
  private static safeMapTemplate(dbTemplate: any): RobustPromptTemplate | null {
    try {
      // Null/undefined check
      if (!dbTemplate || typeof dbTemplate !== 'object') {
        return null;
      }

      // Required field validation
      const id = this.safeString(dbTemplate.id);
      const template = this.safeString(dbTemplate.template);
      
      if (!id || !template || template.length < 5) {
        console.log('⚠️ Invalid template: missing required fields');
        return null;
      }

      // Safe field extraction with defaults
      const mappedTemplate: RobustPromptTemplate = {
        id,
        name: this.safeString(dbTemplate.name) || 'Unnamed Template',
        template: template.trim(),
        tone: this.safeString(dbTemplate.tone) || 'neutral',
        contentType: this.safeString(dbTemplate.content_type) || 'general',
        timePreference: this.safeString(dbTemplate.time_preference) || 'any',
        performanceScore: this.safeNumber(dbTemplate.performance_score, 0),
        usageCount: this.safeNumber(dbTemplate.usage_count, 0),
        active: dbTemplate.active !== false, // Default to true unless explicitly false
        lastUsed: this.safeString(dbTemplate.last_used)
      };

      return mappedTemplate;

    } catch (error: any) {
      console.error('❌ Template mapping failed:', error);
      return null;
    }
  }

  /**
   * 🔒 SAFE STRING EXTRACTION
   * Safely extract string with null/undefined protection
   */
  private static safeString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value.trim();
    }
    
    try {
      return String(value).trim();
    } catch {
      return '';
    }
  }

  /**
   * 🔢 SAFE NUMBER EXTRACTION
   * Safely extract number with validation
   */
  private static safeNumber(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, value); // Ensure non-negative
    }
    
    try {
      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
    } catch {
      return defaultValue;
    }
  }

  /**
   * 🔍 SAFE STRING INCLUDES
   * Safe string inclusion check with null protection
   */
  private static safeStringIncludes(haystack: any, needle: any): boolean {
    try {
      const safeHaystack = this.safeString(haystack).toLowerCase();
      const safeNeedle = this.safeString(needle).toLowerCase();
      
      if (!safeHaystack || !safeNeedle) {
        return false;
      }
      
      return safeHaystack.includes(safeNeedle);
    } catch {
      return false;
    }
  }

  /**
   * 🔧 EXTRACT PLACEHOLDERS SAFELY
   * Safe placeholder extraction with protection against undefined.match
   */
  static extractPlaceholders(template: string): string[] {
    try {
      const safeTemplate = this.safeString(template);
      
      if (!safeTemplate || safeTemplate.length === 0) {
        return [];
      }

      // Safe regex matching with null checks
      const matches = safeTemplate.match(/\{([^}]+)\}/g);
      
      if (!matches || !Array.isArray(matches)) {
        return [];
      }

      return matches
        .map(match => {
          try {
            return match.replace(/[{}]/g, '').trim();
          } catch {
            return '';
          }
        })
        .filter(placeholder => placeholder.length > 0);

    } catch (error: any) {
      console.error('❌ Placeholder extraction failed:', error);
      return [];
    }
  }

  /**
   * 📊 RECORD TEMPLATE USAGE
   * Record template usage for performance tracking
   */
  static async recordTemplateUsage(
    templateId: string,
    tweetId: string,
    performanceScore?: number
  ): Promise<void> {
    try {
      if (!minimalSupabaseClient.supabase) {
        console.log('⚠️ Cannot record usage - database not available');
        return;
      }

      // Record in usage history
      await minimalSupabaseClient.supabase
        .from('prompt_rotation_history')
        .insert({
          template_id: templateId,
          tweet_id: tweetId,
          performance_score: performanceScore || 0,
          time_used: new Date().toISOString()
        });

      console.log(`📝 Recorded template usage: ${templateId} for tweet ${tweetId}`);

    } catch (error: any) {
      console.error('❌ Failed to record template usage:', error);
    }
  }

  /**
   * 🧪 TEST TEMPLATE SYSTEM
   * Comprehensive test of the template selection system
   */
  static async testTemplateSystem(): Promise<{
    success: boolean;
    tests: {
      name: string;
      passed: boolean;
      details: string;
    }[];
  }> {
    console.log('🧪 Testing robust template selection system...');
    
    const tests = [
      {
        name: 'Safe String Handling',
        passed: false,
        details: ''
      },
      {
        name: 'Placeholder Extraction',
        passed: false,
        details: ''
      },
      {
        name: 'Template Selection',
        passed: false,
        details: ''
      },
      {
        name: 'Fallback System',
        passed: false,
        details: ''
      }
    ];

    try {
      // Test 1: Safe string handling
      const nullString = this.safeString(null);
      const undefinedString = this.safeString(undefined);
      const validString = this.safeString('  test  ');
      
      tests[0].passed = nullString === '' && undefinedString === '' && validString === 'test';
      tests[0].details = `null: "${nullString}", undefined: "${undefinedString}", valid: "${validString}"`;

      // Test 2: Placeholder extraction
      const placeholders1 = this.extractPlaceholders('{health_fact} and {tip}');
      const placeholders2 = this.extractPlaceholders(null as any);
      const placeholders3 = this.extractPlaceholders('No placeholders here');
      
      tests[1].passed = placeholders1.length === 2 && 
                      placeholders1.includes('health_fact') && 
                      placeholders1.includes('tip') &&
                      placeholders2.length === 0 &&
                      placeholders3.length === 0;
      tests[1].details = `Found: ${placeholders1.join(', ')} | Null result: ${placeholders2.length} | No match: ${placeholders3.length}`;

      // Test 3: Template selection
      const selectionResult = await this.getTemplate({ currentHour: 10, tone: 'friendly' });
      tests[2].passed = selectionResult.success && selectionResult.template !== undefined;
      tests[2].details = `Success: ${selectionResult.success}, Template: ${selectionResult.template?.name || 'none'}, Reason: ${selectionResult.selectionReason}`;

      // Test 4: Fallback system
      const fallbackResult = this.getAbsoluteFallback();
      tests[3].passed = fallbackResult.success && 
                       fallbackResult.template !== undefined && 
                       fallbackResult.template.template.length > 0;
      tests[3].details = `Fallback template: ${fallbackResult.template?.name || 'none'}`;

      const allTestsPassed = tests.every(test => test.passed);
      
      console.log(`🎯 Template system test ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
      tests.forEach(test => {
        console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}: ${test.details}`);
      });

      return {
        success: allTestsPassed,
        tests
      };

    } catch (error: any) {
      console.error('❌ Template system test failed:', error);
      return {
        success: false,
        tests: tests.map(test => ({ ...test, details: `Test failed: ${error.message}` }))
      };
    }
  }
} 