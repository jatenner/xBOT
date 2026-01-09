/**
 * 🧪 MANUAL TEST: Verify AI Judge Code Path
 * Tests the judge call directly to ensure it works
 */

import 'dotenv/config';
import { scoreCandidate } from '../src/jobs/replySystemV2/candidateScorer';

async function testAIJudge() {
  console.log('========================================');
  console.log('MANUAL AI JUDGE TEST');
  console.log('========================================\n');
  
  // Test with a sample tweet that should pass hard filters
  const testTweet = {
    tweetId: 'test_' + Date.now(),
    authorUsername: 'testuser',
    content: 'Just finished a great workout! Zone 2 cardio for 45 minutes. Feeling energized and ready to tackle the day. #fitness #health',
    postedAt: new Date().toISOString(),
    likeCount: 10,
    replyCount: 2,
    retweetCount: 1,
    feedRunId: 'test_feed_' + Date.now()
  };
  
  console.log('Testing with sample tweet:');
  console.log(`  ID: ${testTweet.tweetId}`);
  console.log(`  Author: @${testTweet.authorUsername}`);
  console.log(`  Content: ${testTweet.content.substring(0, 100)}...`);
  console.log(`  Feed Run ID: ${testTweet.feedRunId}\n`);
  
  try {
    console.log('Calling scoreCandidate...');
    const score = await scoreCandidate(
      testTweet.tweetId,
      testTweet.authorUsername,
      testTweet.content,
      testTweet.postedAt,
      testTweet.likeCount,
      testTweet.replyCount,
      testTweet.retweetCount,
      testTweet.feedRunId
    );
    
    console.log('\n✅ Score Result:');
    console.log(`  Passed Hard Filters: ${score.passed_hard_filters}`);
    console.log(`  Filter Reason: ${score.filter_reason}`);
    console.log(`  Topic Relevance: ${score.topic_relevance_score}`);
    console.log(`  Overall Score: ${score.overall_score}`);
    console.log(`  Judge Decision: ${score.judge_decision ? JSON.stringify(score.judge_decision, null, 2) : 'NONE'}`);
    
    if (score.judge_decision) {
      console.log('\n✅ AI JUDGE WAS CALLED SUCCESSFULLY!');
      console.log(`  Decision: ${score.judge_decision.decision}`);
      console.log(`  Relevance: ${score.judge_decision.relevance}`);
      console.log(`  Replyability: ${score.judge_decision.replyability}`);
    } else {
      console.log('\n❌ AI JUDGE WAS NOT CALLED');
      console.log('  This indicates the judge call is failing or not being reached');
    }
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testAIJudge().catch(console.error);

