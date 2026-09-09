-- ============ MATCHES / ROUNDS: no direct client writes ============
DROP POLICY IF EXISTS matches_update ON public.matches;
DROP POLICY IF EXISTS matches_insert ON public.matches;
DROP POLICY IF EXISTS matches_select ON public.matches;
DROP POLICY IF EXISTS rounds_update ON public.rounds;
DROP POLICY IF EXISTS rounds_insert ON public.rounds;

REVOKE INSERT, UPDATE, DELETE ON public.matches FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.rounds FROM authenticated;
REVOKE ALL ON public.matches FROM anon;
REVOKE ALL ON public.rounds FROM anon;
GRANT SELECT ON public.matches TO authenticated;
GRANT SELECT ON public.rounds TO authenticated;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.rounds TO service_role;

CREATE POLICY matches_select_participants ON public.matches
  FOR SELECT TO authenticated
  USING (player1 = auth.uid() OR player2 = auth.uid());

-- ============ PROFILES: own row only via table reads ============
DROP POLICY IF EXISTS profiles_select_limited ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE ALL ON public.profiles FROM anon;
GRANT UPDATE (status, last_seen) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ============ Public, non-sensitive profile views ============
CREATE OR REPLACE FUNCTION public.list_players(_limit integer DEFAULT 60)
RETURNS TABLE (id uuid, username text, status text, last_seen timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.status, p.last_seen
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid()
  ORDER BY p.last_seen DESC
  LIMIT LEAST(COALESCE(_limit, 60), 100);
$$;

CREATE OR REPLACE FUNCTION public.players_by_ids(_ids uuid[])
RETURNS TABLE (id uuid, username text, status text, last_seen timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.status, p.last_seen
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = ANY(COALESCE(_ids, '{}'::uuid[]))
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, username text, puntos_totales integer, wins integer, current_streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.puntos_totales, p.wins, p.current_streak
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.puntos_totales DESC, p.wins DESC
  LIMIT LEAST(COALESCE(_limit, 100), 100);
$$;

CREATE OR REPLACE FUNCTION public.my_rank()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN me.id IS NULL THEN NULL ELSE (
    SELECT count(*) + 1 FROM public.profiles o
    WHERE (o.puntos_totales, o.wins) > (me.puntos_totales, me.wins)
  )::int END
  FROM public.profiles me WHERE me.id = auth.uid();
$$;

-- ============ Match lifecycle RPCs ============
CREATE OR REPLACE FUNCTION public.create_bot_match(_mode integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _mode NOT IN (1,3,5) THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  INSERT INTO public.matches (player1, mode, vs_bot, status)
  VALUES (auth.uid(), _mode, true, 'in_progress')
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_invite(_rival uuid, _mode integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _mode NOT IN (1,3,5) THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  IF _rival IS NULL OR _rival = auth.uid() THEN RAISE EXCEPTION 'Rival inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _rival) THEN
    RAISE EXCEPTION 'Rival inexistente';
  END IF;
  INSERT INTO public.matches (player1, player2, mode, status)
  VALUES (auth.uid(), _rival, _mode, 'invited')
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_invite(_match_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.matches
    SET status = CASE WHEN _accept THEN 'in_progress'::match_status ELSE 'declined'::match_status END,
        updated_at = now()
    WHERE id = _match_id AND player2 = auth.uid() AND status = 'invited';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no disponible'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.join_random_match(_mode integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _mode NOT IN (1,3,5) THEN RAISE EXCEPTION 'Modo inválido'; END IF;

  SELECT m.id INTO target
  FROM public.matches m
  WHERE m.is_random AND m.status = 'waiting' AND m.player2 IS NULL
    AND m.mode = _mode AND m.player1 <> auth.uid()
  ORDER BY m.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF target IS NOT NULL THEN
    UPDATE public.matches
      SET player2 = auth.uid(), status = 'in_progress', updated_at = now()
      WHERE id = target AND player2 IS NULL AND status = 'waiting';
    IF FOUND THEN RETURN target; END IF;
  END IF;

  INSERT INTO public.matches (player1, mode, is_random, status)
  VALUES (auth.uid(), _mode, true, 'waiting')
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.leave_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches; side text;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;
  IF m.player1 = auth.uid() THEN side := 'p1';
  ELSIF m.player2 = auth.uid() THEN side := 'p2';
  ELSE RAISE EXCEPTION 'No sos parte de esta partida'; END IF;
  IF m.status IN ('finished','cancelled','declined') THEN RETURN; END IF;

  IF m.status = 'in_progress' AND NOT m.vs_bot THEN
    UPDATE public.matches
      SET status = 'cancelled', winner_side = CASE WHEN side = 'p1' THEN 'p2' ELSE 'p1' END,
          updated_at = now()
      WHERE id = m.id;
  ELSE
    UPDATE public.matches SET status = 'cancelled', updated_at = now() WHERE id = m.id;
  END IF;
END $$;

-- ============ The core fix: per-side move submission ============
CREATE OR REPLACE FUNCTION public.play_round_choice(_match_id uuid, _choice play_choice)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches; r public.rounds; side text; bot play_choice;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;
  IF m.player1 = auth.uid() THEN side := 'p1';
  ELSIF m.player2 = auth.uid() THEN side := 'p2';
  ELSE RAISE EXCEPTION 'No sos parte de esta partida'; END IF;
  IF m.status <> 'in_progress' THEN RAISE EXCEPTION 'La partida no está en juego'; END IF;

  SELECT * INTO r FROM public.rounds
    WHERE match_id = _match_id AND result IS NULL
    ORDER BY round_number
    FOR UPDATE
    LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'No hay ronda abierta'; END IF;

  IF side = 'p1' THEN
    IF r.p1_choice IS NOT NULL THEN RETURN; END IF;
    IF m.vs_bot THEN
      bot := (ARRAY['piedra','papel','tijera']::play_choice[])[1 + floor(random() * 3)];
      UPDATE public.rounds SET p1_choice = _choice, p2_choice = bot
        WHERE id = r.id AND p1_choice IS NULL;
    ELSE
      UPDATE public.rounds SET p1_choice = _choice WHERE id = r.id AND p1_choice IS NULL;
    END IF;
  ELSE
    IF r.p2_choice IS NOT NULL THEN RETURN; END IF;
    UPDATE public.rounds SET p2_choice = _choice WHERE id = r.id AND p2_choice IS NULL;
  END IF;
END $$;

-- ============ Execute grants ============
REVOKE ALL ON FUNCTION public.list_players(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.players_by_ids(uuid[]) FROM public, anon;
REVOKE ALL ON FUNCTION public.leaderboard(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.my_rank() FROM public, anon;
REVOKE ALL ON FUNCTION public.create_bot_match(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.create_invite(uuid, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.respond_invite(uuid, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.join_random_match(integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.leave_match(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.play_round_choice(uuid, play_choice) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.list_players(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.players_by_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_rank() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bot_match(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_invite(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_random_match(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.play_round_choice(uuid, play_choice) TO authenticated;