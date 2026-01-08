import { z } from 'zod';

const ModeSchema = z.enum(['live', 'shadow']);
export type UnifiedMode = z.infer<typeof ModeSchema>;

export interface ModeResolution {
  mode: UnifiedMode;
  source: string;
  warnings: string[];
  conflicts: string[];
}

interface ResolveModeOptions {
  env?: NodeJS.ProcessEnv;
}

const LegacyShadowValues = new Set(['shadow', 'dry', 'dev', 'test']);

export function resolveMode(options: ResolveModeOptions = {}): ModeResolution {
  const env = options.env ?? process.env;
  const warnings: string[] = [];
  const conflicts: string[] = [];

  const rawMode = env.MODE?.trim().toLowerCase();

  if (rawMode) {
    if (ModeSchema.safeParse(rawMode).success) {
      checkLegacyConflicts(rawMode as UnifiedMode, env, conflicts);
      return { mode: rawMode as UnifiedMode, source: 'MODE', warnings, conflicts };
    }

    if (LegacyShadowValues.has(rawMode)) {
      warnings.push(`MODE="${env.MODE}" is legacy; treating as MODE="shadow".`);
      checkLegacyConflicts('shadow', env, conflicts);
      return { mode: 'shadow', source: 'MODE(legacy)', warnings, conflicts };
    }

    warnings.push(`MODE="${env.MODE}" is invalid; falling back to MODE="live".`);
  }

  const legacyDisabled = env.POSTING_DISABLED === 'true' || env.DRY_RUN === 'true';
  const legacyLive = env.LIVE_POSTS === 'true';

  if (legacyDisabled) {
    warnings.push('POSTING_DISABLED/DRY_RUN legacy flags detected; running in MODE="shadow".');
    checkLegacyConflicts('shadow', env, conflicts);
    return { mode: 'shadow', source: 'legacy_flags', warnings, conflicts };
  }

  if (legacyLive) {
    warnings.push('LIVE_POSTS=true is deprecated; treating as MODE="live".');
  }

  checkLegacyConflicts('live', env, conflicts);
  return { mode: 'live', source: rawMode ? 'fallback' : 'default', warnings, conflicts };
}

function checkLegacyConflicts(mode: UnifiedMode, env: NodeJS.ProcessEnv, conflicts: string[]) {
  if (mode === 'live') {
    if (env.POSTING_DISABLED === 'true') {
      conflicts.push('MODE=live but POSTING_DISABLED=true (legacy). Posting remains enabled.');
    }
    // DRY_RUN is authoritative and can coexist with MODE=live - no conflict warning
  } else if (mode === 'shadow' && env.LIVE_POSTS === 'true') {
    conflicts.push('MODE=shadow but LIVE_POSTS=true (legacy). Posting stays disabled.');
  }
}

let logged = false;
export function logModeResolution(resolution: ModeResolution): void {
  if (logged) return;
  logged = true;

  const { mode, source, warnings, conflicts } = resolution;
  console.log(`[MODE] Resolved to "${mode}" (source=${source})`);
  warnings.forEach((warning) => console.warn(`[MODE] Warning: ${warning}`));
  conflicts.forEach((conflict) => console.warn(`[MODE] Conflict: ${conflict}`));
}

