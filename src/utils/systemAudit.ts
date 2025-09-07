/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * Tests all Twitter automation components for functionality
 */

import { admin as supabase } from '../lib/supabaseClients';
import { bulletproofPoster } from '../posting/bulletproofPoster';
import { bulletproofBrowser } from '../posting/bulletproofBrowserManager';

interface AuditResult {
  status: 'healthy' | 'warning' | 'error' | 'unknown' | 'ready';
  issues: string[];
}

interface SystemAuditResults {
  posting: AuditResult;
  analytics: AuditResult;
  database: AuditResult;
  browser: AuditResult;
  session: AuditResult;
  overall: 'healthy' | 'warning' | 'error';
}

export async function runSystemAudit(): Promise<SystemAuditResults> {
  console.log('🔍 TWITTER AUTOMATION SYSTEM AUDIT');
  console.log('==================================\n');

  const results: SystemAuditResults = {
    posting: { status: 'unknown', issues: [] },
    analytics: { status: 'unknown', issues: [] },
    database: { status: 'unknown', issues: [] },
    browser: { status: 'unknown', issues: [] },
    session: { status: 'unknown', issues: [] },
    overall: 'error'
  };

  // 1. Environment Variables Check
  console.log('📋 1. ENVIRONMENT VARIABLES');
  console.log('----------------------------');
  
  const requiredEnvVars = [
    'TWITTER_SESSION_B64',
    'SUPABASE_URL', 
    'SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'REDIS_URL'
  ];

  let envVarIssues = 0;
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: Set (${value.length} chars)`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
      results.session.issues.push(`Missing ${envVar}`);
      envVarIssues++;
    }
  }

  // 2. Twitter Session Check
  console.log('\n🔐 2. TWITTER SESSION');
  console.log('---------------------');
  
  try {
    const sessionB64 = process.env.TWITTER_SESSION_B64;
    if (sessionB64) {
      const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
      if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
        console.log(`✅ Session: ${sessionData.cookies.length} cookies loaded`);
        results.session.status = 'healthy';
      } else {
        console.log('❌ Session: Invalid format');
        results.session.status = 'error';
        results.session.issues.push('Invalid session format');
      }
    } else {
      console.log('❌ Session: Missing TWITTER_SESSION_B64');
      results.session.status = 'error';
    }
  } catch (error) {
    console.log(`❌ Session: Parse error - ${(error as Error).message}`);
    results.session.status = 'error';
    results.session.issues.push(`Parse error: ${(error as Error).message}`);
  }

  // 3. Database Connection
  console.log('\n💾 3. DATABASE CONNECTION');
  console.log('-------------------------');
  
  try {
    const { data, error } = await supabase
      .from('learning_posts')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`❌ Database: ${error.message}`);
      results.database.status = 'error';
      results.database.issues.push(error.message);
    } else {
      console.log('✅ Database: Connected successfully');
      results.database.status = 'healthy';
    }
  } catch (error) {
    console.log(`❌ Database: Connection failed - ${(error as Error).message}`);
    results.database.status = 'error';
    results.database.issues.push(`Connection failed: ${(error as Error).message}`);
  }

  // 4. Required Tables Check
  console.log('\n🗄️ 4. DATABASE TABLES');
  console.log('----------------------');
  
  const requiredTables = [
    'learning_posts',
    'tweet_analytics',
    'profile_analytics',
    'bulletproof_posts',
    'follower_growth_content',
    'aggressive_posts',
    'engagement_records'
  ];

  let tableIssues = 0;
  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
        results.database.issues.push(`Table ${table}: ${error.message}`);
        tableIssues++;
      } else {
        console.log(`✅ Table ${table}: Accessible`);
      }
    } catch (tableError) {
      console.log(`❌ Table ${table}: ${(tableError as Error).message}`);
      results.database.issues.push(`Table ${table}: ${(tableError as Error).message}`);
      tableIssues++;
    }
  }

  // 5. Browser System Check
  console.log('\n🌐 5. BROWSER SYSTEM');
  console.log('--------------------');
  
  try {
    const status = bulletproofBrowser.getStatus() as any;
    console.log('Browser Status:', status);
    
    if (status.browserConnected) {
      console.log('✅ Browser: Connected');
      results.browser.status = 'healthy';
    } else {
      console.log('🟡 Browser: Not connected (will launch on demand)');
      results.browser.status = 'ready';
    }
    
  } catch (error) {
    console.log(`❌ Browser: ${(error as Error).message}`);
    results.browser.status = 'error';
    results.browser.issues.push((error as Error).message);
  }

  // 6. Bulletproof Poster Check
  console.log('\n🚀 6. BULLETPROOF POSTER');
  console.log('-------------------------');
  
  try {
    const status = bulletproofPoster.getStatus() as any;
    console.log('Poster Status:', status);
    
    // Light health check (doesn't actually launch browser)
    results.posting.status = 'ready';
    console.log('🟡 Bulletproof Poster: Ready (health check skipped)');
    
  } catch (error) {
    console.log(`❌ Bulletproof Poster: ${(error as Error).message}`);
    results.posting.status = 'error';
    results.posting.issues.push((error as Error).message);
  }

  // 7. Analytics Check
  console.log('\n📊 7. ANALYTICS SYSTEM');
  console.log('----------------------');
  
  try {
    // Check if analytics tables have recent data
    const { data: recentAnalytics, error: analyticsError } = await supabase
      .from('tweet_analytics')
      .select('scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(1);

    if (analyticsError) {
      console.log(`❌ Analytics: ${analyticsError.message}`);
      results.analytics.status = 'error';
      results.analytics.issues.push(analyticsError.message);
    } else if (recentAnalytics && recentAnalytics.length > 0) {
      const lastAnalytics = new Date(recentAnalytics[0].scraped_at);
      const hoursAgo = (Date.now() - lastAnalytics.getTime()) / (1000 * 60 * 60);
      console.log(`✅ Analytics: Last data ${hoursAgo.toFixed(1)} hours ago`);
      results.analytics.status = hoursAgo < 24 ? 'healthy' : 'warning';
      if (hoursAgo >= 24) {
        results.analytics.issues.push(`Stale data: ${hoursAgo.toFixed(1)} hours old`);
      }
    } else {
      console.log('⚠️ Analytics: No data found');
      results.analytics.status = 'warning';
      results.analytics.issues.push('No analytics data found');
    }
  } catch (error) {
    console.log(`❌ Analytics: ${(error as Error).message}`);
    results.analytics.status = 'error';
    results.analytics.issues.push((error as Error).message);
  }

  // 8. Recent Posts Check
  console.log('\n📝 8. RECENT POSTS');
  console.log('------------------');
  
  try {
    const { data: recentPosts, error: postsError } = await supabase
      .from('bulletproof_posts')
      .select('posted_at, status')
      .order('posted_at', { ascending: false })
      .limit(5);

    if (postsError) {
      console.log(`❌ Posts: ${postsError.message}`);
    } else if (recentPosts && recentPosts.length > 0) {
      console.log(`📊 Recent Posts: ${recentPosts.length} found`);
      recentPosts.forEach((post, i) => {
        const timeAgo = post.posted_at ? 
          ((Date.now() - new Date(post.posted_at).getTime()) / (1000 * 60 * 60)).toFixed(1) : 
          'unknown';
        console.log(`  ${i + 1}. ${post.status} - ${timeAgo}h ago`);
      });

      const lastPost = recentPosts[0];
      const lastPostTime = lastPost.posted_at ? new Date(lastPost.posted_at) : null;
      const hoursAgo = lastPostTime ? (Date.now() - lastPostTime.getTime()) / (1000 * 60 * 60) : 999;
      
      if (hoursAgo < 6) {
        console.log('✅ Posts: Recent activity detected');
      } else {
        console.log(`⚠️ Posts: Last post ${hoursAgo.toFixed(1)} hours ago`);
        results.posting.issues.push(`No recent posts: ${hoursAgo.toFixed(1)} hours ago`);
      }
    } else {
      console.log('⚠️ Posts: No posts found');
      results.posting.issues.push('No posts found in database');
    }
  } catch (error) {
    console.log(`❌ Posts: ${(error as Error).message}`);
  }

  // 9. Summary and Overall Status
  console.log('\n📊 AUDIT SUMMARY');
  console.log('================');
  
  let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
  
  for (const [component, result] of Object.entries(results) as [string, AuditResult][]) {
    if (component === 'overall') continue;
    
    const emoji = result.status === 'healthy' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : 
                  result.status === 'ready' ? '🟡' : '❌';
    
    console.log(`${emoji} ${component.toUpperCase()}: ${result.status}`);
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   - ${issue}`));
      if (result.status === 'error') overallStatus = 'error';
      else if (result.status === 'warning' && overallStatus === 'healthy') overallStatus = 'warning';
    }
  }
  
  results.overall = overallStatus;
  console.log(`\n🎯 OVERALL STATUS: ${overallStatus.toUpperCase()}`);
  
  if (overallStatus === 'healthy') {
    console.log('\n🚀 SYSTEM READY FOR AUTONOMOUS OPERATION!');
  } else if (overallStatus === 'warning') {
    console.log('\n⚠️ SYSTEM FUNCTIONAL BUT HAS WARNINGS');
  } else {
    console.log('\n❌ SYSTEM HAS CRITICAL ISSUES - NEEDS ATTENTION');
  }
  
  // 10. Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-------------------');
  
  if (envVarIssues > 0) {
    console.log('🔧 Fix missing environment variables in Railway');
  }
  if (tableIssues > 0) {
    console.log('🔧 Run database migrations to create missing tables');
  }
  if (results.session.status === 'error') {
    console.log('🔧 Update Twitter session with fresh cookies');
  }
  if (results.analytics.status !== 'healthy') {
    console.log('🔧 Check analytics scraper and data collection');
  }
  if (results.posting.issues.some(i => i.includes('No recent posts'))) {
    console.log('🔧 Verify posting system is actively running');
  }
  
  return results;
}

// Export for use in other modules
export { SystemAuditResults, AuditResult };
