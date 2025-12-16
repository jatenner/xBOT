/**
 * 🎤 VOICE ONTOLOGY
 * 
 * Central type-safe configuration for content slots, hooks, tones, and structures.
 * Based on Phase 5 Content & Voice Strategy.
 * 
 * This file defines the allowed combinations and preferences for voice decisions.
 */

import type { ContentSlotType } from '../utils/contentSlotManager';

/**
 * Hook types based on Phase 5 strategy
 */
export type HookType =
  | 'question'
  | 'statistic'
  | 'contrarian'
  | 'framework'
  | 'practical'
  | 'story'
  | 'reveal'
  | 'none';

/**
 * Tone types based on Phase 5 strategy
 */
export type ToneType =
  | 'educational'
  | 'practical'
  | 'data_driven'
  | 'provocative'
  | 'narrative'
  | 'thoughtful'
  | 'timely';

/**
 * Structure types
 */
export type StructureType = 'single' | 'thread' | 'reply';

/**
 * Extended ContentSlotType that includes 'reply' for replies
 */
export type ExtendedContentSlotType = ContentSlotType | 'reply';

/**
 * Voice Ontology Configuration
 * 
 * Defines allowed hooks, tones, and preferred structures per content slot.
 * Based on Phase 5 strategy document recommendations.
 */
export const VOICE_ONTOLOGY: {
  allowedHooks: Record<ExtendedContentSlotType, HookType[]>;
  allowedTones: Record<ExtendedContentSlotType, ToneType[]>;
  preferredStructures: Record<ExtendedContentSlotType, StructureType[]>;
} = {
  allowedHooks: {
    // High-value slots (40% allocation)
    framework: ['framework', 'question', 'statistic', 'reveal'],
    practical_tip: ['practical', 'question', 'statistic', 'none'],
    research: ['statistic', 'reveal', 'question', 'none'],

    // Medium-value slots (40% allocation)
    myth_busting: ['contrarian', 'question', 'statistic', 'reveal'],
    deep_dive: ['question', 'reveal', 'statistic', 'framework'],
    case_study: ['story', 'statistic', 'reveal', 'none'],
    comparison: ['statistic', 'question', 'none', 'reveal'],
    educational: ['reveal', 'question', 'framework', 'statistic'],

    // Low-value slots (20% allocation)
    question: ['question', 'contrarian', 'none'], // Note: 'contrarian' can map to 'question' hook
    trend_analysis: ['statistic', 'reveal', 'question', 'none'],
    story: ['story', 'reveal', 'none'],
    news: ['statistic', 'reveal', 'none'],

    // Reply slot
    reply: ['none'] // Replies typically don't use hooks
  },

  allowedTones: {
    // High-value slots
    framework: ['educational', 'practical', 'data_driven'],
    practical_tip: ['practical', 'educational', 'data_driven'],
    research: ['data_driven', 'educational', 'thoughtful'],

    // Medium-value slots
    myth_busting: ['provocative', 'educational', 'data_driven'],
    deep_dive: ['thoughtful', 'educational', 'data_driven'],
    case_study: ['narrative', 'educational', 'practical'],
    comparison: ['data_driven', 'practical', 'educational'],
    educational: ['educational', 'practical', 'thoughtful'],

    // Low-value slots
    question: ['provocative', 'thoughtful', 'educational'],
    trend_analysis: ['timely', 'thoughtful', 'data_driven'],
    story: ['narrative', 'thoughtful', 'educational'],
    news: ['timely', 'data_driven', 'educational'],

    // Reply slot
    reply: ['practical', 'educational'] // Conservative tones for replies
  },

  preferredStructures: {
    // High-value slots
    framework: ['single', 'thread'], // Can be either, threads preferred for complex frameworks
    practical_tip: ['single'], // Single tweets preferred for quick tips
    research: ['single', 'thread'], // Can be either

    // Medium-value slots
    myth_busting: ['single', 'thread'], // Can be either
    deep_dive: ['thread'], // Threads preferred for deep dives
    case_study: ['single', 'thread'], // Can be either
    comparison: ['single', 'thread'], // Can be either
    educational: ['single', 'thread'], // Can be either

    // Low-value slots
    question: ['single'], // Single tweets preferred for questions
    trend_analysis: ['single', 'thread'], // Can be either
    story: ['single', 'thread'], // Can be either
    news: ['single'], // Single tweets preferred for news

    // Reply slot
    reply: ['reply'] // Always 'reply' structure
  }
};

/**
 * Get allowed hooks for a slot
 */
export function getAllowedHooks(slot: ExtendedContentSlotType): HookType[] {
  return VOICE_ONTOLOGY.allowedHooks[slot] || ['question', 'statistic', 'none'];
}

/**
 * Get allowed tones for a slot
 */
export function getAllowedTones(slot: ExtendedContentSlotType): ToneType[] {
  return VOICE_ONTOLOGY.allowedTones[slot] || ['educational', 'practical'];
}

/**
 * Get preferred structures for a slot
 */
export function getPreferredStructures(slot: ExtendedContentSlotType): StructureType[] {
  return VOICE_ONTOLOGY.preferredStructures[slot] || ['single'];
}

/**
 * Check if a hook is allowed for a slot
 */
export function isHookAllowed(slot: ExtendedContentSlotType, hook: HookType): boolean {
  return getAllowedHooks(slot).includes(hook);
}

/**
 * Check if a tone is allowed for a slot
 */
export function isToneAllowed(slot: ExtendedContentSlotType, tone: ToneType): boolean {
  return getAllowedTones(slot).includes(tone);
}

/**
 * Check if a structure is preferred for a slot
 */
export function isStructurePreferred(slot: ExtendedContentSlotType, structure: StructureType): boolean {
  return getPreferredStructures(slot).includes(structure);
}

