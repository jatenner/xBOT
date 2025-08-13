export interface BotConfig {
  maxDailyPosts: number;
  livePostsEnabled: boolean;
}

export async function loadBotConfig(): Promise<BotConfig> {
  // MAX_DAILY_POSTS: env takes absolute priority
  const envMaxPosts = Number(process.env.MAX_DAILY_POSTS);
  let maxDailyPosts = 100; // default
  
  if (Number.isFinite(envMaxPosts) && envMaxPosts > 0) {
    maxDailyPosts = envMaxPosts;
    console.log(`CONFIG: MAX_DAILY_POSTS = ${maxDailyPosts} (from env)`);
  } else {
    // Could load from DB as fallback, but env is source of truth
    console.log(`CONFIG: MAX_DAILY_POSTS = ${maxDailyPosts} (default)`);
  }
  
  return {
    maxDailyPosts,
    livePostsEnabled: process.env.LIVE_POSTS !== 'false'
  };
}