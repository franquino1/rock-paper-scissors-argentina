-- 1) Internal helpers: not callable from the API at all
REVOKE ALL ON FUNCTION public.finish_match_rewards(uuid, uuid, uuid, boolean, integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.grant_achievement(uuid, text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.apply_round_result() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.start_match_rounds() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.compute_round_result() FROM anon, authenticated, public;

-- 2) Anonymous callers: no SECURITY DEFINER access except signup username check
REVOKE ALL ON FUNCTION public.create_bot_match(integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.create_invite(uuid, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.respond_invite(uuid, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.join_random_match(integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.leave_match(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.play_round_choice(uuid, public.play_choice) FROM anon, public;
REVOKE ALL ON FUNCTION public.leaderboard(integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.my_rank() FROM anon, public;
REVOKE ALL ON FUNCTION public.list_players(integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.players_by_ids(uuid[]) FROM anon, public;

-- 3) Signed-in game actions keep exactly the access they need
GRANT EXECUTE ON FUNCTION public.create_bot_match(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_invite(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_random_match(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.play_round_choice(uuid, public.play_choice) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_rank() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_players(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.players_by_ids(uuid[]) TO authenticated;

-- 4) Signup-time username check stays available pre-login (read-only, validated)
REVOKE ALL ON FUNCTION public.username_available(text) FROM public;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;