/**
 * 🚨 ANTI-LEGACY BUILD GUARD
 * Fails the build if anyone tries to reintroduce legacy posting systems
 */

// @ts-expect-error — fail build if someone reintroduces legacy poster
// import { SimplifiedBulletproofPoster } from '../posting/simplifiedBulletproofPoster';

// @ts-expect-error — fail build if someone tries to import postThread
// import { postThread } from '../posting/postThread';

export const LEGACY_POSTING_DISABLED = true;

console.log('🛡️ ANTI_LEGACY_GUARD: Legacy posting systems are disabled by build guard');
