const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const dir = path.join(process.cwd(), 'supabase/migrations');
  
  if (!fs.existsSync(dir)) {
    console.error('❌ Migration directory not found:', dir);
    process.exit(1);
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const cs = process.env.DATABASE_URL;
  
  if (!cs) { 
    console.error('❌ DATABASE_URL missing'); 
    process.exit(1); 
  }
  
  console.log(`🗃️  Found ${files.length} migration files`);
  console.log(`🔗 Connecting to database...`);
  
  const client = new Client({ 
    connectionString: cs, 
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('✅ Connected to database');
  
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    process.stdout.write(`→ Applying ${f} ... `);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (error) {
      console.log('FAILED:', error.message);
      throw error;
    }
  }
  
  await client.end();
  console.log('✅ All migrations applied');
})().catch(e => { 
  console.error('💥 Migration failed:', e?.message || e); 
  process.exit(1); 
});
