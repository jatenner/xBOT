import { getSupabaseClient } from '../db/index';

let cachedCount = 0;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function getFollowerCountFromDB(): Promise<number> {
  if (cachedCount > 0 && Date.now() - cacheTime < CACHE_TTL) return cachedCount;
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('post_follower_tracking')
      .select('followers_after')
      .not('followers_after', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.followers_after) {
      cachedCount = data.followers_after;
      cacheTime = Date.now();
    }
    return cachedCount;
  } catch { return cachedCount || 0; }
}
