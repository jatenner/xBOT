/**
 * 🎯 GENERATOR-ACCOUNT MAPPER
 * 
 * Maps VI scraped accounts to specific generators based on their content style.
 * Each generator needs examples from accounts that match its personality.
 * 
 * Examples:
 * - newsReporter → STATnews, Nature, JAMA (news accounts)
 * - historian → accounts that post historical health content
 * - storyteller → accounts that tell narratives
 * - dataNerd → accounts that post data-heavy content
 */

import { getSupabaseClient } from '../db/index';
import { GeneratorType } from './generatorMatcher';

export interface GeneratorAccountMapping {
  generator: GeneratorType;
  accountUsernames: string[];
  description: string;
}

/**
 * Map of generators to account types they need
 */
const GENERATOR_ACCOUNT_MAPPING: Record<GeneratorType, {
  keywords: string[];
  accountExamples: string[];
  description: string;
}> = {
  newsReporter: {
    keywords: ['breaking', 'new study', 'published', 'announces', 'reports', 'journal', 'research'],
    accountExamples: ['STATnews', 'Nature', 'JAMA_current', 'NEJM', 'bmj_latest', 'NatureMedicine', 'CellPressNews', 'PLOSMedicine'],
    description: 'Accounts that post breaking health news, new studies, journal publications'
  },
  historian: {
    keywords: ['history', 'discovered', 'evolution', 'used to think', 'timeline', 'past', 'ancient'],
    accountExamples: ['carlzimmer', 'edyong209', 'thegermguy', 'HelenBranswell'],
    description: 'Accounts that post historical health context, evolution of medical knowledge'
  },
  storyteller: {
    keywords: ['story', 'case study', 'patient', 'transformation', 'journey', 'narrative'],
    accountExamples: ['Atul_Gawande', 'kevinmd', 'ZDoggMD', 'DrTomFrieden'],
    description: 'Accounts that tell stories, case studies, patient narratives'
  },
  dataNerd: {
    keywords: ['data', 'study shows', 'n=', 'statistically', 'analysis', 'meta-analysis', 'cohort'],
    accountExamples: ['ExamineHQ', 'StrongerBySci', 'EricTopol', 'marco_altini', 'kevinnbass'],
    description: 'Accounts that post data-heavy, research-focused content with statistics'
  },
  mythBuster: {
    keywords: ['myth', 'debunk', 'actually', 'truth is', 'misconception', 'wrong', 'fact check'],
    accountExamples: ['Neuro_Skeptic', 'sciencebasedmed', 'skepticalscalpel', 'DrStevenNovella'],
    description: 'Accounts that debunk myths, correct misconceptions, fact-check'
  },
  contrarian: {
    keywords: ['challenge', 'conventional wisdom', 'mainstream', 'industry', 'system', 'question'],
    accountExamples: ['YoniFreedhoff', 'sguyenet', 'KevinH_PhD', 'DrPaulOffit'],
    description: 'Accounts that challenge mainstream thinking, question systems'
  },
  culturalBridge: {
    keywords: ['book', 'author', 'influencer', 'culture', 'trend', 'popular', 'celebrity'],
    accountExamples: ['timferriss', 'DavidEpstein', 'alexhormozi'],
    description: 'Accounts that connect health to culture, books, influencers, trends'
  },
  coach: {
    keywords: ['how to', 'protocol', 'step', 'routine', 'practice', 'implement', 'action'],
    accountExamples: ['DrAndyGalpin', 'BradSchoenfeld', 'MennoHenselmans', 'GregNuckols'],
    description: 'Accounts that post actionable protocols, how-to guides, routines'
  },
  explorer: {
    keywords: ['experimental', 'novel', 'emerging', 'cutting edge', 'new approach', 'trial'],
    accountExamples: ['bengreenfield', 'DaveAsprey', 'maxlugavere', 'DrMarkHyman'],
    description: 'Accounts that explore experimental, novel, cutting-edge approaches'
  },
  thoughtLeader: {
    keywords: ['insight', 'perspective', 'big picture', 'future', 'paradigm', 'shift'],
    accountExamples: ['PeterAttiaMD', 'davidasinclair', 'DrMarkHyman', 'foundmyfitness'],
    description: 'Accounts that provide big-picture insights, forward-thinking perspectives'
  },
  philosopher: {
    keywords: ['meaning', 'wisdom', 'philosophy', 'stoic', 'ancient', 'deeper', 'purpose'],
    accountExamples: ['DrRanganChatterjee', 'DrJudBrewer', 'DrLisaFeldmanBarrett'],
    description: 'Accounts that explore deeper meaning, philosophy, wisdom'
  },
  provocateur: {
    keywords: ['controversial', 'bold', 'challenge', 'question', 'why', 'provocative'],
    accountExamples: ['DrKellyBrogan', 'DrDanielAmen', 'DrDavidBurns'],
    description: 'Accounts that post provocative, bold, controversial content'
  },
  interestingContent: {
    keywords: ['surprising', 'fascinating', 'unexpected', 'counterintuitive', 'wow'],
    accountExamples: ['hubermanlab', 'RhondaPatrick', 'foundmyfitness'],
    description: 'Accounts that post surprising, counterintuitive, fascinating content'
  },
  dynamicContent: {
    keywords: [], // Flexible, uses any style
    accountExamples: ['hubermanlab', 'PeterAttiaMD', 'foundmyfitness'],
    description: 'Accounts that vary their content style dynamically'
  },
  popCultureAnalyst: {
    keywords: ['trend', 'viral', 'popular', 'culture', 'influencer', 'celebrity', 'social'],
    accountExamples: ['alexhormozi', 'timferriss', 'DavidEpstein'],
    description: 'Accounts that connect health to pop culture, trends, influencers'
  },
  teacher: {
    keywords: ['explain', 'learn', 'understand', 'teach', 'education', 'step-by-step'],
    accountExamples: ['DrAndyGalpin', 'MatthewWalkerPhD', 'DrSaraGottfried'],
    description: 'Accounts that teach, explain step-by-step, educational content'
  },
  investigator: {
    keywords: ['investigate', 'research', 'deep dive', 'analysis', 'synthesis', 'multiple studies'],
    accountExamples: ['EricTopol', 'ExamineHQ', 'StrongerBySci', 'marco_altini'],
    description: 'Accounts that do deep research synthesis, investigate multiple studies'
  },
  connector: {
    keywords: ['connection', 'system', 'interconnected', 'relates', 'links', 'network'],
    accountExamples: ['foundmyfitness', 'DrMarkHyman', 'DrRanganChatterjee'],
    description: 'Accounts that show systems thinking, interconnections'
  },
  pragmatist: {
    keywords: ['practical', 'realistic', 'achievable', '80/20', 'simple', 'works'],
    accountExamples: ['MennoHenselmans', 'GregNuckols', 'RobbWolf'],
    description: 'Accounts that post practical, realistic, achievable protocols'
  },
  translator: {
    keywords: ['simple', 'explain', 'understand', 'translate', 'plain language', 'clear'],
    accountExamples: ['DrRanganChatterjee', 'DrSaraGottfried', 'DrJudBrewer'],
    description: 'Accounts that translate complex science to simple language'
  },
  patternFinder: {
    keywords: ['pattern', 'trend', 'across', 'multiple', 'common', 'consistent'],
    accountExamples: ['EricTopol', 'ExamineHQ', 'StrongerBySci'],
    description: 'Accounts that identify patterns across research/domains'
  },
  experimenter: {
    keywords: ['experiment', 'test', 'trial', 'self-experiment', 'try', 'personal'],
    accountExamples: ['bengreenfield', 'DaveAsprey', 'maxlugavere'],
    description: 'Accounts that post experimental protocols, self-experimentation'
  }
};

/**
 * Get accounts that match a specific generator
 */
export async function getAccountsForGenerator(generator: GeneratorType): Promise<string[]> {
  const mapping = GENERATOR_ACCOUNT_MAPPING[generator];
  if (!mapping) return [];
  
  const supabase = getSupabaseClient();
  
  // Strategy 1: Get accounts from seed list that match generator
  const seedMatches = mapping.accountExamples.filter(username => 
    // Check if account exists in vi_scrape_targets
    true // We'll filter in query
  );
  
  // Strategy 2: Query vi_collected_tweets for accounts whose content matches generator keywords
  const { data: matchingTweets } = await supabase
    .from('vi_collected_tweets')
    .select('original_author')
    .or(mapping.keywords.map(k => `content.ilike.%${k}%`).join(','))
    .limit(50);
  
  const accountSet = new Set<string>();
  
  // Add seed examples
  for (const username of seedMatches) {
    accountSet.add(username);
  }
  
  // Add accounts from matching tweets
  if (matchingTweets) {
    for (const tweet of matchingTweets) {
      if (tweet.original_author) {
        accountSet.add(tweet.original_author);
      }
    }
  }
  
  // Verify accounts exist in vi_scrape_targets
  const accounts = Array.from(accountSet);
  const { data: existingAccounts } = await supabase
    .from('vi_scrape_targets')
    .select('username')
    .in('username', accounts)
    .eq('is_active', true);
  
  return (existingAccounts || []).map(a => a.username);
}

/**
 * Get example tweets from accounts matching a generator
 */
export async function getExampleTweetsForGenerator(
  generator: GeneratorType,
  limit: number = 5
): Promise<Array<{ content: string; author: string; engagement_rate: number }>> {
  const accounts = await getAccountsForGenerator(generator);
  
  if (accounts.length === 0) {
    return [];
  }
  
  const supabase = getSupabaseClient();
  
  // Get high-performing tweets from matching accounts
  const { data: tweets } = await supabase
    .from('vi_collected_tweets')
    .select('content, original_author, engagement_rate')
    .in('original_author', accounts)
    .gte('engagement_rate', 0.02) // Only successful tweets
    .order('engagement_rate', { ascending: false })
    .limit(limit);
  
  if (!tweets) return [];
  
  return tweets.map(t => ({
    content: t.content,
    author: t.original_author,
    engagement_rate: t.engagement_rate || 0
  }));
}

/**
 * Auto-categorize accounts in vi_scrape_targets by generator type
 */
export async function categorizeAccountsByGenerator(): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get all active accounts
  const { data: accounts } = await supabase
    .from('vi_scrape_targets')
    .select('username, bio_text')
    .eq('is_active', true);
  
  if (!accounts) return;
  
  // For each account, find matching generators
  for (const account of accounts) {
    const matchingGenerators: GeneratorType[] = [];
    const bio = (account.bio_text || '').toLowerCase();
    
    for (const [generator, mapping] of Object.entries(GENERATOR_ACCOUNT_MAPPING)) {
      // Check if bio matches keywords
      const matchesBio = mapping.keywords.some(keyword => 
        bio.includes(keyword.toLowerCase())
      );
      
      // Check if in example list
      const inExamples = mapping.accountExamples.includes(account.username);
      
      if (matchesBio || inExamples) {
        matchingGenerators.push(generator as GeneratorType);
      }
    }
    
    // Store generator mapping (could add a column to vi_scrape_targets)
    // For now, we'll use the query-based approach
  }
}
