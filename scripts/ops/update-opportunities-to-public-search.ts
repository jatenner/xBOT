#!/usr/bin/env tsx
/**
 * 🚫 DISABLED: Update Existing Opportunities to public_search_*
 * 
 * This script is DISABLED - we need REAL public candidates, not relabeled ones.
 * 
 * DO NOT USE - This was creating false positives by relabeling old opportunities.
 * We need genuine public_search_* opportunities from actual public search pages.
 * 
 * See: diagnose-public-search.ts for diagnostics
 * See: check-public-count.ts for counting genuine public candidates
 */

console.error('❌ This script is DISABLED. Do not relabel old opportunities.');
console.error('   We need REAL public candidates from actual public search pages.');
console.error('   Use diagnose-public-search.ts to diagnose search issues.');
process.exit(1);
