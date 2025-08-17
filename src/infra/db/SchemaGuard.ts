import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

type ProbeResult = {
  ok: boolean;
  missing: Array<{ table: string; columns: string[] }>;
  found: Record<string, string[]>;
};

function buildUrlFromParts(): string | undefined {
  const host =
    process.env.PGHOST || process.env.DB_HOST || process.env.POSTGRES_HOST;
  const port = process.env.PGPORT || process.env.DB_PORT || '5432';
  const db =
    process.env.PGDATABASE || process.env.DB_NAME || 'postgres';
  const user =
    process.env.PGUSER || process.env.DB_USER || 'postgres';
  const pass =
    process.env.PGPASSWORD || process.env.DB_PASSWORD;

  if (host && user && pass && db) {
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(
      pass
    )}@${host}:${port}/${db}?sslmode=require`;
  }
  return undefined;
}

function hasSupabaseService(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function rpcReloadViaSupabase(): Promise<void> {
  if (!hasSupabaseService()) return;
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  );
  // call the function added in our migration below
  const { error } = await supabase.rpc('pgrst_schema_reload');
  if (error) {
    console.warn('SCHEMA_GUARD: RPC reload failed', error);
  } else {
    console.info('SCHEMA_GUARD: PostgREST reload via RPC OK');
  }
}

const EXPLICIT_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_POSTGRES_URL;

const DB_URL = EXPLICIT_URL || buildUrlFromParts();

const REQUIRED: Record<string, string[]> = {
  tweet_metrics: [
    'tweet_id',
    'collected_at',
    'likes_count',
    'retweets_count',
    'replies_count',
    'bookmarks_count',
    'impressions_count',
    'content',
  ],
  learning_posts: [
    'id',
    'created_at',
    'tweet_id',
    'format',
    'topic',
    'viral_potential_score',
    'likes_count',
    'retweets_count',
    'replies_count',
    'bookmarks_count',
    'impressions_count',
  ],
};

export class SchemaGuard {
  private pool?: Pool;

  constructor() {
    if (DB_URL) {
      this.pool = new Pool({
        connectionString: DB_URL,
        max: 1,
        idleTimeoutMillis: 10_000,
      });
    }
  }

  async probeSchema(): Promise<ProbeResult> {
    if (!this.pool) {
      console.warn('SCHEMA_GUARD_NO_POOL: No database URL or pool available');
      return {
        ok: false,
        missing: [{ table: 'probe_error', columns: ['no_db_url_or_pool'] }],
        found: {},
      };
    }

    const found: Record<string, string[]> = {};
    const missing: Array<{ table: string; columns: string[] }> = [];

    for (const [table, cols] of Object.entries(REQUIRED)) {
      const res = await this.pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        `,
        [table]
      );
      const existing = res.rows.map((r: any) => r.column_name);
      found[table] = existing;
      const miss = cols.filter((c) => !existing.includes(c));
      if (miss.length) missing.push({ table, columns: miss });
    }

    return { ok: missing.length === 0, missing, found };
  }

  async reloadPostgRESTCache(): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(`SELECT pg_notify('pgrst','reload schema')`);
      console.info('SCHEMA_GUARD: PostgREST reload notified');
      // small settle so pgrst can refresh
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.warn('SCHEMA_GUARD: reload notify failed', e);
    }
  }

  async ensureSchema(): Promise<void> {
    if (!this.pool && !hasSupabaseService()) {
      console.info('SCHEMA_GUARD_SKIPPED_NO_DB: no DATABASE_URL/PG* or Supabase service key; skipping probe.');
      return;
    }

    if (!this.pool && hasSupabaseService()) {
      console.info('SCHEMA_GUARD: no direct DB, attempting RPC reload via Supabase…');
      await rpcReloadViaSupabase();
      return;
    }

    console.info('🔍 SCHEMA_GUARD: Probing database schema...');
    const probe1 = await this.probeSchema().catch((e) => {
      console.error('SCHEMA_GUARD_PROBE_FAILED:', e.message);
      return null;
    });

    if (!probe1) {
      return; // Failed to probe, already logged
    }

    if (!probe1.ok) {
      console.warn('⚠️ SCHEMA_DRIFT_DETECTED', {
        missingColumns: probe1.missing,
        tablesFound: Object.keys(probe1.found),
      });
      await this.reloadPostgRESTCache();
      const probe2 = await this.probeSchema().catch(() => probe1);
      if (!probe2.ok) {
        console.error('❌ SCHEMA_VALIDATION_FAILED', {
          missingColumns: probe2.missing,
          suggestion: 'Run migrations or check database connectivity',
        });
      } else {
        console.info('DB_SCHEMA_OK', probe2.found);
      }
    } else {
      console.info('DB_SCHEMA_OK', probe1.found);
    }
  }

  async close(): Promise<void> {
    await this.pool?.end().catch(() => {});
  }
}

// convenient singleton entrypoint
export async function ensureSchema(): Promise<void> {
  const guard = new SchemaGuard();
  try {
    await guard.ensureSchema();
  } finally {
    await guard.close();
  }
}