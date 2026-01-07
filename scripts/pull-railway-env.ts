import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Pull Railway environment variables and write to .env file
 * Railway CLI doesn't have a direct "pull" command, so we use --kv format
 */
async function pullRailwayEnv() {
  const envFile = '.env';
  const environment = process.env.RAILWAY_ENV || 'production';

  console.log(`[ENV_PULL] Pulling Railway variables (environment: ${environment})...`);

  try {
    // Get variables in KV format (key=value pairs)
    const output = execSync(
      `railway variables --environment ${environment} --kv`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();

    if (!output || output.length === 0) {
      console.warn('[ENV_PULL] ⚠️  No variables returned from Railway');
      return;
    }

    // Parse KV format (key=value, one per line)
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    const varCount = lines.length;

    // Write to .env file
    writeFileSync(envFile, lines.join('\n') + '\n', 'utf8');

    console.log(`[ENV_PULL] ✅ Pulled ${varCount} variables to ${envFile}`);

    // Verify TWITTER_SESSION_B64 length (without printing the actual value)
    const sessionB64Line = lines.find(line => line.startsWith('TWITTER_SESSION_B64='));
    if (sessionB64Line) {
      const sessionB64 = sessionB64Line.split('=').slice(1).join('='); // Handle = in value
      const b64Len = sessionB64.length;
      console.log(`[ENV_PULL] ✅ TWITTER_SESSION_B64 length: ${b64Len} characters`);
    } else {
      console.warn('[ENV_PULL] ⚠️  TWITTER_SESSION_B64 not found in Railway variables');
    }

  } catch (error: any) {
    console.error(`[ENV_PULL] ❌ Error pulling Railway variables: ${error.message}`);
    
    // Check if Railway CLI is installed/authenticated
    if (error.message.includes('command not found') || error.message.includes('railway: not found')) {
      console.error('[ENV_PULL] ❌ Railway CLI not found. Install it: npm i -g @railway/cli');
    } else if (error.message.includes('not authenticated') || error.message.includes('unauthorized')) {
      console.error('[ENV_PULL] ❌ Not authenticated with Railway. Run: railway login');
    } else {
      console.error('[ENV_PULL] ❌ Unexpected error. Please check Railway CLI version and try again.');
      console.error('[ENV_PULL]    If this persists, paste the exact error and we can adjust the command.');
    }
    process.exit(1);
  }
}

pullRailwayEnv().catch(console.error);

