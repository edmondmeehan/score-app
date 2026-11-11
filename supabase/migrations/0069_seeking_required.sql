-- 0069: everyone who has set their gender must also choose who they want to meet (empty used to mean "anyone").
alter table public.profiles drop constraint if exists profiles_seeking_required;
alter table public.profiles add constraint profiles_seeking_required check (gender is null or cardinality(seeking) > 0);
