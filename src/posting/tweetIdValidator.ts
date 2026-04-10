/**
 * 🔒 TWEET ID VALIDATOR
 * 
 * Validates tweet IDs to ensure they are real Twitter tweet IDs (18-20 digits).
 * Prevents false POST_SUCCESS events with invalid IDs.
 */

/**
 * Validates a tweet ID string
 * 
 * @param tweetId - The tweet ID to validate (must be string)
 * @returns Object with valid flag and error message if invalid
 */
export function assertValidTweetId(tweetId: string): { valid: boolean; error?: string } {
  if (!tweetId || typeof tweetId !== 'string') {
    return {
      valid: false,
      error: `Tweet ID must be a non-empty string, got: ${typeof tweetId}`
    };
  }

  // Twitter tweet IDs are 18-20 digits (no leading zeros, pure numeric string)
  const tweetIdRegex = /^\d{18,20}$/;
  
  if (!tweetIdRegex.test(tweetId)) {
    return {
      valid: false,
      error: `Tweet ID must be 18-20 digits, got: "${tweetId}" (length: ${tweetId.length})`
    };
  }

  return { valid: true };
}

/** Placeholder ID when reply was posted but ID extraction failed (strong evidence). Format: posted_strong_evidence_<parentId>_<ts> */
const PROVISIONAL_REPLY_ID_REGEX = /^posted_strong_evidence_\d+_\d+$/;

export function isProvisionalReplyId(tweetId: string): boolean {
  return typeof tweetId === 'string' && PROVISIONAL_REPLY_ID_REGEX.test(tweetId.trim());
}

/**
 * For replies: accept either a valid 18–20 digit tweet ID or a provisional placeholder.
 */
export function assertValidTweetIdOrProvisionalReply(tweetId: string, isReply: boolean): { valid: boolean; error?: string; provisional?: boolean } {
  if (isReply && isProvisionalReplyId(tweetId)) {
    return { valid: true, provisional: true };
  }
  const r = assertValidTweetId(tweetId);
  return { ...r, provisional: false };
}

/** Candidate paths for tweet ID in CreateTweet/GraphQL responses (multiple possible X shapes) */
const CREATE_TWEET_ID_PATHS = [
  'data.create_tweet.tweet_results.result.rest_id',
  'data.create_tweet.tweet_results.result.legacy.id_str',
  'data.create_tweet.tweet_results.result.id',
  'data.create_tweet.tweet_results.result.tweet.rest_id',
  'data.create_tweet.tweet_results.result.tweet.legacy.id_str',
  'data.CreateTweet.tweet_results.result.rest_id',
  'data.CreateTweet.tweet_results.result.legacy.id_str',
  'data.CreateTweet.tweet_results.result.tweet.rest_id',
  'data.CreateTweet.tweet_results.result.tweet.legacy.id_str',
  'data.tweetCreate.tweet_results.result.rest_id',
  'data.tweetCreate.tweet_results.result.legacy.id_str',
  'data.tweetCreate.tweet_results.result.tweet.rest_id',
  'data.tweetCreate.tweet_results.result.tweet.legacy.id_str',
  'data.tweetCreate.tweet.rest_id',
  'data.tweetCreate.tweet.legacy.id_str',
  'data.tweet_create.tweet.rest_id',
  'data.tweet_create.tweet.legacy.id_str',
  'data.tweet.rest_id',
  'data.tweetResult.result.rest_id',
  'tweet_results.result.rest_id',
  'tweet_results.result.legacy.id_str',
  'result.rest_id',
  'result.legacy.id_str',
  'rest_id',
  'id_str',
];

/**
 * Extract and validate tweet ID from CreateTweet GraphQL response.
 * Tries multiple possible X GraphQL response shapes; logs top-level keys and paths checked (no sensitive dump).
 */
export function extractTweetIdFromCreateTweetResponse(responseBody: any): string | null {
  try {
    const struct = getCreateTweetResponseStructure(responseBody);
    console.log(`[CREATE_TWEET_PARSE] response_top_keys=${struct.topKeys.join(',')}`);
    if (struct.dataKeys.length > 0) {
      console.log(`[CREATE_TWEET_PARSE] data_keys=${struct.dataKeys.join(',')}`);
    }
    console.log(`[CREATE_TWEET_PARSE] errors_present=${struct.errorsPresent} errors_count=${struct.errorsCount}`);
    if (struct.errorCodes.length > 0) {
      console.log(`[CREATE_TWEET_PARSE] error_codes=${struct.errorCodes.join('; ')}`);
    }

    for (const path of CREATE_TWEET_ID_PATHS) {
      const value = getNestedValue(responseBody, path);
      if (value != null) {
        const tweetId = String(value).trim();
        const validation = assertValidTweetId(tweetId);
        if (validation.valid) {
          console.log(`[CREATE_TWEET_PARSE] path_used=${path}`);
          return tweetId;
        }
      }
    }
    console.log(`[CREATE_TWEET_PARSE] candidate_paths_checked=${CREATE_TWEET_ID_PATHS.length} none_valid`);
    if (struct.discoveredPaths.length > 0) {
      console.log(`[CREATE_TWEET_PARSE] discovered_paths=${struct.discoveredPaths.slice(0, 30).join('|')}${struct.discoveredPaths.length > 30 ? '...' : ''}`);
    }

    const bodyStr = JSON.stringify(responseBody);
    const restIdMatch = bodyStr.match(/"rest_id"\s*:\s*"(\d{18,20})"/);
    if (restIdMatch) {
      const tweetId = restIdMatch[1];
      if (assertValidTweetId(tweetId).valid) {
        console.log(`[CREATE_TWEET_PARSE] path_used=regex_rest_id`);
        return tweetId;
      }
    }
    const idStrMatch = bodyStr.match(/"id_str"\s*:\s*"(\d{18,20})"/);
    if (idStrMatch) {
      const tweetId = idStrMatch[1];
      if (assertValidTweetId(tweetId).valid) {
        console.log(`[CREATE_TWEET_PARSE] path_used=regex_id_str`);
        return tweetId;
      }
    }

    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Helper: Get nested value from object by dot-separated path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

const MAX_DEPTH = 4;

/**
 * Recursively collect shallow object key paths (depth-limited). Arrays summarized as "key[]".
 * No values or sensitive data - structure only for debugging.
 */
export function collectShallowKeyPaths(obj: any, prefix = '', depth = 0): string[] {
  if (depth >= MAX_DEPTH || obj == null) return [];
  const out: string[] = [];
  if (Array.isArray(obj)) {
    out.push(prefix ? `${prefix}[]` : '[]');
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && !Array.isArray(obj[0])) {
      const firstKeys = Object.keys(obj[0]).slice(0, 20);
      firstKeys.forEach((k) => out.push(...collectShallowKeyPaths((obj[0] as any)[k], prefix ? `${prefix}[0].${k}` : k, depth + 1)));
    }
    return out;
  }
  if (typeof obj !== 'object') return [];
  const keys = Object.keys(obj).slice(0, 50);
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = (obj as any)[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(path);
      out.push(...collectShallowKeyPaths(v, path, depth + 1));
    } else if (Array.isArray(v)) {
      out.push(`${path}[]`);
    } else {
      out.push(path);
    }
  }
  return out;
}

/**
 * Safe structural summary of a CreateTweet response (no payloads, no tokens).
 */
export function getCreateTweetResponseStructure(responseBody: any): {
  topKeys: string[];
  dataKeys: string[];
  errorsPresent: boolean;
  errorsCount: number;
  errorCodes: string[];
  discoveredPaths: string[];
} {
  const topKeys = responseBody && typeof responseBody === 'object' ? Object.keys(responseBody) : [];
  const data = responseBody?.data;
  const dataKeys = data && typeof data === 'object' ? Object.keys(data) : [];
  const errors = responseBody?.errors;
  const errorsPresent = Array.isArray(errors) && errors.length > 0;
  const errorsCount = Array.isArray(errors) ? errors.length : 0;
  const errorCodes = Array.isArray(errors)
    ? (errors as any[]).slice(0, 5).map((e: any) => (e?.code ?? e?.message ?? 'unknown').toString().slice(0, 80))
    : [];
  const discoveredPaths = collectShallowKeyPaths(responseBody).slice(0, 60);
  return { topKeys, dataKeys, errorsPresent, errorsCount, errorCodes, discoveredPaths };
}

/** X error 226 = automation / spam block. */
const CREATE_TWEET_ERROR_CODE_226 = 226;

/**
 * Classify CreateTweet response for error 226 (automation/spam block).
 * Returns { is226: true, errors } if any error has code === 226.
 */
export function getCreateTweetError226(responseBody: any): { is226: boolean; errors: any[] } | null {
  if (!responseBody || typeof responseBody !== 'object') return null;
  const errors = responseBody.errors;
  if (!Array.isArray(errors) || errors.length === 0) return { is226: false, errors: [] };
  const has226 = (errors as any[]).some(
    (e: any) => Number(e?.code) === CREATE_TWEET_ERROR_CODE_226 || String(e?.code) === '226'
  );
  return { is226: has226, errors: (errors as any[]).slice(0, 10) };
}

/** Whether response has any data.create_tweet (or data.CreateTweet) object. */
export function hasCreateTweetData(responseBody: any): boolean {
  if (!responseBody?.data || typeof responseBody.data !== 'object') return false;
  const d = responseBody.data;
  return d.create_tweet != null || d.CreateTweet != null || d.tweetCreate != null;
}
