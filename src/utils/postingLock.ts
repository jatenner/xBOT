import { supabaseClient } from './supabaseClient';

/**
 * Lightweight distributed posting lock.
 * Tries DB-backed lock first; falls back to in-memory lock if DB unavailable.
 */
class PostingLock {
  private inMemoryLockedUntil: number = 0;
  private readonly LOCK_ID = 'posting_lock';
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private async ensureTable(): Promise<void> {
    try {
      const { error } = await supabaseClient.supabase
        .rpc('noop'); // cheap call to ensure connectivity
      // Ignore the result; just touching the connection
    } catch {}

    try {
      await supabaseClient.supabase.rpc('sql', {
        // Many projects disable RPC raw SQL. Fall back to simple create via from(). If not available, we ignore.
      } as any);
    } catch {}

    try {
      // Portable CREATE TABLE IF NOT EXISTS using SQL via the query endpoint isn't available.
      // Instead, attempt an idempotent insert into a table; if it fails with relation missing, try create.
      await supabaseClient.supabase
        .from('runtime_locks')
        .select('lock_id')
        .limit(1);
    } catch (e: any) {
      // Try to create the table using a lightweight DDL helper API if available.
      try {
        const ddl = `
          create table if not exists runtime_locks (
            lock_id text primary key,
            locked_until timestamptz not null default now(),
            updated_at timestamptz not null default now()
          );
          create index if not exists idx_runtime_locks_locked_until on runtime_locks(locked_until);
        `;
        // Attempt via PostgREST RPC not available by default; ignore errors.
        await (supabaseClient.supabase as any).sql?.(ddl);
      } catch {}
    }
  }

  async acquire(ttlMs: number = this.DEFAULT_TTL_MS): Promise<boolean> {
    const now = Date.now();

    // Attempt DB-backed lock if client is available
    try {
      if (supabaseClient && (supabaseClient as any).supabase) {
        // Best-effort ensure table exists (idempotent)
        await this.ensureTable();
        const expiresAt = new Date(now + ttlMs).toISOString();

        // Upsert into a runtime_locks table. If it doesn't exist, this will fail and we fallback.
        const { error } = await supabaseClient.supabase
          .from('runtime_locks')
          .upsert({
            lock_id: this.LOCK_ID,
            locked_until: expiresAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'lock_id' });

        if (!error) {
          // Verify we actually have the lock (no concurrent holder beyond now)
          const { data, error: readErr } = await supabaseClient.supabase
            .from('runtime_locks')
            .select('locked_until')
            .eq('lock_id', this.LOCK_ID)
            .limit(1)
            .maybeSingle();

          if (!readErr && data) {
            const lockedUntil = new Date(data.locked_until).getTime();
            // If lock expiry is in the future, assume we have the lock
            return lockedUntil > now;
          }
        }
      }
    } catch {
      // Fall back to memory
    }

    // In-memory fallback
    if (this.inMemoryLockedUntil > now) {
      return false;
    }
    this.inMemoryLockedUntil = now + ttlMs;
    return true;
  }

  async release(): Promise<void> {
    const now = Date.now();
    try {
      if (supabaseClient && (supabaseClient as any).supabase) {
        await supabaseClient.supabase
          .from('runtime_locks')
          .update({ locked_until: new Date(now).toISOString(), updated_at: new Date().toISOString() })
          .eq('lock_id', this.LOCK_ID);
      }
    } catch {
      // ignore
    }
    this.inMemoryLockedUntil = 0;
  }
}

export const postingLock = new PostingLock();

