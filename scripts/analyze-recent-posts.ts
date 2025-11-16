/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type Row = {
  decision_id: string;
  content: string | string[];
  generator_name: string | null;
  topic_cluster: string | null;
  format_strategy: string | null;
  posted_at: string | null;
  actual_impressions: number | null;
  actual_likes: number | null;
  actual_retweets: number | null;
  actual_replies: number | null;
  actual_engagement_rate: number | null;
};

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`${name} is required in environment`);
  }
  return val;
}

async function main() {
  const limit = Number(process.env.POST_LIMIT || process.argv[2] || 40);
  const SUPABASE_URL = getEnv('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('content_metadata')
    .select(
      `
      decision_id,
      decision_type,
      content,
      topic_cluster,
      generator_name,
      format_strategy,
      posted_at,
      actual_impressions,
      actual_likes,
      actual_retweets,
      actual_replies,
      actual_engagement_rate
    `
    )
    .eq('status', 'posted')
    // Focus on standalone root posts, not replies/threads
    .eq('decision_type', 'single')
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('ERROR_QUERY', error.message);
    process.exit(1);
  }

  const rows = (data || []) as Row[];

  // Compute quick stats
  const byGenerator: Record<
    string,
    {
      count: number;
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
      erSum: number;
    }
  > = {};

  const items = rows.map((r) => {
    const generator = r.generator_name || 'unknown';
    byGenerator[generator] ||= {
      count: 0,
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
      erSum: 0,
    };
    const g = byGenerator[generator];
    g.count += 1;
    g.likes += r.actual_likes || 0;
    g.retweets += r.actual_retweets || 0;
    g.replies += r.actual_replies || 0;
    g.impressions += r.actual_impressions || 0;
    g.erSum += r.actual_engagement_rate || 0;

    const preview =
      Array.isArray(r.content)
        ? r.content.join(' | ').slice(0, 220)
        : String(r.content || '').slice(0, 220);

    return {
      decision_id: r.decision_id,
      posted_at: r.posted_at,
      generator: r.generator_name,
      topic_cluster: r.topic_cluster,
      format_strategy: r.format_strategy,
      preview,
      metrics: {
        impressions: r.actual_impressions,
        likes: r.actual_likes,
        retweets: r.actual_retweets,
        replies: r.actual_replies,
        engagement_rate: r.actual_engagement_rate,
      },
    };
  });

  const generatorSummary = Object.entries(byGenerator)
    .map(([name, v]) => {
      const avgER = v.count ? v.erSum / v.count : 0;
      const avgLikes = v.count ? v.likes / v.count : 0;
      const avgImpr = v.count ? v.impressions / v.count : 0;
      return {
        generator: name,
        count: v.count,
        avg_engagement_rate: Number(avgER.toFixed(4)),
        avg_likes: Math.round(avgLikes),
        avg_impressions: Math.round(avgImpr),
      };
    })
    .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate);

  const out = {
    sample_count: items.length,
    by_generator: generatorSummary,
    items,
  };

  // Single line JSON for easy parsing
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error('ERROR_RUNTIME', e?.message || String(e));
  process.exit(1);
});


