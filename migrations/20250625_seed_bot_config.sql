-- Seed bot_config table with default values
insert into bot_config(key,value)
values ('DISABLE_BOT','false')
on conflict (key) do nothing;
