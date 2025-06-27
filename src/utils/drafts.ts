/**
 * Draft Queue System
 * Handles queuing tweets when rate limits are exhausted
 */

import { supabaseClient } from './supabaseClient.js';

export interface QueuedDraft {
  id?: string;
  content: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
  scheduled_for?: Date;
  created_at?: Date;
  media_urls?: string[];
  alt_text?: string[];
}

export interface DraftQueueOptions {
  priority?: 'high' | 'medium' | 'low';
  scheduledFor?: Date;
  mediaUrls?: string[];
  altText?: string[];
}

/**
 * Queue a tweet draft for later posting
 */
export async function queueDraft(
  content: string, 
  source: string = 'unknown',
  options: DraftQueueOptions = {}
): Promise<boolean> {
  try {
    const draft: QueuedDraft = {
      content: content.trim(),
      source,
      priority: options.priority || 'medium',
      scheduled_for: options.scheduledFor || new Date(),
      media_urls: options.mediaUrls || null,
      alt_text: options.altText || null
    };

    const { error } = await supabaseClient.supabase
      ?.from('drafts')
      .insert(draft);

    if (error) {
      console.log('⚠️ Failed to queue draft:', error.message);
      return false;
    }

    console.log(`📝 Draft queued: ${content.substring(0, 50)}... (${source})`);
    return true;

  } catch (error) {
    console.log('⚠️ Error queuing draft:', error);
    return false;
  }
}

/**
 * Get next draft to post (ordered by priority and creation time)
 */
export async function getNextDraft(): Promise<QueuedDraft | null> {
  try {
    const { data, error } = await supabaseClient.supabase
      ?.from('drafts')
      .select('*')
      .order('priority', { ascending: false }) // high priority first
      .order('created_at', { ascending: true }) // oldest first
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as QueuedDraft;

  } catch (error) {
    console.log('⚠️ Error getting next draft:', error);
    return null;
  }
}

/**
 * Remove draft from queue after successful posting
 */
export async function removeDraft(draftId: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.supabase
      ?.from('drafts')
      .delete()
      .eq('id', draftId);

    if (error) {
      console.log('⚠️ Failed to remove draft:', error.message);
      return false;
    }

    return true;

  } catch (error) {
    console.log('⚠️ Error removing draft:', error);
    return false;
  }
}

/**
 * Get draft queue statistics
 */
export async function getDraftQueueStats(): Promise<{
  total: number;
  high: number;
  medium: number;
  low: number;
}> {
  try {
    const { data, error } = await supabaseClient.supabase
      ?.from('drafts')
      .select('priority');

    if (error || !data) {
      return { total: 0, high: 0, medium: 0, low: 0 };
    }

    const stats = {
      total: data.length,
      high: data.filter(d => d.priority === 'high').length,
      medium: data.filter(d => d.priority === 'medium').length,
      low: data.filter(d => d.priority === 'low').length,
    };

    return stats;

  } catch (error) {
    console.log('⚠️ Error getting draft stats:', error);
    return { total: 0, high: 0, medium: 0, low: 0 };
  }
}

/**
 * Clear old drafts (older than 7 days)
 */
export async function clearOldDrafts(): Promise<number> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabaseClient.supabase
      ?.from('drafts')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())
      .select('id');

    if (error) {
      console.log('⚠️ Failed to clear old drafts:', error.message);
      return 0;
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      console.log(`🧹 Cleared ${deletedCount} old drafts`);
    }

    return deletedCount;

  } catch (error) {
    console.log('⚠️ Error clearing old drafts:', error);
    return 0;
  }
}
