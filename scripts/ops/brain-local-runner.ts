/**
 * Brain Local Runner
 *
 * Runs ONLY the brain feeds locally for testing.
 * No posting, no replies, no content generation — just scraping + classification + learning.
 *
 * Usage: npx tsx scripts/ops/brain-local-runner.ts
 * Ctrl+C to stop.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Load twitter session from file if not in env
if (!process.env.TWITTER_SESSION_B64) {
  const sessionPath = path.join(process.cwd(), 'twitter_session.b64');
  if (fs.existsSync(sessionPath)) {
    process.env.TWITTER_SESSION_B64 = fs.readFileSync(sessionPath, 'utf-8').trim();
    console.log('📱 Loaded Twitter session from twitter_session.b64');
  } else {
    console.warn('⚠️ No twitter_session.b64 found — browser will be unauthenticated');
  }
}

const MINUTE = 60 * 1000;

// Track stats
const stats = {
  startedAt: new Date(),
  cycles: 0,
  totalTweets: 0,
  totalAccounts: 0,
  totalClassified: 0,
  totalRescraped: 0,
  totalDeepAnalyzed: 0,
  totalFeedback: 0,
  errors: 0,
};

function elapsed(): string {
  const mins = Math.round((Date.now() - stats.startedAt.getTime()) / 60000);
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`;
}

function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log(`🧠 BRAIN STATUS — ${elapsed()} elapsed, ${stats.cycles} cycles`);
  console.log(`   Tweets ingested: ${stats.totalTweets}`);
  console.log(`   Accounts discovered: ${stats.totalAccounts}`);
  console.log(`   Classified (Stage 2): ${stats.totalClassified}`);
  console.log(`   Rescraped (Stage 3): ${stats.totalRescraped}`);
  console.log(`   Deep analyzed (Stage 4): ${stats.totalDeepAnalyzed}`);
  console.log(`   Feedback events: ${stats.totalFeedback}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('='.repeat(60) + '\n');
}

async function safeRun(name: string, fn: () => Promise<any>): Promise<any> {
  try {
    const start = Date.now();
    const result = await fn();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ✅ ${name} (${duration}s)`);
    return result;
  } catch (err: any) {
    console.error(`  ❌ ${name}: ${err.message}`);
    stats.errors++;
    return null;
  }
}

async function runDiscoveryCycle() {
  console.log(`\n--- DISCOVERY CYCLE ${stats.cycles + 1} (${elapsed()}) ---`);

  // 1. Trending scraper
  const trending = await safeRun('Trending scraper', async () => {
    const { runTrendingScraper } = await import('../../src/brain/feeds/trendingScraper');
    return runTrendingScraper();
  });
  if (trending) stats.totalTweets += trending.tweets_ingested;

  // 2. Keyword searcher
  const keywords = await safeRun('Keyword searcher', async () => {
    const { runBroadKeywordSearcher } = await import('../../src/brain/feeds/broadKeywordSearcher');
    return runBroadKeywordSearcher();
  });
  if (keywords) stats.totalTweets += keywords.tweets_ingested;

  // 3. Viral hunter
  const viral = await safeRun('Viral hunter', async () => {
    const { runViralHunter } = await import('../../src/brain/feeds/viralHunter');
    return runViralHunter();
  });
  if (viral) stats.totalTweets += viral.tweets_ingested;

  // 4. Account timeline scraper
  const timelines = await safeRun('Timeline scraper', async () => {
    const { runAccountTimelineScraper } = await import('../../src/brain/feeds/accountTimelineScraper');
    return runAccountTimelineScraper();
  });
  if (timelines) stats.totalTweets += timelines.tweets_ingested;

  // 5. For You scraper
  const foryou = await safeRun('For You scraper', async () => {
    const { runForYouScraper } = await import('../../src/brain/feeds/forYouScraper');
    return runForYouScraper();
  });
  if (foryou) stats.totalTweets += foryou.tweets_ingested;

  stats.cycles++;
}

async function runClassificationCycle() {
  console.log(`\n--- CLASSIFICATION (${elapsed()}) ---`);

  // Stage 2: AI classification (will fail gracefully if OpenAI is unfunded)
  const stage2 = await safeRun('Stage 2 AI classify', async () => {
    const { runStage2Classification } = await import('../../src/brain/classificationEngine');
    return runStage2Classification();
  });
  if (stage2) stats.totalClassified += stage2.classified;

  // Stage 3: Re-scrape for trajectory
  const stage3 = await safeRun('Stage 3 rescrape', async () => {
    const { runStage3Rescrape } = await import('../../src/brain/classificationEngine');
    return runStage3Rescrape();
  });
  if (stage3) stats.totalRescraped += stage3.rescraped;

  // Stage 4: Deep analysis (only if viral tweets exist)
  const stage4 = await safeRun('Stage 4 deep analysis', async () => {
    const { runStage4DeepAnalysis } = await import('../../src/brain/classificationEngine');
    return runStage4DeepAnalysis();
  });
  if (stage4) stats.totalDeepAnalyzed += stage4.analyzed;
}

async function runLearningCycle() {
  console.log(`\n--- LEARNING (${elapsed()}) ---`);

  // Account discovery
  const discovery = await safeRun('Account discovery', async () => {
    const { runAccountDiscovery } = await import('../../src/brain/accountDiscoveryEngine');
    return runAccountDiscovery();
  });
  if (discovery) stats.totalAccounts += discovery.accounts_discovered;

  // Keyword pool management
  await safeRun('Keyword pool', async () => {
    const { runKeywordPoolManagement } = await import('../../src/brain/keywordPool');
    return runKeywordPoolManagement();
  });

  // Self-model update
  await safeRun('Self-model update', async () => {
    const { runSelfModelUpdate } = await import('../../src/brain/selfModel');
    return runSelfModelUpdate();
  });

  // Feedback loop
  const feedback = await safeRun('Feedback loop', async () => {
    const { runFeedbackLoop } = await import('../../src/brain/feedbackLoop');
    return runFeedbackLoop();
  });
  if (feedback) stats.totalFeedback += feedback.events_created;
}

async function runFullDBStatus() {
  console.log(`\n--- DB STATUS (${elapsed()}) ---`);
  try {
    const { getSupabaseClient } = await import('../../src/db');
    const s = getSupabaseClient();

    const [tweets, accounts, keywords, classifications, snapshots, feedback] = await Promise.all([
      s.from('brain_tweets').select('id', { count: 'exact', head: true }),
      s.from('brain_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      s.from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', true),
      s.from('brain_classifications').select('id', { count: 'exact', head: true }),
      s.from('brain_tweet_snapshots').select('id', { count: 'exact', head: true }),
      s.from('feedback_events').select('id', { count: 'exact', head: true }),
    ]);

    console.log(`  📊 brain_tweets: ${tweets.count ?? 0}`);
    console.log(`  👥 brain_accounts: ${accounts.count ?? 0}`);
    console.log(`  🔑 brain_keywords: ${keywords.count ?? 0}`);
    console.log(`  🏷️  brain_classifications: ${classifications.count ?? 0}`);
    console.log(`  📈 brain_tweet_snapshots: ${snapshots.count ?? 0}`);
    console.log(`  📝 feedback_events: ${feedback.count ?? 0}`);

    // Top sources
    const { data: sources } = await s
      .from('brain_tweets')
      .select('discovery_source')
      .limit(5000);

    if (sources && sources.length > 0) {
      const sc: Record<string, number> = {};
      for (const t of sources) sc[t.discovery_source] = (sc[t.discovery_source] ?? 0) + 1;
      const sorted = Object.entries(sc).sort((a, b) => b[1] - a[1]);
      console.log('  Sources:', sorted.map(([s, c]) => `${s}:${c}`).join(' | '));
    }

    // Top engagement tweets
    const { data: topTweets } = await s
      .from('brain_tweets')
      .select('tweet_id, author_username, likes, content')
      .order('likes', { ascending: false })
      .limit(3);

    if (topTweets && topTweets.length > 0) {
      console.log('  🏆 Top tweets:');
      for (const t of topTweets) {
        console.log(`     @${t.author_username} (${t.likes} likes): "${(t.content || '').substring(0, 60)}..."`);
      }
    }
  } catch (e: any) {
    console.error(`  DB status error: ${e.message}`);
  }
}

// =============================================================================
// Main loop
// =============================================================================

async function main() {
  console.log('🧠 BRAIN LOCAL RUNNER — Starting 3-hour test run');
  console.log('   Press Ctrl+C to stop\n');
  console.log('   Schedule:');
  console.log('   - Discovery: every 10 min (5 feeds)');
  console.log('   - Classification: every 15 min (3 stages)');
  console.log('   - Learning: every 30 min (discovery + keyword + self-model + feedback)');
  console.log('   - Full status: every 30 min');
  console.log('');

  // Run first cycle immediately
  await runDiscoveryCycle();
  await runClassificationCycle();
  await runLearningCycle();
  await runFullDBStatus();
  printStats();

  // Schedule recurring cycles
  const discoveryInterval = setInterval(async () => {
    await runDiscoveryCycle();
    printStats();
  }, 10 * MINUTE);

  const classifyInterval = setInterval(async () => {
    await runClassificationCycle();
  }, 15 * MINUTE);

  const learningInterval = setInterval(async () => {
    await runLearningCycle();
    await runFullDBStatus();
  }, 30 * MINUTE);

  // Tiering once per run (not every 30 min)
  setTimeout(async () => {
    console.log('\n--- ACCOUNT TIERING ---');
    await safeRun('Account tiering', async () => {
      const { runAccountTiering } = await import('../../src/brain/accountTiering');
      return runAccountTiering();
    });
  }, 60 * MINUTE); // After 1 hour

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down brain runner...');
    clearInterval(discoveryInterval);
    clearInterval(classifyInterval);
    clearInterval(learningInterval);
    printStats();
    runFullDBStatus().then(() => {
      console.log('\n👋 Brain runner stopped. All data saved to Supabase.');
      process.exit(0);
    });
  });

  // Keep alive for 3 hours
  console.log('\n⏰ Running for 3 hours. Ctrl+C to stop early.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
