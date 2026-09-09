DROP FUNCTION IF EXISTS public.list_public_profiles();

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_limited ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, status, last_seen, wins, puntos_totales, current_streak, best_streak)
  ON public.profiles TO authenticated;
GRANT SELECT (id, username) ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
