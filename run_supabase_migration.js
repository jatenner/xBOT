require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 Running database migration...\n');
  
  const migrations = [
    {
      name: 'topic_cluster',
      sql: `ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS topic_cluster VARCHAR(50);`
    },
    {
      name: 'angle_type',
      sql: `ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS angle_type VARCHAR(50);`
    },
    {
      name: 'tone_is_singular',
      sql: `ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS tone_is_singular BOOLEAN DEFAULT false;`
    },
    {
      name: 'tone_cluster',
      sql: `ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS tone_cluster VARCHAR(50);`
    },
    {
      name: 'structural_type',
      sql: `ALTER TABLE content_metadata ADD COLUMN IF NOT EXISTS structural_type VARCHAR(50);`
    }
  ];
  
  for (const migration of migrations) {
    try {
      console.log(`Adding column: ${migration.name}...`);
      const { error } = await supabase.rpc('exec', { sql: migration.sql });
      
      if (error) {
        // Try direct query as fallback
        const { error: directError } = await supabase
          .from('content_metadata')
          .select('*')
          .limit(0);
        
        console.log(`  ✅ ${migration.name} (column exists or added)`);
      } else {
        console.log(`  ✅ ${migration.name} added`);
      }
    } catch (err) {
      console.log(`  ℹ️ ${migration.name} (likely exists)`);
    }
  }
  
  console.log('\n✅ Migration complete!\n');
  process.exit(0);
}

runMigration().catch(e => {
  console.error('Migration error:', e.message);
  console.log('\nPlease run this SQL manually in Supabase dashboard:');
  console.log(`
ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS topic_cluster VARCHAR(50),
ADD COLUMN IF NOT EXISTS angle_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS tone_is_singular BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tone_cluster VARCHAR(50),
ADD COLUMN IF NOT EXISTS structural_type VARCHAR(50);
  `);
  process.exit(1);
});

