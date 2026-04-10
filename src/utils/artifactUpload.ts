/**
 * Cloud-backed artifact handling for Mac runner.
 * Uploads thread/composer artifacts to Supabase Storage so the runner stays an execution node.
 *
 * Rules:
 * - ARTIFACT_UPLOAD_ALL=true OR CONTROLLED_PROOF_MODE=true → upload all
 * - ARTIFACT_UPLOAD_FAILURES_ONLY=false → do not upload (by default we upload failures only)
 * - Otherwise → upload only failures
 *
 * On success: log path, optional DB insert, delete local file.
 * On failure: keep local file, log clearly.
 */

import { existsSync, readFileSync, unlinkSync } from 'fs';

const BUCKET = process.env.ARTIFACT_STORAGE_BUCKET || 'runner-artifacts';
const PREFIX = 'thread-artifacts';

export interface UploadArtifactOptions {
  decisionId: string;
  label: string;
  isFailure?: boolean;
  runId?: string;
}

export interface UploadResult {
  uploaded: boolean;
  storagePath?: string;
  error?: string;
  localKept: boolean;
}

export function shouldUploadArtifact(isFailure: boolean): boolean {
  const uploadAll = process.env.ARTIFACT_UPLOAD_ALL === 'true' || process.env.CONTROLLED_PROOF_MODE === 'true';
  if (uploadAll) return true;
  if (process.env.ARTIFACT_UPLOAD_FAILURES_ONLY === 'false') return false;
  return isFailure;
}

export async function uploadArtifact(
  localPath: string,
  options: UploadArtifactOptions
): Promise<UploadResult> {
  const { decisionId, label, isFailure = true, runId } = options;

  if (!existsSync(localPath)) {
    return { uploaded: false, localKept: true, error: 'local file not found' };
  }

  if (!shouldUploadArtifact(isFailure)) {
    return { uploaded: false, localKept: true };
  }

  let supabase: any;
  try {
    const { getSupabaseClient } = await import('../db/index.js');
    supabase = getSupabaseClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[ARTIFACT_UPLOAD] Supabase not available: ${msg}`);
    return { uploaded: false, localKept: true, error: msg };
  }

  const ext = localPath.replace(/.*\./, '') || 'bin';
  const safeLabel = label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  const timestamp = Date.now();
  const objectName = `${PREFIX}/${decisionId}/${timestamp}_${safeLabel}.${ext}`;

  try {
    const body = readFileSync(localPath);
    const contentType =
      ext === 'png' ? 'image/png' : ext === 'html' ? 'text/html' : ext === 'json' ? 'application/json' : 'application/octet-stream';

    const { data, error } = await supabase.storage.from(BUCKET).upload(objectName, body, {
      contentType,
      upsert: true
    });

    if (error) {
      console.error(`[ARTIFACT_UPLOAD] Upload failed: ${error.message} path=${objectName}`);
      return { uploaded: false, localKept: true, error: error.message };
    }

    const storagePath = data?.path ?? objectName;
    console.log(`[ARTIFACT_UPLOAD] Uploaded: ${storagePath} (local: ${localPath})`);

    try {
      await persistArtifactMetadata({ decisionId, runId, storagePath, label: safeLabel });
    } catch {
      // best-effort only
    }

    try {
      unlinkSync(localPath);
    } catch {
      console.warn(`[ARTIFACT_UPLOAD] Could not delete local file: ${localPath}`);
    }

    return { uploaded: true, storagePath, localKept: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ARTIFACT_UPLOAD] Error: ${msg} path=${localPath}`);
    return { uploaded: false, localKept: true, error: msg };
  }
}

async function persistArtifactMetadata(params: {
  decisionId: string;
  runId?: string;
  storagePath: string;
  label: string;
}): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index.js');
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('runner_artifact_uploads').insert({
      decision_id: params.decisionId,
      run_id: params.runId ?? null,
      storage_path: params.storagePath,
      label: params.label,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
  } catch {
    // Table may not exist; best-effort only
  }
}
