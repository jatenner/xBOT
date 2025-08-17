type EndpointConfig = {
  url: string;
  bodyKey: 'query' | 'sql';
};

export class SupabaseAdmin {
  private url: string | undefined;
  private key: string | undefined;
  private endpointConfig: EndpointConfig | null = null;

  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  available(): boolean {
    return !!(this.url && this.key);
  }

  private async resolveEndpoint(): Promise<EndpointConfig> {
    if (this.endpointConfig) {
      return this.endpointConfig;
    }

    if (!this.available()) {
      throw new Error('SupabaseAdmin unavailable');
    }

    const baseUrl = this.url!.replace(/\/+$/, '');
    
    // Try endpoints in order until one works
    const endpoints = [
      `${baseUrl}/postgres/v1/query`,
      `${baseUrl}/pg/query`,
      `${baseUrl}/pg/execute`,
      `${baseUrl}/pg/sql`
    ];

    const payloadKeys: Array<'query' | 'sql'> = ['query', 'sql'];
    const testSql = 'select 1';
    
    let lastError: string = '';

    for (const endpoint of endpoints) {
      for (const bodyKey of payloadKeys) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.key!,
              'Authorization': `Bearer ${this.key!}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify({ [bodyKey]: testSql })
          });

          if (res.ok) {
            // Cache the working configuration
            this.endpointConfig = { url: endpoint, bodyKey };
            console.info(`SUPABASE_ADMIN: discovered working endpoint ${endpoint} with payload key '${bodyKey}'`);
            return this.endpointConfig;
          } else {
            const text = await res.text().catch(() => '');
            lastError = `${res.status} ${res.statusText} ${text}`;
          }
        } catch (error: any) {
          lastError = error.message;
        }
      }
    }

    throw new Error(`SupabaseAdmin: no working pg-meta endpoint found. Tried: ${endpoints.join(', ')}. Last error: ${lastError}`);
  }

  async execSql(sql: string): Promise<void> {
    if (!this.available()) throw new Error('SupabaseAdmin unavailable');
    
    const config = await this.resolveEndpoint();
    
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.key!,
        'Authorization': `Bearer ${this.key!}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ [config.bodyKey]: sql })
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
