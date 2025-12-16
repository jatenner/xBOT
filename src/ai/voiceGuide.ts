/**
 * 🎤 VOICE GUIDE
 * 
 * Helper for making voice decisions (hook, tone, structure) based on content slot and context.
 * 
 * This is a conservative implementation that tags metadata and logs decisions,
 * without drastically changing content generation behavior.
 */

import type { ContentSlotType } from '../utils/contentSlotManager';
import type { ExtendedContentSlotType, HookType, ToneType, StructureType } from '../config/voiceOntology';
import { getAllowedHooks, getAllowedTones, getPreferredStructures } from '../config/voiceOntology';

/**
 * Voice decision result
 */
export interface VoiceDecision {
  slot: ExtendedContentSlotType;
  hookType: HookType;
  tone: ToneType;
  structure: StructureType;
}

/**
 * Input arguments for voice decision
 */
export interface VoiceDecisionArgs {
  slot: ContentSlotType | 'reply' | null | undefined;
  generatorName: string;
  decisionType: 'single' | 'thread' | 'reply';
  topic?: string | null;
}

/**
 * Choose voice characteristics for content
 * 
 * Conservative implementation that:
 * - Uses VOICE_ONTOLOGY as source of truth
 * - Falls back to safe defaults if slot is missing
 * - Logs all decisions for tracking
 * - Keeps behavior similar to current system
 */
export function chooseVoiceForContent(args: VoiceDecisionArgs): VoiceDecision {
  console.log(`[VOICE_GUIDE] chooseVoiceForContent slot=${args.slot} generator=${args.generatorName} decisionType=${args.decisionType}`);
  
  try {
    // Normalize slot - handle null/undefined and ensure it's a valid ExtendedContentSlotType
    let slot: ExtendedContentSlotType;
    
    if (!args.slot || args.slot === null || args.slot === undefined) {
      // Fallback to safe default
      slot = 'educational';
      console.log(`[VOICE_GUIDE] ⚠️ Missing slot, using fallback: ${slot}`);
    } else if (args.decisionType === 'reply') {
      // Force reply slot for replies
      slot = 'reply';
    } else {
      slot = args.slot as ExtendedContentSlotType;
    }

    // Handle reply case specially
    if (args.decisionType === 'reply' || slot === 'reply') {
      const allowedHooks = getAllowedHooks('reply');
      const allowedTones = getAllowedTones('reply');
      const preferredStructures = getPreferredStructures('reply');

      const decision: VoiceDecision = {
        slot: 'reply',
        hookType: allowedHooks[0] || 'none', // Always 'none' for replies
        tone: allowedTones[Math.floor(Math.random() * allowedTones.length)] || 'practical',
        structure: preferredStructures[0] || 'reply' // Always 'reply' structure
      };

      console.log(
        `[VOICE_GUIDE] slot=${slot} generator=${args.generatorName} decisionType=${args.decisionType} ` +
        `hook=${decision.hookType} tone=${decision.tone} structure=${decision.structure}`
      );

      return decision;
    }

    // For non-replies, choose based on slot and decision type
    const allowedHooks = getAllowedHooks(slot);
    const allowedTones = getAllowedTones(slot);
    const preferredStructures = getPreferredStructures(slot);

    // Choose structure based on decisionType and slot preferences
    let structure: StructureType;
    if (args.decisionType === 'thread') {
      structure = 'thread';
    } else if (args.decisionType === 'single') {
      structure = 'single';
    } else {
      // Default based on slot preferences
      structure = preferredStructures[0] || 'single';
    }

    // Choose hook with slight bias toward question and statistic (as per Phase 5 strategy)
    let hookType: HookType;
    const hookWeights: Record<HookType, number> = {
      question: 1.3, // 30% boost
      statistic: 1.2, // 20% boost
      contrarian: 1.0,
      framework: 1.0,
      practical: 1.0,
      story: 1.0,
      reveal: 1.0,
      none: 0.8 // Slight penalty
    };

    const weightedHooks: HookType[] = [];
    for (const hook of allowedHooks) {
      const weight = hookWeights[hook] || 1.0;
      const count = Math.ceil(weight * 10);
      for (let i = 0; i < count; i++) {
        weightedHooks.push(hook);
      }
    }

    hookType = weightedHooks[Math.floor(Math.random() * weightedHooks.length)] || allowedHooks[0] || 'question';

    // Choose tone with bias toward educational and practical (as per Phase 5 strategy)
    let tone: ToneType;
    const toneWeights: Record<ToneType, number> = {
      educational: 1.3, // 30% boost
      practical: 1.25, // 25% boost
      data_driven: 1.0,
      provocative: 1.0,
      narrative: 1.0,
      thoughtful: 1.0,
      timely: 1.0
    };

    const weightedTones: ToneType[] = [];
    for (const t of allowedTones) {
      const weight = toneWeights[t] || 1.0;
      const count = Math.ceil(weight * 10);
      for (let i = 0; i < count; i++) {
        weightedTones.push(t);
      }
    }

    tone = weightedTones[Math.floor(Math.random() * weightedTones.length)] || allowedTones[0] || 'educational';

    const decision: VoiceDecision = {
      slot,
      hookType,
      tone,
      structure
    };

    console.log(
      `[VOICE_GUIDE] slot=${slot} generator=${args.generatorName} decisionType=${args.decisionType} ` +
      `hook=${decision.hookType} tone=${decision.tone} structure=${decision.structure}`
    );

    return decision;

  } catch (error: any) {
    // Fail gracefully - return safe defaults
    console.error(`[VOICE_GUIDE] ❌ Error choosing voice: ${error.message}`);
    console.error(`[VOICE_GUIDE] ⚠️ Using safe defaults`);

    const fallbackDecision: VoiceDecision = {
      slot: args.slot || 'educational',
      hookType: 'question',
      tone: 'educational',
      structure: args.decisionType === 'thread' ? 'thread' : 'single'
    };

    console.log(
      `[VOICE_GUIDE] slot=${fallbackDecision.slot} generator=${args.generatorName} decisionType=${args.decisionType} ` +
      `hook=${fallbackDecision.hookType} tone=${fallbackDecision.tone} structure=${fallbackDecision.structure} (FALLBACK)`
    );

    return fallbackDecision;
  }
}

