/**
 * Additional type definitions for build fixes
 */

export interface PostingResult {
  success: boolean;
  content?: string;
  tweetId?: string;
  reason?: string;
  error?: string;
}

export interface ThreadPostResult {
  success: boolean;
  tweetIds: string[];
  error?: string;
}

export interface ResourceCheck {
  canLaunch: boolean;
  reason?: string;
}