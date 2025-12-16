#!/usr/bin/env tsx
/**
 * Print Phase 4 & 5 feature flags as seen by the Node process
 */

console.log('[PHASE_FLAGS] ==========================================');
console.log('[PHASE_FLAGS] Phase Feature Flags (process.env):');
console.log('[PHASE_FLAGS] ==========================================');
console.log('[PHASE_FLAGS] ENABLE_PHASE4_ROUTING=', process.env.ENABLE_PHASE4_ROUTING);
console.log('[PHASE_FLAGS] ENABLE_PHASE4_EXPERIMENTS=', process.env.ENABLE_PHASE4_EXPERIMENTS);
console.log('[PHASE_FLAGS] ENABLE_PHASE5_GENERATOR_POLICY=', process.env.ENABLE_PHASE5_GENERATOR_POLICY);
console.log('[PHASE_FLAGS] ENABLE_PHASE5_SLOT_POLICY=', process.env.ENABLE_PHASE5_SLOT_POLICY);
console.log('[PHASE_FLAGS] ==========================================');

// Also check if they're truthy
const phase4Routing = process.env.ENABLE_PHASE4_ROUTING === 'true';
const phase4Experiments = process.env.ENABLE_PHASE4_EXPERIMENTS === 'true';
const phase5GenPolicy = process.env.ENABLE_PHASE5_GENERATOR_POLICY === 'true';
const phase5SlotPolicy = process.env.ENABLE_PHASE5_SLOT_POLICY === 'true';

console.log('[PHASE_FLAGS] Parsed boolean values:');
console.log('[PHASE_FLAGS] ENABLE_PHASE4_ROUTING (boolean):', phase4Routing);
console.log('[PHASE_FLAGS] ENABLE_PHASE4_EXPERIMENTS (boolean):', phase4Experiments);
console.log('[PHASE_FLAGS] ENABLE_PHASE5_GENERATOR_POLICY (boolean):', phase5GenPolicy);
console.log('[PHASE_FLAGS] ENABLE_PHASE5_SLOT_POLICY (boolean):', phase5SlotPolicy);
console.log('[PHASE_FLAGS] ==========================================');
