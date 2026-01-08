/**
 * 🚀 INITIALIZE REPLY SYSTEM V2
 * 
 * Sets up candidate sources and seeds curated accounts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

// Curated accounts (health-focused) - Expanded to 50 for production
const CURATED_ACCOUNTS = [
  // Experts & Researchers
  { username: 'PeterAttiaMD', type: 'expert', topics: ['longevity', 'metabolism'] },
  { username: 'hubermanlab', type: 'expert', topics: ['neuroscience', 'sleep', 'fitness'] },
  { username: 'drjasonfung', type: 'expert', topics: ['fasting', 'metabolism', 'diabetes'] },
  { username: 'garytaubes', type: 'researcher', topics: ['nutrition', 'metabolism'] },
  { username: 'drgundry', type: 'practitioner', topics: ['nutrition', 'gut_health'] },
  { username: 'DrDavidPerlmutter', type: 'expert', topics: ['brain_health', 'nutrition'] },
  { username: 'DrMarkHyman', type: 'expert', topics: ['functional_medicine', 'nutrition'] },
  { username: 'DrAseemMalhotra', type: 'expert', topics: ['cardiovascular', 'nutrition'] },
  { username: 'DrRanganChatterjee', type: 'practitioner', topics: ['functional_medicine', 'wellness'] },
  { username: 'DrRhondaPatrick', type: 'researcher', topics: ['longevity', 'nutrition', 'supplements'] },
  { username: 'DrSaraGottfried', type: 'expert', topics: ['hormones', 'women_health'] },
  { username: 'DrWillCole', type: 'practitioner', topics: ['functional_medicine', 'gut_health'] },
  { username: 'DrKellyann', type: 'practitioner', topics: ['nutrition', 'bone_broth'] },
  { username: 'DrStevenGundry', type: 'practitioner', topics: ['nutrition', 'lectins'] },
  { username: 'DrAmyShah', type: 'expert', topics: ['hormones', 'wellness'] },
  
  // Fitness & Performance
  { username: 'AndyGalpin', type: 'expert', topics: ['strength', 'performance', 'recovery'] },
  { username: 'DrAndyGalpin', type: 'expert', topics: ['exercise_science', 'performance'] },
  { username: 'DrBradSchoenfeld', type: 'researcher', topics: ['strength', 'hypertrophy'] },
  { username: 'DrStuPhillips', type: 'researcher', topics: ['protein', 'muscle'] },
  { username: 'DrMikeIsraetel', type: 'expert', topics: ['strength', 'nutrition'] },
  { username: 'DrEricHelms', type: 'expert', topics: ['strength', 'nutrition'] },
  { username: 'DrLayneNorton', type: 'expert', topics: ['nutrition', 'strength'] },
  { username: 'DrSpencerNadolsky', type: 'practitioner', topics: ['obesity', 'metabolism'] },
  
  // Nutrition & Diet
  { username: 'DrRobertLustig', type: 'expert', topics: ['sugar', 'metabolism', 'obesity'] },
  { username: 'DrNinaTeicholz', type: 'researcher', topics: ['nutrition', 'fat'] },
  { username: 'DrSarahHallberg', type: 'expert', topics: ['diabetes', 'nutrition'] },
  { username: 'DrErikBerg', type: 'practitioner', topics: ['keto', 'nutrition'] },
  { username: 'DrKenDBerry', type: 'practitioner', topics: ['nutrition', 'keto'] },
  { username: 'DrPaulSaladino', type: 'practitioner', topics: ['carnivore', 'nutrition'] },
  { username: 'DrShawnBaker', type: 'practitioner', topics: ['carnivore', 'nutrition'] },
  
  // Sleep & Recovery
  { username: 'DrMatthewWalker', type: 'expert', topics: ['sleep', 'neuroscience'] },
  { username: 'DrMichaelBreus', type: 'expert', topics: ['sleep', 'circadian'] },
  
  // Mental Health & Brain
  { username: 'DrDanielAmen', type: 'expert', topics: ['brain_health', 'mental_health'] },
  { username: 'DrLisaMosconi', type: 'expert', topics: ['brain_health', 'nutrition'] },
  
  // Longevity & Biohacking
  { username: 'DrDavidSinclair', type: 'researcher', topics: ['longevity', 'aging'] },
  { username: 'DrBryanJohnson', type: 'practitioner', topics: ['longevity', 'biohacking'] },
  { username: 'DrPeterDiamandis', type: 'expert', topics: ['longevity', 'technology'] },
  
  // Women's Health
  { username: 'DrAvivaRomm', type: 'practitioner', topics: ['women_health', 'hormones'] },
  { username: 'DrJoleneBrighten', type: 'expert', topics: ['hormones', 'women_health'] },
  
  // Gut Health
  { username: 'DrWillBulsiewicz', type: 'practitioner', topics: ['gut_health', 'fiber'] },
  { username: 'DrJustinSonnenburg', type: 'researcher', topics: ['microbiome', 'gut_health'] },
  
  // Cardiovascular
  { username: 'DrMalcolmKendrick', type: 'expert', topics: ['cardiovascular', 'cholesterol'] },
  { username: 'DrJamesDiNicolantonio', type: 'researcher', topics: ['cardiovascular', 'nutrition'] },
  
  // General Health & Wellness
  { username: 'DrRupyAujla', type: 'practitioner', topics: ['nutrition', 'wellness'] },
  { username: 'DrRanganChatterjee', type: 'practitioner', topics: ['functional_medicine'] },
  { username: 'DrJoshAxe', type: 'practitioner', topics: ['nutrition', 'wellness'] },
  { username: 'DrMarkHyman', type: 'expert', topics: ['functional_medicine'] },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 INITIALIZING REPLY SYSTEM V2');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  
  // Step 1: Create candidate sources
  console.log('[INIT] Step 1: Creating candidate sources...');
  
  const sources = [
    {
      source_type: 'curated_accounts',
      source_name: 'CuratedAccountsFeed',
      config: { account_count: CURATED_ACCOUNTS.length },
      fetch_interval_minutes: 5,
    },
    {
      source_type: 'keyword_search',
      source_name: 'KeywordFeed',
      config: { keywords: ['creatine', 'protein', 'ozempic', 'cholesterol', 'zone 2', 'VO2 max', 'sleep'] },
      fetch_interval_minutes: 5,
    },
    {
      source_type: 'viral_watcher',
      source_name: 'ViralWatcherFeed',
      config: { viral_threshold_likes: 100 },
      fetch_interval_minutes: 5,
    },
  ];
  
  for (const source of sources) {
    const { data: existing } = await supabase
      .from('candidate_sources')
      .select('id')
      .eq('source_type', source.source_type)
      .single();
    
    if (!existing) {
      await supabase
        .from('candidate_sources')
        .insert(source);
      console.log(`[INIT] ✅ Created source: ${source.source_name}`);
    } else {
      console.log(`[INIT] ⏭️ Source already exists: ${source.source_name}`);
    }
  }
  
  // Step 2: Seed curated accounts
  console.log('\n[INIT] Step 2: Seeding curated accounts...');
  
  let seededCount = 0;
  for (const account of CURATED_ACCOUNTS) {
    const { data: existing } = await supabase
      .from('curated_accounts')
      .select('id')
      .eq('username', account.username)
      .single();
    
    if (!existing) {
      await supabase
        .from('curated_accounts')
        .insert({
          username: account.username,
          account_type: account.type,
          health_topics: account.topics,
          signal_score: 0.8, // High signal score
          enabled: true,
        });
      seededCount++;
    }
  }
  
  console.log(`[INIT] ✅ Seeded ${seededCount} curated accounts`);
  
  // Step 3: Initialize ratchet controller
  console.log('\n[INIT] Step 3: Initializing ratchet controller...');
  
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);
  
  const { data: existingRatchet } = await supabase
    .from('reply_ratchet_controller')
    .select('id')
    .eq('week_start_date', weekStart.toISOString().split('T')[0])
    .single();
  
  if (!existingRatchet) {
    await supabase
      .from('reply_ratchet_controller')
      .insert({
        week_start_date: weekStart.toISOString().split('T')[0],
        current_24h_views_threshold: 1000,
      });
    console.log(`[INIT] ✅ Created ratchet controller for week ${weekStart.toISOString().split('T')[0]}`);
  } else {
    console.log(`[INIT] ⏭️ Ratchet controller already exists`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ INITIALIZATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Sources: ${sources.length}`);
  console.log(`Curated accounts: ${seededCount} seeded`);
  console.log(`Ratchet controller: Initialized`);
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);

