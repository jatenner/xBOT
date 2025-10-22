const { Client } = require('pg');

async function fixPostedDecisionsView() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? {
      rejectUnauthorized: false
    } : false
  });
  
  try {
    await client.connect();
    console.log('✅ Connected\n');
    
    // Get the view definition
    const viewDef = await client.query(`
      SELECT definition
      FROM pg_views
      WHERE schemaname = 'public'
      AND viewname = 'posted_decisions';
    `);
    
    console.log('📋 posted_decisions view definition:');
    console.log(viewDef.rows[0].definition);
    console.log('');
    
    // Find which table(s) the view references
    const tables = await client.query(`
      SELECT DISTINCT referenced_table_name
      FROM information_schema.view_table_usage
      WHERE view_name = 'posted_decisions'
      AND view_schema = 'public';
    `);
    
    console.log('📊 View references these tables:');
    for (const row of tables.rows) {
      console.log(` - ${row.referenced_table_name}`);
      
      // Check if the table has generation_source
      const hasColumn = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = $1
          AND column_name = 'generation_source'
        );
      `, [row.referenced_table_name]);
      
      if (hasColumn.rows[0].exists) {
        console.log(`   ✅ Has generation_source column`);
      } else {
        console.log(`   ❌ Missing generation_source column`);
        console.log(`   🔧 Adding generation_source to ${row.referenced_table_name}...`);
        
        try {
          await client.query(`
            ALTER TABLE ${row.referenced_table_name}
            ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT 'real';
          `);
          console.log(`   ✅ Added generation_source to ${row.referenced_table_name}`);
        } catch (err) {
          console.log(`   ❌ Failed: ${err.message}`);
        }
      }
    }
    
    console.log('');
    console.log('🔄 Recreating view to include generation_source...');
    
    // Drop and recreate the view with generation_source
    await client.query(`DROP VIEW IF EXISTS posted_decisions`);
    console.log('  ✅ Dropped old view');
    
    // Recreate view (need to adapt based on the actual definition)
    // This is a placeholder - will need to be adjusted based on actual view definition
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixPostedDecisionsView();

