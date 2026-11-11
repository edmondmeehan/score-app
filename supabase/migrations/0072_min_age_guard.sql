-- 0072: the database refuses any profile birth year that makes someone younger than 25 (backs up the sign-up form check).
create or replace function public.trg_profile_min_age() returns trigger language plpgsql set search_path = public as $$
begin
  if new.birth_year is not null and extract(year from now())::int - new.birth_year < 25 then
    raise exception 'ScoreDate members must be 25 or older.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists profile_min_age on public.profiles;
create trigger profile_min_age before insert or update of birth_year on public.profiles for each row execute function public.trg_profile_min_age();
