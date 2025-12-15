/**
 * Failure Modes Report
 * 
 * Analyzes low-performing content to identify failure patterns
 * READ-ONLY: No mutations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface FailureStats {
  total_failures: number;
  common_topics: Array<{ topic: string; count: number }>;
  common_generators: Array<{ generator: string; count: number }>;
  examples: Array<{
    decision_id: string;
    content: string;
    engagement_rate: number | null;
    followers_gained_weighted: number | null;
    generator_name: string | null;
    topic: string | null;
  }>;
  correlations: {
    low_engagement_generators: string[];
    low_followers_topics: string[];
  };
}

async function generateReport() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('='.repeat(70));
  console.log('FAILURE MODES REPORT');
  console.log('='.repeat(70));
  console.log('');

  // Get posts with engagement_rate < 0.001 OR followers_gained_weighted < 0
  const { data: failures, error: failuresError } = await supabase
    .from('vw_learning')
    .select('decision_id, content, engagement_rate, followers_gained_weighted, generator_name, topic')
    .or('engagement_rate.lt.0.001,followers_gained_weighted.lt.0');

  if (failuresError) {
    console.error('❌ Error fetching failures:', failuresError.message);
    process.exit(1);
  }

  if (!failures || failures.length === 0) {
    console.log('✅ No failure cases found (all posts meet minimum thresholds)');
    process.exit(0);
  }

  // Analyze failures
  const topicCounts: Record<string, number> = {};
  const generatorCounts: Record<string, number> = {};

  failures.forEach((failure: any) => {
    const topic = failure.topic || 'unknown';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;

    const generator = failure.generator_name || 'unknown';
    generatorCounts[generator] = (generatorCounts[generator] || 0) + 1;
  });

  const commonTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  const commonGenerators = Object.entries(generatorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([generator, count]) => ({ generator, count }));

  // Get examples (worst performers)
  const examples = failures
    .map((f: any) => ({
      decision_id: f.decision_id,
      content: (f.content || '').substring(0, 200),
      engagement_rate: f.engagement_rate,
      followers_gained_weighted: f.followers_gained_weighted,
      generator_name: f.generator_name,
      topic: f.topic
    }))
    .sort((a: any, b: any) => {
      const scoreA = a.engagement_rate ?? a.followers_gained_weighted ?? 0;
      const scoreB = b.engagement_rate ?? b.followers_gained_weighted ?? 0;
      return scoreA - scoreB;
    })
    .slice(0, 20);

  // Identify correlations
  const lowEngagementGenerators = Object.entries(generatorCounts)
    .filter(([, count]) => count >= failures.length * 0.1) // Appears in ≥10% of failures
    .map(([generator]) => generator);

  const lowFollowersTopics = Object.entries(topicCounts)
    .filter(([, count]) => count >= failures.length * 0.1) // Appears in ≥10% of failures
    .map(([topic]) => topic);

  // Print summary
  console.log(`Total failures: ${failures.length}`);
  console.log(`(Posts with engagement_rate < 0.001 OR followers_gained_weighted < 0)`);
  console.log('');

  console.log('COMMON TOPICS IN FAILURES:');
  commonTopics.forEach(({ topic, count }) => {
    const pct = ((count / failures.length) * 100).toFixed(1);
    console.log(`  ${topic}: ${count} (${pct}%)`);
  });
  console.log('');

  console.log('COMMON GENERATORS IN FAILURES:');
  commonGenerators.forEach(({ generator, count }) => {
    const pct = ((count / failures.length) * 100).toFixed(1);
    console.log(`  ${generator}: ${count} (${pct}%)`);
  });
  console.log('');

  console.log('CORRELATIONS:');
  console.log(`  Generators with high failure rate: ${lowEngagementGenerators.join(', ') || 'None'}`);
  console.log(`  Topics with high failure rate: ${lowFollowersTopics.join(', ') || 'None'}`);
  console.log('');

  console.log('='.repeat(70));
  console.log('EXAMPLE FAILURES (20 worst):');
  console.log('-'.repeat(70));
  examples.forEach((example, i) => {
    console.log(`\n${i + 1}. [${example.decision_id.substring(0, 8)}...]`);
    console.log(`   Generator: ${example.generator_name || 'N/A'}`);
    console.log(`   Topic: ${example.topic || 'N/A'}`);
    console.log(`   Engagement rate: ${example.engagement_rate?.toFixed(6) || 'N/A'}`);
    console.log(`   Followers gained: ${example.followers_gained_weighted?.toFixed(3) || 'N/A'}`);
    console.log(`   Content: "${example.content}..."`);
  });

  // JSON output
  const stats: FailureStats = {
    total_failures: failures.length,
    common_topics: commonTopics,
    common_generators: commonGenerators,
    examples: examples.slice(0, 10), // Top 10 for JSON
    correlations: {
      low_engagement_generators: lowEngagementGenerators,
      low_followers_topics: lowFollowersTopics
    }
  };

  console.log('\n' + '='.repeat(70));
  console.log('JSON OUTPUT:');
  console.log('-'.repeat(70));
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(70));
}

generateReport().catch((error) => {
  console.error('❌ Report failed:', error.message);
  process.exit(1);
});

