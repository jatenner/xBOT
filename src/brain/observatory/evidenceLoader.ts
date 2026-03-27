/**
 * Evidence Loader
 *
 * Reads JSONL evidence packages and formats them for LLM context injection.
 * The decision brain and content generators call this to get rich evidence
 * for their prompts.
 *
 * Each method loads relevant entries and returns them as structured objects
 * that can be serialized into prompt context.
 */

import * as fs from 'fs';
import * as path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'data', 'evidence');

function readJsonlFile(filename: string): any[] {
  // Try uncompressed first (more recent data)
  const uncompressed = path.join(EVIDENCE_DIR, filename.replace('.gz', ''));
  if (fs.existsSync(uncompressed)) {
    try {
      const content = fs.readFileSync(uncompressed, 'utf-8');
      return content.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  // Try compressed
  const compressed = path.join(EVIDENCE_DIR, filename);
  if (fs.existsSync(compressed)) {
    try {
      const zlib = require('zlib');
      const buf = fs.readFileSync(compressed);
      const content = zlib.gunzipSync(buf).toString('utf-8');
      return content.trim().split('\n').filter(Boolean).map((line: string) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  return [];
}

// =============================================================================
// Growth Journeys
// =============================================================================

export function loadGrowthJourneys(phase?: string, limit: number = 10): any[] {
  const all = readJsonlFile('growth_journeys.jsonl.gz');
  let filtered = all;

  if (phase) {
    filtered = all.filter(j => j.growth_event?.phase_at_start === phase);
  }

  // Sort by growth rate (most impressive first)
  filtered.sort((a, b) => (b.growth_event?.growth_rate_weekly ?? 0) - (a.growth_event?.growth_rate_weekly ?? 0));

  return filtered.slice(0, limit);
}

// =============================================================================
// Content Patterns
// =============================================================================

export function loadContentPatterns(filters?: { hookType?: string; tone?: string; tier?: string }, limit: number = 20): any[] {
  const all = readJsonlFile('content_patterns.jsonl.gz');
  let filtered = all;

  if (filters?.hookType) {
    filtered = filtered.filter(p => p.pattern?.hook_type === filters.hookType);
  }
  if (filters?.tone) {
    filtered = filtered.filter(p => p.pattern?.tone === filters.tone);
  }
  if (filters?.tier) {
    filtered = filtered.filter(p => p.pattern?.account_tier === filters.tier);
  }

  filtered.sort((a, b) => (b.avg_likes ?? 0) - (a.avg_likes ?? 0));
  return filtered.slice(0, limit);
}

// =============================================================================
// Account Profiles
// =============================================================================

export function loadAccountProfiles(filters?: { niche?: string; growthStatus?: string }, limit: number = 20): any[] {
  const all = readJsonlFile('account_profiles.jsonl.gz');
  let filtered = all;

  if (filters?.niche) {
    filtered = filtered.filter(p => p.niche === filters.niche);
  }
  if (filters?.growthStatus) {
    filtered = filtered.filter(p => p.growth_status === filters.growthStatus);
  }

  filtered.sort((a, b) => (b.growth_rate_7d ?? 0) - (a.growth_rate_7d ?? 0));
  return filtered.slice(0, limit);
}

// =============================================================================
// Failed Strategies
// =============================================================================

export function loadFailedStrategies(limit: number = 20): any[] {
  const all = readJsonlFile('failed_strategies.jsonl.gz');
  return all.slice(-limit); // Most recent
}

// =============================================================================
// Daily Snapshots
// =============================================================================

export function loadDailySnapshots(days: number = 7): any[] {
  const all = readJsonlFile('daily_snapshots.jsonl.gz');
  return all.slice(-days);
}

// =============================================================================
// Formatted Evidence for LLM Prompts
// =============================================================================

/**
 * Returns formatted evidence text ready for LLM context injection.
 * Selects the most relevant evidence based on purpose.
 */
export function getEvidenceForPrompt(purpose: 'strategy' | 'content' | 'reply' | 'analysis', limit: number = 5): string {
  let context = '';

  if (purpose === 'strategy' || purpose === 'analysis') {
    // Load growth journeys
    const journeys = loadGrowthJourneys(undefined, limit);
    if (journeys.length > 0) {
      context += '\n=== REAL GROWTH JOURNEYS ===\n';
      for (const j of journeys) {
        context += `\n@${j.account?.username} (${j.account?.niche ?? 'unknown niche'}):\n`;
        context += `  Grew from ${j.growth_event?.start_followers} to ${j.growth_event?.end_followers} followers`;
        context += ` in ${j.growth_event?.duration_days} days (${j.growth_event?.growth_rate_weekly?.toFixed(1)}%/week)\n`;

        if (j.weekly_behavior?.length > 0) {
          context += '  Weekly progression:\n';
          for (const w of j.weekly_behavior.slice(0, 4)) {
            context += `    ${w.week}: ${w.originals} originals, ${w.replies} replies, avg ${w.avg_likes} likes`;
            if (w.reply_targets?.length > 0) {
              context += `, replied to @${w.reply_targets.map((t: any) => t.username).join(', @')}`;
            }
            context += '\n';
          }
        }

        if (j.key_changes?.length > 0) {
          context += '  Key changes: ' + j.key_changes.map((c: any) => c.dimension + ': ' + (c.before ?? '?') + ' → ' + (c.during ?? '?')).join('; ') + '\n';
        }
      }
    }

    // Load failed strategies
    const failed = loadFailedStrategies(3);
    if (failed.length > 0) {
      context += '\n=== STRATEGIES WE TRIED THAT FAILED ===\n';
      for (const f of failed) {
        context += `\n"${f.strategy_name}" (test #${f.test_number}):\n`;
        context += `  Diagnosis: ${f.diagnosis}\n`;
        if (f.revisit_at) context += `  Revisit at: ${f.revisit_at}\n`;
      }
    }
  }

  if (purpose === 'content' || purpose === 'reply') {
    // Load content patterns
    const patterns = loadContentPatterns(undefined, limit);
    if (patterns.length > 0) {
      context += '\n=== TOP CONTENT PATTERNS ===\n';
      for (const p of patterns) {
        context += `\n${p.pattern?.hook_type} + ${p.pattern?.tone} (${p.sample_size} tweets, avg ${p.avg_likes} likes):\n`;
        for (const ex of (p.top_examples ?? []).slice(0, 2)) {
          context += `  @${ex.author}: "${ex.content?.substring(0, 120)}..." (${ex.likes} likes)\n`;
        }
      }
    }
  }

  // Always include recent context
  const snapshots = loadDailySnapshots(1);
  if (snapshots.length > 0) {
    const today = snapshots[0];
    if (today.trending_topics?.length > 0) {
      context += `\n=== TRENDING TODAY ===\n${today.trending_topics.join(', ')}\n`;
    }
  }

  return context;
}
