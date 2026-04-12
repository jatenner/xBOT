/**
 * Bio Change Detector
 *
 * Compares current bio text against the last known bio for an account.
 * When a change is detected, stores it in brain_bio_changes with:
 * - Added/removed keywords
 * - Change type classification (niche pivot, credentials added, CTA added, etc.)
 * - Follower context at time of change
 *
 * This data reveals patterns like:
 * - "Accounts that add credentials to their bio grow 2x faster"
 * - "Niche pivots at 500-2K followers correlate with growth stalls"
 * - "Adding a CTA link at 1K+ followers correlates with acceleration"
 */

import { getSupabaseClient } from '../../db';
import { getFollowerRange } from '../types';
import { createHash } from 'crypto';

const LOG_PREFIX = '[observatory/bio-change]';

function hashBio(bio: string): string {
  return createHash('md5').update(bio.trim().toLowerCase()).digest('hex');
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s@#]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)
  );
}

function classifyBioChange(oldBio: string | null, newBio: string): string {
  if (!oldBio || oldBio.trim().length === 0) return 'initial_set';

  const oldLower = oldBio.toLowerCase();
  const newLower = newBio.toLowerCase();

  // Complete rewrite: less than 30% word overlap
  const oldWords = tokenize(oldBio);
  const newWords = tokenize(newBio);
  const overlap = Array.from(oldWords).filter(w => newWords.has(w)).length;
  const maxSize = Math.max(oldWords.size, newWords.size);
  if (maxSize > 0 && overlap / maxSize < 0.3) return 'complete_rewrite';

  // Credentials: added words like PhD, MD, Dr, CEO, Founder, Author, etc.
  const credentialPatterns = /\b(phd|md|dr\.?|ceo|founder|author|professor|researcher|coach|certified|expert|speaker)\b/i;
  const hadCredentials = credentialPatterns.test(oldLower);
  const hasCredentials = credentialPatterns.test(newLower);
  if (!hadCredentials && hasCredentials) return 'credentials_added';

  // CTA: added link or call-to-action
  const ctaPatterns = /\b(link|subscribe|newsletter|join|free|download|check out|👇|⬇️|linktr\.ee|bit\.ly)\b/i;
  const hadCta = ctaPatterns.test(oldLower);
  const hasCta = ctaPatterns.test(newLower);
  if (!hadCta && hasCta) return 'cta_added';

  // Niche pivot: primary topic words changed significantly
  const topicWords = /\b(health|fitness|crypto|ai|tech|finance|investing|coding|writing|marketing|business|science|psychology|nutrition|wellness)\b/gi;
  const oldTopics = new Set((oldLower.match(topicWords) || []).map(t => t.toLowerCase()));
  const newTopics = new Set((newLower.match(topicWords) || []).map(t => t.toLowerCase()));
  const topicsAdded = Array.from(newTopics).filter(t => !oldTopics.has(t));
  const topicsRemoved = Array.from(oldTopics).filter(t => !newTopics.has(t));
  if (topicsAdded.length > 0 || topicsRemoved.length > 0) return 'niche_pivot';

  return 'minor_edit';
}

export async function detectAndStoreBioChange(
  username: string,
  currentBio: string,
  currentFollowers: number | null,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const currentHash = hashBio(currentBio);

  // Get the last known bio hash
  const { data: account } = await supabase
    .from('brain_accounts')
    .select('bio_text, last_bio_hash')
    .eq('username', username)
    .single();

  if (!account) return false;

  const previousHash = account.last_bio_hash;
  const previousBio = account.bio_text;

  // No previous hash means first time — store hash but don't record as "change"
  if (!previousHash) {
    await supabase
      .from('brain_accounts')
      .update({ last_bio_hash: currentHash })
      .eq('username', username);
    return false;
  }

  // No change
  if (previousHash === currentHash) return false;

  // Bio changed! Classify and store.
  const oldWords = previousBio ? tokenize(previousBio) : new Set<string>();
  const newWords = tokenize(currentBio);
  const addedKeywords = Array.from(newWords).filter(w => !oldWords.has(w));
  const removedKeywords = Array.from(oldWords).filter(w => !newWords.has(w));
  const changeType = classifyBioChange(previousBio, currentBio);
  const followerRange = currentFollowers ? getFollowerRange(currentFollowers) : null;

  const { error } = await supabase.from('brain_bio_changes').insert({
    username,
    old_bio: previousBio,
    new_bio: currentBio,
    followers_at_change: currentFollowers,
    follower_range: followerRange,
    added_keywords: addedKeywords.slice(0, 50),
    removed_keywords: removedKeywords.slice(0, 50),
    change_type: changeType,
  });

  if (error) {
    if (error.message?.includes('relation') || error.message?.includes('schema cache')) {
      console.warn(`${LOG_PREFIX} brain_bio_changes not ready yet — skipping`);
      return false;
    }
    console.error(`${LOG_PREFIX} Insert error:`, error.message);
    return false;
  }

  // Update the hash
  await supabase
    .from('brain_accounts')
    .update({ last_bio_hash: currentHash })
    .eq('username', username);

  console.log(`${LOG_PREFIX} Bio change detected for @${username}: ${changeType} (${addedKeywords.length} added, ${removedKeywords.length} removed keywords)`);
  return true;
}
