// Inspect actual table schemas from Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 INSPECTING TABLE SCHEMAS FROM DATABASE\n');
console.log('='.repeat(80));

async function inspectCriticalTables() {
  const criticalTables = [
    'content_metadata',
    'content_generation_metadata_comprehensive',
    'posted_decisions',
    'tweets',
    'posts',
    'outcomes',
    'real_tweet_metrics',
    'tweet_analytics',
    'tweet_metrics',
    'reply_opportunities',
    'reply_conversions',
    'learning_posts',
    'follower_snapshots'
  ];

  const schemas = {};

  for (const tableName of criticalTables) {
    console.log(`\n📊 Inspecting: ${tableName}`);
    console.log('-'.repeat(80));
    
    try {
      // Get schema info from information_schema
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', tableName)
        .order('ordinal_position');

      if (error) {
        console.log(`   ⚠️  Error: ${error.message}`);
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`   ❌ Table not found or empty`);
        continue;
      }

      console.log(`   ✅ Found ${data.length} columns:`);
      
      schemas[tableName] = {
        columns: data,
        columnNames: data.map(c => c.column_name)
      };

      // Print columns
      data.forEach((col, idx) => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`   ${(idx + 1).toString().padStart(2)}. ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable}`);
      });

      // Check for critical columns
      const hasDecisionId = data.some(c => c.column_name === 'decision_id');
      const hasTweetId = data.some(c => c.column_name === 'tweet_id');
      const hasGenerator = data.some(c => c.column_name === 'generator_name');
      const hasTopic = data.some(c => c.column_name === 'raw_topic' || c.column_name === 'topic_cluster');
      const hasAngle = data.some(c => c.column_name === 'angle');
      const hasTone = data.some(c => c.column_name === 'tone');
      const hasTargetTweetId = data.some(c => c.column_name === 'target_tweet_id');
      const hasTargetUsername = data.some(c => c.column_name === 'target_username');

      console.log(`\n   🔍 Critical columns check:`);
      console.log(`      decision_id: ${hasDecisionId ? '✅' : '❌'}`);
      console.log(`      tweet_id: ${hasTweetId ? '✅' : '❌'}`);
      console.log(`      generator_name: ${hasGenerator ? '✅' : '❌'}`);
      console.log(`      topic (raw_topic/topic_cluster): ${hasTopic ? '✅' : '❌'}`);
      console.log(`      angle: ${hasAngle ? '✅' : '❌'}`);
      console.log(`      tone: ${hasTone ? '✅' : '❌'}`);
      console.log(`      target_tweet_id: ${hasTargetTweetId ? '✅' : '❌'}`);
      console.log(`      target_username: ${hasTargetUsername ? '✅' : '❌'}`);

    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
  }

  return schemas;
}

async function compareOverlappingTables() {
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('🔀 COMPARING OVERLAPPING TABLES');
  console.log('='.repeat(80));

  // Compare content queue tables
  console.log('\n📋 CONTENT QUEUE COMPARISON:');
  console.log('   content_metadata vs content_generation_metadata_comprehensive\n');

  const { data: cm } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'content_metadata');

  const { data: cg } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'content_generation_metadata_comprehensive');

  if (cm && cg) {
    const cmCols = new Set(cm.map(c => c.column_name));
    const cgCols = new Set(cg.map(c => c.column_name));

    const onlyInCM = [...cmCols].filter(c => !cgCols.has(c));
    const onlyInCG = [...cgCols].filter(c => !cmCols.has(c));
    const inBoth = [...cmCols].filter(c => cgCols.has(c));

    console.log(`   Columns in BOTH: ${inBoth.length}`);
    console.log(`   Only in content_metadata: ${onlyInCM.length}`);
    if (onlyInCM.length > 0) {
      onlyInCM.forEach(c => console.log(`      - ${c}`));
    }
    console.log(`   Only in comprehensive: ${onlyInCG.length}`);
    if (onlyInCG.length > 0) {
      onlyInCG.forEach(c => console.log(`      - ${c}`));
    }
  }

  // Compare posted tables
  console.log('\n📋 POSTED CONTENT COMPARISON:');
  console.log('   posted_decisions vs tweets vs posts\n');

  const { data: pd } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'posted_decisions');

  const { data: tw } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'tweets');

  const { data: po } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'posts');

  if (pd && tw && po) {
    const pdCols = new Set(pd.map(c => c.column_name));
    const twCols = new Set(tw.map(c => c.column_name));
    const poCols = new Set(po.map(c => c.column_name));

    const allCols = new Set([...pdCols, ...twCols, ...poCols]);
    
    console.log(`   Total unique columns across all 3: ${allCols.size}`);
    console.log(`   posted_decisions has: ${pdCols.size} columns`);
    console.log(`   tweets has: ${twCols.size} columns`);
    console.log(`   posts has: ${poCols.size} columns`);

    const inAll3 = [...allCols].filter(c => pdCols.has(c) && twCols.has(c) && poCols.has(c));
    console.log(`\n   Columns in ALL 3 tables: ${inAll3.length}`);
    inAll3.forEach(c => console.log(`      - ${c}`));
  }
}

async function main() {
  const schemas = await inspectCriticalTables();
  await compareOverlappingTables();

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('TABLE_SCHEMAS_ACTUAL.json', JSON.stringify(schemas, null, 2));

  console.log('\n\n✅ Schema inspection complete!');
  console.log('📄 Saved to: TABLE_SCHEMAS_ACTUAL.json\n');
}

main().catch(console.error);
