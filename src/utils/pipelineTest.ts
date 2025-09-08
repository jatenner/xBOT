/**
 * 🧪 PIPELINE TEST
 * Test the complete posting -> analytics -> storage pipeline
 */

import { simplifiedPoster as bulletproofPoster } from '../posting/simplifiedBulletproofPoster';
import { followerGrowthEngine } from '../ai/followerGrowthContentEngine';
import { admin as supabase } from '../lib/supabaseClients';

export async function testCompletePipeline(): Promise<{
  success: boolean;
  testResults: Record<string, any>;
  issues: string[];
}> {
  console.log('🧪 PIPELINE_TEST: Testing complete posting pipeline...');
  
  const results: Record<string, any> = {};
  const issues: string[] = [];
  let success = true;

  try {
    // 1. Test Content Generation
    console.log('📝 Testing content generation...');
    
    const contentResult = await followerGrowthEngine.generateFollowerMagnetContent({
      contentGoal: 'viral',
      targetAudience: 'health_conscious'
    });
    
    results.contentGeneration = {
      success: !!contentResult.content,
      contentType: contentResult.contentType,
      contentLength: typeof contentResult.content === 'string' ? 
        contentResult.content.length : 
        (contentResult.content as string[]).join(' ').length,
      viralPotential: contentResult.viralPotential,
      followPotential: contentResult.followPotential
    };

    if (!contentResult.content) {
      success = false;
      issues.push('Content generation failed');
      return { success, testResults: results, issues };
    }

    console.log(`✅ Content: "${typeof contentResult.content === 'string' ? 
      contentResult.content.substring(0, 100) : 
      contentResult.content[0].substring(0, 100)}..."`);

    // 2. Test Database Storage (Pre-posting)
    console.log('💾 Testing pre-posting database storage...');
    
    const testContent = typeof contentResult.content === 'string' ? 
      contentResult.content : contentResult.content[0];

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('follower_growth_content')
        .insert({
          content_type: contentResult.contentType,
          content: testContent,
          predicted_viral: contentResult.viralPotential,
          predicted_follow: contentResult.followPotential,
          format: contentResult.format,
          audience: contentResult.audience
        })
        .select()
        .single();

      if (insertError) {
        success = false;
        issues.push(`Database storage failed: ${insertError.message}`);
        results.databaseStorage = { success: false, error: insertError.message };
      } else if (!insertData) {
        success = false;
        issues.push(`Database storage failed: No data returned from insert`);
        results.databaseStorage = { success: false, error: 'No data returned from insert - table may not exist' };
      } else {
        results.databaseStorage = { 
          success: true, 
          recordId: insertData.id,
          stored: !!insertData
        };
        console.log(`✅ Database: Record ${insertData.id} stored`);
      }
    } catch (dbError) {
      success = false;
      issues.push(`Database error: ${(dbError as Error).message}`);
      results.databaseStorage = { success: false, error: (dbError as Error).message };
    }

    // 3. Test Bulletproof Poster Status (Don't actually post in test)
    console.log('🚀 Testing bulletproof poster readiness...');
    
    try {
      const posterStatus = bulletproofPoster.getStatus();
      const posterHealth = await bulletproofPoster.healthCheck();
      
      results.bulletproofPoster = {
        statusAvailable: !!posterStatus,
        healthCheck: posterHealth,
        ready: posterHealth
      };

      if (!posterHealth) {
        issues.push('Bulletproof poster health check failed');
        // Don't mark as critical failure since it might be environment-specific
      }

      console.log(`✅ Poster: Health = ${posterHealth}, Status available = ${!!posterStatus}`);
      
    } catch (posterError) {
      issues.push(`Poster error: ${(posterError as Error).message}`);
      results.bulletproofPoster = { 
        success: false, 
        error: (posterError as Error).message 
      };
    }

    // 4. Test Analytics Table Structure
    console.log('📊 Testing analytics table structure...');
    
    try {
      const { data: analyticsTest, error: analyticsError } = await supabase
        .from('tweet_analytics')
        .select('*')
        .limit(1);

      results.analyticsTable = {
        accessible: !analyticsError,
        hasData: !!(analyticsTest && analyticsTest.length > 0),
        error: analyticsError?.message || null
      };

      if (analyticsError) {
        issues.push(`Analytics table error: ${analyticsError.message}`);
      } else {
        console.log(`✅ Analytics: Table accessible, ${analyticsTest?.length || 0} records sampled`);
      }
    } catch (analyticsError) {
      issues.push(`Analytics test failed: ${(analyticsError as Error).message}`);
      results.analyticsTable = { success: false, error: (analyticsError as Error).message };
    }

    // 5. Test Learning Posts Table
    console.log('📚 Testing learning posts table...');
    
    try {
      const { data: learningTest, error: learningError } = await supabase
        .from('learning_posts')
        .select('*')
        .limit(1);

      results.learningTable = {
        accessible: !learningError,
        hasData: !!(learningTest && learningTest.length > 0),
        error: learningError?.message || null
      };

      if (learningError) {
        issues.push(`Learning table error: ${learningError.message}`);
      } else {
        console.log(`✅ Learning: Table accessible, ${learningTest?.length || 0} records sampled`);
      }
    } catch (learningError) {
      issues.push(`Learning test failed: ${(learningError as Error).message}`);
      results.learningTable = { success: false, error: (learningError as Error).message };
    }

    // 6. Summary
    console.log('\n📊 PIPELINE TEST SUMMARY');
    console.log('========================');

    if (success && issues.length === 0) {
      console.log('✅ PIPELINE: All tests passed - ready for autonomous operation');
    } else if (issues.length > 0) {
      console.log(`⚠️ PIPELINE: ${issues.length} issues found`);
      issues.forEach(issue => console.log(`   - ${issue}`));
      
      if (success) {
        console.log('🟡 PIPELINE: Core functionality intact despite issues');
      } else {
        console.log('❌ PIPELINE: Critical issues prevent operation');
      }
    }

    return { success, testResults: results, issues };

  } catch (error) {
    console.error('❌ PIPELINE_TEST: Test failed:', error);
    issues.push(`Test execution failed: ${(error as Error).message}`);
    return { success: false, testResults: results, issues };
  }
}
