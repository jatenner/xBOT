/**
 * Test script to verify tier counting logic matches replyJob gates
 * 
 * Simulates stored opportunities with various relevance/replyability scores
 * and verifies tier counts match expected values.
 */

import 'dotenv/config';
import { HEALTH_AUTHORITY_ALLOWLIST } from '../src/ai/relevanceReplyabilityScorer';

interface StoredOpportunity {
  relevance_score: number;
  replyability_score: number;
  author_handle: string;
}

const GATE_TIERS = [
  { tier: 1, relevance: 0.45, replyability: 0.35 },
  { tier: 2, relevance: 0.45, replyability: 0.30 },
  { tier: 3, relevance: 0.45, replyability: 0.25 },
];
const HARD_FLOOR_RELEVANCE = 0.45;
const WHITELIST_EXEMPTION_MIN_RELEVANCE = 0.40;

function computeTierCounts(storedOpportunities: StoredOpportunity[]): { tier1: number; tier2: number; tier3: number } {
  let tier1Pass = 0;
  let tier2Pass = 0;
  let tier3Pass = 0;
  
  for (const opp of storedOpportunities) {
    const relevanceScore = opp.relevance_score;
    const replyabilityScore = opp.replyability_score;
    const authorHandle = (opp.author_handle || '').toLowerCase().replace('@', '');
    const isWhitelisted = HEALTH_AUTHORITY_ALLOWLIST.has(authorHandle);
    
    // HARD FLOOR: relevance < 0.45 => FAIL (unless whitelist exemption: 0.40-0.44)
    let effectiveRelevance = relevanceScore;
    
    if (relevanceScore < HARD_FLOOR_RELEVANCE) {
      // Check whitelist exemption: allow 0.40-0.44 for whitelisted authors
      if (isWhitelisted && relevanceScore >= WHITELIST_EXEMPTION_MIN_RELEVANCE) {
        effectiveRelevance = HARD_FLOOR_RELEVANCE; // Treat as meeting floor for tier checks
      } else {
        continue; // Below hard floor, skip
      }
    }
    
    // Try tiers in order (1 -> 2 -> 3) as fallback ladder
    // Count highest tier that passes
    for (const gate of GATE_TIERS) {
      if (effectiveRelevance >= gate.relevance && replyabilityScore >= gate.replyability) {
        if (gate.tier === 1) tier1Pass++;
        else if (gate.tier === 2) tier2Pass++;
        else if (gate.tier === 3) tier3Pass++;
        break; // Count only highest tier
      }
    }
  }
  
  return { tier1: tier1Pass, tier2: tier2Pass, tier3: tier3Pass };
}

async function main() {
  console.log('[TEST_TIER_COUNTING] 🧪 Testing tier counting logic\n');
  
  // Test case 1: Tier 1 pass (relevance=0.50, replyability=0.40)
  const testCase1: StoredOpportunity[] = [
    { relevance_score: 0.50, replyability_score: 0.40, author_handle: 'statnews' },
  ];
  const counts1 = computeTierCounts(testCase1);
  console.log(`Test 1: relevance=0.50 replyability=0.40`);
  console.log(`  Expected: tier1=1 tier2=0 tier3=0`);
  console.log(`  Got:      tier1=${counts1.tier1} tier2=${counts1.tier2} tier3=${counts1.tier3}`);
  console.log(`  ${counts1.tier1 === 1 && counts1.tier2 === 0 && counts1.tier3 === 0 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test case 2: Tier 2 pass (relevance=0.50, replyability=0.32)
  const testCase2: StoredOpportunity[] = [
    { relevance_score: 0.50, replyability_score: 0.32, author_handle: 'statnews' },
  ];
  const counts2 = computeTierCounts(testCase2);
  console.log(`Test 2: relevance=0.50 replyability=0.32`);
  console.log(`  Expected: tier1=0 tier2=1 tier3=0`);
  console.log(`  Got:      tier1=${counts2.tier1} tier2=${counts2.tier2} tier3=${counts2.tier3}`);
  console.log(`  ${counts2.tier1 === 0 && counts2.tier2 === 1 && counts2.tier3 === 0 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test case 3: Tier 3 pass (relevance=0.50, replyability=0.26)
  const testCase3: StoredOpportunity[] = [
    { relevance_score: 0.50, replyability_score: 0.26, author_handle: 'statnews' },
  ];
  const counts3 = computeTierCounts(testCase3);
  console.log(`Test 3: relevance=0.50 replyability=0.26`);
  console.log(`  Expected: tier1=0 tier2=0 tier3=1`);
  console.log(`  Got:      tier1=${counts3.tier1} tier2=${counts3.tier2} tier3=${counts3.tier3}`);
  console.log(`  ${counts3.tier1 === 0 && counts3.tier2 === 0 && counts3.tier3 === 1 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test case 4: Below hard floor (relevance=0.40, replyability=0.50) - should fail
  const testCase4: StoredOpportunity[] = [
    { relevance_score: 0.40, replyability_score: 0.50, author_handle: 'statnews' },
  ];
  const counts4 = computeTierCounts(testCase4);
  console.log(`Test 4: relevance=0.40 replyability=0.50 (below hard floor)`);
  console.log(`  Expected: tier1=0 tier2=0 tier3=0`);
  console.log(`  Got:      tier1=${counts4.tier1} tier2=${counts4.tier2} tier3=${counts4.tier3}`);
  console.log(`  ${counts4.tier1 === 0 && counts4.tier2 === 0 && counts4.tier3 === 0 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test case 5: Whitelist exemption (relevance=0.42, replyability=0.36, whitelisted author)
  const testCase5: StoredOpportunity[] = [
    { relevance_score: 0.42, replyability_score: 0.36, author_handle: 'hubermanlab' }, // Whitelisted
  ];
  const counts5 = computeTierCounts(testCase5);
  console.log(`Test 5: relevance=0.42 replyability=0.36 (whitelisted author)`);
  console.log(`  Expected: tier1=1 tier2=0 tier3=0 (whitelist exemption)`);
  console.log(`  Got:      tier1=${counts5.tier1} tier2=${counts5.tier2} tier3=${counts5.tier3}`);
  console.log(`  ${counts5.tier1 === 1 && counts5.tier2 === 0 && counts5.tier3 === 0 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Test case 6: Mixed opportunities (like @statnews stored=5)
  const testCase6: StoredOpportunity[] = [
    { relevance_score: 0.50, replyability_score: 0.40, author_handle: 'statnews' }, // Tier 1
    { relevance_score: 0.48, replyability_score: 0.32, author_handle: 'statnews' }, // Tier 2
    { relevance_score: 0.46, replyability_score: 0.26, author_handle: 'statnews' }, // Tier 3
    { relevance_score: 0.30, replyability_score: 0.50, author_handle: 'statnews' }, // Below floor
    { relevance_score: 0.50, replyability_score: 0.20, author_handle: 'statnews' }, // Below all tiers
  ];
  const counts6 = computeTierCounts(testCase6);
  console.log(`Test 6: Mixed opportunities (5 total)`);
  console.log(`  Expected: tier1=1 tier2=1 tier3=1 (3 pass, 2 fail)`);
  console.log(`  Got:      tier1=${counts6.tier1} tier2=${counts6.tier2} tier3=${counts6.tier3}`);
  console.log(`  ${counts6.tier1 === 1 && counts6.tier2 === 1 && counts6.tier3 === 1 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Sample [SEED_STATS] log line
  console.log('═══════════════════════════════════════════');
  console.log('Sample [SEED_STATS] log line:');
  console.log(`[SEED_STATS] seed=@statnews scraped=16 stored=5 tier1=${counts6.tier1} tier2=${counts6.tier2} tier3=${counts6.tier3} disallowed=0`);
  console.log('═══════════════════════════════════════════\n');
  
  process.exit(0);
}

main().catch(console.error);

