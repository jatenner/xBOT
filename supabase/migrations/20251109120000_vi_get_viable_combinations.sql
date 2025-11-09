-- ════════════════════════════════════════════════════════════════════════
-- VISUAL INTELLIGENCE: Viable Combination RPC
-- Date: 2025-11-09
-- Purpose: Provide topic/angle/tone/structure groupings that have enough
--          high-confidence data for downstream intelligence building.
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function vi_get_viable_combinations(min_count integer default 5)
returns table(
  topic text,
  angle text,
  tone text,
  structure text,
  total_count integer
)
language sql
security definer
set search_path = public
as $$
  with qualified as (
    select
      c.topic,
      c.angle,
      c.tone,
      c.structure,
      c.tweet_id
    from vi_content_classification c
    join vi_collected_tweets ct
      on ct.tweet_id = c.tweet_id
    join vi_visual_formatting vf
      on vf.tweet_id = c.tweet_id
    where coalesce(c.topic_confidence, 0) >= 0.6
      and coalesce(c.angle_confidence, 0) >= 0.6
      and coalesce(c.tone_confidence, 0) >= 0.6
      and coalesce(c.structure_confidence, 0) >= 0.6
      and ct.classified is true
      and ct.analyzed is true
  )
  select
    topic,
    angle,
    tone,
    structure,
    count(*)::integer as total_count
  from qualified
  group by 1,2,3,4
  having count(*) >= greatest(1, min_count)
  order by total_count desc;
$$;

grant execute on function vi_get_viable_combinations(integer) to anon, authenticated, service_role;

commit;

