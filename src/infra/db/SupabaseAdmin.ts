import fetch from 'node-fetch';

export class SupabaseAdmin {
  private url: string | undefined;
  private key: string | undefined;

  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  available(): boolean {
    return !!(this.url && this.key);
  }

  private metaEndpoint(): string {
    // Postgres Meta API
    return `${this.url}/postgres/v1/query`;
  }

  async execSql(sql: string): Promise<void> {
    if (!this.available()) throw new Error('SupabaseAdmin unavailable');
    const res = await fetch(this.metaEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.key as string,
        'Authorization': `Bearer ${this.key}`
      },
      body: JSON.stringify({ query: sql })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SupabaseAdmin execSql failed: ${res.status} ${res.statusText} ${text}`);
    }
  }

  async reloadPostgrest(): Promise<void> {
    // No function needed; directly NOTIFY the pgrst channel
    await this.execSql(`select pg_notify('pgrst','reload schema');`);
  }
}
