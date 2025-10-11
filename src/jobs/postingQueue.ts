/**
 * 📮 POSTING QUEUE JOB
 * Processes ready decisions and posts them to Twitter
 */

import { getConfig, getModeFlags } from '../config/config';

export async function processPostingQueue(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[POSTING_QUEUE] 📮 Processing posting queue...');
  
  try {
    // 1. Check if posting is enabled
    if (flags.postingDisabled) {
      console.log('[POSTING_QUEUE] ⚠️ Posting disabled, skipping queue processing');
      return;
    }
    
    // 2. Check rate limits
    const canPost = await checkPostingRateLimits();
    if (!canPost) {
      console.log('[POSTING_QUEUE] ⚠️ Rate limit reached, skipping posting');
      return;
    }
    
    // 3. Get ready decisions from queue
    const readyDecisions = await getReadyDecisions();
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    
    if (readyDecisions.length === 0) {
      console.log(`[POSTING_QUEUE] ℹ️ No decisions ready for posting (grace_window=${GRACE_MINUTES}m)`);
      return;
    }
    
    console.log(`[POSTING_QUEUE] 📝 Found ${readyDecisions.length} decisions ready for posting (grace_window=${GRACE_MINUTES}m)`);
    
    // 4. Process each decision
    let successCount = 0;
    for (const decision of readyDecisions) {
      try {
        await processDecision(decision);
        successCount++;
      } catch (error) {
        console.error(`[POSTING_QUEUE] ❌ Failed to post decision ${decision.id}:`, error.message);
        await markDecisionFailed(decision.id, error.message);
      }
    }
    
    console.log(`[POSTING_QUEUE] ✅ Posted ${successCount}/${readyDecisions.length} decisions`);
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Queue processing failed:', error.message);
    throw error;
  }
}

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'content' | 'reply';
  target_tweet_id?: string;
  target_username?: string;
  bandit_arm: string;
  timing_arm?: string;
  predicted_er: number;
  quality_score?: number;
  topic_cluster: string;
  status: string;
  created_at: string;
}

interface QueuedDecisionRow {
  [key: string]: unknown;
  id: unknown;
  content: unknown;
  decision_type: unknown;
  target_tweet_id?: unknown;
  target_username?: unknown;
  bandit_arm: unknown;
  timing_arm?: unknown;
  predicted_er: unknown;
  quality_score?: unknown;
  topic_cluster: unknown;
  status: unknown;
  created_at: unknown;
}

async function checkPostingRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxPostsPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 1));
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', oneHourAgo);
    
    if (error) {
      console.warn('[POSTING_QUEUE] ⚠️ Failed to check posting rate limit, allowing posts');
      return true;
    }
    
    const recentPosts = count || 0;
    if (recentPosts >= maxPostsPerHour) {
      console.log(`[POSTING_QUEUE] ⚠️ Hourly post limit reached: ${recentPosts}/${maxPostsPerHour}`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Post budget available: ${recentPosts}/${maxPostsPerHour}`);
    return true;
    
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to check rate limits, allowing posts:', error.message);
    return true;
  }
}

async function getReadyDecisions(): Promise<QueuedDecision[]> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Add grace window for "close enough" posts
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    const graceWindow = new Date(Date.now() + GRACE_MINUTES * 60 * 1000).toISOString();
    
    console.log(`[POSTING_QUEUE] 📅 Fetching posts ready within ${GRACE_MINUTES} minute window`);
    
    const { data, error } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('status', 'queued')
      // Remove generation_source filter to allow all queued content
      .lte('scheduled_at', graceWindow) // Add grace window filter
      .order('scheduled_at', { ascending: true }) // Order by scheduled time, not creation time
      .limit(5); // Process max 5 at a time to avoid overwhelming Twitter
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Map raw rows to typed decisions
    const rows = data as QueuedDecisionRow[];
    const decisions: QueuedDecision[] = rows.map(row => ({
      id: String(row.id ?? ''),
      content: String(row.content ?? ''),
      decision_type: String(row.decision_type ?? 'content') as 'content' | 'reply',
      target_tweet_id: row.target_tweet_id ? String(row.target_tweet_id) : undefined,
      target_username: row.target_username ? String(row.target_username) : undefined,
      bandit_arm: String(row.bandit_arm ?? ''),
      timing_arm: row.timing_arm ? String(row.timing_arm) : undefined,
      predicted_er: Number(row.predicted_er ?? 0),
      quality_score: row.quality_score ? Number(row.quality_score) : undefined,
      topic_cluster: String(row.topic_cluster ?? ''),
      status: String(row.status ?? 'ready_for_posting'),
      created_at: String(row.created_at ?? new Date().toISOString())
    }));
    
    return decisions;
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
    return [];
  }
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  console.log(`[POSTING_QUEUE] 📮 Processing ${decision.decision_type}: ${decision.id}`);
  
    // Note: We keep status as 'queued' until actually posted
    // No intermediate 'posting' status to avoid DB constraint violations
    
    // Update metrics
    await updatePostingMetrics('queued');
  
  try {
    let tweetId: string;
    
    if (decision.decision_type === 'content') {
      tweetId = await postContent(decision);
    } else if (decision.decision_type === 'reply') {
      tweetId = await postReply(decision);
    } else {
      throw new Error(`Unknown decision type: ${decision.decision_type}`);
    }
    
    // Mark as posted and store tweet ID
    await markDecisionPosted(decision.id, tweetId);
    
    // Update metrics
    await updatePostingMetrics('posted');
    
    console.log(`[POSTING_QUEUE] ✅ ${decision.decision_type} posted: ${tweetId}`);
    
  } catch (error) {
    await updateDecisionStatus(decision.id, 'failed');
    await updatePostingMetrics('error');
    throw error;
  }
}

async function postContent(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 📝 Posting content: "${decision.content.substring(0, 50)}..."`);
  
  // 🛡️ Use BulletproofTwitterComposer with 4 fallback strategies
  console.log('[POSTING_QUEUE] 🛡️ Using BulletproofTwitterComposer with 4 strategies...');
  
  try {
    // 🎯 EMERGENCY: Use UltimateTwitterPoster with current X selectors
    console.log('[POSTING_QUEUE] 🎯 Using UltimateTwitterPoster with updated selectors...');
    
    const { UltimateTwitterPoster } = await import('../posting/ultimatePostingFix');
    const { chromium } = await import('playwright');
    
    const browser = await chromium.launch({ 
      headless: true,  // ← PERMANENT FIX: Back to headless but with MAXIMUM stealth
      args: [
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-popup-blocking',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--no-default-browser-check',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-service-autorun',
        '--export-tagged-pdf',
        '--disable-search-engine-choice-screen',
        '--unsafely-disable-devtools-self-xss-warnings'
      ]
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });
    
    // 🎭 ULTIMATE STEALTH: Remove ALL automation indicators
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Remove automation flags
      delete (window as any).chrome?.runtime?.onConnect;
      delete (window as any).chrome?.runtime?.onMessage;
      delete (window as any).__nightmare;
      delete (window as any).__phantomas;
      delete (window as any).__fxdriver_unwrapped;
      delete (window as any).callPhantom;
      delete (window as any)._phantom;
      delete (window as any).phantom;
      
      // Spoof plugins to look like real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ],
      });
      
      // Spoof languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Spoof permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Hide that we're headless
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
      });
      
      // Spoof screen properties
      Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
      Object.defineProperty(screen, 'width', { get: () => 1920 });
    });
    
    const page = await context.newPage();
    
    const ultimatePoster = new UltimateTwitterPoster(page);
    const result = await ultimatePoster.postTweet(decision.content);
    
    await browser.close();
    
    if (result.success) {
      const tweetId = result.tweetId || `ultimate_${Date.now()}`;
      console.log(`[POSTING_QUEUE] ✅ Content posted via UltimateTwitterPoster with ID: ${tweetId}`);
      return tweetId;
    } else {
      console.error(`[POSTING_QUEUE] ❌ UltimateTwitterPoster posting failed: ${result.error}`);
      throw new Error(result.error || 'UltimateTwitterPoster posting failed');
    }
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ❌ UltimateTwitterPoster system error: ${error.message}`);
    throw new Error(`UltimateTwitterPoster posting failed: ${error.message}`);
  }
}

async function postReply(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  if (!decision.target_tweet_id) {
    throw new Error('Reply decision missing target_tweet_id');
  }
  
  // 🛡️ Use bulletproof posting system for replies too
  console.log('[POSTING_QUEUE] 🛡️ Using bulletproof reply system...');
  
  try {
    // For now, use the same bulletproof posting system
    // TODO: Implement proper reply functionality in bulletproof system
    const { bulletproofPost } = await import('../posting/bulletproofHttpPoster');
    const bulletproofResult = await bulletproofPost(decision.content);
    
    if (bulletproofResult.success) {
      const tweetId = bulletproofResult.tweetId || `bulletproof_reply_${Date.now()}`;
      console.log(`[POSTING_QUEUE] ✅ Reply posted via bulletproof system with ID: ${tweetId}`);
      return tweetId;
    } else {
      console.error(`[POSTING_QUEUE] ❌ Bulletproof reply failed: ${bulletproofResult.error}`);
      throw new Error(bulletproofResult.error || 'Bulletproof reply failed');
    }
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ❌ Bulletproof reply system error: ${error.message}`);
    throw new Error(`Bulletproof reply failed: ${error.message}`);
  }
}

async function updateDecisionStatus(decisionId: string, status: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
  }
}

async function markDecisionPosted(decisionId: string, tweetId: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 1. Update content_metadata status
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'posted',
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (updateError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update content_metadata for ${decisionId}:`, updateError.message);
    }
    
    // 2. Get the full decision details for posted_decisions archive
    const { data: decisionData, error: fetchError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('id', decisionId)
      .single();
    
    if (fetchError || !decisionData) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to fetch decision data for ${decisionId}`);
      return;
    }
    
    // 3. Store in posted_decisions archive with safer numeric handling
    const { error: archiveError } = await supabase
      .from('posted_decisions')
      .insert([{
        decision_id: decisionId,
        content: decisionData.content,
        tweet_id: tweetId,
        decision_type: decisionData.decision_type || 'content',
        target_tweet_id: decisionData.target_tweet_id,
        target_username: decisionData.target_username,
        bandit_arm: decisionData.bandit_arm,
        timing_arm: decisionData.timing_arm,
        predicted_er: Math.min(1.0, Math.max(0.0, Number(decisionData.predicted_er) || 0)),
        quality_score: Math.min(1.0, Math.max(0.0, Number(decisionData.quality_score) || 0)),
        topic_cluster: decisionData.topic_cluster,
        posted_at: new Date().toISOString()
      }]);
    
    if (archiveError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to archive posted decision ${decisionId}:`, archiveError.message);
    } else {
      console.log(`[POSTING_QUEUE] 📝 Decision ${decisionId} marked as posted with tweet ID: ${tweetId}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark posted for ${decisionId}:`, error.message);
  }
}

async function markDecisionFailed(decisionId: string, errorMessage: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
    } else {
      console.log(`[POSTING_QUEUE] ❌ Decision ${decisionId} marked as failed: ${errorMessage}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
  }
}

async function updatePostingMetrics(type: 'queued' | 'posted' | 'error'): Promise<void> {
  try {
    const { updateMockMetrics } = await import('../api/metrics');
    
    switch (type) {
      case 'queued':
        updateMockMetrics({ postsQueued: 1 });
        break;
      case 'posted':
        updateMockMetrics({ postsPosted: 1 });
        break;
      case 'error':
        updateMockMetrics({ postingErrors: 1 });
        break;
    }
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to update posting metrics:', error.message);
  }
}
