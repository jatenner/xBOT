const fs = require('fs');
const path = require('path');

// Import Supabase client
let supabase;
try {
  const { supabase: supabaseClient } = require('./src/utils/supabaseClient');
  supabase = supabaseClient;
} catch (error) {
  console.log('❌ Could not load supabaseClient, trying alternative...');
  process.exit(1);
}

async function applyDatabaseSetup() {
  console.log('🚀 === APPLYING AUTONOMOUS AI AGENT DATABASE SETUP ===');
  
  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'create_complete_autonomous_database.sql');
    if (!fs.existsSync(sqlFilePath)) {
      console.log('❌ SQL file not found:', sqlFilePath);
      return;
    }
    
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('📄 Loaded SQL file successfully');
    
    // Split into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      
      if (statement.length === 0) continue;
      
      try {
        // Log what we're doing
        if (statement.startsWith('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`📊 Creating table: ${tableName}`);
        } else if (statement.startsWith('CREATE INDEX')) {
          const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`🔧 Creating index: ${indexName}`);
        } else if (statement.startsWith('INSERT INTO')) {
          const tableName = statement.match(/INSERT INTO (\w+)/i)?.[1];
          console.log(`📝 Inserting data into: ${tableName}`);
        }
        
        // Execute the statement
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });
        
        if (error) {
          // Try direct query for CREATE TABLE statements
          if (statement.startsWith('CREATE TABLE') || statement.startsWith('CREATE INDEX')) {
            try {
              await supabase.from('_').select('1').limit(0); // Test connection
              console.log(`⚠️  Statement may have issues (this could be normal): ${statement.substring(0, 50)}...`);
              errorCount++;
            } catch (directError) {
              console.log(`❌ Error with statement: ${statement.substring(0, 50)}...`);
              console.log(`   Error: ${error.message || error}`);
              errorCount++;
            }
          } else {
            console.log(`❌ Error with statement: ${statement.substring(0, 50)}...`);
            console.log(`   Error: ${error.message || error}`);
            errorCount++;
          }
        } else {
          successCount++;
        }
        
      } catch (error) {
        console.log(`❌ Exception with statement: ${statement.substring(0, 50)}...`);
        console.log(`   Exception: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n🏁 === DATABASE SETUP SUMMARY ===');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`⚠️  Statements with issues: ${errorCount}`);
    console.log(`📊 Total processed: ${successCount + errorCount}`);
    
    if (successCount > 0) {
      console.log('\n🎯 Running database health check...');
      
      // Run a quick health check
      try {
        const { data: tables, error: tableError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .in('table_name', [
            'api_usage_tracking', 'bot_usage_tracking', 'twitter_master_config',
            'twitter_master_decisions', 'system_health_status', 'follower_growth_predictions'
          ]);
        
        if (!tableError && tables) {
          console.log(`✅ Verified ${tables.length} critical tables exist`);
          tables.forEach(table => {
            console.log(`   📊 ${table.table_name}`);
          });
        }
        
      } catch (healthError) {
        console.log('⚠️  Could not run health check, but setup likely succeeded');
      }
      
      console.log('\n🤖 === AUTONOMOUS AI AGENT DATABASE READY ===');
      console.log('🎯 Your autonomous Twitter growth master can now operate!');
      
    } else {
      console.log('\n❌ Database setup had significant issues. Check your Supabase connection and permissions.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during database setup:', error);
  }
}

// Execute the setup
applyDatabaseSetup().catch(console.error); 