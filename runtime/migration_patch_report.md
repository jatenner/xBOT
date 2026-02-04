# Migration Patch Report

Generated: 2026-02-04T23:02:23.954Z

## Summary

- **Total migrations scanned:** 124
- **Migrations with dangerous patterns:** 17
- **Patterns found:** 55
- **Already patched:** 0
- **Newly patched:** 17

## Details


### 20250114_add_visual_format_column.sql

- **Patterns found:** 1
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 43)


### 20250115_restore_content_slot_and_vw_learning.sql

- **Patterns found:** 1
- **Already patched:** No
- **Patched:** Yes

Patterns:
- CREATE INDEX ON on `tweet_metrics` (line 243)


### 20251001_add_performance_indexes.sql

- **Patterns found:** 3
- **Already patched:** No
- **Patched:** Yes

Patterns:
- CREATE INDEX ON on `content_metadata` (line 6)
- CREATE INDEX ON on `posted_decisions` (line 18)
- CREATE INDEX ON on `content_metadata` (line 26)


### 20251001_alter_content_metadata_autonomous.sql

- **Patterns found:** 4
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 17)
- CREATE INDEX ON on `posted_decisions` (line 92)
- CREATE INDEX ON on `posted_decisions` (line 93)
- CREATE INDEX ON on `posted_decisions` (line 94)


### 20251001_comprehensive_autonomous_system.sql

- **Patterns found:** 10
- **Already patched:** No
- **Patched:** Yes

Patterns:
- CREATE INDEX ON on `content_metadata` (line 76)
- CREATE INDEX ON on `content_metadata` (line 82)
- CREATE INDEX ON on `content_metadata` (line 88)
- CREATE INDEX ON on `content_metadata` (line 94)
- CREATE INDEX ON on `content_metadata` (line 100)
- CREATE INDEX ON on `content_metadata` (line 106)
- CREATE INDEX ON on `content_metadata` (line 112)
- CREATE INDEX ON on `posted_decisions` (line 170)
- CREATE INDEX ON on `posted_decisions` (line 176)
- CREATE INDEX ON on `posted_decisions` (line 182)


### 20251015_comprehensive_data_storage.sql

- **Patterns found:** 2
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 46)
- CREATE INDEX ON on `content_metadata` (line 71)


### 20251016_add_thread_tweets_column.sql

- **Patterns found:** 2
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 4)
- CREATE INDEX ON on `content_metadata` (line 11)


### 20251018_clean_content_metadata.sql

- **Patterns found:** 10
- **Already patched:** No
- **Patched:** Yes

Patterns:
- CREATE INDEX ON on `content_metadata` (line 127)
- CREATE INDEX ON on `content_metadata` (line 128)
- CREATE INDEX ON on `content_metadata` (line 129)
- CREATE INDEX ON on `content_metadata` (line 130)
- CREATE INDEX ON on `content_metadata` (line 131)
- CREATE INDEX ON on `content_metadata` (line 132)
- CREATE INDEX ON on `content_metadata` (line 133)
- CREATE INDEX ON on `content_metadata` (line 134)
- CREATE INDEX ON on `content_metadata` (line 135)
- DROP TRIGGER on `content_metadata` (line 160)


### 20251018_generator_learning_system.sql

- **Patterns found:** 4
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 14)
- CREATE INDEX ON on `content_metadata` (line 20)
- CREATE INDEX ON on `content_metadata` (line 24)
- DROP TRIGGER on `content_metadata` (line 312)


### 20251019002140_enhance_metrics_quality_tracking.sql

- **Patterns found:** 2
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `engagement_snapshots` (line 100)
- CREATE INDEX ON on `engagement_snapshots` (line 206)


### 20251019180300_authoritative_schema.sql

- **Patterns found:** 2
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `posted_decisions` (line 219)
- CREATE INDEX ON on `content_metadata` (line 180)


### 20251022_fix_missing_columns.sql

- **Patterns found:** 3
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `posted_decisions` (line 12)
- CREATE INDEX ON on `posted_decisions` (line 15)
- CREATE INDEX ON on `tweet_metrics` (line 55)


### 20251022_fix_missing_columns_v2.sql

- **Patterns found:** 2
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `tweet_metrics` (line 70)
- CREATE INDEX ON on `tweet_metrics` (line 73)


### 20251022_fix_remaining_columns.sql

- **Patterns found:** 3
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `tweet_metrics` (line 39)
- CREATE INDEX ON on `tweet_metrics` (line 57)
- DROP TRIGGER on `tweet_metrics` (line 51)


### 20251102235048_add_thread_tweet_ids.sql

- **Patterns found:** 2
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 4)
- CREATE INDEX ON on `content_metadata` (line 10)


### 20251205_add_content_slot.sql

- **Patterns found:** 3
- **Already patched:** No
- **Patched:** Yes

Patterns:
- ALTER TABLE ADD COLUMN on `content_metadata` (line 21)
- CREATE INDEX ON on `content_metadata` (line 30)
- CREATE INDEX ON on `content_metadata` (line 35)


### 20251205_create_vw_learning.sql

- **Patterns found:** 1
- **Already patched:** No
- **Patched:** Yes

Patterns:
- CREATE INDEX ON on `tweet_metrics` (line 141)

