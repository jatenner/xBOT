import { Pool } from 'pg';
import { SupabaseAdmin } from './SupabaseAdmin';

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
  private admin?: SupabaseAdmin;

  constructor() {
    if (DB_URL) {
      this.pool = new Pool({
        connectionString: DB_URL,
        max: 1,
        idleTimeoutMillis: 10_000,
      });
    }
    if (hasSupabaseService()) {
      this.admin = new SupabaseAdmin();
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
    // Case 1: No direct DB and no Supabase admin — skip once.
    if (!this.pool && !this.admin?.available()) {
      console.info('SCHEMA_GUARD_SKIPPED_NO_DB: no DATABASE_URL/PG* and no SUPABASE_SERVICE_ROLE_KEY; skipping.');
      return;
    }

    // Case 2: No direct DB, but we DO have Supabase admin.
    if (!this.pool && this.admin?.available()) {
      console.info('SCHEMA_GUARD: no direct DB; using Supabase Meta to bootstrap & reload…');
      // 2a) Ensure core schema idempotently
      await this.ensureCoreSchemaViaSupabaseMeta();
      // 2b) Reload PostgREST so new columns are visible to REST
      await this.admin.reloadPostgrest().then(() => {
        console.info('SCHEMA_GUARD: PostgREST reload via SQL OK');
      }).catch((e) => {
        console.warn('SCHEMA_GUARD: PostgREST reload via SQL failed', e);
      });
      return;
    }

    // Case 3: We have a DB pool — do the normal probe/reload path (unchanged)
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

  private async ensureCoreSchemaViaSupabaseMeta(): Promise<void> {
    if (!this.admin?.available()) return;
    const sql = `
    -- Tables (idempotent)
    create table if not exists public.tweet_metrics (
      tweet_id text primary key,
      collected_at timestamptz not null default now(),
      likes_count int not null default 0,
      retweets_count int not null default 0,
      replies_count int not null default 0,
      bookmarks_count int not null default 0,
      impressions_count bigint not null default 0,
      content text
    );

    create table if not exists public.learning_posts (
      tweet_id text primary key,
      created_at timestamptz not null default now(),
      format text not null,
      likes_count int not null default 0,
      retweets_count int not null default 0,
      replies_count int not null default 0,
      bookmarks_count int not null default 0,
      impressions_count bigint not null default 0,
      viral_potential_score int not null default 0,
      content text
    );

    -- Columns (idempotent)
    do $$
    begin
      -- tweet_metrics columns
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='tweet_metrics' and column_name='bookmarks_count') then
        alter table public.tweet_metrics add column if not exists bookmarks_count int not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='tweet_metrics' and column_name='impressions_count') then
        alter table public.tweet_metrics add column if not exists impressions_count bigint not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='tweet_metrics' and column_name='content') then
        alter table public.tweet_metrics add column if not exists content text;
      end if;

      -- learning_posts columns
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='likes_count') then
        alter table public.learning_posts add column if not exists likes_count int not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='retweets_count') then
        alter table public.learning_posts add column if not exists retweets_count int not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='replies_count') then
        alter table public.learning_posts add column if not exists replies_count int not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='bookmarks_count') then
        alter table public.learning_posts add column if not exists bookmarks_count int not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='impressions_count') then
        alter table public.learning_posts add column if not exists impressions_count bigint not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='viral_potential_score') then
        alter table public.learning_posts add column if not exists viral_potential_score int not null default 0;
      end if;
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='learning_posts' and column_name='content') then
        alter table public.learning_posts add column if not exists content text;
      end if;
    end$$;
    `;
    try {
      await this.admin.execSql(sql);
      console.info('SCHEMA_GUARD: core schema ensured via Supabase Meta');
    } catch (e) {
      console.warn('SCHEMA_GUARD: core schema ensure failed', e);
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