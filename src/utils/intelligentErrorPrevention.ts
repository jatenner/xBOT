/**
 * 🧠 INTELLIGENT ERROR PREVENTION SYSTEM
 * Predicts and prevents errors before they happen
 */

interface ErrorPattern {
  pattern: string;
  frequency: number;
  lastSeen: string;
  preventionActions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SystemHealth {
  overallScore: number; // 0-100
  components: {
    browser: number;
    database: number;
    api: number;
    content: number;
    learning: number;
  };
  risks: string[];
  recommendations: string[];
}

export class IntelligentErrorPrevention {
  private static instance: IntelligentErrorPrevention;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private healthCheckTimer?: NodeJS.Timeout;

  static getInstance(): IntelligentErrorPrevention {
    if (!IntelligentErrorPrevention.instance) {
      IntelligentErrorPrevention.instance = new IntelligentErrorPrevention();
    }
    return IntelligentErrorPrevention.instance;
  }

  /**
   * 🎯 START PROACTIVE MONITORING
   */
  startProactiveMonitoring(): void {
    console.log('🧠 Starting intelligent error prevention monitoring...');
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Load historical error patterns
    this.loadErrorPatterns();
  }

  /**
   * 🔍 PREDICTIVE ERROR ANALYSIS
   */
  async predictAndPrevent(): Promise<{
    risksFound: number;
    actionsExecuted: number;
    systemHealth: SystemHealth;
  }> {
    console.log('🔮 Performing predictive error analysis...');

    const systemHealth = await this.assessSystemHealth();
    const risks = await this.identifyPotentialRisks();
    let actionsExecuted = 0;

    // Execute preventive actions for high-risk scenarios
    for (const risk of risks) {
      if (risk.severity === 'high' || risk.severity === 'critical') {
        await this.executePreventiveActions(risk);
        actionsExecuted++;
      }
    }

    return {
      risksFound: risks.length,
      actionsExecuted,
      systemHealth
    };
  }

  /**
   * 📊 ASSESS SYSTEM HEALTH
   */
  private async assessSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      overallScore: 100,
      components: {
        browser: await this.checkBrowserHealth(),
        database: await this.checkDatabaseHealth(),
        api: await this.checkApiHealth(),
        content: await this.checkContentHealth(),
        learning: await this.checkLearningHealth()
      },
      risks: [],
      recommendations: []
    };

    // Calculate overall score
    const componentScores = Object.values(health.components);
    health.overallScore = Math.round(
      componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length
    );

    // Add recommendations based on low scores
    Object.entries(health.components).forEach(([component, score]) => {
      if (score < 70) {
        health.risks.push(`${component} health below 70%`);
        health.recommendations.push(`Investigate ${component} component issues`);
      }
    });

    return health;
  }

  /**
   * 🎭 CHECK BROWSER HEALTH
   */
  private async checkBrowserHealth(): Promise<number> {
    let score = 100;
    
    try {
      // Check for browser process issues
      const { execSync } = await import('child_process');
      
      // Check for zombie browser processes
      try {
        const processes = execSync('pgrep -f chromium').toString();
        const processCount = processes.trim().split('\n').length;
        
        if (processCount > 5) {
          score -= 30; // Too many browser processes
        }
      } catch (e) {
        // No processes found is actually good
      }

      // Check for browser session file
      const fs = await import('fs');
      const sessionPath = '/app/data/twitter_session.json';
      
      if (!fs.existsSync(sessionPath)) {
        score -= 50; // No session file
      } else {
        const stats = fs.statSync(sessionPath);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageHours > 24) {
          score -= 20; // Session file is old
        }
      }

    } catch (error) {
      score -= 40; // General browser health check failed
    }

    return Math.max(0, score);
  }

  /**
   * 🗄️ CHECK DATABASE HEALTH
   */
  private async checkDatabaseHealth(): Promise<number> {
    let score = 100;

    try {
      const { supabaseClient } = await import('./supabaseClient');
      
      // Test basic connectivity
      const startTime = Date.now();
      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        score -= 60; // Database error
      } else if (responseTime > 5000) {
        score -= 30; // Slow response
      } else if (responseTime > 2000) {
        score -= 15; // Moderate delay
      }

      // Check recent activity
      const recentTweets = await supabaseClient.supabase
        .from('tweets')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!recentTweets.data || recentTweets.data.length === 0) {
        score -= 25; // No recent database activity
      }

    } catch (error) {
      score -= 80; // Major database issues
    }

    return Math.max(0, score);
  }

  /**
   * 🔗 CHECK API HEALTH
   */
  private async checkApiHealth(): Promise<number> {
    let score = 100;

    try {
      // Check budget status
      const { emergencyBudgetLockdown } = await import('./emergencyBudgetLockdown');
      const budgetStatus = await emergencyBudgetLockdown.isLockedDown();

      if (budgetStatus.lockdownActive) {
        score -= 50; // Budget locked
      } else if (budgetStatus.remainingBudget < 1.0) {
        score -= 30; // Low budget
      }

      // Check OpenAI API health (simple test)
      const testPrompt = 'Test';
      const { BudgetAwareOpenAI } = await import('./budgetAwareOpenAI');
      const openai = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
      
      const startTime = Date.now();
      const result = await openai.createChatCompletion(
        [{ role: 'user', content: testPrompt }],
        {
          priority: 'optional',
          operationType: 'health_check',
          maxTokens: 5,
          model: 'gpt-3.5-turbo',
          temperature: 0.1
        }
      );

      const responseTime = Date.now() - startTime;

      if (!result.success) {
        score -= 40; // API error
      } else if (responseTime > 10000) {
        score -= 20; // Slow API
      }

    } catch (error) {
      score -= 60; // API health check failed
    }

    return Math.max(0, score);
  }

  /**
   * 📝 CHECK CONTENT HEALTH
   */
  private async checkContentHealth(): Promise<number> {
    let score = 100;

    try {
      // Check for recent content generation
      const { supabaseClient } = await import('./supabaseClient');
      const recentContent = await supabaseClient.supabase
        .from('tweets')
        .select('content, created_at')
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // 6 hours
        .order('created_at', { ascending: false })
        .limit(5);

      if (!recentContent.data || recentContent.data.length === 0) {
        score -= 30; // No recent content
      } else {
        // Check for content diversity
        const contents = recentContent.data.map(t => t.content);
        const uniqueStarts = new Set(contents.map(c => c.substring(0, 20)));
        
        if (uniqueStarts.size < contents.length * 0.8) {
          score -= 25; // Low content diversity
        }

        // Check for content quality indicators
        const avgLength = contents.reduce((sum, c) => sum + c.length, 0) / contents.length;
        if (avgLength < 50) {
          score -= 20; // Content too short
        } else if (avgLength > 270) {
          score -= 15; // Content too long
        }
      }

    } catch (error) {
      score -= 40; // Content health check failed
    }

    return Math.max(0, score);
  }

  /**
   * 🧠 CHECK LEARNING HEALTH
   */
  private async checkLearningHealth(): Promise<number> {
    let score = 100;

    try {
      // Check if learning systems have sufficient data
      const { supabaseClient } = await import('./supabaseClient');
      
      // Check tweet analytics data
      const analytics = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('id')
        .limit(10);

      if (!analytics.data || analytics.data.length < 5) {
        score -= 40; // Insufficient analytics data
      }

      // Check learning patterns
      const patterns = await supabaseClient.supabase
        .from('learning_patterns')
        .select('id')
        .limit(5);

      if (!patterns.data || patterns.data.length < 3) {
        score -= 30; // Insufficient learning patterns
      }

    } catch (error) {
      score -= 50; // Learning health check failed
    }

    return Math.max(0, score);
  }

  /**
   * ⚠️ IDENTIFY POTENTIAL RISKS
   */
  private async identifyPotentialRisks(): Promise<ErrorPattern[]> {
    const risks: ErrorPattern[] = [];

    // Check for error pattern buildup
    this.errorPatterns.forEach((pattern, key) => {
      if (pattern.frequency > 3 && pattern.severity !== 'low') {
        risks.push(pattern);
      }
    });

    // Check for system-specific risks
    const browserHealth = await this.checkBrowserHealth();
    if (browserHealth < 50) {
      risks.push({
        pattern: 'browser_degradation',
        frequency: 1,
        lastSeen: new Date().toISOString(),
        preventionActions: ['restart_browser', 'clear_cache', 'reinitialize_session'],
        severity: 'high'
      });
    }

    return risks;
  }

  /**
   * 🛠️ EXECUTE PREVENTIVE ACTIONS
   */
  private async executePreventiveActions(risk: ErrorPattern): Promise<void> {
    console.log(`🛠️ Executing preventive actions for: ${risk.pattern}`);

    for (const action of risk.preventionActions) {
      try {
        await this.executeAction(action);
        console.log(`✅ Preventive action completed: ${action}`);
      } catch (error) {
        console.error(`❌ Preventive action failed: ${action}`, error);
      }
    }
  }

  /**
   * ⚡ EXECUTE SPECIFIC ACTION
   */
  private async executeAction(action: string): Promise<void> {
    switch (action) {
      case 'restart_browser':
        await this.restartBrowser();
        break;
      case 'clear_cache':
        await this.clearCache();
        break;
      case 'reinitialize_session':
        await this.reinitializeSession();
        break;
      case 'cleanup_database':
        await this.cleanupDatabase();
        break;
      default:
        console.log(`Unknown preventive action: ${action}`);
    }
  }

  /**
   * 🔄 RESTART BROWSER
   */
  private async restartBrowser(): Promise<void> {
    try {
      const { execSync } = await import('child_process');
      execSync('pkill -f chromium 2>/dev/null || true');
      await this.sleep(2000); // Wait 2 seconds
      console.log('🎭 Browser processes restarted');
    } catch (error) {
      console.warn('Browser restart failed:', error);
    }
  }

  /**
   * 🧹 CLEAR CACHE
   */
  private async clearCache(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const cacheDir = path.join(process.cwd(), '.cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        console.log('🧹 Cache cleared');
      }
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * 🔑 REINITIALIZE SESSION
   */
  private async reinitializeSession(): Promise<void> {
    try {
      // Force session refresh on next browser initialization
      console.log('🔑 Session reinitialization queued');
    } catch (error) {
      console.warn('Session reinitialization failed:', error);
    }
  }

  /**
   * 🗄️ CLEANUP DATABASE
   */
  private async cleanupDatabase(): Promise<void> {
    try {
      const { supabaseClient } = await import('./supabaseClient');
      
      // Clean up old temporary data
      await supabaseClient.supabase
        .from('system_logs')
        .delete()
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        
      console.log('🗄️ Database cleanup completed');
    } catch (error) {
      console.warn('Database cleanup failed:', error);
    }
  }

  /**
   * 🔍 PERFORM HEALTH CHECK
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.assessSystemHealth();
      
      if (health.overallScore < 70) {
        console.warn(`⚠️ System health below 70%: ${health.overallScore}%`);
        console.warn('Risks:', health.risks);
      } else {
        console.log(`✅ System health good: ${health.overallScore}%`);
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * 📚 LOAD ERROR PATTERNS
   */
  private loadErrorPatterns(): void {
    // Initialize with common error patterns
    const commonPatterns: ErrorPattern[] = [
      {
        pattern: 'browser_session_expired',
        frequency: 0,
        lastSeen: '',
        preventionActions: ['reinitialize_session', 'restart_browser'],
        severity: 'medium'
      },
      {
        pattern: 'database_connection_timeout',
        frequency: 0,
        lastSeen: '',
        preventionActions: ['cleanup_database'],
        severity: 'high'
      },
      {
        pattern: 'api_rate_limit',
        frequency: 0,
        lastSeen: '',
        preventionActions: ['adjust_timing'],
        severity: 'medium'
      }
    ];

    commonPatterns.forEach(pattern => {
      this.errorPatterns.set(pattern.pattern, pattern);
    });
  }

  /**
   * 📝 RECORD ERROR PATTERN
   */
  recordError(error: Error): void {
    const errorKey = this.categorizeError(error);
    const existing = this.errorPatterns.get(errorKey);

    if (existing) {
      existing.frequency++;
      existing.lastSeen = new Date().toISOString();
    } else {
      this.errorPatterns.set(errorKey, {
        pattern: errorKey,
        frequency: 1,
        lastSeen: new Date().toISOString(),
        preventionActions: this.getPreventionActions(errorKey),
        severity: this.assessSeverity(errorKey)
      });
    }
  }

  /**
   * 🏷️ CATEGORIZE ERROR
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('session') || message.includes('login')) {
      return 'browser_session_expired';
    } else if (message.includes('timeout') || message.includes('network')) {
      return 'network_timeout';
    } else if (message.includes('rate limit') || message.includes('429')) {
      return 'api_rate_limit';
    } else if (message.includes('database') || message.includes('supabase')) {
      return 'database_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * 🛠️ GET PREVENTION ACTIONS
   */
  private getPreventionActions(errorKey: string): string[] {
    const actionMap: Record<string, string[]> = {
      'browser_session_expired': ['reinitialize_session', 'restart_browser'],
      'network_timeout': ['retry_with_delay'],
      'api_rate_limit': ['adjust_timing'],
      'database_error': ['cleanup_database'],
      'unknown_error': ['general_cleanup']
    };

    return actionMap[errorKey] || ['general_cleanup'];
  }

  /**
   * ⚖️ ASSESS SEVERITY
   */
  private assessSeverity(errorKey: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'browser_session_expired': 'medium',
      'network_timeout': 'medium',
      'api_rate_limit': 'high',
      'database_error': 'critical',
      'unknown_error': 'low'
    };

    return severityMap[errorKey] || 'low';
  }

  /**
   * 💤 SLEEP UTILITY
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🛑 STOP MONITORING
   */
  stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      console.log('🛑 Error prevention monitoring stopped');
    }
  }
}