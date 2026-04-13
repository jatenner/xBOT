/**
 * Bio Feature Extractor
 *
 * Extracts structured features from Twitter bio text.
 * Used to analyze: what bio characteristics correlate with growth?
 *
 * Features: length, has CTA, has link, has credentials, has emoji,
 * has niche keywords, tone, specificity of claims.
 */

export interface BioFeatures {
  char_count: number;
  word_count: number;
  has_link: boolean;
  has_emoji: boolean;
  emoji_count: number;
  has_credentials: boolean;       // PhD, MD, CEO, Founder, etc.
  credential_type: string | null; // 'academic', 'professional', 'creator', null
  has_cta: boolean;               // "DM for...", "Link below", "Follow for..."
  has_niche_claim: boolean;       // "Helping you...", "Teaching...", "Sharing..."
  has_social_proof: boolean;      // "Featured in...", "50K+", "As seen on..."
  has_location: boolean;          // Contains a location mention
  has_personal_touch: boolean;    // "Dad", "Mom", "Dog lover", personal details
  tone: 'professional' | 'casual' | 'authority' | 'friendly' | 'minimal';
  specificity: 'vague' | 'specific' | 'hyper_specific';
}

const CREDENTIAL_PATTERNS = {
  academic: /\b(phd|ph\.d|md|m\.d|dr\.?|professor|researcher|scientist)\b/i,
  professional: /\b(ceo|cto|coo|founder|co-founder|director|vp |head of|partner at|author of)\b/i,
  creator: /\b(creator|influencer|coach|consultant|speaker|podcaster|writer|blogger)\b/i,
};

const CTA_PATTERNS = /\b(dm\s+me|link\s+below|link\s+in\s+bio|subscribe|newsletter|follow\s+for|join\s+my|free\s+guide|download|grab\s+your|sign\s+up|book\s+a\s+call)\b/i;

const NICHE_CLAIM_PATTERNS = /\b(helping|teaching|sharing|writing\s+about|talking\s+about|passionate\s+about|obsessed\s+with|all\s+things)\b/i;

const SOCIAL_PROOF_PATTERNS = /\b(featured\s+in|as\s+seen|forbes|wsj|nyt|cnn|bbc|inc\.|wired|\d+k\+?\s*(followers|subscribers|clients|students|views))\b/i;

const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

export function extractBioFeatures(bio: string): BioFeatures {
  if (!bio || bio.trim().length === 0) {
    return {
      char_count: 0, word_count: 0, has_link: false, has_emoji: false,
      emoji_count: 0, has_credentials: false, credential_type: null,
      has_cta: false, has_niche_claim: false, has_social_proof: false,
      has_location: false, has_personal_touch: false,
      tone: 'minimal', specificity: 'vague',
    };
  }

  const words = bio.split(/\s+/).filter(w => w.length > 0);
  const emojis = bio.match(EMOJI_PATTERN) || [];
  const bioLower = bio.toLowerCase();

  // Credentials
  let hasCredentials = false;
  let credentialType: string | null = null;
  for (const [type, pattern] of Object.entries(CREDENTIAL_PATTERNS)) {
    if (pattern.test(bio)) {
      hasCredentials = true;
      credentialType = type;
      break;
    }
  }

  // Personal touch
  const personalPatterns = /\b(dad|mom|father|mother|husband|wife|dog|cat|coffee|lover|fan of|traveler|runner)\b/i;
  const hasPersonalTouch = personalPatterns.test(bioLower);

  // Tone
  let tone: BioFeatures['tone'] = 'casual';
  if (bio.length < 20) tone = 'minimal';
  else if (hasCredentials && SOCIAL_PROOF_PATTERNS.test(bio)) tone = 'authority';
  else if (hasCredentials) tone = 'professional';
  else if (hasPersonalTouch || emojis.length > 2) tone = 'friendly';

  // Specificity
  let specificity: BioFeatures['specificity'] = 'vague';
  if (/\d/.test(bio) && (NICHE_CLAIM_PATTERNS.test(bio) || hasCredentials)) {
    specificity = 'hyper_specific'; // Has numbers + claims = "Helping 10K+ people lose weight"
  } else if (NICHE_CLAIM_PATTERNS.test(bio) || hasCredentials) {
    specificity = 'specific';
  }

  return {
    char_count: bio.length,
    word_count: words.length,
    has_link: /https?:\/\/|linktr\.ee|bit\.ly|link\s+in\s+bio/i.test(bio),
    has_emoji: emojis.length > 0,
    emoji_count: emojis.length,
    has_credentials: hasCredentials,
    credential_type: credentialType,
    has_cta: CTA_PATTERNS.test(bio),
    has_niche_claim: NICHE_CLAIM_PATTERNS.test(bio),
    has_social_proof: SOCIAL_PROOF_PATTERNS.test(bio),
    has_location: /📍|🌍|based\s+in|living\s+in|\bin\s+(nyc|la|sf|london|tokyo|dubai)/i.test(bio),
    has_personal_touch: hasPersonalTouch,
    tone,
    specificity,
  };
}
