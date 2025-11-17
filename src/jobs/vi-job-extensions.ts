/**
 * 🔗 VISUAL INTELLIGENCE: Job Extensions
 * 
 * Extends existing jobs with VI functionality:
 * - peer_scraper → Add VI account scraping
 * - data_collection → Add VI processing + auto-seed
 * - account_discovery → Add micro-influencer finding (weekly)
 * 
 * All extensions are feature-flagged (VISUAL_INTELLIGENCE_ENABLED)
 * 
 * USAGE:
 * Import and call these from existing jobs:
 * 
 * // In peer_scraper job:
 * await runVIAccountScraping();
 * 
 * // In data_collection job:
 * await autoSeedIfNeeded(); // Auto-seeds on first run
 * await runVIProcessing();
 * 
 * // In account_discovery job (weekly only):
 * await runVIAccountDiscovery();
 */

import { log } from '../lib/logger';
import { getSupabaseClient } from '../db/index';

// ═══════════════════════════════════════════════════════════
// AUTO-SEED: Seeds accounts on first run (no manual step)
// ═══════════════════════════════════════════════════════════

const SEED_ACCOUNTS = [
  // Original 100 accounts
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
  'insidePN', 'suppversity', 'OxygenAdvantage', 'NatureAging', 'ZOE',
  
  // ✅ EXPANDED: Added 75 more high-quality health/longevity accounts
  // Longevity & Biohacking
  'davidasinclair', 'brad_stulberg', 'MatthewWalkerPhD', 'alexhormozi', 'hubermanlab',
  'RhondaPatrick', 'DrMarkHyman', 'bengreenfield', 'maxlugavere', 'DaveAsprey',
  // Nutrition & Metabolism
  'syattfitness', 'thefitnesschef_', 'mennohenselman', 'adamragusea', 'RobbWolf',
  'drstephenphd', 'timferriss', 'drgominak', 'DrSarahBallantyne', 'nickelnutrition',
  // Fitness & Performance
  'DrMikeISRAETAEL', 'DrStephanieButtermore', 'eric_helms', 'gregnuckols', 'jeffnippard',
  'strengthcoachdan', 'andybaker72', 'zacharymoody', 'scottabel', 'dylanbozeman',
  // Mental Health & Neuroscience
  'drdrewpinsky', 'DrMatthewLieberman', 'drpeternatt', 'DrLisaFeldmanBarrett', 'DrJudBrewer',
  'AndrewHuberman', 'DrSaraGottfried', 'DrKellyBrogan', 'DrDanielAmen', 'DrDavidBurns',
  // Sleep & Recovery
  'daniellebarlow', 'nicklittlehales', 'sleephq', 'drmichaelyoung', 'sleepgeek',
  // Women's Health
  'DrJoleneBrighten', 'drjenniferlanda', 'drchristinamotsch', 'DrJessicaShepherd', 'DrLaurenStreicher',
  // Integrative Medicine
  'DrRanganChatterjee', 'DrWillCole', 'DrZachBush', 'DrMarkCrislip', 'DrBenLynch',
  // Research & Science Communication
  'sciencebasedmed', 'DrPaulOffit', 'skepticalscalpel', 'DrStevenNovella', 'DrDavidGorski',
  // Health Optimization
  'OutliveAuthor', 'DrAlpHutchins', 'DrTynaMoore', 'DrBruceHoffman', 'DrCarolineApovian',
  // Public Health
  'DrLeanaWen', 'ashishkjha', 'DrMichaelGreger', 'DrDeanOrnish', 'DrAshishJha'
];

/**
 * Auto-seed accounts on first run (idempotent - safe to run multiple times)
 */
export async function autoSeedIfNeeded(): Promise<void> {
  // Check feature flag
  if (process.env.VISUAL_INTELLIGENCE_ENABLED !== 'true') {
    return; // Skip if disabled
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Check if already seeded
    const { count } = await supabase
      .from('vi_scrape_targets')
      .select('*', { count: 'exact', head: true });
    
    if (count && count > 0) {
      // Already seeded, skip
      return;
    }
    
    log({ op: 'vi_auto_seed_start', accounts: SEED_ACCOUNTS.length });
    
    // Seed accounts
    for (const username of SEED_ACCOUNTS) {
      await supabase.from('vi_scrape_targets').upsert({
        username,
        tier: null, // Will be auto-assigned on first scrape
        tier_weight: null,
        followers_count: null,
        discovery_method: 'manual_seed',
        inclusion_reason: 'Initial seed account (batch of 100)',
        is_active: true,
        is_health_verified: true
      }, {
        onConflict: 'username',
        ignoreDuplicates: true
      });
    }
    
    log({ op: 'vi_auto_seed_complete', seeded: SEED_ACCOUNTS.length });
    
  } catch (error: any) {
    log({ op: 'vi_auto_seed_error', error: error.message });
    // Don't throw - let job continue
  }
}

/**
 * VI Extension for peer_scraper job
 * Scrapes 100 VI accounts for visual intelligence
 */
export async function runVIAccountScraping(): Promise<void> {
  // Check feature flag
  if (process.env.VISUAL_INTELLIGENCE_ENABLED !== 'true') {
    return; // Silently skip if disabled
  }
  
  log({ op: 'vi_extension_scraping_start' });
  
  try {
    const { scrapeVIAccounts } = await import('../intelligence/viAccountScraper');
    await scrapeVIAccounts();
    
    log({ op: 'vi_extension_scraping_complete' });
    
  } catch (error: any) {
    log({ op: 'vi_extension_scraping_error', error: error.message });
    // Don't throw - let peer_scraper continue even if VI fails
  }
}

/**
 * VI Extension for data_collection job
 * Classifies, analyzes, and builds intelligence from tweets
 */
export async function runVIProcessing(): Promise<void> {
  // Check feature flag
  if (process.env.VISUAL_INTELLIGENCE_ENABLED !== 'true') {
    return; // Silently skip if disabled
  }
  
  log({ op: 'vi_extension_processing_start' });
  
  try {
    const { processVITweets } = await import('../intelligence/viProcessor');
    await processVITweets();
    
    log({ op: 'vi_extension_processing_complete' });
    
  } catch (error: any) {
    log({ op: 'vi_extension_processing_error', error: error.message });
    // Don't throw - let data_collection continue even if VI fails
  }
}

/**
 * VI Extension for account_discovery job
 * Discovers new micro-influencer accounts (weekly only)
 */
export async function runVIAccountDiscovery(): Promise<void> {
  // Check feature flag
  if (process.env.VISUAL_INTELLIGENCE_ENABLED !== 'true') {
    return; // Silently skip if disabled
  }
  
  // Only run on Sundays (weekly)
  const isSunday = new Date().getDay() === 0;
  if (!isSunday) {
    return; // Skip on other days
  }
  
  log({ op: 'vi_extension_discovery_start' });
  
  try {
    const { discoverMicroInfluencers } = await import('../intelligence/viAccountFinder');
    await discoverMicroInfluencers();
    
    log({ op: 'vi_extension_discovery_complete' });
    
  } catch (error: any) {
    log({ op: 'vi_extension_discovery_error', error: error.message });
    // Don't throw - let account_discovery continue even if VI fails
  }
}

/**
 * Apply visual formatting to generated content
 * Called by planJob after content generation
 */
export async function applyVIFormatting(
  rawContent: string,
  params: {
    topic: string;
    angle?: string;
    tone?: string;
    structure?: string;
  }
): Promise<string> {
  // Check feature flag
  if (process.env.VISUAL_INTELLIGENCE_ENABLED !== 'true') {
    return rawContent; // Return unformatted if disabled
  }
  
  try {
    const { applyVisualFormatting } = await import('../intelligence/viIntelligenceFeed');
    const formatted = await applyVisualFormatting(rawContent, params);
    
    return formatted;
    
  } catch (error: any) {
    log({ op: 'vi_formatting_error', error: error.message });
    return rawContent; // Fallback to unformatted on error
  }
}

