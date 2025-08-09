# 🚀 Railway Environment Configuration

## Required Environment Variables for Content Preprocessing

Add these environment variables in Railway Dashboard → Service → Variables:

### 🧵 Thread Enforcement
```
THREADS_ENFORCE=true
```
- **Description**: Always post numbered content (1/, 2/, 3/) as real Twitter threads
- **Default**: true
- **Options**: true, false
- **Effect**: When true, content like "1/ First tweet 2/ Second tweet" will be posted as a proper reply chain instead of a single long tweet

### 🏷️ Hashtag Control  
```
MAX_HASHTAGS=0
```
- **Description**: Maximum number of hashtags to keep in posts
- **Default**: 0 (remove all hashtags)
- **Options**: 0, 1, 2, 3+ (any number)
- **Effect**: 
  - 0 = Remove all hashtags for human-like posting
  - 1 = Keep only the first hashtag
  - 2+ = Keep first N hashtags

### 🧾 Claude Narration (Optional)
```
ENABLE_CLAUDE_NARRATION=true
```
- **Description**: Show Claude's transparent narration in logs
- **Default**: true
- **Options**: true, false
- **Effect**: When true, you'll see "🧾 Claude: ..." messages explaining what preprocessing is doing

## How to Set Variables in Railway

1. **Go to Railway Dashboard**
2. **Select your xBOT service**
3. **Click "Variables" tab**
4. **Add each variable:**
   - Click "New Variable"
   - Key: `THREADS_ENFORCE`
   - Value: `true`
   - Click "Add"
5. **Repeat for other variables**
6. **Redeploy** (push a commit or click "Deploy Latest")

## What You'll See in Logs

After setting these variables, you'll see Claude's narration:

```
🧾 === CONTENT PREPROCESSING PHASE ===
🧾 Claude: Starting comprehensive content preprocessing
🧾 Claude: Thread pattern detected: 3 parts. Enforcing proper thread structure
🧾 Claude: All thread parts cleaned and ready for reply-chain posting

📋 PREPROCESSING SUMMARY
   • THREADS_ENFORCE: true
   • MAX_HASHTAGS: 0
   • Effects: Normalize markers, remove all hashtags, humanize tone
   • Thread Detection: Enforce reply-chain for numbered content
```

## Expected Results

### ✅ Before (Bad):
- Single tweet: "1/ First point 2/ Second point 3/ Third point #health #tips"
- Contains hashtags, posted as one long tweet

### ✅ After (Good):
- **Tweet 1/3**: "First point"
- **Reply 2/3**: "Second point" (posted as reply to tweet 1)
- **Reply 3/3**: "Third point" (posted as reply to tweet 2)
- No hashtags, sounds human, proper thread structure

## Troubleshooting

### Variables Not Taking Effect:
1. Check Railway logs for "🧾 PREPROCESSING SUMMARY"
2. Verify variables are set correctly (no extra spaces)
3. Redeploy after adding variables

### Thread Still Posting as Single Tweet:
1. Check if `THREADS_ENFORCE=true` is set
2. Look for "🧾 Claude: Thread pattern detected" in logs
3. Ensure content has numbered format (1/, 2/, 3/)

### Too Many/Too Few Hashtags:
1. Adjust `MAX_HASHTAGS` value
2. Check logs for "remove all hashtags" or "keep N hashtags"
3. Redeploy after changes

## Quick Copy-Paste for Railway:

```
THREADS_ENFORCE=true
MAX_HASHTAGS=0
ENABLE_CLAUDE_NARRATION=true
```

Just paste each line as a separate variable in Railway Dashboard.