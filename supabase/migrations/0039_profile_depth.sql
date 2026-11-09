-- 0039: richer profiles — up to three prompts, "looking for", more lifestyle details, and My NYC spots.

alter table public.profiles add column if not exists prompts jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists looking_for text;
alter table public.profiles add column if not exists pets text;
alter table public.profiles add column if not exists religion text;
alter table public.profiles add column if not exists politics text;
alter table public.profiles add column if not exists my_nyc jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.profiles add constraint profiles_prompts_shape check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) <= 3);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_my_nyc_shape check (jsonb_typeof(my_nyc) = 'array' and jsonb_array_length(my_nyc) <= 3);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_looking_for_ok check (looking_for is null or looking_for in ('relationship','long_term_open','casual','figuring_out'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_pets_ok check (pets is null or pets in ('dog','cat','both','other','none','want'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_religion_ok check (religion is null or religion in ('agnostic','atheist','buddhist','catholic','christian','hindu','jewish','muslim','spiritual','other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_politics_ok check (politics is null or politics in ('liberal','moderate','conservative','not_political','other'));
exception when duplicate_object then null; end $$;

-- Carry the existing single prompt over as prompt #1.
update public.profiles
set prompts = jsonb_build_array(jsonb_build_object('q', prompt_q, 'a', prompt_a))
where prompt_a is not null and trim(prompt_a) <> '' and prompts = '[]'::jsonb;

grant update (prompts, looking_for, pets, religion, politics, my_nyc) on public.profiles to authenticated;
