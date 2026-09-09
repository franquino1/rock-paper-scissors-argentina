ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS puntos_totales integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bot_wins integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.achievements (
  code text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT SELECT ON public.achievements TO anon;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievements_select_all ON public.achievements FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_achievements_select_all ON public.user_achievements FOR SELECT TO authenticated USING (true);

INSERT INTO public.achievements (code, title, description, icon, sort_order) VALUES
  ('primera_victoria', 'Primera Victoria', 'Ganá tu primera partida', '🥇', 1),
  ('racha_de_fuego', 'Racha de Fuego', 'Ganá 5 partidas seguidas', '🔥', 2),
  ('cazador_de_bots', 'Cazador de Bots', 'Ganale 10 veces a la app', '🤖', 3),
  ('duelista', 'Duelista', 'Ganale a 10 rivales humanos distintos', '⚔️', 4),
  ('maratonista', 'Maratonista', 'Jugá 50 partidas en total', '🏃', 5),
  ('top_10', 'Top 10', 'Entrá al top 10 del ranking general', '🏆', 6),
  ('que_maquina', 'Che, qué máquina', 'Ganá 20 partidas', '💪', 7),
  ('mate_amargo', 'Mate Amargo', 'Jugá una serie mejor de 5 y ganala', '🧉', 8)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_achievement(_user_id uuid, _code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_achievements (user_id, code)
  VALUES (_user_id, _code)
  ON CONFLICT (user_id, code) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.grant_achievement(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finish_match_rewards(_match_id uuid, _winner uuid, _loser uuid, _vs_bot boolean, _mode integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pts integer;
  streak integer;
  total_wins integer;
  bots integer;
  distinct_humans integer;
  played integer;
  my_points integer;
  rank_pos integer;
BEGIN
  IF _winner IS NULL THEN RETURN; END IF;

  IF _vs_bot THEN
    pts := 5;
  ELSIF _mode = 5 THEN
    pts := 15;
  ELSE
    pts := 10;
  END IF;

  UPDATE public.profiles
    SET current_streak = current_streak + 1,
        puntos_totales = puntos_totales + pts,
        bot_wins = bot_wins + CASE WHEN _vs_bot THEN 1 ELSE 0 END
    WHERE id = _winner
    RETURNING current_streak, wins, bot_wins, puntos_totales
    INTO streak, total_wins, bots, my_points;

  UPDATE public.profiles SET best_streak = GREATEST(best_streak, streak) WHERE id = _winner;

  IF streak IN (3, 5, 10) THEN
    UPDATE public.profiles SET puntos_totales = puntos_totales + 5 WHERE id = _winner;
  END IF;

  IF _loser IS NOT NULL THEN
    UPDATE public.profiles SET current_streak = 0 WHERE id = _loser;
  END IF;

  IF total_wins >= 1 THEN PERFORM public.grant_achievement(_winner, 'primera_victoria'); END IF;
  IF streak >= 5 THEN PERFORM public.grant_achievement(_winner, 'racha_de_fuego'); END IF;
  IF bots >= 10 THEN PERFORM public.grant_achievement(_winner, 'cazador_de_bots'); END IF;
  IF total_wins >= 20 THEN PERFORM public.grant_achievement(_winner, 'que_maquina'); END IF;
  IF _mode = 5 AND NOT _vs_bot THEN PERFORM public.grant_achievement(_winner, 'mate_amargo'); END IF;

  SELECT count(DISTINCT other) INTO distinct_humans FROM (
    SELECT CASE WHEN m.player1 = _winner THEN m.player2 ELSE m.player1 END AS other
    FROM public.matches m
    WHERE m.status = 'finished'
      AND m.vs_bot = false
      AND ((m.player1 = _winner AND m.winner_side = 'p1') OR (m.player2 = _winner AND m.winner_side = 'p2'))
  ) s WHERE other IS NOT NULL;
  IF distinct_humans >= 10 THEN PERFORM public.grant_achievement(_winner, 'duelista'); END IF;

  SELECT count(*) INTO played FROM public.matches m
    WHERE m.status = 'finished' AND (m.player1 = _winner OR m.player2 = _winner);
  IF played >= 50 THEN PERFORM public.grant_achievement(_winner, 'maratonista'); END IF;

  SELECT count(*) + 1 INTO rank_pos FROM public.profiles p WHERE p.puntos_totales > my_points;
  IF rank_pos <= 10 THEN PERFORM public.grant_achievement(_winner, 'top_10'); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_match_rewards(uuid, uuid, uuid, boolean, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_round_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  m public.matches;
  target INT;
  s1 INT;
  s2 INT;
  winner_id uuid;
  loser_id uuid;
BEGIN
  IF OLD.result IS NOT NULL OR NEW.result IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO m FROM public.matches WHERE id = NEW.match_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'in_progress' THEN
    RETURN NEW;
  END IF;

  s1 := m.p1_score + CASE WHEN NEW.result = 'p1' THEN 1 ELSE 0 END;
  s2 := m.p2_score + CASE WHEN NEW.result = 'p2' THEN 1 ELSE 0 END;
  target := CASE m.mode WHEN 1 THEN 1 WHEN 3 THEN 2 ELSE 3 END;

  IF s1 >= target OR s2 >= target THEN
    UPDATE public.matches
      SET p1_score = s1, p2_score = s2, status = 'finished',
          winner_side = CASE WHEN s1 >= target THEN 'p1' ELSE 'p2' END,
          updated_at = now()
      WHERE id = m.id;

    IF s1 >= target THEN
      winner_id := m.player1;
      loser_id := m.player2;
    ELSE
      winner_id := m.player2;
      loser_id := m.player1;
    END IF;

    IF winner_id IS NOT NULL THEN
      UPDATE public.profiles SET wins = wins + 1, status = 'online' WHERE id = winner_id;
    END IF;
    IF loser_id IS NOT NULL THEN
      UPDATE public.profiles SET losses = losses + 1, status = 'online' WHERE id = loser_id;
    END IF;

    PERFORM public.finish_match_rewards(m.id, winner_id, loser_id, m.vs_bot, m.mode);
  ELSE
    UPDATE public.matches SET p1_score = s1, p2_score = s2, updated_at = now() WHERE id = m.id;
    INSERT INTO public.rounds (match_id, round_number)
    VALUES (m.id, NEW.round_number + 1)
    ON CONFLICT (match_id, round_number) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.apply_round_result() FROM PUBLIC, anon, authenticated;