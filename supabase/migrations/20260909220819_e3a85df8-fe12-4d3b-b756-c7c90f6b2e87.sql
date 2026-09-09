-- profiles: full row only for the owner
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Limited public projection for leaderboard / online list / username availability
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
  SELECT id, username, status, last_seen, wins, puntos_totales, current_streak, best_streak
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- user_achievements: only own unlocks
DROP POLICY IF EXISTS user_achievements_select_all ON public.user_achievements;
CREATE POLICY user_achievements_select_own ON public.user_achievements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
