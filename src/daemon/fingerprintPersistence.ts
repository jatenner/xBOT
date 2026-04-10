import fs from 'fs';
import path from 'path';
import { generateSessionFingerprint, type SessionFingerprint } from '../infra/playwright/stealthConfig';

export function loadOrCreateFingerprint(profileDir: string, filename = 'fingerprint.json'): SessionFingerprint {
  const filePath = path.join(profileDir, filename);

  // Try to load existing fingerprint
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const saved = JSON.parse(raw);
      if (saved.userAgent && saved.viewport && saved.chromeVersion) {
        console.log(`[FINGERPRINT] ✅ Loaded persistent fingerprint: Chrome/${saved.chromeVersion} viewport=${saved.viewport.width}x${saved.viewport.height}`);
        return saved as SessionFingerprint;
      }
    }
  } catch (e: any) {
    console.warn(`[FINGERPRINT] ⚠️ Failed to load fingerprint: ${e.message}`);
  }

  // Generate new fingerprint and persist
  const fp = generateSessionFingerprint();
  try {
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(fp, null, 2));
    console.log(`[FINGERPRINT] 🆕 Generated and saved fingerprint: Chrome/${fp.chromeVersion} viewport=${fp.viewport.width}x${fp.viewport.height}`);
  } catch (e: any) {
    console.warn(`[FINGERPRINT] ⚠️ Failed to save fingerprint: ${e.message}`);
  }

  return fp;
}
