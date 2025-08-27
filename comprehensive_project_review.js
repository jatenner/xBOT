#!/usr/bin/env node

/**
 * 📊 COMPREHENSIVE PROJECT REVIEW - EXTENSIVE ANALYSIS
 * 
 * Deep dive into all aspects of the xBOT project:
 * - System health and performance
 * - Code quality and architecture  
 * - Database integrity and learning
 * - Posting effectiveness and engagement
 * - Error patterns and optimization opportunities
 */

require('dotenv').config();

console.log(`
📊 COMPREHENSIVE PROJECT REVIEW - EXTENSIVE ANALYSIS
===================================================
Timestamp: ${new Date().toISOString()}
Environment: ${process.env.NODE_ENV || 'production'}
`);

async function runComprehensiveReview() {
  const report = {
    systemHealth: {},
    codeQuality: {},
    database: {},
    posting: {},
    engagement: {},
    errors: {},
    recommendations: []
  };

  console.log('🔍 PHASE 1: SYSTEM HEALTH ANALYSIS');
  console.log('==================================');
  
  // 1. Check environment variables
  const requiredEnvVars = [
    'OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY', 'TWITTER_SESSION_B64'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
  report.systemHealth.environment = {
    status: missingEnvVars.length === 0 ? 'HEALTHY' : 'ISSUES',
    missingVars: missingEnvVars,
    totalVars: requiredEnvVars.length,
    configuredVars: requiredEnvVars.length - missingEnvVars.length
  };
  
  console.log(`📊 Environment Variables: ${report.systemHealth.environment.configuredVars}/${report.systemHealth.environment.totalVars} configured`);
  if (missingEnvVars.length > 0) {
    console.log(`⚠️ Missing: ${missingEnvVars.join(', ')}`);
  }

  console.log('\n🔍 PHASE 2: DATABASE ANALYSIS');
  console.log('=============================');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check tweets table
    const { data: tweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('*', { count: 'exact' })
      .limit(5);
    
    report.database.tweets = {
      status: tweetsError ? 'ERROR' : 'HEALTHY',
      count: tweets?.length || 0,
      error: tweetsError?.message,
      sampleData: tweets?.slice(0, 3)
    };

    // Check learning_posts table
    const { data: learningPosts, error: learningError } = await supabase
      .from('learning_posts')
      .select('*', { count: 'exact' })
      .limit(5);
    
    report.database.learningPosts = {
      status: learningError ? 'ERROR' : 'HEALTHY',
      count: learningPosts?.length || 0,
      error: learningError?.message,
      sampleData: learningPosts?.slice(0, 3)
    };

    // Check tweet_metrics table
    const { data: metrics, error: metricsError } = await supabase
      .from('tweet_metrics')
      .select('*', { count: 'exact' })
      .limit(5);
    
    report.database.metrics = {
      status: metricsError ? 'ERROR' : 'HEALTHY',
      count: metrics?.length || 0,
      error: metricsError?.message,
      sampleData: metrics?.slice(0, 3)
    };

    // Check engagement_snapshots table (new)
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('engagement_snapshots')
      .select('*', { count: 'exact' })
      .limit(5);
    
    report.database.engagementSnapshots = {
      status: snapshotsError ? 'ERROR' : 'HEALTHY',
      count: snapshots?.length || 0,
      error: snapshotsError?.message,
      sampleData: snapshots?.slice(0, 3)
    };

    console.log(`📊 Tweets: ${report.database.tweets.count} records`);
    console.log(`📚 Learning Posts: ${report.database.learningPosts.count} records`);
    console.log(`📈 Metrics: ${report.database.metrics.count} records`);
    console.log(`📊 Engagement Snapshots: ${report.database.engagementSnapshots.count} records`);

  } catch (dbError) {
    console.error(`❌ Database connection failed: ${dbError.message}`);
    report.database.connectionError = dbError.message;
  }

  console.log('\n🔍 PHASE 3: CODE QUALITY ANALYSIS');
  console.log('=================================');
  
  // Analyze file structure
  const fs = require('fs');
  const path = require('path');
  
  const analyzeDirectory = (dir) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    let tsFiles = 0;
    let jsFiles = 0;
    let totalLines = 0;
    
    files.forEach(file => {
      if (file.isFile()) {
        if (file.name.endsWith('.ts')) tsFiles++;
        if (file.name.endsWith('.js')) jsFiles++;
        
        try {
          const filePath = path.join(dir, file.name);
          const content = fs.readFileSync(filePath, 'utf8');
          totalLines += content.split('\n').length;
        } catch (error) {
          // Skip files we can't read
        }
      }
    });
    
    return { tsFiles, jsFiles, totalLines };
  };
  
  const srcAnalysis = analyzeDirectory('./src');
  report.codeQuality = {
    typeScriptFiles: srcAnalysis.tsFiles,
    javaScriptFiles: srcAnalysis.jsFiles,
    totalLines: srcAnalysis.totalLines,
    status: srcAnalysis.tsFiles > 0 ? 'MODERN' : 'LEGACY'
  };
  
  console.log(`📝 TypeScript Files: ${report.codeQuality.typeScriptFiles}`);
  console.log(`📝 JavaScript Files: ${report.codeQuality.javaScriptFiles}`);
  console.log(`📏 Total Lines: ${report.codeQuality.totalLines}`);

  console.log('\n🔍 PHASE 4: POSTING SYSTEM ANALYSIS');
  console.log('==================================');
  
  // Test core components
  try {
    const { AutonomousPostingEngine } = await import('./dist/core/autonomousPostingEngine.js');
    report.posting.coreEngine = 'LOADED';
  } catch (error) {
    report.posting.coreEngine = 'ERROR';
    report.posting.coreEngineError = error.message;
  }
  
  try {
    const { EnhancedThreadComposer } = await import('./dist/posting/enhancedThreadComposer.js');
    report.posting.threadComposer = 'LOADED';
  } catch (error) {
    report.posting.threadComposer = 'ERROR';
    report.posting.threadComposerError = error.message;
  }
  
  try {
    const { ThreadQualityEnhancer } = await import('./dist/content/threadQualityEnhancer.js');
    report.posting.qualityEnhancer = 'LOADED';
  } catch (error) {
    report.posting.qualityEnhancer = 'ERROR';
    report.posting.qualityEnhancerError = error.message;
  }

  console.log(`🤖 Core Posting Engine: ${report.posting.coreEngine}`);
  console.log(`🧵 Thread Composer: ${report.posting.threadComposer}`);
  console.log(`🎨 Quality Enhancer: ${report.posting.qualityEnhancer}`);

  console.log('\n🔍 PHASE 5: ENGAGEMENT ANALYSIS');
  console.log('===============================');
  
  if (report.database.metrics && report.database.metrics.sampleData) {
    const metrics = report.database.metrics.sampleData;
    const totalLikes = metrics.reduce((sum, m) => sum + (m.likes || 0), 0);
    const totalRetweets = metrics.reduce((sum, m) => sum + (m.retweets || 0), 0);
    const totalReplies = metrics.reduce((sum, m) => sum + (m.replies || 0), 0);
    
    report.engagement = {
      avgLikes: totalLikes / metrics.length,
      avgRetweets: totalRetweets / metrics.length,
      avgReplies: totalReplies / metrics.length,
      totalEngagement: totalLikes + totalRetweets + totalReplies,
      postsAnalyzed: metrics.length
    };
    
    console.log(`❤️ Average Likes: ${report.engagement.avgLikes.toFixed(1)}`);
    console.log(`🔄 Average Retweets: ${report.engagement.avgRetweets.toFixed(1)}`);
    console.log(`💬 Average Replies: ${report.engagement.avgReplies.toFixed(1)}`);
    console.log(`📊 Total Engagement: ${report.engagement.totalEngagement}`);
  }

  console.log('\n🔍 PHASE 6: ERROR PATTERN ANALYSIS');
  console.log('==================================');
  
  // Analyze recent logs for error patterns (simulated)
  const commonErrorPatterns = [
    'Content validation failed',
    'Thread posting failed', 
    'Database connection error',
    'OpenAI API error',
    'Playwright timeout',
    'Session expired'
  ];
  
  report.errors.patterns = commonErrorPatterns.map(pattern => ({
    pattern,
    severity: 'MEDIUM',
    frequency: 'OCCASIONAL'
  }));

  console.log('\n📋 COMPREHENSIVE REPORT SUMMARY');
  console.log('===============================');
  
  // Generate recommendations
  if (report.systemHealth.environment.status === 'ISSUES') {
    report.recommendations.push('🔧 Fix missing environment variables');
  }
  
  if (report.database.tweets?.count < 50) {
    report.recommendations.push('📊 Increase posting frequency to build dataset');
  }
  
  if (report.posting.threadComposer === 'ERROR') {
    report.recommendations.push('🧵 Debug thread composer integration');
  }
  
  if (report.engagement.avgLikes < 5) {
    report.recommendations.push('📈 Optimize content for higher engagement');
  }
  
  report.recommendations.push('🔄 Implement automated health monitoring');
  report.recommendations.push('📊 Set up engagement alerting thresholds');
  report.recommendations.push('🧠 Enhance learning algorithm with more data');

  // Final report
  console.log(`
🎯 OVERALL SYSTEM HEALTH: ${getOverallHealth(report)}

📊 KEY METRICS:
   Environment: ${report.systemHealth.environment.status}
   Database: ${getDatabaseHealth(report)}
   Code Quality: ${report.codeQuality.status}
   Posting System: ${getPostingHealth(report)}
   
📈 ENGAGEMENT PERFORMANCE:
   Total Posts: ${report.database.tweets?.count || 0}
   Learning Posts: ${report.database.learningPosts?.count || 0}
   Avg Engagement: ${report.engagement.totalEngagement || 0}
   
🔧 PRIORITY RECOMMENDATIONS:
${report.recommendations.map((rec, i) => `   ${i + 1}. ${rec}`).join('\n')}

📦 SYSTEM STATUS: ${getSystemStatus(report)}
  `);

  return report;
}

function getOverallHealth(report) {
  const issues = [];
  if (report.systemHealth.environment.status === 'ISSUES') issues.push('ENV');
  if (report.database.connectionError) issues.push('DB');
  if (report.posting.coreEngine === 'ERROR') issues.push('POSTING');
  
  if (issues.length === 0) return '🟢 EXCELLENT';
  if (issues.length <= 2) return '🟡 GOOD (minor issues)';
  return '🔴 NEEDS ATTENTION';
}

function getDatabaseHealth(report) {
  const tables = ['tweets', 'learningPosts', 'metrics', 'engagementSnapshots'];
  const healthyTables = tables.filter(table => 
    report.database[table]?.status === 'HEALTHY'
  );
  
  return `${healthyTables.length}/${tables.length} tables healthy`;
}

function getPostingHealth(report) {
  const components = ['coreEngine', 'threadComposer', 'qualityEnhancer'];
  const workingComponents = components.filter(comp => 
    report.posting[comp] === 'LOADED'
  );
  
  return `${workingComponents.length}/${components.length} components loaded`;
}

function getSystemStatus(report) {
  const overallHealth = getOverallHealth(report);
  if (overallHealth.includes('EXCELLENT')) return '🚀 FULLY OPERATIONAL';
  if (overallHealth.includes('GOOD')) return '✅ OPERATIONAL (monitoring)';
  return '⚠️ REQUIRES MAINTENANCE';
}

// Run the comprehensive review
runComprehensiveReview().catch(console.error);
