/**
 * 🚫 KNOWN BOGUS CLAIMS
 * Patterns for commonly shared false health information
 */

export const KNOWN_BOGUS_PATTERNS: RegExp[] = [
  // Appendix/serotonin myth (appendix doesn't produce 70% of serotonin)
  /appendix[^.]*\b(60|70|80|90)%\b[^.]*serotonin/i,
  
  // Brain usage myth (we don't only use 10% of our brain)
  /only\s+use\s+\b(10|5|20)%\b[^.]*brain/i,
  
  // Detox myths (liver/kidneys handle detox, not special products)
  /detox[^.]*removes?[^.]*toxins?[^.]*body/i,
  
  // Vaccine misinformation patterns
  /vaccines?[^.]*cause[^.]*autism/i,
  
  // Water intake myths (8 glasses rule oversimplified)
  /\b8\s+glasses?\b[^.]*water[^.]*day[^.]*need/i,
  
  // Add more patterns as needed...
];
