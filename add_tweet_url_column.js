const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
  console.log('🔧 Adding tweet_url column to content_metadata...');
  
  // Check if column already exists
  const { data: existing, error: checkError } = await supabase
    .from('content_metadata')
    .select('tweet_url')
    .limit(1);
  
  if (!checkError) {
    console.log('✅ tweet_url column already exists!');
    return;
  }
  
  if (checkError && !checkError.message.includes('does not exist')) {
    console.log('❌ Unexpected error:', checkError.message);
    return;
  }
  
  // Column doesn't exist, need to add it via SQL
  console.log('📝 Column does not exist. Need to add via Supabase SQL editor:');
  console.log('\n' + '='.repeat(70));
  console.log('ALTER TABLE content_metadata ADD COLUMN tweet_url TEXT;');
  console.log('='.repeat(70));
  console.log('\nℹ️  Go to Supabase dashboard → SQL Editor → Run this command');
}

addColumn().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
