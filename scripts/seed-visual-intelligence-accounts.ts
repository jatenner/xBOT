#!/usr/bin/env npx tsx

/**
 * 🌱 SEED VISUAL INTELLIGENCE ACCOUNTS
 * 
 * Seeds 100 health/longevity accounts for visual intelligence learning
 * Accounts will be auto-tiered based on follower count when first scraped
 */

import { getSupabaseClient } from '../src/db/index';

const SEED_ACCOUNTS = [
  // Provided by user - 100 accounts total
  'WHO', 'CDCgov', 'NIH', 'HarvardHealth', 'JohnsHopkinsSPH',
  'NEJM', 'JAMA_current', 'bmj_latest', 'NatureMedicine', 'EricTopol',
  'ExamineHQ', 'StrongerBySci', 'HRV4Training', 'marco_altini', 'kevinnbass',
  'CaloriesProper', 'martykendall2', 'zoeharcombe', 'DrGilCarvalho', 'BarbellMedicine',
  'PainScience', 'GregLehman', 'AdamMeakins', 'GidMK', 'Neuro_Skeptic',
  'MicrobiomDigest', 'DrNadolsky', 'TheAlanAragon', 'BioLayne', 'EpiEllie',
  'MicrobiomeJ', 'GMFHx', 'bykriscampbell', 'andrew_flatt', 'DrLeahLagos',
  'SylvainLaborde_', 'OptimalHRV', 'WMicrobiomeDay', 'microbiomedao', 'TheGutHealthDoc',
  'OurWorldInData', 'TheLancet', 'TheLancetPH', 'PLOSMedicine', 'Nature',
  'CellPressNews', 'STATnews', 'BMJ_Open', 'American_Heart', 'ACCinTouch',
  'NIMHgov', 'NIDDKgov', 'AmDiabetesAssn', 'US_FDA', 'Surgeon_General',
  'NASEM_Health', 'CochraneLibrary', 'NutritionOrg', 'SleepFoundation', 'PeterAttiaMD',
  'sleepdiplomat', 'DrAndyGalpin', 'Jeukendrup', 'mackinprof', 'BradSchoenfeld',
  'MennoHenselmans', 'GregNuckols', 'AlaNutr', 'Scienceofsport', 'sweatscience',
  'DavidEpstein', 'HelenBranswell', 'carlzimmer', 'edyong209', 'thegermguy',
  'YoniFreedhoff', 'sguyenet', 'KevinH_PhD', 'foundmyfitness', 'drchatterjeeuk',
  'TomGoom', 'BenCoomber', 'euanashley', 'DrTomFrieden', 'florian_krammer',
  'trishgreenhalgh', 'ZDoggMD', 'Atul_Gawande', 'kevinmd', 'PulmCrit',
  'Medscape', 'JAMANetworkOpen', 'JACCJournals', 'AnnalsofIM', 'ChrisMasterjohn',
  'insidePN', 'suppversity', 'OxygenAdvantage', 'NatureAging', 'ZOE'
];

async function seedAccounts() {
  console.log('🌱 SEED: Starting visual intelligence account seeding...');
  console.log(`   Total accounts: ${SEED_ACCOUNTS.length}`);
  
  const supabase = getSupabaseClient();
  let seeded = 0;
  let skipped = 0;
  
  for (const username of SEED_ACCOUNTS) {
    try {
      // Insert account (will be auto-tiered when first scraped)
      const { error } = await supabase
        .from('vi_scrape_targets')
        .upsert({
          username: username,
          tier: null, // Will be auto-assigned on first scrape based on follower count
          tier_weight: null, // Will be auto-assigned
          followers_count: null, // Will be fetched on first scrape
          discovery_method: 'manual_seed',
          inclusion_reason: `Initial seed account (batch of 100)`,
          is_active: true,
          is_health_verified: true // Manually verified as health niche
        }, {
          onConflict: 'username',
          ignoreDuplicates: true
        });
      
      if (error) {
        console.error(`   ❌ Failed to seed @${username}: ${error.message}`);
        skipped++;
      } else {
        seeded++;
      }
      
    } catch (error: any) {
      console.error(`   ❌ Error seeding @${username}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`\n✅ SEED COMPLETE:`);
  console.log(`   Seeded: ${seeded} accounts`);
  console.log(`   Skipped: ${skipped} accounts (errors or duplicates)`);
  console.log(`\n📊 NEXT STEPS:`);
  console.log(`   1. Account monitoring scraper will run every 6 hours`);
  console.log(`   2. Accounts will be auto-tiered on first scrape:`);
  console.log(`      • 1k-20k followers = micro (2.0x weight)`);
  console.log(`      • 20k-100k followers = growth (1.0x weight)`);
  console.log(`      • 100k+ followers = established (0.5x weight)`);
  console.log(`   3. Tweets collected, classified, and analyzed automatically`);
  console.log(`   4. Dashboard available at /visual-intelligence`);
}

seedAccounts().catch(console.error);

