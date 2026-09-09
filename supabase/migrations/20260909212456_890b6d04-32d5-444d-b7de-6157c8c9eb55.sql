-- Types
CREATE TYPE public.play_choice AS ENUM ('piedra','papel','tijera');
CREATE TYPE public.match_status AS ENUM ('invited','waiting','in_progress','finished','cancelled','declined');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1 UUID NOT NULL,
  player2 UUID,
  vs_bot BOOLEAN NOT NULL DEFAULT false,
  is_random BOOLEAN NOT NULL DEFAULT false,
  mode INT NOT NULL DEFAULT 1,
  status public.match_status NOT NULL DEFAULT 'waiting',
  p1_score INT NOT NULL DEFAULT 0,
  p2_score INT NOT NULL DEFAULT 0,
  winner_side TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_mode_check CHECK (mode IN (1,3,5))
);
GRANT SELECT, INSERT, UPDATE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select" ON public.matches FOR SELECT TO authenticated
USING (
  player1 = auth.uid() OR player2 = auth.uid()
  OR (is_random AND player2 IS NULL AND status = 'waiting')
);
CREATE POLICY "matches_insert" ON public.matches FOR INSERT TO authenticated
WITH CHECK (player1 = auth.uid());
CREATE POLICY "matches_update" ON public.matches FOR UPDATE TO authenticated
USING (
  player1 = auth.uid() OR player2 = auth.uid()
  OR (is_random AND player2 IS NULL AND status = 'waiting')
)
WITH CHECK (player1 = auth.uid() OR player2 = auth.uid());

-- rounds
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  p1_choice public.play_choice,
  p2_choice public.play_choice,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, round_number)
);
GRANT SELECT, INSERT, UPDATE ON public.rounds TO authenticated;
GRANT ALL ON public.rounds TO service_role;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_match_participant(_match_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id AND (m.player1 = auth.uid() OR m.player2 = auth.uid())
  )
$$;

CREATE POLICY "rounds_select" ON public.rounds FOR SELECT TO authenticated
USING (public.is_match_participant(match_id));
CREATE POLICY "rounds_insert" ON public.rounds FOR INSERT TO authenticated
WITH CHECK (public.is_match_participant(match_id));
CREATE POLICY "rounds_update" ON public.rounds FOR UPDATE TO authenticated
USING (public.is_match_participant(match_id))
WITH CHECK (public.is_match_participant(match_id));

-- username availability helper
CREATE OR REPLACE FUNCTION public.username_available(_username TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_username))
$$;
GRANT EXECUTE ON FUNCTION public.username_available(TEXT) TO anon, authenticated;

-- round resolution
CREATE OR REPLACE FUNCTION public.compute_round_result()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.p1_choice IS NOT NULL AND NEW.p2_choice IS NOT NULL AND NEW.result IS NULL THEN
    IF NEW.p1_choice = NEW.p2_choice THEN
      NEW.result := 'empate';
    ELSIF (NEW.p1_choice = 'piedra' AND NEW.p2_choice = 'tijera')
       OR (NEW.p1_choice = 'tijera' AND NEW.p2_choice = 'papel')
       OR (NEW.p1_choice = 'papel' AND NEW.p2_choice = 'piedra') THEN
      NEW.result := 'p1';
    ELSE
      NEW.result := 'p2';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rounds_compute_result BEFORE UPDATE ON public.rounds
FOR EACH ROW EXECUTE FUNCTION public.compute_round_result();

CREATE OR REPLACE FUNCTION public.apply_round_result()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.matches;
  target INT;
  s1 INT;
  s2 INT;
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
      UPDATE public.profiles SET wins = wins + 1, status = 'online' WHERE id = m.player1;
      IF m.player2 IS NOT NULL THEN
        UPDATE public.profiles SET losses = losses + 1, status = 'online' WHERE id = m.player2;
      END IF;
    ELSE
      UPDATE public.profiles SET losses = losses + 1, status = 'online' WHERE id = m.player1;
      IF m.player2 IS NOT NULL THEN
        UPDATE public.profiles SET wins = wins + 1, status = 'online' WHERE id = m.player2;
      END IF;
    END IF;
  ELSE
    UPDATE public.matches SET p1_score = s1, p2_score = s2, updated_at = now() WHERE id = m.id;
    INSERT INTO public.rounds (match_id, round_number)
    VALUES (m.id, NEW.round_number + 1)
    ON CONFLICT (match_id, round_number) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER rounds_apply_result AFTER UPDATE ON public.rounds
FOR EACH ROW EXECUTE FUNCTION public.apply_round_result();

-- create first round when a match starts
CREATE OR REPLACE FUNCTION public.start_match_rounds()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'in_progress' AND (TG_OP = 'INSERT' OR OLD.status <> 'in_progress') THEN
    INSERT INTO public.rounds (match_id, round_number)
    VALUES (NEW.id, 1)
    ON CONFLICT (match_id, round_number) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_start_rounds AFTER INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.start_match_rounds();

-- realtime
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.rounds REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;