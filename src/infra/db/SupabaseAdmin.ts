/*
 * SupabaseAdmin - SQL execution over HTTP via Supabase pg-meta API + Management API fallback
 * 
 * Environment Variables:
 * - SUPABASE_URL: Your Supabase project URL (required for project-meta)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for project-meta operations
 * - SUPABASE_PG_META_PATH: Override endpoint path (optional, e.g. "/postgres/v1/query")
 * - SUPABASE_PROJECT_REF: Project reference for Management API fallback
 * - SUPABASE_PAT: Personal Access Token for Management API fallback
 */

// Using Node.js native fetch (Node 18+)

// One-time logging guards to prevent spam
let hasLoggedUnavailable = false;
let hasLoggedNoEndpoint = false;

type EndpointMode = {
  kind: 'project-meta' | 'admin-api';
  url: string;
};

export class SupabaseAdmin {
  private url: string | undefined;
  private key: string | undefined;
  private projectRef: string | undefined;
  private pat: string | undefined;
  private resolvedEndpoint: EndpointMode | null = null;
  private endpointResolved: boolean = false;

  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.projectRef = process.env.SUPABASE_PROJECT_REF;
    this.pat = process.env.SUPABASE_PAT;
  }

  available(): boolean {
    // Available if we have project-meta credentials OR management API credentials
    return !!(this.url && this.key) || !!(this.projectRef && this.pat);
  }

  async resolveEndpoint(): Promise<EndpointMode> {
    // Return cached result
    if (this.endpointResolved) {
      if (!this.resolvedEndpoint) {
        throw new Error('No working endpoint found');
      }
      return this.resolvedEndpoint;
    }

    if (!this.available()) {
      if (!hasLoggedUnavailable) {
        console.info('SUPABASE_ADMIN: No usable credentials; skipping.');
        hasLoggedUnavailable = true;
      }
      throw new Error('SupabaseAdmin unavailable');
    }

    // Try project-meta first if we have those credentials
    if (this.url && this.key) {
      const baseUrl = this.url.replace(/\/+$/, '');
      
      // Check for override first
      const overridePath = process.env.SUPABASE_PG_META_PATH;
      if (overridePath) {
        const endpoint = `${baseUrl}${overridePath.startsWith('/') ? overridePath : '/' + overridePath}`;
        const canaryResult = await this.testProjectMetaEndpoint(endpoint);
        if (canaryResult.success) {
          this.resolvedEndpoint = { kind: 'project-meta', url: endpoint };
          this.endpointResolved = true;
          console.info(`SupabaseAdmin: using pg-meta endpoint ${endpoint} (override)`);
          console.info('SupabaseAdmin: pg-meta canary OK');
          return this.resolvedEndpoint;
        }
      }
      
      // Try candidate endpoints in exact order
      const candidates = [
        `${baseUrl}/postgres/v1/query`,
        `${baseUrl}/sql/v1`,
        `${baseUrl}/postgres/v1/sql`,
        `${baseUrl}/pg/query`,
        `${baseUrl}/pg/execute`,
        `${baseUrl}/pg/sql`
      ];

      for (const endpoint of candidates) {
        const result = await this.testProjectMetaEndpoint(endpoint);
        if (result.success) {
          this.resolvedEndpoint = { kind: 'project-meta', url: endpoint };
          this.endpointResolved = true;
          console.info(`SupabaseAdmin: using pg-meta endpoint ${endpoint}`);
          console.info('SupabaseAdmin: pg-meta canary OK');
          return this.resolvedEndpoint;
        }
      }
    }
    
    // Fallback to Management API if project-meta failed
    if (this.projectRef && this.pat) {
      const managementUrl = `https://api.supabase.com/v1/projects/${this.projectRef}/database/query`;
      const canaryResult = await this.testManagementApiEndpoint(managementUrl);
      if (canaryResult.success) {
        this.resolvedEndpoint = { kind: 'admin-api', url: managementUrl };
        this.endpointResolved = true;
        console.info(`SupabaseAdmin: using management API ${managementUrl}`);
        console.info('SupabaseAdmin: pg-meta canary OK');
        return this.resolvedEndpoint;
      }
    }

    // Mark as resolved (failed) to prevent retries
    this.endpointResolved = true;
    this.resolvedEndpoint = null;

    if (!hasLoggedNoEndpoint) {
      console.warn('SCHEMA_GUARD: SupabaseAdmin could not find a working pg-meta SQL endpoint. Set SUPABASE_PG_META_PATH or provide a direct DB URL.');
      hasLoggedNoEndpoint = true;
    }

    throw new Error('No working endpoint found after trying project-meta and management API');
  }

  private async testProjectMetaEndpoint(endpoint: string): Promise<{ success: boolean; error: string }> {
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

  private async testManagementApiEndpoint(endpoint: string): Promise<{ success: boolean; error: string }> {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.pat!}`
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
    
    let res: any;
    if (endpoint.kind === 'project-meta') {
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key!,
          'Authorization': `Bearer ${this.key!}`
        },
        body: JSON.stringify({ query: sql })
      });
    } else {
      // admin-api
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.pat!}`
        },
        body: JSON.stringify({ query: sql })
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SupabaseAdmin execSql failed: ${res.status} ${res.statusText} ${text}`);
    }
  }

  async reloadPostgrest(): Promise<void> {
    await this.execSql(`select pg_notify('pgrst','reload schema');`);
  }
}
