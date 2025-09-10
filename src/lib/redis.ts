/**
 * Redis client wrapper - exports the safe Redis client
 * This ensures compatibility with imports that expect '../lib/redis'
 */

export { getRedisSafeClient as getRedis } from './redisSafe';
export { getRedisSafeClient } from './redisSafe';
export default getRedisSafeClient;

// For backwards compatibility, re-export the safe client
import { getRedisSafeClient } from './redisSafe';
export const redis = getRedisSafeClient();
