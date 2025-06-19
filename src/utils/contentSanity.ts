import axios from 'axios';

interface SanityResult {
  ok: boolean;
  fixes: string[];
  reason?: string;
}

interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Checks if time-based intro matches current hour and fixes if needed
 */
export function checkTimeIntro(text: string, now: Date = new Date()): string {
  const hour = now.getHours();
  
  // Define time periods
  const timeMap = {
    'Late Night': [0, 1, 2, 3, 4, 5], // 00:00-05:59
    'Good Morning': [6, 7, 8, 9, 10, 11], // 06:00-11:59
    'Afternoon': [12, 13, 14, 15, 16, 17], // 12:00-17:59
    'Evening': [18, 19, 20, 21, 22, 23] // 18:00-23:59
  };

  // Find current correct intro
  let correctIntro = '';
  for (const [intro, hours] of Object.entries(timeMap)) {
    if (hours.includes(hour)) {
      correctIntro = intro;
      break;
    }
  }

  // Check for existing time intros and replace if wrong
  const timeIntroRegex = /(Late Night|Good Morning|Afternoon|Evening)/gi;
  const matches = text.match(timeIntroRegex);
  
  if (matches && matches.length > 0) {
    const currentIntro = matches[0];
    if (currentIntro.toLowerCase() !== correctIntro.toLowerCase()) {
      // Replace the wrong intro with the correct one
      return text.replace(timeIntroRegex, correctIntro);
    }
  }

  return text;
}

/**
 * Validates riddles that claim to be specific word lengths
 */
export function validateRiddle(text: string): ValidationResult {
  // Look for "five-letter word" pattern
  const fiveLetterPattern = /five-letter word/i;
  if (!fiveLetterPattern.test(text)) {
    return { ok: true }; // No five-letter word claim
  }

  // Extract the answer - look for quoted text or text after "What am I?"
  const answerPatterns = [
    /"([^"]+)"/g, // Quoted text
    /What am I\?\s*([A-Za-z]+)/i, // After "What am I?"
    /Answer:\s*([A-Za-z]+)/i, // After "Answer:"
    /I am\s+([A-Za-z]+)/i // After "I am"
  ];

  let answer = '';
  for (const pattern of answerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      answer = match[1].trim();
      break;
    }
  }

  if (!answer) {
    return { 
      ok: false, 
      reason: 'Five-letter word riddle found but no answer detected in quotes or after "What am I?"' 
    };
  }

  if (answer.length !== 5) {
    return { 
      ok: false, 
      reason: `Riddle claims "five-letter word" but answer "${answer}" has ${answer.length} letters` 
    };
  }

  return { ok: true };
}

/**
 * Validates URLs by making HEAD requests
 */
export async function validateUrls(text: string): Promise<ValidationResult> {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  
  if (urls.length === 0) {
    return { ok: true }; // No URLs to check
  }

  const timeout = 6000; // 6 seconds

  for (const url of urls) {
    try {
      const response = await axios.head(url, { 
        timeout,
        validateStatus: (status) => status < 500 // Accept redirects and client errors, reject server errors
      });
      
      // Check for major issues
      if (response.status >= 400) {
        return { 
          ok: false, 
          reason: `URL ${url} returned ${response.status} status` 
        };
      }
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { 
          ok: false, 
          reason: `URL ${url} is unreachable: ${error.message}` 
        };
      }
      if (error.code === 'ECONNABORTED') {
        return { 
          ok: false, 
          reason: `URL ${url} timed out after ${timeout}ms` 
        };
      }
      // For other errors, continue (might be temporary network issues)
      console.warn(`URL check warning for ${url}:`, error.message);
    }
  }

  return { ok: true };
}

/**
 * Runs all sanity checks and returns consolidated result
 */
export async function runSanityChecks(text: string): Promise<SanityResult> {
  const fixes: string[] = [];
  let currentText = text;

  // 1. Check and fix time intro
  const fixedTimeText = checkTimeIntro(currentText);
  if (fixedTimeText !== currentText) {
    currentText = fixedTimeText;
    fixes.push('Fixed time-based intro to match current hour');
  }

  // 2. Validate riddle
  const riddleCheck = validateRiddle(currentText);
  if (!riddleCheck.ok) {
    return {
      ok: false,
      fixes,
      reason: riddleCheck.reason
    };
  }

  // 3. Validate URLs
  const urlCheck = await validateUrls(currentText);
  if (!urlCheck.ok) {
    return {
      ok: false,
      fixes,
      reason: urlCheck.reason
    };
  }

  // Update the text with fixes if any
  if (fixes.length > 0) {
    fixes.unshift(currentText); // Put the fixed text first
  }

  return {
    ok: true,
    fixes
  };
} 