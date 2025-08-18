/**
 * SupabaseMetaRunner - Execute SQL via Supabase pg-meta HTTP API
 * Handles Supabase Meta API calls over HTTPS to avoid direct TCP connections
 */

export interface MetaResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export class SupabaseMetaRunner {
  private baseUrl: string;
  private serviceKey: string;
  private metaPath: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('META_RUNNER: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    this.baseUrl = supabaseUrl.replace(/\/$/, '');
    this.serviceKey = serviceKey;
    this.metaPath = process.env.SUPABASE_PG_META_PATH || '/pg/sql';
  }

  /**
   * Check if Meta Runner is available based on environment variables
   */
  isAvailable(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  /**
   * Execute SQL via Supabase pg-meta API
   */
  async execSql(sql: string): Promise<MetaResponse> {
    if (!this.isAvailable()) {
      return { success: false, error: 'META_RUNNER: Supabase credentials not available' };
    }

    const endpoint = `${this.baseUrl}${this.metaPath}`;
    
    try {
      console.info(`META_RUNNER: executing SQL via ${this.metaPath}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'authorization': `Bearer ${this.serviceKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          error: `META_RUNNER: HTTP ${response.status} ${response.statusText}: ${errorText}`
        };
      }

      const data = await response.json().catch(() => null);
      console.info('META_RUNNER: SQL execution successful');
      
      return { success: true, data };

    } catch (error: any) {
      return {
        success: false,
        error: `META_RUNNER: Network error - ${error.message}`
      };
    }
  }

  /**
   * Test connectivity with a simple query
   */
  async testConnection(): Promise<MetaResponse> {
    return this.execSql('SELECT 1 as ok');
  }

  /**
   * Reload PostgREST schema cache
   */
  async reloadPostgrest(): Promise<MetaResponse> {
    return this.execSql("SELECT pg_notify('pgrst', 'reload schema')");
  }
}
