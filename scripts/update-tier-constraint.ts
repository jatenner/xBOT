import { Client } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('🔄 Updating reply_opportunities tier constraint...');

    const sql = `
      ALTER TABLE reply_opportunities DROP CONSTRAINT IF EXISTS reply_opportunities_tier_check;
      ALTER TABLE reply_opportunities ADD CONSTRAINT reply_opportunities_tier_check
        CHECK (
          tier IS NULL OR tier IN (
            'TITAN', 'ULTRA', 'MEGA', 'MEGA+', 'SUPER', 'HIGH',
            'VIRAL', 'VIRAL+', 'TRENDING', 'TRENDING+', 'FRESH', 'FRESH+',
            'HEALTH HOT (300+)', 'HEALTH KEYWORD (500+)',
            'golden', 'good', 'acceptable', 'TEST', 'TEST+'
          )
        );
    `;

    await client.query(sql);
    console.log('✅ Constraint updated successfully');
  } catch (error: any) {
    console.error('❌ Failed to update constraint:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
