import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Hard timeout guard: Force exit after 30 seconds
const TIMEOUT_MS = 30000;
const timeoutGuard = setTimeout(() => {
  console.error('\n❌ TIMEOUT: quick-check exceeded 30 seconds');
  console.error('DONE quick-check (exit=1)');
  process.exit(1);
}, TIMEOUT_MS);

// Ensure timeout is cleared if script exits normally
process.on('exit', () => {
  clearTimeout(timeoutGuard);
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCheck(): Promise<number> {
  console.log('START quick-check');
  console.log('─'.repeat(60));
  
  let exitCode = 0;
  
  try {
    // CHECK 1: Recent posts
    console.log('\nCHECK 1: Recent posts in database');
    try {
      const { data: posts, error } = await Promise.race([
        supabase
          .from('content_metadata')
          .select('tweet_id, decision_type, posted_at, status')
          .eq('status', 'posted')
          .order('posted_at', { ascending: false })
          .limit(5),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);

      if (error) {
        console.log(`CHECK 1: FAIL - ${error.message}`);
        exitCode = 1;
      } else if (!posts || posts.length === 0) {
        console.log('CHECK 1: FAIL - NO POSTS FOUND IN DATABASE');
        console.log('⚠️  This means tweets are posting but not saving to database!');
        exitCode = 1;
      } else {
        console.log(`CHECK 1: PASS - Found ${posts.length} recent posts`);
        posts.forEach((p, i) => {
          const postedTime = new Date(p.posted_at);
          const minutesAgo = Math.round((Date.now() - postedTime.getTime()) / 60000);
          console.log(`  ${i+1}. ${p.tweet_id} | ${p.decision_type} | ${minutesAgo}m ago`);
        });
      }
    } catch (checkError: any) {
      console.log(`CHECK 1: FAIL - ${checkError.message}`);
      exitCode = 1;
    }

    // CHECK 2: Queue status
    console.log('\nCHECK 2: Queue status');
    try {
      const { data: queue, error: queueError } = await Promise.race([
        supabase
          .from('content_metadata')
          .select('decision_id, decision_type, status, scheduled_at')
          .eq('status', 'queued')
          .order('scheduled_at', { ascending: true })
          .limit(3),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);

      if (queueError) {
        console.log(`CHECK 2: FAIL - ${queueError.message}`);
        exitCode = 1;
      } else {
        console.log(`CHECK 2: PASS - ${queue?.length || 0} items in queue`);
        queue?.forEach((q, i) => {
          const scheduledTime = new Date(q.scheduled_at);
          const minutesUntil = Math.round((scheduledTime.getTime() - Date.now()) / 60000);
          console.log(`  ${i+1}. ${q.decision_type} in ${minutesUntil} min`);
        });
      }
    } catch (checkError: any) {
      console.log(`CHECK 2: FAIL - ${checkError.message}`);
      exitCode = 1;
    }

    // CHECK 3: Rate limit compliance
    console.log('\nCHECK 3: Rate limit compliance (last hour)');
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentPosts, error: rateError } = await Promise.race([
        supabase
          .from('content_metadata')
          .select('tweet_id, posted_at, decision_type', { count: 'exact' })
          .eq('status', 'posted')
          .gte('posted_at', oneHourAgo),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 10000)
        )
      ]);

      if (rateError) {
        console.log(`CHECK 3: FAIL - ${rateError.message}`);
        exitCode = 1;
      } else {
        const postCount = recentPosts?.length || 0;
        const MAX_POSTS_PER_HOUR = 2;
        
        if (postCount > MAX_POSTS_PER_HOUR) {
          console.log(`CHECK 3: FAIL - ${postCount} posts in last hour (limit: ${MAX_POSTS_PER_HOUR})`);
          console.log('⚠️  RATE LIMIT VIOLATION DETECTED!');
          exitCode = 1;
        } else {
          console.log(`CHECK 3: PASS - ${postCount}/${MAX_POSTS_PER_HOUR} posts in last hour`);
        }
      }
    } catch (checkError: any) {
      console.log(`CHECK 3: FAIL - ${checkError.message}`);
      exitCode = 1;
    }

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    exitCode = 1;
  }

  return exitCode;
}

// Main execution with proper cleanup and exit handling
async function main() {
  let exitCode = 1; // Default to failure
  
  try {
    exitCode = await Promise.race([
      quickCheck(),
      new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error('Overall timeout')), 28000) // 28s, leaving 2s for cleanup
      )
    ]);
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    exitCode = 1;
  } finally {
    // Cleanup: Clear timeout guard
    clearTimeout(timeoutGuard);
    
    // Print final status
    console.log('\n' + '─'.repeat(60));
    if (exitCode === 0) {
      console.log('✅ ALL CHECKS PASSED');
    } else {
      console.log('❌ SOME CHECKS FAILED');
    }
    console.log(`DONE quick-check (exit=${exitCode})`);
    
    // Force exit (Supabase client keeps connections open)
    process.exit(exitCode);
  }
}

// Run main and handle any uncaught errors
main().catch((error) => {
  console.error('\n❌ UNCAUGHT ERROR:', error.message);
  console.error('DONE quick-check (exit=1)');
  process.exit(1);
});
