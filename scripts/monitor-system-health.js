#!/usr/bin/env node

/**
 * System Health Monitor
 * Comprehensive monitoring and reporting for xBOT system
 */

const Redis = require('ioredis');
const { execSync } = require('child_process');

async function monitorSystemHealth() {
  console.log('🏥 SYSTEM HEALTH MONITOR STARTING...');
  console.log('=' .repeat(50));
  
  const report = {
    timestamp: new Date().toISOString(),
    status: 'UNKNOWN',
    checks: [],
    recommendations: []
  };

  // 1. Redis Health Check
  try {
    console.log('📡 Checking Redis connectivity...');
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
    
    if (!redisUrl) {
      report.checks.push({
        name: 'Redis Connection',
        status: 'FAIL',
        details: 'No Redis URL configured'
      });
    } else {
      const redis = new Redis(redisUrl, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1
      });
      
      // Test Redis operations
      await redis.ping();
      const info = await redis.info('memory');
      
      // Check emergency flags
      const [emergencyStop, postingDisabled, viralDisabled] = await Promise.all([
        redis.get('xbot:emergency_stop'),
        redis.get('xbot:posting_disabled'),
        redis.get('xbot:viral_engine_disabled')
      ]);
      
      redis.disconnect();
      
      let emergencyStatus = 'NORMAL';
      if (emergencyStop && Date.now() < parseInt(emergencyStop)) {
        emergencyStatus = `EMERGENCY STOP (until ${new Date(parseInt(emergencyStop)).toLocaleString()})`;
      } else if (postingDisabled === 'true') {
        emergencyStatus = 'POSTING DISABLED';
      } else if (viralDisabled === 'true') {
        emergencyStatus = 'VIRAL ENGINE DISABLED';
      }
      
      report.checks.push({
        name: 'Redis Connection',
        status: 'PASS',
        details: `Connected, Emergency Status: ${emergencyStatus}`
      });
      
      console.log(`✅ Redis: Connected (${emergencyStatus})`);
    }
  } catch (redisError) {
    report.checks.push({
      name: 'Redis Connection',
      status: 'FAIL',
      details: redisError.message
    });
    console.log(`❌ Redis: ${redisError.message}`);
  }

  // 2. Railway Service Health
  try {
    console.log('🚂 Checking Railway service...');
    const logs = execSync('railway logs | head -20', { encoding: 'utf8', timeout: 10000 });
    
    const recentErrors = logs.split('\n').filter(line => 
      line.includes('❌') || line.includes('ERROR') || line.includes('failed')
    ).length;
    
    const postingActivity = logs.split('\n').filter(line =>
      line.includes('🧠 Executing VIRAL') || line.includes('POST_ORCHESTRATOR')
    ).length;
    
    const emergencyStops = logs.split('\n').filter(line =>
      line.includes('EMERGENCY STOP')
    ).length;
    
    let healthStatus = 'HEALTHY';
    if (emergencyStops > 0) {
      healthStatus = 'EMERGENCY STOPPED';
    } else if (recentErrors > 5) {
      healthStatus = 'DEGRADED';
    } else if (postingActivity > 20) {
      healthStatus = 'HYPERACTIVE';
    }
    
    report.checks.push({
      name: 'Railway Service',
      status: healthStatus === 'HEALTHY' ? 'PASS' : 'WARN',
      details: `Status: ${healthStatus}, Recent errors: ${recentErrors}, Posting activity: ${postingActivity}, Emergency stops: ${emergencyStops}`
    });
    
    console.log(`📊 Railway: ${healthStatus} (errors: ${recentErrors}, activity: ${postingActivity})`);
    
  } catch (railwayError) {
    report.checks.push({
      name: 'Railway Service',
      status: 'FAIL',
      details: `Cannot access Railway logs: ${railwayError.message}`
    });
    console.log(`❌ Railway: ${railwayError.message}`);
  }

  // 3. Environment Check
  try {
    console.log('🌍 Checking environment configuration...');
    const requiredEnvVars = [
      'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY', 'TWITTER_SESSION_B64'
    ];
    
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    const partial = requiredEnvVars.filter(env => 
      process.env[env] && process.env[env].length < 10
    );
    
    if (missing.length === 0 && partial.length === 0) {
      report.checks.push({
        name: 'Environment Config',
        status: 'PASS',
        details: 'All required environment variables present'
      });
      console.log('✅ Environment: All variables configured');
    } else {
      report.checks.push({
        name: 'Environment Config',
        status: 'WARN',
        details: `Missing: ${missing.join(', ')}, Partial: ${partial.join(', ')}`
      });
      console.log(`⚠️  Environment: Missing ${missing.length}, Partial ${partial.length}`);
    }
    
  } catch (envError) {
    report.checks.push({
      name: 'Environment Config',
      status: 'FAIL',
      details: envError.message
    });
  }

  // 4. Database Connectivity (if possible)
  try {
    console.log('🗄️  Checking database connectivity...');
    
    // Try to check if we can connect to the database
    if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
      // Simple connection test would go here
      report.checks.push({
        name: 'Database Connection',
        status: 'UNKNOWN',
        details: 'DB URL configured, but connection test not implemented'
      });
      console.log('🔍 Database: URL configured (connection test needed)');
    } else {
      report.checks.push({
        name: 'Database Connection',
        status: 'WARN',
        details: 'No direct database URL configured'
      });
      console.log('⚠️  Database: No direct URL configured');
    }
    
  } catch (dbError) {
    report.checks.push({
      name: 'Database Connection',
      status: 'FAIL',
      details: dbError.message
    });
  }

  // 5. Generate Overall Status and Recommendations
  const failedChecks = report.checks.filter(c => c.status === 'FAIL').length;
  const warnChecks = report.checks.filter(c => c.status === 'WARN').length;
  
  if (failedChecks > 0) {
    report.status = 'CRITICAL';
    report.recommendations.push('🚨 Critical issues detected - immediate attention required');
  } else if (warnChecks > 2) {
    report.status = 'DEGRADED';
    report.recommendations.push('⚠️  Multiple warnings - system may be unstable');
  } else if (warnChecks > 0) {
    report.status = 'WARNING';
    report.recommendations.push('⚠️  Minor issues detected - monitor closely');
  } else {
    report.status = 'HEALTHY';
    report.recommendations.push('✅ System appears healthy');
  }

  // Additional intelligent recommendations
  const emergencyCheck = report.checks.find(c => c.name === 'Redis Connection');
  if (emergencyCheck && emergencyCheck.details.includes('EMERGENCY STOP')) {
    report.recommendations.push('🛑 Emergency stop is active - posting halted for safety');
    report.recommendations.push('💡 Run "node scripts/nuclear-stop.js" to extend or "redis-cli del xbot:emergency_stop" to clear');
  }

  const railwayCheck = report.checks.find(c => c.name === 'Railway Service');
  if (railwayCheck && railwayCheck.details.includes('HYPERACTIVE')) {
    report.recommendations.push('🔥 System showing hyperactive posting - may need throttling');
    report.recommendations.push('💡 Consider running nuclear stop if posting spam continues');
  }

  // Output Final Report
  console.log('\n' + '=' .repeat(50));
  console.log(`🏥 OVERALL SYSTEM STATUS: ${report.status}`);
  console.log('=' .repeat(50));
  
  report.checks.forEach(check => {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️ ';
    console.log(`${icon} ${check.name}: ${check.status}`);
    if (check.details) {
      console.log(`   ${check.details}`);
    }
  });
  
  console.log('\n📋 RECOMMENDATIONS:');
  report.recommendations.forEach(rec => {
    console.log(`   ${rec}`);
  });
  
  console.log('\n🕒 Report generated:', report.timestamp);
  
  return report;
}

// CLI usage
if (require.main === module) {
  monitorSystemHealth()
    .then((report) => {
      // Exit with appropriate code
      if (report.status === 'CRITICAL') {
        process.exit(2);
      } else if (report.status === 'DEGRADED') {
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('💥 Health monitor failed:', error);
      process.exit(3);
    });
}

module.exports = { monitorSystemHealth };
