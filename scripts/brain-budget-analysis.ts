#!/usr/bin/env tsx
/**
 * Brain Budget Analysis — where is the $6/day going?
 *
 * Queries api_usage for the last 24h, groups by purpose + model,
 * shows cost share and calls per purpose so we can see whether Stage 2
 * classification is actually the dominant cost or something else is.
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const sinceHours = Number(process.argv[2] ?? 24);
  const sinceIso = new Date(Date.now() - sinceHours * 3600_000).toISOString();

  const { rows: byPurpose } = await client.query(
    `SELECT
        intent,
        model,
        COUNT(*) AS calls,
        SUM(cost_usd) AS total_cost,
        SUM(prompt_tokens) AS prompt_tokens,
        SUM(completion_tokens) AS completion_tokens,
        ROUND(AVG(cost_usd)::numeric, 6) AS avg_cost_per_call,
        ROUND(AVG(prompt_tokens)::numeric, 0) AS avg_prompt_tokens,
        ROUND(AVG(completion_tokens)::numeric, 0) AS avg_completion_tokens
     FROM api_usage
     WHERE created_at >= $1
     GROUP BY intent, model
     ORDER BY total_cost DESC`,
    [sinceIso],
  );

  const { rows: totals } = await client.query(
    `SELECT
        COUNT(*) AS calls,
        SUM(cost_usd) AS total_cost,
        SUM(prompt_tokens) AS prompt_tokens,
        SUM(completion_tokens) AS completion_tokens
     FROM api_usage
     WHERE created_at >= $1`,
    [sinceIso],
  );

  const total = Number(totals[0]?.total_cost ?? 0);
  console.log(`\n── Budget spend last ${sinceHours}h ──`);
  console.log(`Total: $${total.toFixed(4)} across ${totals[0]?.calls ?? 0} calls`);
  console.log(
    `Prompt tokens: ${Number(totals[0]?.prompt_tokens ?? 0).toLocaleString()}  |  Completion tokens: ${Number(totals[0]?.completion_tokens ?? 0).toLocaleString()}`,
  );
  console.log();

  console.log('purpose'.padEnd(42) + 'model'.padEnd(22) + 'calls'.padStart(8) + 'cost'.padStart(12) + 'share'.padStart(8) + 'avg/call'.padStart(12));
  console.log('─'.repeat(106));

  for (const r of byPurpose) {
    const cost = Number(r.total_cost);
    const share = total > 0 ? (cost / total) * 100 : 0;
    console.log(
      (r.intent ?? 'unknown').padEnd(42).slice(0, 42) +
        (r.model ?? '-').padEnd(22).slice(0, 22) +
        String(r.calls).padStart(8) +
        ('$' + cost.toFixed(4)).padStart(12) +
        (share.toFixed(1) + '%').padStart(8) +
        ('$' + Number(r.avg_cost_per_call).toFixed(5)).padStart(12),
    );
  }

  // Classification-specific deep dive
  const classificationRows = byPurpose.filter(r => String(r.intent ?? '').includes('classification'));
  if (classificationRows.length > 0) {
    console.log('\n── Classification detail ──');
    for (const r of classificationRows) {
      const avgPrompt = Number(r.avg_prompt_tokens);
      const avgCompletion = Number(r.avg_completion_tokens);
      console.log(
        `  ${r.intent} (${r.model}): ${r.calls} calls, avg ${avgPrompt} prompt + ${avgCompletion} completion tokens per call`,
      );
    }
  }

  await client.end();
}

main().catch(err => {
  console.error('ERR:', err.message);
  process.exit(1);
});
