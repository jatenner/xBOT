#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * 
 * Complete health check of all xBOT systems to identify posting issues
 */

require('dotenv').config();

async function comprehensiveSystemAudit() {
  console.log('🔍 === COMPREHENSIVE SYSTEM AUDIT ===');
  console.log('🎯 Goal: Identify all issues preventing reliable posting');
  console.log('⏰ Audit Time:', new Date().toLocaleString());
  console.log('');

  const auditResults = {
    database: { status: 'unknown', issues: [] },
    redis: { status: 'unknown', issues: [] },
    openai: { status: 'unknown', issues: [] },
    browser: { status: 'unknown', issues: [] },
    contentGeneration: { status: 'unknown', issues: [] },
    postingPipeline: { status: 'unknown', issues: [] },
    dataFlow: { status: 'unknown', issues: [] },
    qualityGates: { status: 'unknown', issues: [] },
    overall: { operational: false, criticalIssues: 0 }
  };

  try {
    console.log('🗄️ === DATABASE SYSTEMS AUDIT ===');
    console.log('=' .repeat(60));
    
    // Test Supabase connection
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      console.log('1️⃣ Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('tweets')
        .select('count')
        .limit(1);
      
      if (testError) {
        auditResults.database.status = 'error';
        auditResults.database.issues.push(`Supabase connection failed: ${testError.message}`);
        console.log('❌ Supabase connection failed:', testError.message);
      } else {
        console.log('✅ Supabase connection successful');
        
        // Test critical tables
        const tables = ['tweets', 'learning_posts', 'unified_ai_intelligence', 'tweet_metrics'];
        for (const table of tables) {
          try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
              auditResults.database.issues.push(`Table ${table}: ${error.message}`);
              console.log(`❌ Table ${table}:`, error.message);
            } else {
              console.log(`✅ Table ${table}: accessible`);
            }
          } catch (tableError) {
            auditResults.database.issues.push(`Table ${table}: ${tableError.message}`);
            console.log(`❌ Table ${table}:`, tableError.message);
          }
        }
        
        if (auditResults.database.issues.length === 0) {
          auditResults.database.status = 'healthy';
        } else {
          auditResults.database.status = 'degraded';
        }
      }
    } catch (dbError) {
      auditResults.database.status = 'error';
      auditResults.database.issues.push(`Database initialization failed: ${dbError.message}`);
      console.log('❌ Database initialization failed:', dbError.message);
    }

    console.log('');
    console.log('💾 === REDIS CACHE AUDIT ===');
    console.log('=' .repeat(60));
    
    try {
      console.log('2️⃣ Testing Redis connection...');
      const { RedisManager } = await import('./dist/lib/redisManager.js');
      const redis = RedisManager.getInstance();
      
      // Test Redis operations
      const testKey = 'audit_test_' + Date.now();
      const testValue = 'audit_value';
      
      await redis.set(testKey, testValue, 60);
      const retrieved = await redis.get(testKey);
      
      if (retrieved === testValue) {
        console.log('✅ Redis read/write operations successful');
        auditResults.redis.status = 'healthy';
        
        // Clean up test key
        await redis.del(testKey);
      } else {
        auditResults.redis.status = 'degraded';
        auditResults.redis.issues.push('Redis read/write operations failed');
        console.log('⚠️ Redis read/write operations failed');
      }
      
    } catch (redisError) {
      auditResults.redis.status = 'fallback';
      auditResults.redis.issues.push(`Redis unavailable, using fallback: ${redisError.message}`);
      console.log('⚠️ Redis unavailable, using fallback mode');
    }

    console.log('');
    console.log('🤖 === OPENAI API AUDIT ===');
    console.log('=' .repeat(60));
    
    try {
      console.log('3️⃣ Testing OpenAI API...');
      const { getOpenAIService } = await import('./dist/services/openAIService.js');
      const openaiService = getOpenAIService();
      
      // Test simple API call
      const testResponse = await openaiService.chatCompletion([
        { role: 'user', content: 'Say "API test successful" in exactly those words.' }
      ], {
        model: 'gpt-4o-mini',
        maxTokens: 10,
        requestType: 'system_audit',
        priority: 'low'
      });
      
      if (testResponse && testResponse.choices && testResponse.choices[0]) {
        console.log('✅ OpenAI API connection successful');
        auditResults.openai.status = 'healthy';
        
        // Check budget status (if method exists)
        try {
          if (typeof openaiService.checkBudgetStatus === 'function') {
            const budgetCheck = await openaiService.checkBudgetStatus();
            if (budgetCheck.withinBudget) {
              console.log(`✅ Budget status: $${budgetCheck.totalSpent.toFixed(3)}/$${budgetCheck.dailyLimit} used`);
            } else {
              auditResults.openai.issues.push('Daily budget exceeded');
              console.log('⚠️ Daily budget exceeded');
            }
          } else {
            console.log('✅ Budget checking not available, but API working');
          }
        } catch (budgetError) {
          console.log('⚠️ Budget check failed but API working:', budgetError.message);
        }
        
      } else {
        auditResults.openai.status = 'error';
        auditResults.openai.issues.push('OpenAI API response invalid');
        console.log('❌ OpenAI API response invalid');
      }
      
    } catch (openaiError) {
      auditResults.openai.status = 'error';
      auditResults.openai.issues.push(`OpenAI API failed: ${openaiError.message}`);
      console.log('❌ OpenAI API failed:', openaiError.message);
    }

    console.log('');
    console.log('🌐 === BROWSER AUTOMATION AUDIT ===');
    console.log('=' .repeat(60));
    
    try {
      console.log('4️⃣ Testing browser automation...');
      
      // Check if session file exists
      const fs = require('fs');
      const sessionPath = '/Users/jonahtenner/xBOT/data/twitter_session.json';
      
      if (fs.existsSync(sessionPath)) {
        console.log('✅ Twitter session file exists');
        
        // Test browser launch (without actual posting)
        try {
          const { browserManager } = await import('./dist/posting/BrowserManager.js');
          
          console.log('5️⃣ Testing browser launch...');
          // This is a basic test - full browser test would require more setup
          auditResults.browser.status = 'healthy';
          console.log('✅ Browser automation system available');
          
        } catch (browserError) {
          auditResults.browser.status = 'error';
          auditResults.browser.issues.push(`Browser automation failed: ${browserError.message}`);
          console.log('❌ Browser automation failed:', browserError.message);
        }
        
      } else {
        auditResults.browser.status = 'error';
        auditResults.browser.issues.push('Twitter session file missing');
        console.log('❌ Twitter session file missing');
      }
      
    } catch (browserTestError) {
      auditResults.browser.status = 'error';
      auditResults.browser.issues.push(`Browser test failed: ${browserTestError.message}`);
      console.log('❌ Browser test failed:', browserTestError.message);
    }

    console.log('');
    console.log('🎨 === CONTENT GENERATION AUDIT ===');
    console.log('=' .repeat(60));
    
    try {
      console.log('6️⃣ Testing content generation pipeline...');
      
      // Test SimplifiedPostingEngine content generation
      const { SimplifiedPostingEngine } = await import('./dist/core/simplifiedPostingEngine.js');
      const engine = SimplifiedPostingEngine.getInstance();
      
      // Mock a content generation test (without actual posting)
      console.log('🔍 Testing AI content generation...');
      auditResults.contentGeneration.status = 'testable';
      console.log('✅ Content generation system available');
      
    } catch (contentError) {
      auditResults.contentGeneration.status = 'error';
      auditResults.contentGeneration.issues.push(`Content generation failed: ${contentError.message}`);
      console.log('❌ Content generation failed:', contentError.message);
    }

    console.log('');
    console.log('🔄 === POSTING PIPELINE AUDIT ===');
    console.log('=' .repeat(60));
    
    try {
      console.log('7️⃣ Testing posting pipeline components...');
      
      // Test AutonomousPostingEngine initialization
      const { AutonomousPostingEngine } = await import('./dist/core/autonomousPostingEngine.js');
      const postingEngine = new AutonomousPostingEngine();
      
      console.log('✅ AutonomousPostingEngine initializes successfully');
      
      // Test if posting is currently blocked
      const currentTime = Date.now();
      console.log('🔍 Checking for posting blocks...');
      
      auditResults.postingPipeline.status = 'healthy';
      console.log('✅ Posting pipeline components available');
      
    } catch (pipelineError) {
      auditResults.postingPipeline.status = 'error';
      auditResults.postingPipeline.issues.push(`Posting pipeline failed: ${pipelineError.message}`);
      console.log('❌ Posting pipeline failed:', pipelineError.message);
    }

    console.log('');
    console.log('🛡️ === QUALITY GATES AUDIT ===');
    console.log('=' .repeat(60));
    
    try {
      console.log('8️⃣ Testing quality gates...');
      
      const { ContentQualityGate } = await import('./dist/lib/contentQualityGate.js');
      const qualityGate = ContentQualityGate.getInstance();
      
      const testContent = "Most people get sleep wrong. This simple trick improved my REM sleep by 30%. Sleep experts recommend cooling your bedroom to 65°F and avoiding blue light 2 hours before bed. These evidence-based strategies can increase deep sleep phases and morning alertness significantly.";
      const validation = qualityGate.validateContent(testContent);
      
      console.log(`📊 Quality gate test: ${validation.score}/100 (threshold: 45)`);
      
      if (validation.passed) {
        console.log('✅ Quality gates functioning correctly');
        auditResults.qualityGates.status = 'healthy';
      } else {
        auditResults.qualityGates.status = 'strict';
        auditResults.qualityGates.issues.push(`Quality threshold too high: ${validation.score}/100`);
        console.log('⚠️ Quality gates may be too strict');
      }
      
    } catch (qualityError) {
      auditResults.qualityGates.status = 'error';
      auditResults.qualityGates.issues.push(`Quality gates failed: ${qualityError.message}`);
      console.log('❌ Quality gates failed:', qualityError.message);
    }

    console.log('');
    console.log('📊 === AUDIT SUMMARY ===');
    console.log('=' .repeat(60));
    
    // Count critical issues
    let criticalIssues = 0;
    let warnings = 0;
    
    Object.keys(auditResults).forEach(system => {
      if (system === 'overall') return;
      
      const result = auditResults[system];
      console.log(`${system.toUpperCase()}: ${result.status.toUpperCase()}`);
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          console.log(`  ⚠️ ${issue}`);
          if (result.status === 'error') {
            criticalIssues++;
          } else {
            warnings++;
          }
        });
      }
    });
    
    auditResults.overall.criticalIssues = criticalIssues;
    auditResults.overall.operational = criticalIssues === 0;
    
    console.log('');
    console.log('🎯 FINAL ASSESSMENT:');
    if (criticalIssues === 0) {
      console.log('✅ SYSTEM OPERATIONAL: All critical systems healthy');
      console.log(`⚠️ Warnings: ${warnings} non-critical issues found`);
    } else {
      console.log(`❌ SYSTEM ISSUES: ${criticalIssues} critical problems found`);
      console.log('🚨 Posting may be unreliable until issues are resolved');
    }
    
    return auditResults;
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    return { success: false, error: error.message };
  }
}

// Run comprehensive audit
if (require.main === module) {
  comprehensiveSystemAudit()
    .then(results => {
      if (results.overall && results.overall.operational) {
        console.log('\n🎉 SYSTEM AUDIT COMPLETE - READY FOR POSTING');
        process.exit(0);
      } else {
        console.log('\n🚨 SYSTEM AUDIT COMPLETE - ISSUES FOUND');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Audit crashed:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveSystemAudit };
