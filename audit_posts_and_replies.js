/**
 * 🔍 COMPREHENSIVE CONTENT AUDIT
 * Analyze actual posts and replies for quality, patterns, and improvement opportunities
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function auditPostsAndReplies() {
  console.log('🔍 COMPREHENSIVE CONTENT AUDIT');
  console.log('===============================\n');

  try {
    // Get recent posts from database
    console.log('📊 FETCHING RECENT POSTS...');
    const { data: posts, error: postsError } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (postsError) {
      console.error('❌ Error fetching posts:', postsError.message);
      return;
    }

    console.log(`✅ Found ${posts?.length || 0} recent posts\n`);

    // Analyze posts
    if (posts && posts.length > 0) {
      console.log('📝 POST ANALYSIS');
      console.log('================');
      
      const postAnalysis = {
        total: posts.length,
        withHashtags: 0,
        withQuotes: 0,
        withEllipses: 0,
        incomplete: 0,
        repetitiveOpenings: {},
        commonTopics: {},
        averageLength: 0,
        qualityIssues: [],
        goodExamples: [],
        badExamples: []
      };

      let totalLength = 0;

      posts.forEach((post, index) => {
        const content = post.content || post.text || '';
        totalLength += content.length;

        // Check for quality issues
        const issues = [];
        
        if (content.includes('#')) {
          postAnalysis.withHashtags++;
          issues.push('Contains hashtags');
        }
        
        if (content.includes('"') || content.includes("'")) {
          postAnalysis.withQuotes++;
          issues.push('Contains quotes');
        }
        
        if (content.includes('...')) {
          postAnalysis.withEllipses++;
          issues.push('Contains ellipses');
        }
        
        if (!content.match(/[.!?]$/) || content.includes('nigh ') || content.includes(' th ')) {
          postAnalysis.incomplete++;
          issues.push('Incomplete or has typos');
        }

        // Track openings (first 30 chars)
        const opening = content.substring(0, 30);
        postAnalysis.repetitiveOpenings[opening] = (postAnalysis.repetitiveOpenings[opening] || 0) + 1;

        // Extract topics
        const healthTopics = ['sleep', 'vitamin', 'supplement', 'exercise', 'nutrition', 'stress', 'magnesium', 'protein', 'gut', 'hormone'];
        healthTopics.forEach(topic => {
          if (content.toLowerCase().includes(topic)) {
            postAnalysis.commonTopics[topic] = (postAnalysis.commonTopics[topic] || 0) + 1;
          }
        });

        // Categorize quality
        if (issues.length === 0 && content.length >= 180 && content.length <= 280) {
          postAnalysis.goodExamples.push({
            index: index + 1,
            content: content.substring(0, 100) + '...',
            length: content.length,
            created: post.created_at
          });
        } else if (issues.length > 0) {
          postAnalysis.badExamples.push({
            index: index + 1,
            content: content.substring(0, 100) + '...',
            issues,
            length: content.length,
            created: post.created_at
          });
        }

        console.log(`${index + 1}. [${content.length} chars] ${content.substring(0, 120)}${content.length > 120 ? '...' : ''}`);
        if (issues.length > 0) {
          console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
        }
        console.log(`   📅 Posted: ${new Date(post.created_at).toLocaleDateString()}`);
        console.log('');
      });

      postAnalysis.averageLength = Math.round(totalLength / posts.length);

      // Summary
      console.log('\n📊 POST QUALITY SUMMARY');
      console.log('=======================');
      console.log(`Total Posts Analyzed: ${postAnalysis.total}`);
      console.log(`Average Length: ${postAnalysis.averageLength} characters`);
      console.log(`With Hashtags: ${postAnalysis.withHashtags} (${((postAnalysis.withHashtags/postAnalysis.total)*100).toFixed(1)}%)`);
      console.log(`With Quotes: ${postAnalysis.withQuotes} (${((postAnalysis.withQuotes/postAnalysis.total)*100).toFixed(1)}%)`);
      console.log(`With Ellipses: ${postAnalysis.withEllipses} (${((postAnalysis.withEllipses/postAnalysis.total)*100).toFixed(1)}%)`);
      console.log(`Incomplete/Typos: ${postAnalysis.incomplete} (${((postAnalysis.incomplete/postAnalysis.total)*100).toFixed(1)}%)`);

      // Repetitive openings
      console.log('\n🔄 REPETITIVE OPENINGS');
      console.log('======================');
      Object.entries(postAnalysis.repetitiveOpenings)
        .filter(([opening, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([opening, count]) => {
          console.log(`"${opening}..." used ${count} times`);
        });

      // Common topics
      console.log('\n📋 MOST COMMON TOPICS');
      console.log('=====================');
      Object.entries(postAnalysis.commonTopics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([topic, count]) => {
          console.log(`${topic}: ${count} posts`);
        });

      // Good examples
      if (postAnalysis.goodExamples.length > 0) {
        console.log('\n✅ GOOD EXAMPLES');
        console.log('================');
        postAnalysis.goodExamples.slice(0, 3).forEach(example => {
          console.log(`${example.index}. ${example.content} (${example.length} chars)`);
        });
      }

      // Bad examples
      if (postAnalysis.badExamples.length > 0) {
        console.log('\n❌ PROBLEMATIC EXAMPLES');
        console.log('=======================');
        postAnalysis.badExamples.slice(0, 5).forEach(example => {
          console.log(`${example.index}. ${example.content} (${example.length} chars)`);
          console.log(`   Issues: ${example.issues.join(', ')}`);
        });
      }
    }

    // Check for replies/engagement
    console.log('\n💬 REPLY ANALYSIS');
    console.log('=================');
    
    const { data: replies, error: repliesError } = await supabase
      .from('strategic_replies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (repliesError) {
      console.log('⚠️  No reply data found or error:', repliesError.message);
    } else if (replies && replies.length > 0) {
      console.log(`✅ Found ${replies.length} recent replies\n`);
      
      replies.forEach((reply, index) => {
        const content = reply.content || reply.reply_text || '';
        console.log(`${index + 1}. ${content}`);
        console.log(`   Strategy: ${reply.strategy || 'unknown'}`);
        console.log(`   Target: ${reply.parent_tweet_id || 'unknown'}`);
        console.log('');
      });
    } else {
      console.log('📭 No recent replies found');
    }

    // Check learning posts table for AI-generated content
    console.log('\n🤖 AI CONTENT ANALYSIS');
    console.log('======================');
    
    const { data: learningPosts, error: learningError } = await supabase
      .from('learning_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (learningError) {
      console.log('⚠️  Error fetching learning posts:', learningError.message);
    } else if (learningPosts && learningPosts.length > 0) {
      console.log(`✅ Found ${learningPosts.length} AI-generated posts\n`);
      
      const aiAnalysis = {
        total: learningPosts.length,
        byType: {},
        avgViralScore: 0,
        avgEngagement: 0,
        contentPatterns: {}
      };

      let totalViralScore = 0;
      let totalEngagement = 0;

      learningPosts.forEach((post, index) => {
        const content = post.content || '';
        const type = post.content_type || 'unknown';
        const viralScore = post.viral_score || 0;
        const engagement = post.engagement_rate || 0;

        aiAnalysis.byType[type] = (aiAnalysis.byType[type] || 0) + 1;
        totalViralScore += viralScore;
        totalEngagement += engagement;

        // Check for AI patterns
        if (content.toLowerCase().includes('think')) {
          aiAnalysis.contentPatterns['think_pattern'] = (aiAnalysis.contentPatterns['think_pattern'] || 0) + 1;
        }
        if (content.toLowerCase().includes('new study') || content.toLowerCase().includes('research')) {
          aiAnalysis.contentPatterns['research_pattern'] = (aiAnalysis.contentPatterns['research_pattern'] || 0) + 1;
        }
        if (content.toLowerCase().includes('here\'s') || content.toLowerCase().includes('here is')) {
          aiAnalysis.contentPatterns['heres_pattern'] = (aiAnalysis.contentPatterns['heres_pattern'] || 0) + 1;
        }

        console.log(`${index + 1}. [${type}] ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
        console.log(`   Viral Score: ${viralScore}/100 | Engagement: ${(engagement * 100).toFixed(2)}%`);
        console.log('');
      });

      aiAnalysis.avgViralScore = Math.round(totalViralScore / aiAnalysis.total);
      aiAnalysis.avgEngagement = totalEngagement / aiAnalysis.total;

      console.log('📊 AI CONTENT SUMMARY');
      console.log('=====================');
      console.log(`Average Viral Score: ${aiAnalysis.avgViralScore}/100`);
      console.log(`Average Engagement: ${(aiAnalysis.avgEngagement * 100).toFixed(2)}%`);
      console.log('\nContent Types:');
      Object.entries(aiAnalysis.byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} posts`);
      });
      console.log('\nContent Patterns:');
      Object.entries(aiAnalysis.contentPatterns).forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count} occurrences`);
      });
    } else {
      console.log('📭 No AI-generated content found in learning_posts table');
    }

    // IMPROVEMENT RECOMMENDATIONS
    console.log('\n🚀 IMPROVEMENT RECOMMENDATIONS');
    console.log('==============================');
    
    const recommendations = [];

    if (postAnalysis.withHashtags > 0) {
      recommendations.push(`❌ CRITICAL: Remove hashtags from ${postAnalysis.withHashtags} posts - they reduce engagement`);
    }
    
    if (postAnalysis.withQuotes > 0) {
      recommendations.push(`❌ CRITICAL: Remove quotation marks from ${postAnalysis.withQuotes} posts - makes content look fake`);
    }
    
    if (postAnalysis.withEllipses > 0) {
      recommendations.push(`⚠️  Remove ellipses from ${postAnalysis.withEllipses} posts - complete sentences perform better`);
    }

    if (postAnalysis.incomplete > 0) {
      recommendations.push(`❌ CRITICAL: Fix ${postAnalysis.incomplete} incomplete posts with typos or grammar issues`);
    }

    // Check for repetition
    const repetitiveCount = Object.values(postAnalysis.repetitiveOpenings).filter(count => count > 1).length;
    if (repetitiveCount > 0) {
      recommendations.push(`🔄 MEDIUM: Reduce repetitive openings - ${repetitiveCount} patterns repeated multiple times`);
    }

    // Check topic diversity
    const topTopics = Object.entries(postAnalysis.commonTopics).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (topTopics.length > 0 && topTopics[0][1] > postAnalysis.total * 0.3) {
      recommendations.push(`📋 MEDIUM: Over-focusing on "${topTopics[0][0]}" (${topTopics[0][1]} posts) - diversify topics`);
    }

    // Check length distribution
    if (postAnalysis.averageLength < 200) {
      recommendations.push(`📏 LOW: Average post length is ${postAnalysis.averageLength} chars - consider longer, more substantial content`);
    } else if (postAnalysis.averageLength > 270) {
      recommendations.push(`📏 LOW: Average post length is ${postAnalysis.averageLength} chars - some posts may be too long for optimal engagement`);
    }

    if (recommendations.length === 0) {
      console.log('✅ Content quality looks good! No major issues detected.');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('\n🎯 PRIORITY ACTIONS');
    console.log('==================');
    console.log('1. 🛡️  Deploy bulletproof prompt system (already done) to enforce validation');
    console.log('2. 🔄 Enable anti-repetition system to prevent duplicate openings');
    console.log('3. 📊 Monitor engagement metrics for each prompt configuration');
    console.log('4. 🎭 Rotate personas and emotional frameworks more frequently');
    console.log('5. 📈 Use Thompson Sampling bandit to optimize based on real performance');

  } catch (error) {
    console.error('💥 AUDIT_FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the audit
if (require.main === module) {
  auditPostsAndReplies().catch(console.error);
}

module.exports = { auditPostsAndReplies };
