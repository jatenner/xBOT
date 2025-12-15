/**
 * Generator Performance Report
 * 
 * Analyzes performance metrics by generator_name
 * READ-ONLY: No mutations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface GeneratorStats {
  generator_name: string;
  uses: number;
  avg_followers_gained_weighted: number | null;
  avg_engagement_rate: number | null;
  avg_primary_objective_score: number | null;
  top_posts: Array<{
    decision_id: string;
    content: string;
    followers_gained_weighted: number | null;
    primary_objective_score: number | null;
    engagement_rate: number | null;
  }>;
  worst_posts: Array<{
    decision_id: string;
    content: string;
    followers_gained_weighted: number | null;
    primary_objective_score: number | null;
    engagement_rate: number | null;
  }>;
}

async function generateReport() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('='.repeat(70));
  console.log('GENERATOR PERFORMANCE REPORT');
  console.log('='.repeat(70));
  console.log('');

  // Get all content with generator_name and join vw_learning for metrics
  const { data: learningData, error: learningError } = await supabase
    .from('vw_learning')
    .select('decision_id, generator_name, content, followers_gained_weighted, primary_objective_score, engagement_rate')
    .not('generator_name', 'is', null)
    .not('generator_name', 'eq', '');

  if (learningError) {
    console.error('❌ Error fetching vw_learning:', learningError.message);
    process.exit(1);
  }

  if (!learningData || learningData.length === 0) {
    console.log('⚠️  No data found in vw_learning');
    process.exit(0);
  }

  // Group by generator_name
  const generatorMap = new Map<string, GeneratorStats>();

  learningData.forEach((row: any) => {
    const genName = row.generator_name || 'unknown';
    
    if (!generatorMap.has(genName)) {
      generatorMap.set(genName, {
        generator_name: genName,
        uses: 0,
        avg_followers_gained_weighted: null,
        avg_engagement_rate: null,
        avg_primary_objective_score: null,
        top_posts: [],
        worst_posts: []
      });
    }

    const stats = generatorMap.get(genName)!;
    stats.uses++;
  });

  // Calculate averages and collect posts for each generator
  generatorMap.forEach((stats, genName) => {
    const genRows = learningData.filter((r: any) => r.generator_name === genName);
    
    // Calculate averages
    const followersValues = genRows
      .map((r: any) => r.followers_gained_weighted)
      .filter((v: any) => v !== null && v !== undefined);
    stats.avg_followers_gained_weighted = followersValues.length > 0
      ? followersValues.reduce((sum: number, v: number) => sum + v, 0) / followersValues.length
      : null;

    const engagementValues = genRows
      .map((r: any) => r.engagement_rate)
      .filter((v: any) => v !== null && v !== undefined);
    stats.avg_engagement_rate = engagementValues.length > 0
      ? engagementValues.reduce((sum: number, v: number) => sum + v, 0) / engagementValues.length
      : null;

    const scoreValues = genRows
      .map((r: any) => r.primary_objective_score)
      .filter((v: any) => v !== null && v !== undefined);
    stats.avg_primary_objective_score = scoreValues.length > 0
      ? scoreValues.reduce((sum: number, v: number) => sum + v, 0) / scoreValues.length
      : null;

    // Get top 3 posts (by primary_objective_score, then followers_gained_weighted)
    const sortedTop = [...genRows]
      .filter((r: any) => r.primary_objective_score !== null || r.followers_gained_weighted !== null)
      .sort((a: any, b: any) => {
        const scoreA = a.primary_objective_score ?? a.followers_gained_weighted ?? 0;
        const scoreB = b.primary_objective_score ?? b.followers_gained_weighted ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, 3)
      .map((r: any) => ({
        decision_id: r.decision_id,
        content: (r.content || '').substring(0, 200),
        followers_gained_weighted: r.followers_gained_weighted,
        primary_objective_score: r.primary_objective_score,
        engagement_rate: r.engagement_rate
      }));

    stats.top_posts = sortedTop;

    // Get worst 3 posts
    const sortedWorst = [...genRows]
      .filter((r: any) => r.primary_objective_score !== null || r.followers_gained_weighted !== null)
      .sort((a: any, b: any) => {
        const scoreA = a.primary_objective_score ?? a.followers_gained_weighted ?? 0;
        const scoreB = b.primary_objective_score ?? b.followers_gained_weighted ?? 0;
        return scoreA - scoreB;
      })
      .slice(0, 3)
      .map((r: any) => ({
        decision_id: r.decision_id,
        content: (r.content || '').substring(0, 200),
        followers_gained_weighted: r.followers_gained_weighted,
        primary_objective_score: r.primary_objective_score,
        engagement_rate: r.engagement_rate
      }));

    stats.worst_posts = sortedWorst;
  });

  // Print text summary
  console.log('TEXT SUMMARY:');
  console.log('-'.repeat(70));
  
  const sortedGenerators = Array.from(generatorMap.values())
    .sort((a, b) => b.uses - a.uses);

  sortedGenerators.forEach((stats) => {
    console.log(`\n[${stats.generator_name}]`);
    console.log(`  Uses: ${stats.uses}`);
    console.log(`  Avg followers_gained_weighted: ${stats.avg_followers_gained_weighted?.toFixed(3) || 'N/A'}`);
    console.log(`  Avg engagement_rate: ${stats.avg_engagement_rate?.toFixed(4) || 'N/A'}`);
    console.log(`  Avg primary_objective_score: ${stats.avg_primary_objective_score?.toFixed(4) || 'N/A'}`);
    
    if (stats.top_posts.length > 0) {
      console.log(`  Top post: score=${stats.top_posts[0].primary_objective_score?.toFixed(4) || stats.top_posts[0].followers_gained_weighted?.toFixed(3) || 'N/A'}`);
      console.log(`    "${stats.top_posts[0].content}..."`);
    }
    
    if (stats.worst_posts.length > 0) {
      console.log(`  Worst post: score=${stats.worst_posts[0].primary_objective_score?.toFixed(4) || stats.worst_posts[0].followers_gained_weighted?.toFixed(3) || 'N/A'}`);
      console.log(`    "${stats.worst_posts[0].content}..."`);
    }
  });

  // Print JSON
  console.log('\n' + '='.repeat(70));
  console.log('JSON OUTPUT:');
  console.log('-'.repeat(70));
  console.log(JSON.stringify(sortedGenerators, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(70));
}

generateReport().catch((error) => {
  console.error('❌ Report failed:', error.message);
  process.exit(1);
});

