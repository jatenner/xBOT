/**
 * 🩺 COMPREHENSIVE HEALTH CHECK SYSTEM
 * Ensures all systems are properly configured and working together
 */

import { EmergencyPostingSystem } from './emergencyPostingSystem';

interface HealthCheckResult {
  component: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  details: string;
  recommendations?: string[];
}

export class ComprehensiveHealthCheck {
  
  /**
   * 🏥 RUN COMPLETE SYSTEM HEALTH CHECK
   */
  static async runFullHealthCheck(): Promise<{
    overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    results: HealthCheckResult[];
    summary: string;
  }> {
    console.log('🩺 === COMPREHENSIVE SYSTEM HEALTH CHECK ===');
    
    const results: HealthCheckResult[] = [];
    
    // 1. Environment Variables Check
    results.push(await this.checkEnvironmentVariables());
    
    // 2. Database Connection Check
    results.push(await this.checkDatabaseConnection());
    
    // 3. Emergency Systems Check
    results.push(await this.checkEmergencySystems());
    
    // 4. Browser System Check
    results.push(await this.checkBrowserSystem());
    
    // 5. AI Systems Check
    results.push(await this.checkAISystems());
    
    // 6. Required Files Check
    results.push(await this.checkRequiredFiles());
    
    // Determine overall health
    const criticalCount = results.filter(r => r.status === 'CRITICAL').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;
    
    let overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    let summary: string;
    
    if (criticalCount > 0) {
      overall = 'CRITICAL';
      summary = `${criticalCount} critical issues found. System may not function properly.`;
    } else if (warningCount > 0) {
      overall = 'WARNING';
      summary = `${warningCount} warnings found. System functional but may have reduced capabilities.`;
    } else {
      overall = 'HEALTHY';
      summary = 'All systems are healthy and ready for deployment.';
    }
    
    // Print summary
    console.log(`\n🩺 === HEALTH CHECK SUMMARY ===`);
    console.log(`Overall Status: ${overall}`);
    console.log(`Summary: ${summary}`);
    console.log('\nComponent Status:');
    
    results.forEach(result => {
      const emoji = result.status === 'HEALTHY' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
      console.log(`${emoji} ${result.component}: ${result.status}`);
      console.log(`   ${result.details}`);
      if (result.recommendations?.length) {
        result.recommendations.forEach(rec => console.log(`   💡 ${rec}`));
      }
    });
    
    return { overall, results, summary };
  }
  
  /**
   * 🔧 CHECK ENVIRONMENT VARIABLES
   */
  private static async checkEnvironmentVariables(): Promise<HealthCheckResult> {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY'
    ];
    
    const optional = [
      'TWITTER_USERNAME',
      'TWITTER_PASSWORD',
      'TWITTER_EMAIL'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    const missingOptional = optional.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      return {
        component: 'Environment Variables',
        status: 'CRITICAL',
        details: `Missing required variables: ${missing.join(', ')}`,
        recommendations: [
          'Set required environment variables in Railway dashboard',
          'Check .env file for local development',
          'Verify variable names match exactly'
        ]
      };
    }
    
    if (missingOptional.length > 0) {
      return {
        component: 'Environment Variables',
        status: 'WARNING',
        details: `Missing optional variables: ${missingOptional.join(', ')}. Some features may be limited.`,
        recommendations: [
          'Set Twitter credentials for full automation',
          'Add missing variables when ready for full deployment'
        ]
      };
    }
    
    return {
      component: 'Environment Variables',
      status: 'HEALTHY',
      details: 'All required environment variables are present'
    };
  }
  
  /**
   * 🗄️ CHECK DATABASE CONNECTION
   */
  private static async checkDatabaseConnection(): Promise<HealthCheckResult> {
    try {
      // Use our new database health monitor for robust health checking
      const { databaseHealthMonitor } = await import('./databaseHealthMonitor');
      
      // Perform a quick health check
      await databaseHealthMonitor.runHealthCheck();
      const health = databaseHealthMonitor.getStatus();
      
      // Check Supabase status
      if (!health.supabase.available) {
        if (health.supabase.error?.includes('522') || health.supabase.error?.includes('timeout')) {
          return {
            component: 'Database Connection',
            status: 'WARNING',
            details: 'Supabase experiencing timeout issues (522). Will retry with fallbacks.',
            recommendations: [
              'Database health monitor will retry automatically',
              'Emergency systems will activate if needed',
              'Monitor will track recovery status'
            ]
          };
        }
        
        return {
          component: 'Database Connection', 
          status: 'WARNING',
          details: `Supabase connection issue: ${health.supabase.error || 'Unknown error'}`,
          recommendations: [
            'Database health monitor will retry automatically',
            'Check Supabase status if issue persists',
            'Emergency mode available as fallback'
          ]
        };
      }
      
      // Check Redis status (non-critical)
      const redisStatus = health.redis.available ? 'connected' : 'not available';
      const databaseMode = health.mode;
      
      return {
        component: 'Database Connection',
        status: 'HEALTHY',
        details: `Database system operational. Mode: ${databaseMode}. Redis: ${redisStatus}. Supabase latency: ${health.supabase.latency}ms`
      };
      
    } catch (error: any) {
      return {
        component: 'Database Connection',
        status: 'WARNING',
        details: `Database health check initialization error: ${error.message}. Will retry automatically.`,
        recommendations: [
          'Database health monitor will initialize in background',
          'System will retry connection automatically',
          'Emergency mode available if needed'
        ]
      };
    }
  }
  
  /**
   * 🚨 CHECK EMERGENCY SYSTEMS
   */
  private static async checkEmergencySystems(): Promise<HealthCheckResult> {
    try {
      const healthCheck = await EmergencyPostingSystem.healthCheck();
      
      if (!healthCheck.ready) {
        return {
          component: 'Emergency Systems',
          status: 'WARNING',
          details: `Emergency systems not fully ready: ${healthCheck.issues.join(', ')}`,
          recommendations: [
            'Install Chromium for Alpine Linux',
            'Verify emergency content is available',
            'Test emergency posting manually'
          ]
        };
      }
      
      return {
        component: 'Emergency Systems',
        status: 'HEALTHY',
        details: 'Emergency posting system ready for activation'
      };
      
    } catch (error: any) {
      return {
        component: 'Emergency Systems',
        status: 'WARNING',
        details: `Emergency system check failed: ${error.message}`,
        recommendations: [
          'Review emergency system configuration',
          'Check Alpine Chromium installation',
          'Verify emergency content availability'
        ]
      };
    }
  }
  
  /**
   * 🌐 CHECK BROWSER SYSTEM
   */
  private static async checkBrowserSystem(): Promise<HealthCheckResult> {
    try {
      const { chromium } = await import('playwright');
      
      // Check if Alpine Chromium is available
      const isAlpine = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      
      if (isAlpine) {
        // Test Alpine Chromium launch
        const browser = await chromium.launch({
          headless: true,
          executablePath: '/usr/bin/chromium-browser',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        await browser.close();
        
        return {
          component: 'Browser System',
          status: 'HEALTHY',
          details: 'Alpine Chromium browser system working correctly'
        };
      } else {
        // Test regular Playwright
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        
        return {
          component: 'Browser System',
          status: 'HEALTHY',
          details: 'Playwright browser system working correctly'
        };
      }
      
    } catch (error: any) {
      return {
        component: 'Browser System',
        status: 'CRITICAL',
        details: `Browser launch failed: ${error.message}`,
        recommendations: [
          'Install Chromium system dependencies',
          'Run: apk add chromium (for Alpine)',
          'Verify Playwright installation',
          'Check browser executable path'
        ]
      };
    }
  }
  
  /**
   * 🤖 CHECK AI SYSTEMS
   */
  private static async checkAISystems(): Promise<HealthCheckResult> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return {
          component: 'AI Systems',
          status: 'CRITICAL',
          details: 'OpenAI API key not configured',
          recommendations: [
            'Set OPENAI_API_KEY environment variable',
            'Verify API key is valid and has credits',
            'Check OpenAI account status'
          ]
        };
      }
      
      // Test budget system
      const { EmergencyBudgetLockdown } = await import('./emergencyBudgetLockdown');
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      
      if (budgetStatus.lockdownActive) {
        return {
          component: 'AI Systems',
          status: 'WARNING',
          details: `Budget lockdown active: ${budgetStatus.lockdownReason}`,
          recommendations: [
            'Check daily budget limits',
            'Wait for budget reset',
            'Review spending patterns'
          ]
        };
      }
      
      return {
        component: 'AI Systems',
        status: 'HEALTHY',
        details: `AI systems ready. Budget: $${(budgetStatus.dailyLimit - budgetStatus.totalSpent).toFixed(2)} remaining`
      };
      
    } catch (error: any) {
      return {
        component: 'AI Systems',
        status: 'WARNING',
        details: `AI system check failed: ${error.message}`,
        recommendations: [
          'Verify OpenAI configuration',
          'Check budget system setup',
          'Review AI service initialization'
        ]
      };
    }
  }
  
  /**
   * 📁 CHECK REQUIRED FILES
   */
  private static async checkRequiredFiles(): Promise<HealthCheckResult> {
    const fs = await import('fs');
    const path = await import('path');
    
    const criticalFiles = [
      'dist/main.js',
      'package.json'
    ];
    
    const optionalFiles = [
      'twitter-auth.json',
      'data/twitter_session.json',
      '/app/data/twitter_session.json'
    ];
    
    const missingCritical = criticalFiles.filter(file => !fs.existsSync(file));
    const missingOptional = optionalFiles.filter(file => !fs.existsSync(file));
    
    if (missingCritical.length > 0) {
      return {
        component: 'Required Files',
        status: 'CRITICAL',
        details: `Missing critical files: ${missingCritical.join(', ')}`,
        recommendations: [
          'Run: npm run build',
          'Verify TypeScript compilation succeeded',
          'Check file permissions'
        ]
      };
    }
    
    if (missingOptional.length === optionalFiles.length) {
      return {
        component: 'Required Files',
        status: 'WARNING',
        details: 'No Twitter session files found. Manual login may be required.',
        recommendations: [
          'Upload twitter-auth.json for persistent sessions',
          'Run initial login to create session file',
          'Set up Twitter credentials for automation'
        ]
      };
    }
    
    return {
      component: 'Required Files',
      status: 'HEALTHY',
      details: 'All critical files present and accessible'
    };
  }
}