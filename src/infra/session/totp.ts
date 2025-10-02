/**
 * 🔢 Simple TOTP (Time-based One-Time Password) Generator
 * Used for 2FA login
 */

import crypto from 'crypto';

/**
 * Base32 decode
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  let bits = '';
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  
  return Buffer.from(bytes);
}

/**
 * Generate TOTP code
 */
export function generateTOTP(secret: string, timeStep: number = 30): string {
  try {
    // Decode base32 secret
    const key = base32Decode(secret);
    
    // Get current time step
    const epoch = Math.floor(Date.now() / 1000 / timeStep);
    const time = Buffer.alloc(8);
    time.writeBigInt64BE(BigInt(epoch));
    
    // HMAC-SHA1
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(time);
    const hash = hmac.digest();
    
    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    );
    
    // Return 6-digit code
    return (code % 1000000).toString().padStart(6, '0');
  } catch (error: any) {
    console.error('[TOTP] Failed to generate code:', error.message);
    throw new Error('TOTP generation failed');
  }
}

