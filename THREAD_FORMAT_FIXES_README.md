# Thread Format Fixes & Tweet Sanitization Patch

## Overview

This patch implements comprehensive fixes for Twitter thread formatting, single post sanitization, and posting standardization for the xBOT system. The changes ensure that single posts never contain thread language, threads are posted as proper reply chains, and all logging is clean and actionable.

## Key Features Implemented

### 1. Format-Aware Sanitizer (`src/utils/formatSanitizer.ts`)

**Purpose**: Removes thread language and numbering tokens based on the final post format.

**Key Functions**:
- `sanitizeForFormat(input, finalFormat)` - Main sanitizer function
- `stripThreadPhrases(text)` - Removes thread-specific language
- `stripLeadingNumbering(text)` - Removes numbering patterns
- `containsThreadLanguage(text)` - Validates clean content
- `getSanitizationSummary(original, sanitized)` - Provides logging summary

**Supported Final Formats**:
- `single` - Removes all thread language, numbering, and CTAs
- `thread` - Removes forced numbering but keeps natural content
- `longform_single` - Treats as single for sanitization purposes

**Patterns Removed for Singles**:
- Thread indicators: 🧵, "thread", "follow this thread", "more in the thread"
- Numbering: 1/7, (1/7), 1/, 1.), 1), 1., part 2
- Direction indicators: 👇, "see next tweet", "continued", "next in thread"
- Dangling phrases: "in the next tweet", "continued below"

### 2. Enhanced Tweet Linter (`src/utils/tweetLinter.ts`)

**Purpose**: Enforces format-specific rules and character limits.

**Environment Variables** (with defaults):
```
TWEET_MAX_CHARS_HARD=279
EMOJI_MAX=2
FORCE_NO_HASHTAGS=true
```

**Format-Specific Rules**:
- **Singles**: Max 279 chars (hard limit), no trimming if within limit
- **Thread T1**: Max 240 chars (before-the-fold rule)
- **Thread T2+**: Max 270 chars (more room for detailed content)
- **Longform Singles**: Same as singles (279 chars)

**Actions Performed**:
- `trim` - Content shortened at word boundaries
- `emoji_reduce` - Emojis limited to EMOJI_MAX
- `hashtags_removed` - All hashtags removed when FORCE_NO_HASHTAGS=true

**Logging Format**:
```
LINTER: format=single, tweets=1, t1_chars=245, actions=[trim|emoji_reduce]
```

### 3. Real Reply-Chain Threads (`src/agents/autonomousTwitterPoster.ts`)

**Purpose**: Ensures threads post as proper Twitter reply chains with human-like delays.

**Environment Variables** (with defaults):
```
FALLBACK_SINGLE_TWEET_OK=true
ENABLE_THREADS=true
THREAD_MIN_TWEETS=4
THREAD_MAX_TWEETS=8
THREAD_STRICT_REPLY_MODE=true
LONGFORM_AUTODETECT=true
LONGFORM_FALLBACK_TO_THREAD=true
```

**Thread Chain Implementation**:
1. Post T1 as initial tweet
2. For each subsequent tweet (T2, T3, etc.):
   - Add human delay (600-1200ms)
   - Reply to the previous tweet ID
   - Maintain proper in_reply_to chain
   - Retry once on failure

**Logging Format**:
```
POST_START
FORMAT_DECISION: final=thread, reason=engine, tweets=5
THREAD_CHAIN: k=1/5, in_reply_to=none
POST_DONE: id=123456789
THREAD_CHAIN: k=2/5, in_reply_to=123456789
POST_DONE: id=123456790
...
SESSION_SAVED: cookies=19
```

**Error Handling**:
- If posting fails at tweet k, retry once
- If still failing: `THREAD_ABORTED_AFTER: k=3, error=message`
- Save what was posted successfully and return partial results

### 4. Format Decision Flow

**Integration Points**:
1. **Growth Engine** → selects `finalFormat` ∈ {single, thread, longform_single}
2. **Sanitizer** → `sanitizeForFormat(content, finalFormat)`
3. **Linter** → `lintAndSplitThread(tweets, finalFormat)`
4. **Poster** → respects `finalFormat`, never re-decides

**Longform Fallback**:
If longform unavailable and `LONGFORM_FALLBACK_TO_THREAD=true`:
- Convert to thread format
- T1 = distilled summary (≤240 chars)
- T2+ = semantic chunks (230-270 chars)
- Log: `FORMAT_DECISION: final=thread, reason=fallback_longform_to_thread`

## Environment Configuration

### Production Settings (Railway)
```bash
FORCE_NO_HASHTAGS=true
EMOJI_MAX=2
TWEET_MAX_CHARS_HARD=279
ENABLE_THREADS=true
FALLBACK_SINGLE_TWEET_OK=false
THREAD_MIN_TWEETS=5
THREAD_MAX_TWEETS=9
THREAD_STRICT_REPLY_MODE=true
LONGFORM_AUTODETECT=true
LONGFORM_FALLBACK_TO_THREAD=true
```

### Development Settings
```bash
FALLBACK_SINGLE_TWEET_OK=true    # Allow fallbacks during testing
THREAD_MIN_TWEETS=3              # Lower minimum for testing
```

## Testing

### Format Sanitizer Tests
```bash
npm run test:format
```
Tests cover all sanitization patterns, edge cases, and format-specific behavior.

### Tweet Linter Tests  
```bash
npm run test:linter
```
Tests cover environment variables, format-specific limits, validation rules, and logging output.

### Integration Tests
The main functionality is tested through:
- Format sanitizer unit tests (36 tests)
- Tweet linter unit tests (26 tests)  
- Integration with existing posting system

## Files Modified

### New Files
- `src/utils/formatSanitizer.ts` - Format-aware content sanitization
- `tests/formatSanitizer.test.ts` - Comprehensive sanitizer tests
- `tests/tweetLinter.test.ts` - Enhanced linter tests
- `tests/autonomousTwitterPoster.test.ts` - Integration tests (partial)

### Modified Files
- `src/utils/tweetLinter.ts` - Enhanced with format awareness and env variables
- `src/agents/autonomousTwitterPoster.ts` - Updated with format sanitization and real reply chains
- `package.json` - Added test scripts for new functionality

### Environment Integration
- All existing linter callsites updated to pass `finalFormat` parameter
- Backward compatibility maintained with default `finalFormat='thread'`

## Key Behavioral Changes

### Before
- Singles could contain "🧵 Follow this thread" language
- Threads posted as separate tweets, not reply chains
- Inconsistent character limits across formats
- Generic linting regardless of final format

### After  
- Singles are always clean of thread language
- Threads post as proper T1→T2→T3→... reply chains
- Format-specific character limits (240/270/279)
- Smart sanitization based on intended format
- Human delays between thread tweets (600-1200ms)
- Comprehensive error handling and logging

## Logging Standards

All logs follow consistent prefixes for Railway monitoring:

- `POST_START` - Beginning of posting operation
- `FORMAT_DECISION: final=X, reason=Y, tweets=N` - Format selection
- `FORMAT_SANITIZER: removed_thread_language_single` - Sanitization actions
- `LINTER: format=X, tweets=N, t1_chars=N, actions=[X|Y]` - Linting results
- `THREAD_CHAIN: k=N/M, in_reply_to=ID` - Thread progression
- `POST_DONE: id=TWEET_ID` - Successful post
- `THREAD_ABORTED_AFTER: k=N, error=MSG` - Thread failure
- `SESSION_SAVED: cookies=N` - Session persistence

## Acceptance Criteria ✅

- [x] Singles never contain thread language or numbering
- [x] Threads post as proper reply chains with human delays
- [x] Singles not truncated below 279 chars unless breaking rules
- [x] Emojis preserved up to EMOJI_MAX limit
- [x] Logs show exact prefixes and fit on one line
- [x] Format decisions logged with reasons
- [x] Environment variables respected with sensible defaults
- [x] Comprehensive test coverage for core functionality
- [x] Backward compatibility maintained
- [x] Error handling with retry logic and graceful degradation

## Usage

The patch integrates seamlessly with existing xBOT infrastructure:

1. **Growth Engine** determines the optimal format
2. **Sanitizer** cleans content appropriately  
3. **Linter** applies format-specific rules
4. **Poster** executes with proper reply chains
5. **Logs** provide clear visibility into each step

No breaking changes to existing APIs - all modifications are additive with sensible defaults.