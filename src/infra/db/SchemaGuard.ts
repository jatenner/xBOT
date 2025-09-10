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

// One-time logging to prevent spam
let hasLoggedSkip = false;

// Build Supabase postgres URL from existing working credentials
function buildSupabaseDbUrl(): string | undefined {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (supabaseUrl && supabaseServiceKey) {
    // Extract project ref from Supabase URL (e.g., qtgjmaelglghnlahqpbl.supabase.co)
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      // Use the same connection format as production
      const password = process.env.PROD_DB_PASSWORD || process.env.STAGING_DB_PASSWORD;
      if (password) {
        return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
      }
    }
  }
  return undefined;
}

// Recognize wide set of envs for direct DB URL (prefer if present)
const EXPLICIT_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_POSTGRES_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DIRECT_URL ||
  process.env.PG_CONNECTION_STRING ||
  process.env.PGDATABASE_URL;

const DB_URL = EXPLICIT_URL || buildSupabaseDbUrl() || buildUrlFromParts();

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
      // Ensure SSL mode is set for secure connections
      const connectionString = DB_URL.includes('sslmode=') 
        ? DB_URL 
        : `${DB_URL}${DB_URL.includes('?') ? '&' : '?'}sslmode=require`;
      
      console.info(`SCHEMA_GUARD: Using DB connection: ${connectionString.replace(/:[^@]+@/, ':***@')}`);
      this.pool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 1,
        idleTimeoutMillis: 10_000,
      });
    } else {
      console.info('SCHEMA_GUARD: No DB URL found, will try SupabaseAdmin');
    }
    // Initialize SupabaseAdmin if it has credentials
    this.admin = new SupabaseAdmin();
    if (!this.admin.available()) {
      this.admin = undefined;
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
      if (!hasLoggedSkip) {
        console.info('SCHEMA_GUARD_SKIPPED_NO_DB: no DATABASE_URL/* and no SUPABASE_SERVICE_ROLE_KEY; skipping.');
        hasLoggedSkip = true;
      }
      return;
    }

    // Case 2: We have a DB pool — prefer direct DB (run idempotent schema + reload)
    if (this.pool) {
      console.info('🔍 SCHEMA_GUARD: Probing database schema...');
      await this.ensureCoreSchemaViaPool();
      return;
    }

    // Case 3: No direct DB, but we DO have Supabase admin.
    if (!this.pool && this.admin?.available()) {
      console.info('SCHEMA_GUARD: no direct DB; using Supabase Meta to bootstrap & reload…');
      await this.ensureCoreSchemaViaSupabaseMeta();
      return;
    }
  }

  private async ensureCoreSchemaViaSupabaseMeta(): Promise<void> {
    if (!this.admin?.available()) return;
    
    const sql = `-- Idempotent core schema bootstrap via Supabase Meta
create table if not exists public.tweet_metrics (
  tweet_id text not null,
  collected_at timestamptz not null default now(),
  likes_count int not null default 0,
  retweets_count int not null default 0,
  replies_count int not null default 0,
  bookmarks_count int not null default 0,
  impressions_count bigint not null default 0,
  content text,
  primary key (tweet_id, collected_at)
);

create table if not exists public.learning_posts (
  id serial primary key,
  tweet_id text unique not null,
  created_at timestamptz not null default now(),
  format text not null,
  topic text,
  likes_count int not null default 0,
  retweets_count int not null default 0,
  replies_count int not null default 0,
  bookmarks_count int not null default 0,
  impressions_count bigint not null default 0,
  viral_potential_score int not null default 0,
  content text
);

-- Add missing columns if they don't exist
do $$
begin
  -- tweet_metrics columns
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='collected_at') then
    alter table public.tweet_metrics add column if not exists collected_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='likes_count') then
    alter table public.tweet_metrics add column if not exists likes_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='retweets_count') then
    alter table public.tweet_metrics add column if not exists retweets_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='replies_count') then
    alter table public.tweet_metrics add column if not exists replies_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='bookmarks_count') then
    alter table public.tweet_metrics add column if not exists bookmarks_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='impressions_count') then
    alter table public.tweet_metrics add column if not exists impressions_count bigint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='content') then
    alter table public.tweet_metrics add column if not exists content text;
  end if;

  -- learning_posts columns  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='id') then
    alter table public.learning_posts add column if not exists id serial primary key;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='created_at') then
    alter table public.learning_posts add column if not exists created_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='format') then
    alter table public.learning_posts add column if not exists format text not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='topic') then
    alter table public.learning_posts add column if not exists topic text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='likes_count') then
    alter table public.learning_posts add column if not exists likes_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='retweets_count') then
    alter table public.learning_posts add column if not exists retweets_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='replies_count') then
    alter table public.learning_posts add column if not exists replies_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='bookmarks_count') then
    alter table public.learning_posts add column if not exists bookmarks_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='impressions_count') then
    alter table public.learning_posts add column if not exists impressions_count bigint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='viral_potential_score') then
    alter table public.learning_posts add column if not exists viral_potential_score int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='content') then
    alter table public.learning_posts add column if not exists content text;
  end if;
end$$;`;

    try {
      await this.admin.execSql(sql);
      console.info('SCHEMA_GUARD: core schema ensured via Supabase Meta');
    } catch (e: any) {
      console.warn('SCHEMA_GUARD: core schema ensure failed:', e.message);
      return;
    }

    // PostgREST reload in separate call for better error isolation
    try {
      await this.admin.reloadPostgrest();
      console.info('SCHEMA_GUARD: PostgREST reload via SQL OK');
    } catch (e: any) {
      console.warn('SCHEMA_GUARD: PostgREST reload via SQL failed:', e.message);
    }
  }

  private async ensureCoreSchemaViaPool(): Promise<void> {
    if (!this.pool) return;

    const sql = `-- Idempotent core schema bootstrap via direct DB
create table if not exists public.tweet_metrics (
  tweet_id text not null,
  collected_at timestamptz not null default now(),
  likes_count int not null default 0,
  retweets_count int not null default 0,
  replies_count int not null default 0,
  bookmarks_count int not null default 0,
  impressions_count bigint not null default 0,
  content text,
  primary key (tweet_id, collected_at)
);

create table if not exists public.learning_posts (
  id serial primary key,
  tweet_id text unique not null,
  created_at timestamptz not null default now(),
  format text not null,
  topic text,
  likes_count int not null default 0,
  retweets_count int not null default 0,
  replies_count int not null default 0,
  bookmarks_count int not null default 0,
  impressions_count bigint not null default 0,
  viral_potential_score int not null default 0,
  content text
);

-- Add missing columns if they don't exist
do $$
begin
  -- tweet_metrics columns
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='collected_at') then
    alter table public.tweet_metrics add column if not exists collected_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='likes_count') then
    alter table public.tweet_metrics add column if not exists likes_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='retweets_count') then
    alter table public.tweet_metrics add column if not exists retweets_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='replies_count') then
    alter table public.tweet_metrics add column if not exists replies_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='bookmarks_count') then
    alter table public.tweet_metrics add column if not exists bookmarks_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='impressions_count') then
    alter table public.tweet_metrics add column if not exists impressions_count bigint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='content') then
    alter table public.tweet_metrics add column if not exists content text;
  end if;

  -- learning_posts columns  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='id') then
    alter table public.learning_posts add column if not exists id serial primary key;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='created_at') then
    alter table public.learning_posts add column if not exists created_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='format') then
    alter table public.learning_posts add column if not exists format text not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='topic') then
    alter table public.learning_posts add column if not exists topic text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='likes_count') then
    alter table public.learning_posts add column if not exists likes_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='retweets_count') then
    alter table public.learning_posts add column if not exists retweets_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='replies_count') then
    alter table public.learning_posts add column if not exists replies_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='bookmarks_count') then
    alter table public.learning_posts add column if not exists bookmarks_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='impressions_count') then
    alter table public.learning_posts add column if not exists impressions_count bigint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='viral_potential_score') then
    alter table public.learning_posts add column if not exists viral_potential_score int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='content') then
    alter table public.learning_posts add column if not exists content text;
  end if;
end$$;`;

    try {
      await this.pool.query(sql);
      console.info('SCHEMA_GUARD: core schema ensured (direct DB)');
    } catch (e: any) {
      console.warn('SCHEMA_GUARD: core schema ensure failed via pool:', e.message);
      return;
    }

    // PostgREST reload via pool
    try {
      await this.pool.query("select pg_notify('pgrst','reload schema');");
      console.info('SCHEMA_GUARD: PostgREST reload via SQL OK');
    } catch (e: any) {
      console.warn('SCHEMA_GUARD: PostgREST reload via SQL failed:', e.message);
    }
  }

  async close(): Promise<void> {
    await this.pool?.end().catch(() => {});
  }
}

// convenient singleton entrypoint for external use (e.g., self-healing)
export async function ensureSchema(): Promise<void> {
  const guard = new SchemaGuard();
  try {
    await guard.ensureSchema();
  } finally {
    await guard.close();
  }
}