/**
 * 🧠 HUMAN CONTENT FILTER
 * 
 * Automatically filters ALL content to sound human and removes hashtags
 * This ensures every tweet sounds natural and conversational
 */

import { HUMAN_CONTENT_CONFIG, humanizeContent, removeHashtags, getHumanContentStarters, getHumanContentEndings } from '../config/humanContentConfig';

export class HumanContentFilter {
  
  /**
   * 🚫 MANDATORY HASHTAG REMOVAL
   * This function is called on ALL content before posting
   */
  static removeAllHashtags(content: string): string {
    // Remove hashtags completely - no exceptions
    return content
      .replace(/#\w+/g, '') // Remove all hashtags
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim();
  }
  
  /**
   * 🧠 HUMANIZE ALL CONTENT
   * Makes any content sound natural and conversational
   */
  static makeHuman(content: string): string {
    let humanContent = content;
    
    // Step 1: Remove ALL hashtags (mandatory)
    humanContent = this.removeAllHashtags(humanContent);
    
    // Step 2: Replace robotic phrases
    humanContent = this.replaceRoboticPhrases(humanContent);
    
    // Step 3: Add contractions for natural flow
    humanContent = this.addContractions(humanContent);
    
    // Step 4: Add personal perspective if missing
    humanContent = this.addPersonalTouch(humanContent);
    
    // Step 5: Clean up and validate
    humanContent = this.finalCleanup(humanContent);
    
    return humanContent;
  }
  
  /**
   * Replace robotic/marketing phrases with human alternatives
   */
  private static replaceRoboticPhrases(content: string): string {
    const roboticPatterns = [
      { robotic: /\bThoughts\?\s*$/gi, human: "What's your take?" },
      { robotic: /\bWhat do you think\?\s*$/gi, human: "Anyone else notice this?" },
      { robotic: /\bLet me know in the comments/gi, human: "Curious what others think" },
      { robotic: /\bDrop your thoughts below/gi, human: "What's your experience been?" },
      { robotic: /\bFollow for more/gi, human: "" },
      { robotic: /\bLike and retweet/gi, human: "" },
      { robotic: /\bDon't forget to/gi, human: "" },
      { robotic: /\bMake sure to/gi, human: "" },
      { robotic: /\bBe sure to/gi, human: "" },
      { robotic: /\bKey takeaway:/gi, human: "What strikes me:" },
      { robotic: /\bBreaking:/gi, human: "Just saw:" },
      { robotic: /\bAlert:/gi, human: "Noticed:" },
      { robotic: /\bFun fact:/gi, human: "Interesting:" },
      { robotic: /\bPro tip:/gi, human: "Something I learned:" },
      { robotic: /\bGame changer/gi, human: "pretty significant" },
      { robotic: /\bRevolutionary/gi, human: "remarkable" },
      { robotic: /\bCutting-edge/gi, human: "latest" },
      { robotic: /\bNext-generation/gi, human: "newer" },
      { robotic: /\bState-of-the-art/gi, human: "advanced" }
    ];
    
    let humanContent = content;
    
    roboticPatterns.forEach(pattern => {
      humanContent = humanContent.replace(pattern.robotic, pattern.human);
    });
    
    return humanContent;
  }
  
  /**
   * Add natural contractions
   */
  private static addContractions(content: string): string {
    return content
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bwill not\b/g, "won't")
      .replace(/\bwould not\b/g, "wouldn't")
      .replace(/\bcould not\b/g, "couldn't")
      .replace(/\bshould not\b/g, "shouldn't")
      .replace(/\bmight not\b/g, "mightn't")
      .replace(/\bit is\b/g, "it's")
      .replace(/\bthat is\b/g, "that's")
      .replace(/\bwho is\b/g, "who's")
      .replace(/\bwhat is\b/g, "what's")
      .replace(/\bwhere is\b/g, "where's")
      .replace(/\bhow is\b/g, "how's")
      .replace(/\bwhen is\b/g, "when's")
      .replace(/\bwhy is\b/g, "why's")
      .replace(/\bwe are\b/g, "we're")
      .replace(/\bthey are\b/g, "they're")
      .replace(/\byou are\b/g, "you're")
      .replace(/\bi am\b/g, "I'm")
      .replace(/\bhe is\b/g, "he's")
      .replace(/\bshe is\b/g, "she's")
      .replace(/\bthere is\b/g, "there's")
      .replace(/\bhere is\b/g, "here's")
      .replace(/\bwho would\b/g, "who'd")
      .replace(/\bwhat would\b/g, "what'd")
      .replace(/\bi would\b/g, "I'd")
      .replace(/\byou would\b/g, "you'd")
      .replace(/\bwe would\b/g, "we'd")
      .replace(/\bthey would\b/g, "they'd")
      .replace(/\bi have\b/g, "I've")
      .replace(/\byou have\b/g, "you've")
      .replace(/\bwe have\b/g, "we've")
      .replace(/\bthey have\b/g, "they've");
  }
  
  /**
   * Add personal perspective if content is too impersonal
   */
  private static addPersonalTouch(content: string): string {
    // Check if content already has personal elements
    const personalMarkers = [
      /\bi'm\b/i, /\bi've\b/i, /\bi'd\b/i, /\bi'll\b/i,
      /\bmy\b/i, /\bme\b/i, /\bin my\b/i,
      /\bbeen thinking/i, /\bnoticed\b/i, /\bobserving/i,
      /\bfascinating/i, /\binteresting/i, /\bremarkable/i,
      /\bstrikes me/i, /\bcaught my attention/i,
      /\bjust saw/i, /\bjust noticed/i
    ];
    
    const hasPersonalTouch = personalMarkers.some(marker => marker.test(content));
    
    if (!hasPersonalTouch && content.length > 50) {
      const starters = getHumanContentStarters();
      const randomStarter = starters[Math.floor(Math.random() * starters.length)];
      
      // Add personal starter if content is too formal
      if (!content.match(/^(The|A|An|Most|Many|Some|AI|Machine|Technology|Healthcare)/)) {
        // Content already starts conversationally
        return content;
      } else {
        // Make it more personal
        content = `${randomStarter} ${content.charAt(0).toLowerCase() + content.slice(1)}`;
      }
    }
    
    return content;
  }
  
  /**
   * Final cleanup and validation
   */
  private static finalCleanup(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .replace(/\s+\./g, '.') // Fix spaced periods
      .replace(/\s+,/g, ',') // Fix spaced commas
      .replace(/\s+!/g, '!') // Fix spaced exclamations
      .replace(/\s+\?/g, '?') // Fix spaced questions
      .trim();
  }
  
  /**
   * 🚨 EMERGENCY HASHTAG SCANNER
   * Double-check that NO hashtags exist anywhere
   */
  static validateNoHashtags(content: string): boolean {
    return !content.includes('#');
  }
  
  /**
   * 🎯 MASTER FILTER FUNCTION
   * This is called on ALL content before posting
   */
  static filterAllContent(content: string): string {
    console.log('🧠 Applying human content filter...');
    
    // Apply all humanization
    let humanContent = this.makeHuman(content);
    
    // Emergency hashtag check
    if (!this.validateNoHashtags(humanContent)) {
      console.log('🚫 Emergency hashtag removal triggered');
      humanContent = this.removeAllHashtags(humanContent);
    }
    
    // Final validation
    if (humanContent.includes('#')) {
      console.log('🚨 CRITICAL: Hashtags still detected, forcing removal');
      humanContent = humanContent.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
    }
    
    console.log('✅ Content humanized - natural and hashtag-free');
    return humanContent;
  }
} 