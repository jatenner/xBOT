do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'tweets' and column_name = 'id'
  ) then
    alter table tweets add column id text;
    create index if not exists idx_tweets_id on tweets(id);
    raise notice 'Added tweets.id compatibility column';
  end if;
end $$;
