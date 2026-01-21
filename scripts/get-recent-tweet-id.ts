#!/usr/bin/env tsx
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Auto-sync env from Railway
try {
  execSync('pnpm run runner:autosync', { stdio: 'pipe', encoding: 'utf-8' });
} catch (e) {
  // Continue with existing .env.local if available
}

const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
}

import { getSupabaseClient } from '../src/db';

(async () => {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, target_tweet_content')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (data) {
    console.log(data.target_tweet_id);
  } else {
    console.log('NO_TWEET_ID_FOUND');
  }
})();
