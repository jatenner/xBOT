import { supabaseClient } from './supabaseClient';

/**
 * Lightweight distributed posting lock.
 * Tries DB-backed lock first; falls back to in-memory lock if DB unavailable.
 */
class PostingLock {
  private inMemoryLockedUntil: number = 0;
  private readonly LOCK_ID = 'posting_lock';
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async acquire(ttlMs: number = this.DEFAULT_TTL_MS): Promise<boolean> {
    const now = Date.now();

    // Attempt DB-backed lock if client is available
    try {
      if (supabaseClient && (supabaseClient as any).supabase) {
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

