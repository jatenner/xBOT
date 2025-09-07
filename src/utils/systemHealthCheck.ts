/**
 * 🏥 SYSTEM HEALTH CHECK
 * Quick health verification for Railway deployment
 */

export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  status: string;
  details: Record<string, any>;
}> {
  const details: Record<string, any> = {};
  let healthy = true;
  const issues: string[] = [];

  // Check environment variables
  const requiredEnvVars = ['TWITTER_SESSION_B64', 'SUPABASE_URL', 'OPENAI_API_KEY'];
  const envStatus: Record<string, boolean> = {};
  
  for (const envVar of requiredEnvVars) {
    envStatus[envVar] = !!process.env[envVar];
    if (!process.env[envVar]) {
      healthy = false;
      issues.push(`Missing ${envVar}`);
    }
  }
  
  details.environment = envStatus;

  // Check session format
  try {
    if (process.env.TWITTER_SESSION_B64) {
      const sessionData = JSON.parse(Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString());
      details.session = {
        valid: !!(sessionData.cookies && Array.isArray(sessionData.cookies)),
        cookieCount: sessionData.cookies?.length || 0
      };
      
      if (!details.session.valid) {
        healthy = false;
        issues.push('Invalid session format');
      }
    } else {
      details.session = { valid: false, cookieCount: 0 };
    }
  } catch (error) {
    details.session = { valid: false, error: (error as Error).message };
    healthy = false;
    issues.push(`Session parse error: ${(error as Error).message}`);
  }

  // Test database connection (if possible)
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { admin } = await import('../lib/supabaseClients');
      const { data, error } = await admin.from('learning_posts').select('count').limit(1);
      
      details.database = {
        connected: !error,
        error: error?.message || null
      };
      
      if (error) {
        healthy = false;
        issues.push(`Database: ${error.message}`);
      }
    } else {
      details.database = { connected: false, error: 'Missing credentials' };
      healthy = false;
      issues.push('Database credentials missing');
    }
  } catch (error) {
    details.database = { connected: false, error: (error as Error).message };
    healthy = false;
    issues.push(`Database connection failed: ${(error as Error).message}`);
  }

  // System readiness
  details.posting = {
    ready: healthy && !!process.env.TWITTER_SESSION_B64,
    canGenerateContent: !!process.env.OPENAI_API_KEY,
    canStoreData: details.database?.connected || false
  };

  const status = healthy ? 
    'System is healthy and ready for autonomous operation' :
    `System has ${issues.length} critical issues: ${issues.join(', ')}`;

  return {
    healthy,
    status,
    details
  };
}
