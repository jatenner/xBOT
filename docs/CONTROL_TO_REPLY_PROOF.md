# Control → Executor → X Proof (Reply)

**Date:** 2026-01-24T03:26:08.366Z  
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
| Windows Opened | ❌ | 1 | HARD |
| Chrome CDP Processes | ✅ | 0 | HARD |
| Pages Max | ✅ | 0 | HARD |

## Evidence

- **Decision ID:** 9febb05d-ff40-4b2f-835f-3941c9c5d937
- **Target Tweet ID:** 2014718451563004351
- **Proof Tag:** control-reply-1769224851859
- **Pipeline Source:** control_reply_scheduler
- **Decision Status:** queued
- **Attempt ID:** N/A
- **Outcome ID:** N/A
- **Event IDs:** N/A


## Log Excerpts

```
[POSTING_QUEUE] 📝 Processing reply: 18d7f556-f45e-4b9f-89fe-1e96ca1eb7e2
[POSTING_QUEUE] 📝 Processing reply: 4fd86317-f3c1-43fc-a20d-553b2f9e74fc
[POSTING_QUEUE] 📝 Processing reply: 60519174-7540-4399-b3b0-e99eaa130659
[POSTING_QUEUE] 📝 Processing reply: 9febb05d-ff40-4b2f-835f-3941c9c5d937
[POSTING_QUEUE] 🔒 Successfully claimed decision 9febb05d-ff40-4b2f-835f-3941c9c5d937 for posting
[RAMP_MODE] ramp_enabled=true ramp_level=3 posts_last_hour=2 replies_last_hour=0 blocked_self_reply=0 blocked_reply_to_reply=0 blocked_freshness=0 blocked_generic=0 NOT_IN_DB_count=0
[REPLY_V2] 🎼 Starting reply system v2 job...
[REPLY_SELECT] ✅ Resolved 2014901576557642108 → root 2014898944317288827 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT] ✅ Resolved 2014901576557642108 → root 2014898944317288827 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[REPLY_SELECT] ✅ Resolved 2014901574871679155 → root 2014895159666716925 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT] ✅ Resolved 2014901574871679155 → root 2014895159666716925 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[SCORER] ✅ Judge decision for 1968667323453108354: reject (relevance=0.00, replyability=0.00)
[REPLY_SELECT] ✅ Resolved 2014901560015544770 → root 2014896570320425041 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT] ✅ Resolved 2014901560015544770 → root 2014896570320425041 (checks: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true)
[REPLY_SELECT]   Checks performed: replying_to_text=false, social_context=false, main_article_reply_indicator=false, multiple_articles=true
[SCORER] ✅ Judge decision for 2014901558933119457: reject (relevance=0.00, replyability=0.00)
[SCORER] ✅ Judge decision for 2014901558866280824: reject (relevance=0.00, replyability=0.00)
[SCORER] ✅ Judge decision for 2014901557712638285: reject (relevance=0.00, replyability=0.00)
```

## Result

❌ **FAIL** - One or more checks failed
