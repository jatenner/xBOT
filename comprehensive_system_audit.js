#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { supabase } = require('./dist/utils/supabaseClient');

class SystemAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.fixedIssues = [];
    this.unicodePatterns = [
      /��/g, // Common replacement character
      /\uFFFD/g, // Unicode replacement character
      /[\u0000-\u001F]/g, // Control characters (except newlines \n)
      /[\uFFF0-\uFFFF]/g, // Other problematic Unicode ranges
      /â€™/g, // UTF-8 encoding error for apostrophe
      /â€œ/g, // UTF-8 encoding error for left quote
      /â€\x9D/g, // UTF-8 encoding error for right quote
      /Ã¡/g, // Common encoding error
    ];
  }

  async runFullAudit() {
    console.log('🔍 === COMPREHENSIVE SYSTEM AUDIT ===\n');
    
    // 1. Unicode corruption audit
    await this.auditUnicodeCorruption();
    
    // 2. Database configuration audit
    await this.auditDatabaseConfig();
    
    // 3. API limits and usage audit
    await this.auditAPIUsage();
    
    // 4. File encoding audit
    await this.auditFileEncoding();
    
    // 5. Performance bottlenecks audit
    await this.auditPerformanceIssues();
    
    // 6. Content generation audit
    await this.auditContentGeneration();
    
    // 7. Deployment status audit
    await this.auditDeploymentStatus();
    
    // 8. Security and configuration audit
    await this.auditSecurityConfig();
    
    // Generate comprehensive report
    this.generateAuditReport();
  }

  async auditUnicodeCorruption() {
    console.log('🔤 1. UNICODE CORRUPTION AUDIT');
    
    const filesToCheck = [
      'src/prompts/tweetPrompt.txt',
      'src/prompts/viralTemplates.txt',
      'src/prompts/persona.txt',
      'src/prompts/replyPrompt.txt',
      'src/prompts/quoteRetweetTemplates.txt',
      'package.json',
      'README.md',
      'src/utils/formatTweet.ts',
      'src/agents/postTweet.ts'
    ];

    for (const filePath of filesToCheck) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const foundIssues = this.checkUnicodeIssues(content, filePath);
          
          if (foundIssues.length > 0) {
            this.issues.push({
              type: 'UNICODE_CORRUPTION',
              file: filePath,
              issues: foundIssues,
              severity: 'HIGH'
            });
            console.log(`   ❌ ${filePath}: ${foundIssues.length} Unicode issues found`);
          } else {
            console.log(`   ✅ ${filePath}: Clean`);
          }
        }
      } catch (error) {
        this.warnings.push({
          type: 'FILE_READ_ERROR',
          file: filePath,
          error: error.message
        });
        console.log(`   ⚠️  ${filePath}: Cannot read file`);
      }
    }
  }

  checkUnicodeIssues(content, filePath) {
    const issues = [];
    
    for (const pattern of this.unicodePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        issues.push({
          pattern: pattern.toString(),
          matches: matches.length,
          examples: matches.slice(0, 3)
        });
      }
    }
    
    return issues;
  }

  async auditDatabaseConfig() {
    console.log('\n🗄️  2. DATABASE CONFIGURATION AUDIT');
    
    try {
      // Check bot configuration
      const configs = ['enabled', 'DISABLE_BOT', 'bot_enabled', 'last_activity', 'current_mode'];
      
      for (const configKey of configs) {
        try {
          const { data: config, error } = await supabase
            .from('bot_config')
            .select('*')
            .eq('key', configKey)
            .single();

          if (error && error.code === 'PGRST116') {
            this.issues.push({
              type: 'MISSING_CONFIG',
              key: configKey,
              severity: 'MEDIUM',
              fix: `INSERT INTO bot_config (key, value) VALUES ('${configKey}', 'true')`
            });
            console.log(`   ❌ Missing config: ${configKey}`);
          } else if (config) {
            console.log(`   ✅ ${configKey}: ${config.value}`);
          }
        } catch (err) {
          this.warnings.push({
            type: 'CONFIG_CHECK_ERROR',
            key: configKey,
            error: err.message
          });
        }
      }

      // Check control flags
      const { data: flags, error: flagsError } = await supabase
        .from('control_flags')
        .select('*');

      if (flagsError) {
        this.issues.push({
          type: 'CONTROL_FLAGS_ERROR',
          error: flagsError.message,
          severity: 'LOW'
        });
      } else if (flags) {
        flags.forEach(flag => {
          if (flag.value && flag.id === 'DISABLE_BOT') {
            this.issues.push({
              type: 'BOT_DISABLED',
              flag: flag.id,
              severity: 'HIGH'
            });
            console.log(`   ❌ Bot disabled by flag: ${flag.id}`);
          } else {
            console.log(`   ✅ ${flag.id}: ${flag.value ? 'ACTIVE' : 'INACTIVE'}`);
          }
        });
      }

    } catch (error) {
      this.issues.push({
        type: 'DATABASE_CONNECTION_ERROR',
        error: error.message,
        severity: 'CRITICAL'
      });
      console.log(`   ❌ Database connection failed: ${error.message}`);
    }
  }

  async auditAPIUsage() {
    console.log('\n📊 3. API USAGE AUDIT');
    
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const today = new Date().toISOString().split('T')[0];

      // Monthly usage
      const { data: monthlyUsage, error: monthlyError } = await supabase
        .from('monthly_api_usage')
        .select('*')
        .eq('month', currentMonth)
        .single();

      if (monthlyError && monthlyError.code === 'PGRST116') {
        this.issues.push({
          type: 'MISSING_MONTHLY_TRACKER',
          severity: 'MEDIUM',
          fix: 'Initialize monthly API usage tracking'
        });
        console.log(`   ❌ Monthly usage tracker missing`);
      } else if (monthlyUsage) {
        const tweetPercent = (monthlyUsage.tweets / 1500) * 100;
        console.log(`   📅 Monthly tweets: ${monthlyUsage.tweets}/1500 (${tweetPercent.toFixed(1)}%)`);
        
        if (monthlyUsage.tweets >= 1500) {
          this.issues.push({
            type: 'MONTHLY_LIMIT_REACHED',
            severity: 'CRITICAL',
            tweets: monthlyUsage.tweets
          });
        } else if (monthlyUsage.tweets >= 1400) {
          this.warnings.push({
            type: 'APPROACHING_MONTHLY_LIMIT',
            tweets: monthlyUsage.tweets
          });
        }
      }

      // Daily usage
      const { data: dailyUsage, error: dailyError } = await supabase
        .from('api_usage')
        .select('*')
        .eq('date', today)
        .single();

      if (dailyError && dailyError.code === 'PGRST116') {
        this.issues.push({
          type: 'MISSING_DAILY_TRACKER',
          severity: 'LOW',
          fix: 'Initialize daily API usage tracking'
        });
        console.log(`   ❌ Daily usage tracker missing`);
      } else if (dailyUsage) {
        console.log(`   📅 Daily writes: ${dailyUsage.writes}/450`);
        console.log(`   📅 Daily reads: ${dailyUsage.reads}/90`);
        
        if (dailyUsage.writes >= 450) {
          this.issues.push({
            type: 'DAILY_WRITE_LIMIT_REACHED',
            severity: 'HIGH',
            writes: dailyUsage.writes
          });
        }
      }

    } catch (error) {
      this.issues.push({
        type: 'API_USAGE_AUDIT_ERROR',
        error: error.message,
        severity: 'MEDIUM'
      });
      console.log(`   ❌ API usage audit failed: ${error.message}`);
    }
  }

  async auditFileEncoding() {
    console.log('\n📄 4. FILE ENCODING AUDIT');
    
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      'src/prompts/tweetPrompt.txt',
      'src/prompts/viralTemplates.txt',
      'src/utils/contentSanity.ts',
      'src/agents/postTweet.ts'
    ];

    for (const filePath of criticalFiles) {
      try {
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const content = buffer.toString('utf8');
          
          // Check for BOM (Byte Order Mark)
          if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            this.warnings.push({
              type: 'UTF8_BOM_DETECTED',
              file: filePath,
              fix: 'Remove BOM from file'
            });
            console.log(`   ⚠️  ${filePath}: UTF-8 BOM detected`);
          }

          // Check for mixed line endings
          const hasWindows = content.includes('\r\n');
          const hasUnix = content.includes('\n') && !content.includes('\r\n');
          
          if (hasWindows && hasUnix) {
            this.warnings.push({
              type: 'MIXED_LINE_ENDINGS',
              file: filePath,
              fix: 'Standardize line endings'
            });
            console.log(`   ⚠️  ${filePath}: Mixed line endings`);
          } else {
            console.log(`   ✅ ${filePath}: Encoding OK`);
          }
        }
      } catch (error) {
        this.issues.push({
          type: 'FILE_ENCODING_ERROR',
          file: filePath,
          error: error.message,
          severity: 'MEDIUM'
        });
      }
    }
  }

  async auditPerformanceIssues() {
    console.log('\n⚡ 5. PERFORMANCE ISSUES AUDIT');
    
    // Check for large files that might slow down the system
    const performanceFiles = [
      'bot_ai_visual_decision.log',
      'bot_24_7.log',
      'bot_24_7_fixed.log',
      'package-lock.json'
    ];

    for (const fileName of performanceFiles) {
      try {
        if (fs.existsSync(fileName)) {
          const stats = fs.statSync(fileName);
          const sizeMB = stats.size / (1024 * 1024);
          
          if (sizeMB > 50) {
            this.issues.push({
              type: 'LARGE_FILE_PERFORMANCE',
              file: fileName,
              size: `${sizeMB.toFixed(1)}MB`,
              severity: 'MEDIUM',
              fix: 'Consider archiving or cleaning up large log files'
            });
            console.log(`   ⚠️  ${fileName}: ${sizeMB.toFixed(1)}MB (large file)`);
          } else {
            console.log(`   ✅ ${fileName}: ${sizeMB.toFixed(1)}MB`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  ${fileName}: Cannot check size`);
      }
    }

    // Check node_modules size
    try {
      if (fs.existsSync('node_modules')) {
        this.warnings.push({
          type: 'NODE_MODULES_SIZE',
          message: 'Consider running npm prune to remove unused packages'
        });
        console.log(`   💡 node_modules: Consider running 'npm prune'`);
      }
    } catch (error) {
      // Ignore
    }
  }

  async auditContentGeneration() {
    console.log('\n📝 6. CONTENT GENERATION AUDIT');
    
    try {
      // Check recent tweets for quality
      const { data: recentTweets, error } = await supabase
        .from('tweets')
        .select('content, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        this.issues.push({
          type: 'TWEET_FETCH_ERROR',
          error: error.message,
          severity: 'MEDIUM'
        });
        console.log(`   ❌ Cannot fetch recent tweets: ${error.message}`);
      } else if (recentTweets && recentTweets.length > 0) {
        let corruptedTweets = 0;
        let duplicateTweets = 0;
        const contents = new Set();

        recentTweets.forEach((tweet, index) => {
          // Check for Unicode corruption
          const hasCorruption = this.unicodePatterns.some(pattern => 
            pattern.test(tweet.content)
          );
          
          if (hasCorruption) {
            corruptedTweets++;
          }

          // Check for duplicates
          if (contents.has(tweet.content)) {
            duplicateTweets++;
          } else {
            contents.add(tweet.content);
          }

          console.log(`   ${index + 1}. "${tweet.content.substring(0, 50)}..." ${hasCorruption ? '❌' : '✅'}`);
        });

        if (corruptedTweets > 0) {
          this.issues.push({
            type: 'CORRUPTED_TWEETS_IN_DATABASE',
            count: corruptedTweets,
            severity: 'HIGH',
            fix: 'Clean up corrupted tweets in database'
          });
        }

        if (duplicateTweets > 0) {
          this.warnings.push({
            type: 'DUPLICATE_TWEETS',
            count: duplicateTweets,
            fix: 'Improve content uniqueness algorithms'
          });
        }

        console.log(`   📊 Summary: ${corruptedTweets} corrupted, ${duplicateTweets} duplicates`);
      } else {
        this.warnings.push({
          type: 'NO_RECENT_TWEETS',
          message: 'No recent tweets found in database'
        });
        console.log(`   ⚠️  No recent tweets found`);
      }

    } catch (error) {
      this.issues.push({
        type: 'CONTENT_AUDIT_ERROR',
        error: error.message,
        severity: 'MEDIUM'
      });
    }
  }

  async auditDeploymentStatus() {
    console.log('\n🚀 7. DEPLOYMENT STATUS AUDIT');
    
    try {
      // Check if Render deployment is responding
      const response = await fetch('https://snap2health-xbot.onrender.com', {
        method: 'HEAD',
        timeout: 10000
      });
      
      if (response.ok) {
        console.log(`   ✅ Render deployment: Online (${response.status})`);
      } else {
        this.issues.push({
          type: 'DEPLOYMENT_ERROR',
          status: response.status,
          severity: 'CRITICAL',
          fix: 'Restart Render service or check deployment logs'
        });
        console.log(`   ❌ Render deployment: Error ${response.status}`);
      }
    } catch (error) {
      this.issues.push({
        type: 'DEPLOYMENT_UNREACHABLE',
        error: error.message,
        severity: 'CRITICAL',
        fix: 'Check Render service status and restart if needed'
      });
      console.log(`   ❌ Render deployment: Unreachable`);
    }

    // Check if build files exist
    const buildFiles = [
      'dist/agents/postTweet.js',
      'dist/agents/strategistAgent.js',
      'dist/utils/contentSanity.js',
      'dist/prompts/tweetPrompt.txt'
    ];

    let missingBuildFiles = 0;
    for (const buildFile of buildFiles) {
      if (!fs.existsSync(buildFile)) {
        missingBuildFiles++;
        console.log(`   ❌ Missing: ${buildFile}`);
      } else {
        console.log(`   ✅ Built: ${buildFile}`);
      }
    }

    if (missingBuildFiles > 0) {
      this.issues.push({
        type: 'MISSING_BUILD_FILES',
        count: missingBuildFiles,
        severity: 'HIGH',
        fix: 'Run npm run build'
      });
    }
  }

  async auditSecurityConfig() {
    console.log('\n🔐 8. SECURITY & CONFIGURATION AUDIT');
    
    // Check for environment variables
    const requiredEnvVars = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY'
    ];

    let missingEnvVars = 0;
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingEnvVars++;
        this.issues.push({
          type: 'MISSING_ENV_VAR',
          variable: envVar,
          severity: 'CRITICAL',
          fix: 'Add to .env file'
        });
        console.log(`   ❌ Missing: ${envVar}`);
      } else {
        console.log(`   ✅ Present: ${envVar}`);
      }
    }

    // Check .env file exists
    if (!fs.existsSync('.env')) {
      this.issues.push({
        type: 'MISSING_ENV_FILE',
        severity: 'CRITICAL',
        fix: 'Create .env file with required variables'
      });
      console.log(`   ❌ .env file missing`);
    } else {
      console.log(`   ✅ .env file exists`);
    }
  }

  generateAuditReport() {
    console.log('\n📋 === AUDIT REPORT SUMMARY ===');
    
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
    const highIssues = this.issues.filter(i => i.severity === 'HIGH');
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM');
    const lowIssues = this.issues.filter(i => i.severity === 'LOW');

    console.log(`\n🚨 CRITICAL ISSUES: ${criticalIssues.length}`);
    criticalIssues.forEach(issue => {
      console.log(`   • ${issue.type}: ${issue.fix || issue.error || 'Manual review needed'}`);
    });

    console.log(`\n⚠️  HIGH PRIORITY ISSUES: ${highIssues.length}`);
    highIssues.forEach(issue => {
      console.log(`   • ${issue.type}: ${issue.fix || issue.error || 'Manual review needed'}`);
    });

    console.log(`\n📝 MEDIUM PRIORITY ISSUES: ${mediumIssues.length}`);
    mediumIssues.forEach(issue => {
      console.log(`   • ${issue.type}: ${issue.fix || issue.error || 'Manual review needed'}`);
    });

    console.log(`\n💡 WARNINGS: ${this.warnings.length}`);
    this.warnings.slice(0, 5).forEach(warning => {
      console.log(`   • ${warning.type}: ${warning.fix || warning.message || 'Review recommended'}`);
    });

    // Overall health score
    const totalIssues = criticalIssues.length + highIssues.length + mediumIssues.length;
    let healthScore = 100;
    
    healthScore -= criticalIssues.length * 25;
    healthScore -= highIssues.length * 15;
    healthScore -= mediumIssues.length * 5;
    healthScore -= this.warnings.length * 2;
    
    healthScore = Math.max(0, healthScore);

    console.log(`\n🎯 SYSTEM HEALTH SCORE: ${healthScore}/100`);
    
    if (healthScore >= 90) {
      console.log('   ✅ EXCELLENT - System is running optimally');
    } else if (healthScore >= 75) {
      console.log('   🟡 GOOD - Minor issues need attention');
    } else if (healthScore >= 50) {
      console.log('   🟠 FAIR - Several issues affecting performance');
    } else {
      console.log('   🔴 POOR - Critical issues need immediate attention');
    }

    // Priority actions
    console.log('\n🎯 PRIORITY ACTIONS:');
    if (criticalIssues.length > 0) {
      console.log('   1. 🚨 Fix critical issues immediately');
      console.log('   2. 🔄 Restart services after fixes');
      console.log('   3. ✅ Verify system functionality');
    } else if (highIssues.length > 0) {
      console.log('   1. ⚠️  Address high priority issues');
      console.log('   2. 📊 Monitor system performance');
      console.log('   3. 🔍 Review warnings for optimization');
    } else {
      console.log('   1. ✅ System is healthy');
      console.log('   2. 📈 Focus on optimization');
      console.log('   3. 🔍 Monitor for new issues');
    }

    console.log('\n✅ Comprehensive audit complete!');
  }
}

// Run the audit
const auditor = new SystemAuditor();
auditor.runFullAudit().catch(console.error); 