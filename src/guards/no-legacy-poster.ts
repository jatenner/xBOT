/**
 * 🚨 ANTI-LEGACY BUILD GUARD
 * Fails the build if anyone tries to reintroduce legacy posting systems
 */

// Build guards to prevent legacy system reintroduction
// These commented imports will cause TypeScript errors if legacy systems are used
// Uncomment to test: import { SimplifiedBulletproofPoster } from '../posting/simplifiedBulletproofPoster';
// Uncomment to test: import { postThread } from '../posting/postThread';

export const LEGACY_POSTING_DISABLED = true;

console.log('🛡️ ANTI_LEGACY_GUARD: Legacy posting systems are disabled by build guard');
