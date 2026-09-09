DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.list_public_profiles()
RETURNS TABLE (
  id uuid,
  username text,
  status text,
  last_seen timestamptz,
  wins integer,
  puntos_totales integer,
  current_streak integer,
  best_streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.status, p.last_seen, p.wins,
         p.puntos_totales, p.current_streak, p.best_streak
  FROM public.profiles p
$$;

REVOKE ALL ON FUNCTION public.list_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO anon, authenticated;
