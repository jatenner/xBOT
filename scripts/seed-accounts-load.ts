#!/usr/bin/env tsx

/**
 * 🌱 SEED ACCOUNTS LOADER
 * 
 * Loads ~200 health/fitness/wellness accounts into seed_accounts table
 * 
 * Usage:
 *   pnpm exec tsx scripts/seed-accounts-load.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface SeedAccountInput {
  handle: string;
  priority: number; // 10 = top-tier, 50 = strong niche, 100 = filler
  category: string;
}

// ~200 health/fitness/wellness accounts
const SEED_ACCOUNTS: SeedAccountInput[] = [
  // Priority 10: Top-tier mega accounts (high reach)
  { handle: 'hubermanlab', priority: 10, category: 'science' },
  { handle: 'peterattiamd', priority: 10, category: 'health' },
  { handle: 'foundmyfitness', priority: 10, category: 'longevity' },
  { handle: 'bengreenfield', priority: 10, category: 'health' },
  { handle: 'drmarkhyman', priority: 10, category: 'health' },
  { handle: 'drgundry', priority: 10, category: 'health' },
  { handle: 'jeff_nippard', priority: 10, category: 'fitness' },
  { handle: 'biolayne', priority: 10, category: 'nutrition' },
  { handle: 'drandygalpin', priority: 10, category: 'science' },
  { handle: 'drericberg', priority: 10, category: 'health' },
  { handle: 'WHO', priority: 10, category: 'health' },
  { handle: 'CDCgov', priority: 10, category: 'health' },
  { handle: 'NIH', priority: 10, category: 'science' },
  { handle: 'HarvardHealth', priority: 10, category: 'health' },
  { handle: 'JohnsHopkinsSPH', priority: 10, category: 'health' },
  
  // Priority 50: Strong niche accounts
  { handle: 'thefitnesschef_', priority: 50, category: 'fitness' },
  { handle: 'yudapearl', priority: 50, category: 'science' },
  { handle: 'nicknorwitzphd', priority: 50, category: 'science' },
  { handle: 'maxlugaver', priority: 50, category: 'nutrition' },
  { handle: 'daveasprey', priority: 50, category: 'health' },
  { handle: 'solbrah', priority: 50, category: 'fitness' },
  { handle: 'healthygamergg', priority: 50, category: 'health' },
  { handle: 'niallharbison', priority: 50, category: 'fitness' },
  { handle: 'breyermeyer', priority: 50, category: 'fitness' },
  { handle: 'fitfounder', priority: 50, category: 'fitness' },
  { handle: 'NEJM', priority: 50, category: 'science' },
  { handle: 'JAMA_current', priority: 50, category: 'science' },
  { handle: 'bmj_latest', priority: 50, category: 'science' },
  { handle: 'NatureMedicine', priority: 50, category: 'science' },
  { handle: 'EricTopol', priority: 50, category: 'science' },
  { handle: 'ExamineHQ', priority: 50, category: 'nutrition' },
  { handle: 'StrongerBySci', priority: 50, category: 'fitness' },
  { handle: 'HRV4Training', priority: 50, category: 'fitness' },
  { handle: 'marco_altini', priority: 50, category: 'fitness' },
  { handle: 'kevinnbass', priority: 50, category: 'fitness' },
  { handle: 'CaloriesProper', priority: 50, category: 'nutrition' },
  { handle: 'martykendall2', priority: 50, category: 'nutrition' },
  { handle: 'zoeharcombe', priority: 50, category: 'nutrition' },
  { handle: 'DrGilCarvalho', priority: 50, category: 'nutrition' },
  { handle: 'BarbellMedicine', priority: 50, category: 'fitness' },
  { handle: 'PainScience', priority: 50, category: 'health' },
  { handle: 'GregLehman', priority: 50, category: 'health' },
  { handle: 'AdamMeakins', priority: 50, category: 'health' },
  { handle: 'GidMK', priority: 50, category: 'health' },
  { handle: 'Neuro_Skeptic', priority: 50, category: 'science' },
  { handle: 'MicrobiomDigest', priority: 50, category: 'health' },
  { handle: 'DrNadolsky', priority: 50, category: 'health' },
  { handle: 'TheAlanAragon', priority: 50, category: 'nutrition' },
  { handle: 'BioLayne', priority: 50, category: 'nutrition' },
  { handle: 'EpiEllie', priority: 50, category: 'nutrition' },
  { handle: 'MicrobiomeJ', priority: 50, category: 'health' },
  { handle: 'GMFHx', priority: 50, category: 'health' },
  { handle: 'bykriscampbell', priority: 50, category: 'nutrition' },
  { handle: 'andrew_flatt', priority: 50, category: 'fitness' },
  { handle: 'DrLeahLagos', priority: 50, category: 'health' },
  { handle: 'SylvainLaborde_', priority: 50, category: 'fitness' },
  { handle: 'OptimalHRV', priority: 50, category: 'fitness' },
  { handle: 'WMicrobiomeDay', priority: 50, category: 'health' },
  { handle: 'microbiomedao', priority: 50, category: 'health' },
  { handle: 'TheGutHealthDoc', priority: 50, category: 'health' },
  { handle: 'OurWorldInData', priority: 50, category: 'science' },
  { handle: 'TheLancet', priority: 50, category: 'science' },
  { handle: 'TheLancetPH', priority: 50, category: 'health' },
  { handle: 'PLOSMedicine', priority: 50, category: 'science' },
  { handle: 'Nature', priority: 50, category: 'science' },
  { handle: 'CellPressNews', priority: 50, category: 'science' },
  { handle: 'STATnews', priority: 50, category: 'health' },
  { handle: 'BMJ_Open', priority: 50, category: 'science' },
  { handle: 'American_Heart', priority: 50, category: 'health' },
  { handle: 'ACCinTouch', priority: 50, category: 'health' },
  { handle: 'NIMHgov', priority: 50, category: 'health' },
  { handle: 'NIDDKgov', priority: 50, category: 'health' },
  { handle: 'AmDiabetesAssn', priority: 50, category: 'health' },
  { handle: 'US_FDA', priority: 50, category: 'health' },
  { handle: 'Surgeon_General', priority: 50, category: 'health' },
  { handle: 'NASEM_Health', priority: 50, category: 'health' },
  { handle: 'CochraneLibrary', priority: 50, category: 'science' },
  { handle: 'NutritionOrg', priority: 50, category: 'nutrition' },
  { handle: 'SleepFoundation', priority: 50, category: 'health' },
  { handle: 'PeterAttiaMD', priority: 50, category: 'health' },
  { handle: 'sleepdiplomat', priority: 50, category: 'health' },
  { handle: 'Jeukendrup', priority: 50, category: 'fitness' },
  { handle: 'mackinprof', priority: 50, category: 'fitness' },
  { handle: 'BradSchoenfeld', priority: 50, category: 'fitness' },
  { handle: 'MennoHenselmans', priority: 50, category: 'fitness' },
  { handle: 'GregNuckols', priority: 50, category: 'fitness' },
  { handle: 'AlaNutr', priority: 50, category: 'nutrition' },
  { handle: 'Scienceofsport', priority: 50, category: 'fitness' },
  { handle: 'sweatscience', priority: 50, category: 'fitness' },
  { handle: 'DavidEpstein', priority: 50, category: 'fitness' },
  { handle: 'HelenBranswell', priority: 50, category: 'health' },
  { handle: 'carlzimmer', priority: 50, category: 'science' },
  { handle: 'edyong209', priority: 50, category: 'science' },
  { handle: 'thegermguy', priority: 50, category: 'health' },
  { handle: 'YoniFreedhoff', priority: 50, category: 'nutrition' },
  { handle: 'sguyenet', priority: 50, category: 'nutrition' },
  { handle: 'KevinH_PhD', priority: 50, category: 'nutrition' },
  { handle: 'TomGoom', priority: 50, category: 'health' },
  { handle: 'BenCoomber', priority: 50, category: 'fitness' },
  { handle: 'euanashley', priority: 50, category: 'health' },
  { handle: 'DrTomFrieden', priority: 50, category: 'health' },
  { handle: 'florian_krammer', priority: 50, category: 'health' },
  { handle: 'trishgreenhalgh', priority: 50, category: 'health' },
  { handle: 'ZDoggMD', priority: 50, category: 'health' },
  { handle: 'Atul_Gawande', priority: 50, category: 'health' },
  { handle: 'kevinmd', priority: 50, category: 'health' },
  { handle: 'PulmCrit', priority: 50, category: 'health' },
  { handle: 'Medscape', priority: 50, category: 'health' },
  { handle: 'JAMANetworkOpen', priority: 50, category: 'science' },
  { handle: 'JACCJournals', priority: 50, category: 'health' },
  { handle: 'AnnalsofIM', priority: 50, category: 'health' },
  { handle: 'ChrisMasterjohn', priority: 50, category: 'nutrition' },
  { handle: 'NatureAging', priority: 50, category: 'science' },
  { handle: 'ZOE', priority: 50, category: 'health' },
  
  // Priority 100: Filler/longtail accounts
  { handle: 'DrRanganChatterjee', priority: 100, category: 'health' },
  { handle: 'DrWillCole', priority: 100, category: 'health' },
  { handle: 'DrZachBush', priority: 100, category: 'health' },
  { handle: 'DrMarkCrislip', priority: 100, category: 'health' },
  { handle: 'DrBenLynch', priority: 100, category: 'health' },
  { handle: 'sciencebasedmed', priority: 100, category: 'science' },
  { handle: 'DrPaulOffit', priority: 100, category: 'health' },
  { handle: 'skepticalscalpel', priority: 100, category: 'health' },
  { handle: 'DrStevenNovella', priority: 100, category: 'science' },
  { handle: 'DrDavidGorski', priority: 100, category: 'health' },
  { handle: 'OutliveAuthor', priority: 100, category: 'health' },
  { handle: 'DrAlpHutchins', priority: 100, category: 'health' },
  { handle: 'DrTynaMoore', priority: 100, category: 'health' },
  { handle: 'DrBruceHoffman', priority: 100, category: 'health' },
  { handle: 'DrCarolineApovian', priority: 100, category: 'health' },
  { handle: 'DrLeanaWen', priority: 100, category: 'health' },
  { handle: 'ashishkjha', priority: 100, category: 'health' },
  { handle: 'DrMichaelGreger', priority: 100, category: 'nutrition' },
  { handle: 'DrDeanOrnish', priority: 100, category: 'health' },
  { handle: 'DrAshishJha', priority: 100, category: 'health' },
  { handle: 'DrRhondaPatrick', priority: 100, category: 'science' },
  { handle: 'DrSatchinPanda', priority: 100, category: 'health' },
  { handle: 'DrValterLongo', priority: 100, category: 'longevity' },
  { handle: 'DrDavidSinclair', priority: 100, category: 'longevity' },
  { handle: 'DrMattKaeberlein', priority: 100, category: 'longevity' },
  { handle: 'DrNirBarzilai', priority: 100, category: 'longevity' },
  { handle: 'DrJamesKirkland', priority: 100, category: 'longevity' },
  { handle: 'DrJudithCampisi', priority: 100, category: 'longevity' },
  { handle: 'DrFelipeSierra', priority: 100, category: 'longevity' },
  { handle: 'DrBrianKennedy', priority: 100, category: 'longevity' },
  { handle: 'DrLauraNiedernhofer', priority: 100, category: 'longevity' },
  { handle: 'DrPankajKapahi', priority: 100, category: 'longevity' },
  { handle: 'DrMattKaeberlein', priority: 100, category: 'longevity' },
  { handle: 'DrMorganLevine', priority: 100, category: 'longevity' },
  { handle: 'DrSteveHorvath', priority: 100, category: 'longevity' },
  { handle: 'DrAlessioFasano', priority: 100, category: 'health' },
  { handle: 'DrTimSpector', priority: 100, category: 'health' },
  { handle: 'DrJustinSonnenburg', priority: 100, category: 'health' },
  { handle: 'DrEranElinav', priority: 100, category: 'health' },
  { handle: 'DrSarkisMazmanian', priority: 100, category: 'health' },
  { handle: 'DrRobKnight', priority: 100, category: 'health' },
  { handle: 'DrJackGilbert', priority: 100, category: 'health' },
  { handle: 'DrMartinBlaser', priority: 100, category: 'health' },
  { handle: 'DrMariaGloriaDominguezBello', priority: 100, category: 'health' },
  { handle: 'DrEmeranMayer', priority: 100, category: 'health' },
  { handle: 'DrMichaelGershon', priority: 100, category: 'health' },
  { handle: 'DrGaryWu', priority: 100, category: 'health' },
  { handle: 'DrJamesLewis', priority: 100, category: 'health' },
  { handle: 'DrRamnikXavier', priority: 100, category: 'health' },
  { handle: 'DrDanKnight', priority: 100, category: 'health' },
  { handle: 'DrCurtisHuttenhower', priority: 100, category: 'health' },
  { handle: 'DrCatherineLozupone', priority: 100, category: 'health' },
  { handle: 'DrRobynneChutkan', priority: 100, category: 'health' },
  { handle: 'DrWillBulsiewicz', priority: 100, category: 'health' },
  { handle: 'DrVincentPedre', priority: 100, category: 'health' },
  { handle: 'DrMarkHyman', priority: 100, category: 'health' },
  { handle: 'DrAmyMyers', priority: 100, category: 'health' },
  { handle: 'DrIzabellaWentz', priority: 100, category: 'health' },
  { handle: 'DrTerryWahls', priority: 100, category: 'health' },
  { handle: 'DrSarahBallantyne', priority: 100, category: 'nutrition' },
  { handle: 'DrChrisKresser', priority: 100, category: 'health' },
  { handle: 'DrKellyBrogan', priority: 100, category: 'health' },
  { handle: 'DrMarkMattson', priority: 100, category: 'health' },
  { handle: 'DrSatchidanandaPanda', priority: 100, category: 'health' },
  { handle: 'DrMichaelBreus', priority: 100, category: 'health' },
  { handle: 'DrMatthewWalker', priority: 100, category: 'health' },
  { handle: 'DrRaphaelPelayo', priority: 100, category: 'health' },
  { handle: 'DrWendyTroxel', priority: 100, category: 'health' },
  { handle: 'DrMichaelGrandner', priority: 100, category: 'health' },
  { handle: 'DrAllisonSiebern', priority: 100, category: 'health' },
  { handle: 'DrColleenCarney', priority: 100, category: 'health' },
  { handle: 'DrRachelManber', priority: 100, category: 'health' },
  { handle: 'DrDonnPosner', priority: 100, category: 'health' },
  { handle: 'DrMichaelPerlis', priority: 100, category: 'health' },
  { handle: 'DrDanielBuysse', priority: 100, category: 'health' },
  { handle: 'DrCharlesMorin', priority: 100, category: 'health' },
  { handle: 'DrKennethWright', priority: 100, category: 'health' },
  { handle: 'DrTillRoenneberg', priority: 100, category: 'health' },
  { handle: 'DrRussellFoster', priority: 100, category: 'health' },
  { handle: 'DrStevenLockley', priority: 100, category: 'health' },
  { handle: 'DrShanthaRajaratnam', priority: 100, category: 'health' },
  { handle: 'DrDerkJanDijk', priority: 100, category: 'health' },
  { handle: 'DrElizabethKlerman', priority: 100, category: 'health' },
  { handle: 'DrPhyllisZee', priority: 100, category: 'health' },
  { handle: 'DrKristenKnutson', priority: 100, category: 'health' },
  { handle: 'DrLaurenHale', priority: 100, category: 'health' },
  { handle: 'DrOrfeuBuxton', priority: 100, category: 'health' },
  { handle: 'DrNamniGoel', priority: 100, category: 'health' },
  { handle: 'DrDavidDinges', priority: 100, category: 'health' },
  { handle: 'DrHansVanDongen', priority: 100, category: 'health' },
  { handle: 'DrGregoryBelenky', priority: 100, category: 'health' },
  { handle: 'DrThomasBalkin', priority: 100, category: 'health' },
  { handle: 'DrMichaelBonnet', priority: 100, category: 'health' },
  { handle: 'DrDonnaArand', priority: 100, category: 'health' },
  { handle: 'DrCleteKushida', priority: 100, category: 'health' },
  { handle: 'DrMerrillMitler', priority: 100, category: 'health' },
  { handle: 'DrMarkMahowald', priority: 100, category: 'health' },
  { handle: 'DrCarlosSchenck', priority: 100, category: 'health' },
  { handle: 'DrRosalindCartwright', priority: 100, category: 'health' },
  { handle: 'DrJeromeSiegel', priority: 100, category: 'health' },
  { handle: 'DrCliffordSaper', priority: 100, category: 'health' },
  { handle: 'DrLuisdeLecea', priority: 100, category: 'health' },
  { handle: 'DrThomasScammell', priority: 100, category: 'health' },
  { handle: 'DrEmmanuelMignot', priority: 100, category: 'health' },
  { handle: 'DrSeijiNishino', priority: 100, category: 'health' },
  { handle: 'DrMasashiYanagisawa', priority: 100, category: 'health' },
  { handle: 'DrYvesDauvilliers', priority: 100, category: 'health' },
  { handle: 'DrGertJanLammers', priority: 100, category: 'health' },
  { handle: 'DrRafaelPelayo', priority: 100, category: 'health' },
];

async function main() {
  console.log('🌱 Loading seed accounts into database...');
  console.log(`   Total accounts: ${SEED_ACCOUNTS.length}`);
  
  const supabase = getSupabaseClient();
  let loaded = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const account of SEED_ACCOUNTS) {
    try {
      const { error } = await supabase
        .from('seed_accounts')
        .upsert({
          handle: account.handle.toLowerCase().trim(),
          enabled: true,
          priority: account.priority,
          category: account.category,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'handle',
        });
      
      if (error) {
        // Check if table doesn't exist
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.error(`   ❌ Table seed_accounts does not exist. Please apply migration first.`);
          console.error(`   Run: supabase migration up`);
          process.exit(1);
        }
        console.error(`   ❌ Failed to load @${account.handle}: ${error.message || 'Unknown error'}`);
        errors++;
      } else {
        loaded++;
      }
    } catch (error: any) {
      console.error(`   ❌ Error loading @${account.handle}: ${error.message}`);
      errors++;
    }
  }
  
  // Get final count
  const { count: totalCount } = await supabase
    .from('seed_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true);
  
  const { count: priority10Count } = await supabase
    .from('seed_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true)
    .eq('priority', 10);
  
  const { count: priority50Count } = await supabase
    .from('seed_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true)
    .eq('priority', 50);
  
  const { count: priority100Count } = await supabase
    .from('seed_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true)
    .eq('priority', 100);
  
  console.log('');
  console.log('✅ Seed accounts loaded:');
  console.log(`   Total enabled: ${totalCount || 0}`);
  console.log(`   Priority 10 (top-tier): ${priority10Count || 0}`);
  console.log(`   Priority 50 (strong niche): ${priority50Count || 0}`);
  console.log(`   Priority 100 (filler): ${priority100Count || 0}`);
  console.log(`   Loaded this run: ${loaded}`);
  console.log(`   Skipped (duplicates): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log('');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

