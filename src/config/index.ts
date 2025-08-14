export interface BotConfig {
  maxDailyPosts: number;
  livePostsEnabled: boolean;
  enableThreads: boolean;
  threadMinTweets: number;
  threadMaxTweets: number;
  fallbackSingleTweetOk: boolean;
  forcePost: boolean;
  threadRetryAttempts: number;
  threadRetryBaseMs: number;
  threadStrictReplyMode: boolean;
  tweetMaxCharsHard: number;
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
  
  const enableThreads = process.env.ENABLE_THREADS !== 'false';
  const threadMinTweets = Number(process.env.THREAD_MIN_TWEETS) || 5;
  const threadMaxTweets = Number(process.env.THREAD_MAX_TWEETS) || 9;
  const fallbackSingleTweetOk = process.env.FALLBACK_SINGLE_TWEET_OK === 'true';
  const forcePost = process.env.FORCE_POST !== 'false';
  const threadRetryAttempts = Number(process.env.THREAD_RETRY_ATTEMPTS) || 3;
  const threadRetryBaseMs = Number(process.env.THREAD_RETRY_BASE_MS) || 500;
  const threadStrictReplyMode = process.env.THREAD_STRICT_REPLY_MODE !== 'false';
  const tweetMaxCharsHard = Number(process.env.TWEET_MAX_CHARS_HARD) || 279;

  console.log(`CONFIG: ENABLE_THREADS = ${enableThreads}`);
  console.log(`CONFIG: THREAD_MIN_TWEETS = ${threadMinTweets}`);
  console.log(`CONFIG: THREAD_MAX_TWEETS = ${threadMaxTweets}`);
  console.log(`CONFIG: FALLBACK_SINGLE_TWEET_OK = ${fallbackSingleTweetOk}`);
  console.log(`CONFIG: THREAD_RETRY_ATTEMPTS = ${threadRetryAttempts}`);
  console.log(`CONFIG: THREAD_RETRY_BASE_MS = ${threadRetryBaseMs}`);
  console.log(`CONFIG: THREAD_STRICT_REPLY_MODE = ${threadStrictReplyMode}`);
  console.log(`CONFIG: TWEET_MAX_CHARS_HARD = ${tweetMaxCharsHard}`);
  console.log(`CONFIG: FORCE_POST = ${forcePost}`);

  return {
    maxDailyPosts,
    livePostsEnabled: process.env.LIVE_POSTS !== 'false',
    enableThreads,
    threadMinTweets,
    threadMaxTweets,
    fallbackSingleTweetOk,
    forcePost,
    threadRetryAttempts,
    threadRetryBaseMs,
    threadStrictReplyMode,
    tweetMaxCharsHard
  };
}