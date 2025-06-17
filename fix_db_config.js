const { supabase } = require('./dist/utils/supabaseClient');

async function fixDatabase() {
  console.log('🔧 Fixing database configuration...');
  
  // Fix bot_config table
  const { data: existing, error: fetchError } = await supabase
    .from('bot_config')
    .select('*')
    .eq('key', 'DISABLE_BOT');
  
  if (fetchError || !existing || existing.length === 0) {
    console.log('⚙️ Creating DISABLE_BOT config...');
    const { error } = await supabase
      .from('bot_config')
      .insert({ key: 'DISABLE_BOT', value: 'false', description: 'Master bot disable switch' });
    
    if (error) console.error('Error:', error);
    else console.log('✅ Created DISABLE_BOT config');
  } else {
    console.log('✅ DISABLE_BOT config already exists');
  }
  
  // Fix control_flags table
  const { data: flagExists, error: flagError } = await supabase
    .from('control_flags')
    .select('*')
    .eq('id', 'DISABLE_BOT');
  
  if (flagError || !flagExists || flagExists.length === 0) {
    console.log('⚙️ Creating DISABLE_BOT flag...');
    const { error } = await supabase
      .from('control_flags')
      .insert({ id: 'DISABLE_BOT', value: false });
    
    if (error) console.error('Error:', error);
    else console.log('✅ Created DISABLE_BOT flag');
  } else {
    console.log('✅ DISABLE_BOT flag already exists');
  }
  
  console.log('🎯 Database fix completed!');
}

fixDatabase().catch(console.error); 