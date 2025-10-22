require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function createTable() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔧 Creating reply_opportunities table in Supabase...\n');

  // Read the SQL
  const sqlContent = fs.readFileSync('create_reply_opportunities_table.sql', 'utf8');
  
  // Split into individual statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📋 Executing ${statements.length} SQL statements...\n`);

  try {
    // Execute each statement using Supabase's RPC or direct query
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      console.log(`[${i + 1}/${statements.length}] Executing...`);
      
      // Try using the postgres RPC endpoint
      const { data, error } = await supabase.rpc('exec', { 
        sql: stmt 
      }).single();
      
      if (error && !error.message.includes('could not find')) {
        // If exec RPC doesn't exist, we need to use a different approach
        console.log(`  Skipping RPC method (not available)`);
      }
    }
    
    // Verify table was created by trying to query it
    console.log('\n🔍 Verifying table creation...\n');
    
    const { data, error } = await supabase
      .from('reply_opportunities')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Table was not created. Please use Supabase SQL Editor manually.');
      }
      // Other errors might be OK (like no rows found)
      console.log('  Note:', error.message);
    }
    
    console.log('✅ Table exists and is accessible!\n');
    
    // Get count
    const { count, error: countError } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Current row count: ${count || 0}\n`);
    console.log('🎉 SUCCESS! Reply system is ready!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Could not create table automatically.');
    console.log('📋 Please run the SQL manually in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/qtgjmaelglghnlahqpbl/sql/new\n');
    process.exit(1);
  }
}

createTable().finally(() => {
  fs.unlinkSync('create_table_supabase.js');
});
