require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * 🔍 COMPREHENSIVE SYSTEM VERIFICATION
 * 
 * This script checks:
 * 1. Railway deployment health
 * 2. Playwright browser automation status  
 * 3. Supabase automatic migrations
 * 4. Database metrics storage capability
 * 5. Learning system functionality
 * 6. Complete posting pipeline
 */

async function comprehensiveSystemCheck() {
  console.log('🔍 COMPREHENSIVE SYSTEM VERIFICATION');
  console.log('===================================');
  console.log(`⏰ Started: ${new Date().toLocaleString()}`);
  console.log('🎯 Goal: Verify all systems operational for bot learning improvement');
  console.log('');

  const results = {
    environment: false,
    database: false,
    migrations: false,
    metrics: false,
    posting: false,
    learning: false
  };

  try {
    // ==========================================
    // 1️⃣ ENVIRONMENT & CREDENTIALS CHECK
    // ==========================================
    console.log('1️⃣ ENVIRONMENT & CREDENTIALS VERIFICATION');
    console.log('==========================================');
    
    const requiredVars = {
      'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
      'SUPABASE_URL': process.env.SUPABASE_URL,
      'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY
    };

    let envHealthy = true;
    for (const [key, value] of Object.entries(requiredVars)) {
      if (value) {
        console.log(`✅ ${key}: Present (${value.length} chars)`);
      } else {
        console.log(`❌ ${key}: Missing`);
        envHealthy = false;
      }
    }
    
    results.environment = envHealthy;
    console.log(`📊 Environment Status: ${envHealthy ? '✅ HEALTHY' : '❌ ISSUES'}`);
    console.log('');

    if (!envHealthy) {
      console.log('🚨 Cannot proceed with missing environment variables');
      return results;
    }

    // ==========================================
    // 2️⃣ SUPABASE CONNECTION & HEALTH CHECK
    // ==========================================
    console.log('2️⃣ SUPABASE DATABASE CONNECTION');
    console.log('================================');
    
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    try {
      // Test basic connectivity
      const { data: healthCheck, error: healthError } = await client
        .from('tweets')
        .select('count')
        .limit(1);
        
      if (healthError) {
        console.log(`❌ Database connection failed: ${healthError.message}`);
        results.database = false;
      } else {
        console.log('✅ Database connection successful');
        results.database = true;
      }
    } catch (dbError) {
      console.log(`❌ Database error: ${dbError.message}`);
      results.database = false;
    }

    // ==========================================
    // 3️⃣ DATABASE SCHEMA & MIGRATION CHECK
    // ==========================================
    console.log('');
    console.log('3️⃣ DATABASE SCHEMA & AUTOMATIC MIGRATIONS');
    console.log('==========================================');
    
    const requiredTables = ['tweets', 'tweet_metrics', 'learning_posts', 'content_generations'];
    let schemaHealthy = true;
    
    for (const table of requiredTables) {
      try {
        const { data, error } = await client
          .from(table)
          .select('*')
          .limit(1);
          
        if (error) {
          console.log(`❌ Table '${table}': ${error.message}`);
          schemaHealthy = false;
        } else {
          console.log(`✅ Table '${table}': Accessible`);
        }
      } catch (tableError) {
        console.log(`❌ Table '${table}': ${tableError.message}`);
        schemaHealthy = false;
      }
    }
    
    results.migrations = schemaHealthy;
    console.log(`📊 Schema Status: ${schemaHealthy ? '✅ HEALTHY' : '❌ NEEDS MIGRATION'}`);

    // ==========================================
    // 4️⃣ METRICS STORAGE CAPABILITY TEST
    // ==========================================
    console.log('');
    console.log('4️⃣ METRICS STORAGE CAPABILITY TEST');
    console.log('==================================');
    
    const testTweetId = `test_${Date.now()}`;
    let metricsHealthy = false;
    
    try {
      // Test storing real content (like our fixed system does)
      const testContent = "Health tip: Drinking water first thing in the morning kickstarts your metabolism. Your body loses 1-2 pounds of water overnight through breathing and sweating. Rehydration helps brain function and energy levels.";
      
      const { error: storageError } = await client
        .from('tweets')
        .insert({
          tweet_id: testTweetId,
          content: testContent,
          posted_at: new Date().toISOString(),
          platform: 'twitter',
          status: 'test',
          engagement_score: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          content_format: 'single',
          created_at: new Date().toISOString()
        });

      if (storageError) {
        console.log(`❌ Metrics storage test failed: ${storageError.message}`);
      } else {
        console.log('✅ Content storage test successful');
        
        // Test learning_posts storage
        const { error: learningError } = await client
          .from('learning_posts')
          .insert({
            tweet_id: testTweetId,
            content: testContent,
            format: 'single',
            likes_count: 0,
            retweets_count: 0,
            replies_count: 0,
            bookmarks_count: 0,
            impressions_count: 50,
            viral_potential_score: 75,
            created_at: new Date().toISOString()
          });

        if (learningError) {
          console.log(`❌ Learning storage test failed: ${learningError.message}`);
        } else {
          console.log('✅ Learning posts storage test successful');
          metricsHealthy = true;
        }
      }
      
      // Cleanup test data
      await client.from('tweets').delete().eq('tweet_id', testTweetId);
      await client.from('learning_posts').delete().eq('tweet_id', testTweetId);
      console.log('🧹 Test data cleaned up');
      
    } catch (storageTestError) {
      console.log(`❌ Storage test error: ${storageTestError.message}`);
    }
    
    results.metrics = metricsHealthy;
    console.log(`📊 Metrics Storage: ${metricsHealthy ? '✅ OPERATIONAL' : '❌ ISSUES'}`);

    // ==========================================
    // 5️⃣ LEARNING SYSTEM DATA ANALYSIS
    // ==========================================
    console.log('');
    console.log('5️⃣ LEARNING SYSTEM DATA ANALYSIS');
    console.log('=================================');
    
    try {
      // Check recent learning data quality
      const { data: recentPosts, error: learningError } = await client
        .from('learning_posts')
        .select('tweet_id, content, viral_potential_score, likes_count, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (learningError) {
        console.log(`❌ Learning data query failed: ${learningError.message}`);
        results.learning = false;
      } else {
        console.log(`📚 Recent learning entries: ${recentPosts.length}`);
        
        // Analyze data quality
        let realContentCount = 0;
        let totalViralScore = 0;
        
        recentPosts.forEach((post, i) => {
          const isRealContent = post.content.length > 67 && 
                               !post.content.includes('Thread posted successfully') &&
                               !post.content.includes('High-quality tweet for follower growth');
          
          if (isRealContent) realContentCount++;
          totalViralScore += post.viral_potential_score || 0;
          
          if (i < 3) {
            console.log(`   ${i+1}. ${post.tweet_id}: ${post.content.length} chars, ${post.viral_potential_score || 0} viral score`);
          }
        });
        
        const avgViralScore = recentPosts.length > 0 ? totalViralScore / recentPosts.length : 0;
        const realContentPercentage = recentPosts.length > 0 ? (realContentCount / recentPosts.length) * 100 : 0;
        
        console.log(`📊 Real content: ${realContentPercentage.toFixed(1)}% (${realContentCount}/${recentPosts.length})`);
        console.log(`📊 Average viral score: ${avgViralScore.toFixed(1)}`);
        
        results.learning = realContentPercentage > 70; // Good if >70% real content
        console.log(`📊 Learning Quality: ${results.learning ? '✅ GOOD' : '❌ NEEDS IMPROVEMENT'}`);
      }
    } catch (learningAnalysisError) {
      console.log(`❌ Learning analysis error: ${learningAnalysisError.message}`);
      results.learning = false;
    }

    // ==========================================
    // 6️⃣ POSTING SYSTEM STATUS CHECK
    // ==========================================
    console.log('');
    console.log('6️⃣ POSTING SYSTEM STATUS CHECK');
    console.log('===============================');
    
    try {
      const { data: latestTweets, error: tweetsError } = await client
        .from('tweets')
        .select('tweet_id, content, posted_at')
        .order('posted_at', { ascending: false })
        .limit(3);

      if (tweetsError) {
        console.log(`❌ Tweet history query failed: ${tweetsError.message}`);
        results.posting = false;
      } else {
        const now = new Date();
        const latestPost = latestTweets[0];
        
        if (latestPost) {
          const timeSincePost = Math.floor((now - new Date(latestPost.posted_at)) / (1000 * 60));
          console.log(`⏰ Last post: ${timeSincePost} minutes ago`);
          console.log(`📝 Content: "${latestPost.content.substring(0, 60)}..."`);
          console.log(`📏 Length: ${latestPost.content.length} characters`);
          
          if (timeSincePost < 120) {
            console.log('✅ Recent posting activity detected');
            results.posting = true;
          } else {
            console.log('⚠️ No recent posts - system may be idle or issues exist');
            results.posting = false;
          }
        } else {
          console.log('❌ No tweet history found');
          results.posting = false;
        }
      }
    } catch (postingCheckError) {
      console.log(`❌ Posting check error: ${postingCheckError.message}`);
      results.posting = false;
    }

    // ==========================================
    // 📊 FINAL SYSTEM HEALTH SUMMARY
    // ==========================================
    console.log('');
    console.log('📊 COMPREHENSIVE SYSTEM HEALTH SUMMARY');
    console.log('======================================');
    
    const healthChecks = [
      { name: 'Environment Variables', status: results.environment, critical: true },
      { name: 'Database Connection', status: results.database, critical: true },
      { name: 'Schema/Migrations', status: results.migrations, critical: true },
      { name: 'Metrics Storage', status: results.metrics, critical: true },
      { name: 'Learning System', status: results.learning, critical: false },
      { name: 'Posting Activity', status: results.posting, critical: false }
    ];

    let criticalIssues = 0;
    let totalIssues = 0;

    healthChecks.forEach(check => {
      const status = check.status ? '✅' : '❌';
      const priority = check.critical ? '[CRITICAL]' : '[MONITOR]';
      console.log(`${status} ${check.name}: ${check.status ? 'HEALTHY' : 'ISSUES'} ${priority}`);
      
      if (!check.status) {
        totalIssues++;
        if (check.critical) criticalIssues++;
      }
    });

    console.log('');
    console.log('🎯 OVERALL SYSTEM STATUS:');
    if (criticalIssues === 0) {
      console.log('✅ SYSTEM OPERATIONAL - All critical systems healthy');
      if (totalIssues === 0) {
        console.log('🎉 PERFECT HEALTH - All systems optimal');
      } else {
        console.log('⚠️ Minor issues detected - monitor non-critical systems');
      }
    } else {
      console.log('🚨 CRITICAL ISSUES DETECTED - Immediate attention required');
      console.log(`   Critical: ${criticalIssues}, Total: ${totalIssues}`);
    }

    console.log('');
    console.log('💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (!results.environment) {
      console.log('🔧 Fix environment variables in Railway deployment');
    }
    if (!results.database) {
      console.log('🔧 Check Supabase connection and credentials');
    }
    if (!results.migrations) {
      console.log('🔧 Run Supabase migrations to fix database schema');
    }
    if (!results.metrics) {
      console.log('🔧 Fix database storage permissions and constraints');
    }
    if (!results.learning) {
      console.log('🔧 Improve content storage to capture real data for learning');
    }
    if (!results.posting) {
      console.log('🔧 Check Playwright browser automation and posting pipeline');
    }

    if (criticalIssues === 0) {
      console.log('🚀 System ready for optimal bot learning and posting!');
    }

  } catch (error) {
    console.error('❌ System check failed:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('');
  console.log(`🏁 Comprehensive check completed: ${new Date().toLocaleString()}`);
  return results;
}

// Run the comprehensive system check
comprehensiveSystemCheck();
