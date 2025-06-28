-- tighten quality gate + make threads atomic
--------------------------------------------------------------

-- 1) block weak one-liner "95 %" tweets
update bot_config
set value = value
         || jsonb_build_object(
              'minSentences',           2,
              'minNonNumericTokens',    5,
              'rejectPercentOnlyPosts', true
            )
where key = 'runtime_config';

-- 2) require that a full thread fits in today's quota
update bot_config
set value = jsonb_set(
              value,
              '{atomicThreads}',
              'true',
              true
            )
where key = 'runtime_config';

--------------------------------------------------------------
-- down-migration is a no-op (leave existing settings intact)
-------------------------------------------------------------- 