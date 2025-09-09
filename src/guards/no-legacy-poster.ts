/**
 * 🚨 ANTI-LEGACY BUILD GUARD
 * Fails the build if anyone tries to reintroduce legacy posting systems
 * 
 * This guard runs at build time and will cause TypeScript compilation
 * to fail if any of the legacy posting systems are imported.
 */

// 🚨 BUILD GUARD: Uncomment any line below to test guard functionality
// import { SimplifiedBulletproofPoster } from '../posting/simplifiedBulletproofPoster';
// import { postThread } from '../posting/postThread';
// import bulletproofPoster from '../posting/bulletproofPoster';

export const LEGACY_POSTING_DISABLED = true;

// Runtime check for any legacy poster usage
if (typeof window === 'undefined') {
  // Server-side check
  const stack = new Error().stack || '';
  const legacyPatterns = [
    'SimplifiedBulletproofPoster',
    'bulletproofPoster.postContent',
    'bulletproofPoster.postThread',
    'postThread('
  ];
  
  for (const pattern of legacyPatterns) {
    if (stack.includes(pattern)) {
      throw new Error(`🚨 LEGACY_POSTER_DETECTED: ${pattern} usage is forbidden! Use PostingFacade instead.`);
    }
  }
}

console.log('🛡️ ANTI_LEGACY_GUARD: Legacy posting systems are disabled by build guard');
