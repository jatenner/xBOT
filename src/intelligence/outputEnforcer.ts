/**
 * Output Enforcer
 *
 * Post-generation validation that enforces tick advisor recommendations
 * as hard constraints. The LLM receives guidance in the prompt but can
 * ignore it — this module catches violations after generation and either
 * rejects or auto-corrects.
 */

export interface EnforcementResult {
  approved: boolean;
  violations: string[];
  suggestions: string[];
}

// ── Reply constraints ────────────────────────────────────────────────

export async function enforceReplyConstraints(
  replyText: string,
  tickAdvice: any | null
): Promise<EnforcementResult> {
  const violations: string[] = [];
  const suggestions: string[] = [];

  // 1. Minimum substance
  // Check for emoji-only: strip all non-whitespace ASCII letters/digits — if nothing remains, it's emoji-only
  const strippedAlpha = replyText.trim().replace(/[^a-zA-Z0-9]/g, '');
  if (!replyText || replyText.trim().length < 20 || (replyText.trim().length > 0 && strippedAlpha.length === 0)) {
    violations.push('reply too short/empty');
    suggestions.push('write a substantive reply (20+ chars)');
  }

  // 2. Length check against tick advice
  if (tickAdvice?.reply_preferences?.ideal_length_range) {
    const range = tickAdvice.reply_preferences.ideal_length_range as [number, number];
    const maxWithGrace = Math.round(range[1] * 1.3);
    if (replyText.length > maxWithGrace) {
      violations.push(
        `reply too long (${replyText.length} chars, target ${range[0]}-${range[1]})`
      );
      suggestions.push(`shorten to under ${range[1]} chars`);
    }
  }

  // 3. Avoid-angle keyword check
  if (tickAdvice?.reply_preferences?.avoid_angles) {
    const avoidAngles = tickAdvice.reply_preferences.avoid_angles as string[];
    const trimmed = replyText.trim();

    for (const angle of avoidAngles) {
      const lowerAngle = angle.toLowerCase();
      let matched = false;

      if (lowerAngle === 'educational') {
        matched =
          trimmed.startsWith("It's important to") ||
          trimmed.startsWith("it's important to") ||
          trimmed.startsWith('You should know') ||
          trimmed.startsWith('you should know');
      } else if (lowerAngle === 'authoritative') {
        const startsWithAs = /^As a /i.test(trimmed);
        const studiesShow =
          /^Studies show/i.test(trimmed) &&
          !/^Studies show.{0,30}(doi|et al|20\d{2}|pubmed)/i.test(trimmed);
        matched = startsWithAs || studiesShow;
      }

      if (matched) {
        violations.push(`tone matches avoided angle '${angle}'`);
        suggestions.push(`rewrite to avoid ${angle} tone`);
      }
    }
  }

  // 4. Question format check (when experiment requests question format)
  if (
    tickAdvice?.reply_preferences?.preferred_format === 'question' &&
    !replyText.includes('?')
  ) {
    violations.push('format should be question but no question mark found');
    suggestions.push('rephrase as a question');
  }

  return {
    approved: violations.length === 0,
    violations,
    suggestions,
  };
}

// ── Content (original post) constraints ──────────────────────────────

export async function enforceContentConstraints(
  contentText: string,
  experimentStrategy: any | null,
  tickAdvice: any | null
): Promise<EnforcementResult> {
  const violations: string[] = [];
  const suggestions: string[] = [];

  // 1. Thread check at bootstrap stage
  let stage = 'bootstrap'; // default conservative
  try {
    const { getTickAdvice } = await import('./tickAdvisor');
    const advice = tickAdvice ?? (await getTickAdvice());
    if (advice?.our_stage) {
      stage = advice.our_stage;
    }
  } catch {
    /* non-fatal */
  }

  const hasThreadMarkers =
    /THREAD BREAK/i.test(contentText) ||
    contentText.includes('\u{1F9F5}') || // 🧵
    /\/[12345]\b/.test(contentText) ||
    /\b[12345]\/\d/.test(contentText);

  if (stage === 'bootstrap' && hasThreadMarkers) {
    violations.push('threads not recommended at bootstrap stage');
    suggestions.push('convert to a single tweet');
  }

  // 2. Length check for single tweets (280 char max)
  if (!hasThreadMarkers && contentText.length > 280) {
    violations.push(
      `single tweet too long (${contentText.length} chars, max 280)`
    );
    suggestions.push('trim to 280 characters or convert to thread');
  }

  return {
    approved: violations.length === 0,
    violations,
    suggestions,
  };
}
