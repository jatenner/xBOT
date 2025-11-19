/**
 * 🛡️ CONTENT SAFETY & FACT-CHECKING GATE
 * Reduces false claims while keeping content velocity
 */

import { KNOWN_BOGUS_PATTERNS } from './knownBogus';

const FACT_CHECK_MODE = (process.env.FACT_CHECK_MODE ?? 'light') as 'off' | 'light' | 'strict';

export interface ContentSafetyResult {
  ok: boolean;
  sanitized: string;
  reasons: string[];
  originalLength: number;
  sanitizedLength: number;
}

/**
 * 🔍 CHECK AND SANITIZE CONTENT
 */
export function checkAndSanitizeContent(text: string): ContentSafetyResult {
  const originalLength = text.length;
  
  if (FACT_CHECK_MODE === 'off') {
    return {
      ok: true,
      sanitized: text,
      reasons: [],
      originalLength,
      sanitizedLength: originalLength
    };
  }

  // Normalize whitespace and split into sentences
  const normalized = text.replace(/\s+/g, ' ').trim();
  const sentences = splitIntoSentences(normalized);
  
  const reasons: string[] = [];
  const keptSentences: string[] = [];

  for (const sentence of sentences) {
    const sentenceResult = processSentence(sentence.trim());
    
    if (sentenceResult.keep) {
      keptSentences.push(sentenceResult.text);
    } else {
      reasons.push(sentenceResult.reason || 'Content safety filter');
    }
  }

  const sanitized = keptSentences.join(' ').trim();
  const sanitizedLength = sanitized.length;
  
  // If thread becomes empty after sanitization, block it
  const ok = sanitized.length > 20; // Minimum viable content
  
  if (!ok && reasons.length === 0) {
    reasons.push('no_content_after_factcheck');
  }

  console.log(`🛡️ FACT_CHECK: ${FACT_CHECK_MODE} mode, ${originalLength}→${sanitizedLength} chars, ${reasons.length} issues`);
  
  return {
    ok,
    sanitized,
    reasons,
    originalLength,
    sanitizedLength
  };
}

interface SentenceResult {
  keep: boolean;
  text: string;
  reason?: string;
}

/**
 * 🔎 PROCESS INDIVIDUAL SENTENCE
 */
function processSentence(sentence: string): SentenceResult {
  // 🚨 FICTIONAL STORY DETECTION - Block made-up stories
  const fictionalStoryPatterns = [
    // Generic names in stories (Lisa, Sarah, John, etc.)
    /\b(Lisa|Sarah|John|Mike|Emily|David|Jessica|Chris|Amy|Tom|Mark|Jennifer|Robert|Maria|James|Patricia|Michael|Linda|William|Barbara|Richard|Susan|Joseph|Karen|Thomas|Nancy|Charles|Betty|Daniel|Margaret|Matthew|Sandra|Anthony|Donna|Donald|Carol|Steven|Ruth|Paul|Sharon|Andrew|Michelle|Kenneth|Laura|Joshua|Sarah|Kevin|Kimberly|Brian|Deborah|George|Emily|Edward|Angela|Ronald|Ashley|Timothy|Brenda|Jason|Pamela|Jeffrey|Nicole|Ryan|Emma|Jacob|Olivia|Gary|Cynthia|Nicholas|Marie|Eric|Janet|Jonathan|Catherine|Stephen|Frances|Larry|Christine|Justin|Samantha|Scott|Debra|Brandon|Rachel|Benjamin|Carolyn|Frank|Janet|Raymond|Virginia|Gregory|Maria|Samuel|Heather|Patrick|Diane|Alexander|Julie|Jack|Joyce|Dennis|Victoria|Jerry|Kelly|Tyler|Christina|Aaron|Joan|Jose|Evelyn|Adam|Judith|Henry|Megan|Nathan|Cheryl|Zachary|Andrea|Douglas|Hannah|Kyle|Jacqueline|Noah|Martha|Ethan|Gloria|Jeremy|Teresa|Walter|Sara|Christian|Janice|Keith|Marie|Roger|Julia|Harold|Grace|Carl|Judy|Arthur|Theresa|Gerald|Madison|Lawrence|Beverly|Joe|Denise|Sean|Marilyn|Dylan|Amber|Bryan|Danielle|Ralph|Rose|Roy|Brittany|Eugene|Diana|Wayne|Abigail|Louis|Jane|Philip|Lori|Johnny|Kathryn|Willie|Emma|Alan|Cathy|Juan|Joan|Wayne|Rachel|Randy|Carolyn|Howard|Janet|Eugene|Marie|Carlos|Catherine|Russell|Frances|Bobby|Ann|Victor|Joyce|Albert|Diana|Eugene|Marie)\b.*(struggled|tried|embraced|discovered|found|realized|learned|changed|transformed|improved|solved|fixed|overcame|achieved|succeeded|failed|started|began|decided|chose|switched|adopted|implemented|practiced|experimented|tested|used|took|did|made|got|became|was|were)/i,
    // "A few years ago, someone..." patterns
    /\b(A few years ago|Recently|Last year|A while back|Some time ago|Not long ago|A couple years ago|A few months ago|Last month|Recently, someone|A while ago, someone|Some time ago, someone|Not long ago, someone)\b.*\b(someone|a person|a woman|a man|a patient|a client|a friend|an individual|a patient|a client)\b.*(struggled|tried|embraced|discovered|found|realized|learned|changed|transformed|improved|solved|fixed|overcame|achieved|succeeded|failed|started|began|decided|chose|switched|adopted|implemented|practiced|experimented|tested|used|took|did|made|got|became)/i,
    // "Imagine someone who..." patterns
    /\b(Imagine|Picture|Think about|Consider|Suppose|Visualize)\b.*\b(someone|a person|a woman|a man|a patient|a client|a friend|an individual|who)\b.*(struggled|tried|embraced|discovered|found|realized|learned|changed|transformed|improved|solved|fixed|overcame|achieved|succeeded|failed|started|began|decided|chose|switched|adopted|implemented|practiced|experimented|tested|used|took|did|made|got|became)/i,
    // Generic "someone" stories without research context
    /\b(someone|a person|a woman|a man|a patient|a client|a friend|an individual)\b.*(struggled|tried|embraced|discovered|found|realized|learned|changed|transformed|improved|solved|fixed|overcame|achieved|succeeded|failed|started|began|decided|chose|switched|adopted|implemented|practiced|experimented|tested|used|took|did|made|got|became)\b.*(within weeks|within days|after|soon|quickly|rapidly|suddenly|immediately|instantly)/i
  ];

  // Check for fictional story patterns
  for (const pattern of fictionalStoryPatterns) {
    if (pattern.test(sentence)) {
      // Allow if it's clearly a documented case study (mentions study, research, published, etc.)
      const hasResearchContext = /(study|research|trial|published|journal|documented|case study|clinical|RCT|meta-analysis|Harvard|JAMA|NEJM|Cochrane|Nature|Science|PLOS|researcher|scientist|doctor|physician|patient.*study|study.*patient)/i.test(sentence);
      
      if (!hasResearchContext) {
        return {
          keep: false,
          text: '',
          reason: 'fictional_story_detected'
        };
      }
    }
  }

  // Check against known bogus patterns
  for (const pattern of KNOWN_BOGUS_PATTERNS) {
    if (pattern.test(sentence)) {
      return {
        keep: false,
        text: '',
        reason: `known_bogus_pattern: ${pattern.source}`
      };
    }
  }

  // Check for strong numeric claims without sources
  const hasStrongNumericClaim = /\b\d{2,}%\b/.test(sentence);
  const hasSourceCue = /(source|study|trial|RCT|meta-?analysis|Harvard|JAMA|NEJM|Cochrane|Nature|Science|PLOS)/i.test(sentence);

  if (hasStrongNumericClaim && !hasSourceCue) {
    if (FACT_CHECK_MODE === 'light') {
      return {
        keep: false,
        text: '',
        reason: 'numeric_claim_without_source'
      };
    } else if (FACT_CHECK_MODE === 'strict') {
      // Replace with softer version
      const softened = sentence
        .replace(/\b\d{2,}%\b/g, 'significant amounts')
        .replace(/^/, 'Studies suggest ');
      
      return {
        keep: true,
        text: softened,
        reason: 'softened_numeric_claim'
      };
    }
  }

  return { keep: true, text: sentence };
}

/**
 * ✂️ SPLIT INTO SENTENCES
 */
function splitIntoSentences(text: string): string[] {
  return text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
