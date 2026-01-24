# Control → Executor → X Proof (Reply)

**Date:** 2026-01-24T03:09:23.396Z  
**Status:** ❌ FAIL

## Machine Info

- **Hostname:** Mac.lan
- **Platform:** darwin
- **Architecture:** arm64
- **Node Version:** v22.14.0
- **Runner Profile Dir:** /Users/jonahtenner/Desktop/xBOT/.runner-profile

## Results

| Check | Status | Evidence | Assertion |
|-------|--------|----------|-----------|
| Control Decision Created | ✅ | control_reply_scheduler | - |
| Decision Queued | ✅ | queued | - |
| Decision Claimed | ❌ | queued | - |
| Attempt Recorded | ❌ | N/A | - |
| Result Recorded | ❌ | N/A | - |
| Success/Failure Event | ❌ | N/A | - |
| Exactly One Decision | ✅ | 1 | HARD |
| Exactly One Attempt | ❌ | 0 | HARD |
| Windows Opened | ✅ | 0 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 0 | HARD |

## Evidence

- **Decision ID:** 60519174-7540-4399-b3b0-e99eaa130659
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769223897028
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A


## Log Excerpts

```
[POSTING_QUEUE] ℹ️  Reply-specific columns will be validated per-decision for reply decisions
[POSTING_QUEUE] 🔍 DIAGNOSTIC [5/7]: decision_id=18d7f556-f45e-4b9f-89fe-1e96ca1eb7e2 type=reply gate=PASS reason=
[POSTING_QUEUE] 🔍 DIAGNOSTIC [6/7]: decision_id=4fd86317-f3c1-43fc-a20d-553b2f9e74fc type=reply gate=PASS reason=
[POSTING_QUEUE] 🔍 DIAGNOSTIC [7/7]: decision_id=60519174-7540-4399-b3b0-e99eaa130659 type=reply gate=PASS reason=
{"ts":"2026-01-24T03:05:00.694Z","app":"xbot","op":"reply_config_loaded","config":{"MIN_MINUTES_BETWEEN":15,"MAX_REPLIES_PER_HOUR":4,"MAX_REPLIES_PER_DAY":100,"BATCH_SIZE":1,"STAGGER_BASE_MIN":5,"STAGGER_INCREMENT_MIN":10}}
[POSTING_QUEUE] 📝 Processing reply: 18d7f556-f45e-4b9f-89fe-1e96ca1eb7e2
[POSTING_QUEUE] 📝 Processing reply: 4fd86317-f3c1-43fc-a20d-553b2f9e74fc
[POSTING_QUEUE] 📝 Processing reply: 60519174-7540-4399-b3b0-e99eaa130659
[POSTING_QUEUE] 🔒 Successfully claimed decision 60519174-7540-4399-b3b0-e99eaa130659 for posting
[RAMP_MODE] ramp_enabled=true ramp_level=3 posts_last_hour=1 replies_last_hour=0 blocked_self_reply=0 blocked_reply_to_reply=0 blocked_freshness=0 blocked_generic=0 NOT_IN_DB_count=0
[REPLY_V2] 🎼 Starting reply system v2 job...
[REPLY_SELECT] ✅ Resolved 2014897579453018254 → root 2014742020128907761 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT] ✅ Resolved 2014897579453018254 → root 2014742020128907761 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[SCORER] ✅ Judge decision for 2014856675078144164: reject (relevance=0.00, replyability=0.00)
[REPLY_SELECT] ✅ 2014856675078144164 confirmed as ROOT tweet (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=false)
```

## Result

❌ **FAIL** - One or more checks failed
