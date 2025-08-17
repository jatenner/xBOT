/*
 * SupabaseAdmin - SQL execution over HTTP via Supabase pg-meta API
 * 
 * Environment Variables:
 * - SUPABASE_URL: Your Supabase project URL (required)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin operations (required)
 * - SUPABASE_PG_META_PATH: Override endpoint path (optional, e.g. "/postgres/v1/query")
 */

// One-time logging guards to prevent spam
let hasLoggedUnavailable = false;
let hasLoggedNoEndpoint = false;

export class SupabaseAdmin {
  private url: string | undefined;
  private key: string | undefined;
  private resolvedEndpoint: string | null = null;
  private endpointResolved: boolean = false;

  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  available(): boolean {
    return !!(this.url && this.key);
  }

  async resolveEndpoint(): Promise<string> {
    // Return cached result
    if (this.endpointResolved) {
      if (!this.resolvedEndpoint) {
        throw new Error('No working pg-meta endpoint found');
      }
      return this.resolvedEndpoint;
    }

    if (!this.available()) {
      if (!hasLoggedUnavailable) {
        console.info('SUPABASE_ADMIN: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; skipping.');
        hasLoggedUnavailable = true;
      }
      throw new Error('SupabaseAdmin unavailable');
    }

    const baseUrl = this.url!.replace(/\/+$/, '');
    
    // Check for override first
    const overridePath = process.env.SUPABASE_PG_META_PATH;
    if (overridePath) {
      const endpoint = `${baseUrl}${overridePath.startsWith('/') ? overridePath : '/' + overridePath}`;
      const canaryResult = await this.testEndpoint(endpoint);
      if (canaryResult.success) {
        this.resolvedEndpoint = endpoint;
        this.endpointResolved = true;
        console.info(`SupabaseAdmin: using pg-meta endpoint ${endpoint} (override)`);
        console.info('SupabaseAdmin: pg-meta canary OK');
        return endpoint;
      }
    }
    
    // Try candidate endpoints in exact order
    const candidates = [
      `${baseUrl}/postgres/v1/query`,
      `${baseUrl}/pg/query`,
      `${baseUrl}/pg`,
      `${baseUrl}/sql/v1`,
      `${baseUrl}/postgres/v1/sql`
    ];

    let lastError = '';
    
    for (const endpoint of candidates) {
      const result = await this.testEndpoint(endpoint);
      if (result.success) {
        this.resolvedEndpoint = endpoint;
        this.endpointResolved = true;
        console.info(`SupabaseAdmin: using pg-meta endpoint ${endpoint}`);
        console.info('SupabaseAdmin: pg-meta canary OK');
        return endpoint;
      }
      lastError = result.error;
    }

    // Mark as resolved (failed) to prevent retries
    this.endpointResolved = true;
    this.resolvedEndpoint = null;

    if (!hasLoggedNoEndpoint) {
      console.warn('SCHEMA_GUARD: SupabaseAdmin could not find a working pg-meta SQL endpoint. Set SUPABASE_PG_META_PATH or provide a direct DB URL.');
      hasLoggedNoEndpoint = true;
    }

    throw new Error(`No working pg-meta endpoint found. Last error: ${lastError}`);
  }

  private async testEndpoint(endpoint: string): Promise<{ success: boolean; error: string }> {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key!,
          'Authorization': `Bearer ${this.key!}`
        },
        body: JSON.stringify({ query: 'select 1' })
      });

      if (res.ok) {
        return { success: true, error: '' };
      } else {
        const text = await res.text().catch(() => '');
        return { success: false, error: `${res.status} ${res.statusText} ${text}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async execSql(sql: string): Promise<void> {
    if (!this.available()) {
      throw new Error('SupabaseAdmin unavailable');
    }
    
    const endpoint = await this.resolveEndpoint();
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.key!,
        'Authorization': `Bearer ${this.key!}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SupabaseAdmin execSql failed: ${res.status} ${res.statusText} ${text}`);
    }
  }

  async reloadPostgrest(): Promise<void> {
    await this.execSql(`select pg_notify('pgrst','reload schema');`);
  }
}
