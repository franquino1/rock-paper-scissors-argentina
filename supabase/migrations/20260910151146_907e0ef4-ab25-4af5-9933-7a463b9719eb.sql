-- 1) Ocultar la jugada del rival hasta que la ronda tenga resultado
DROP POLICY IF EXISTS rounds_select ON public.rounds;
CREATE POLICY rounds_select_resolved ON public.rounds
FOR SELECT TO authenticated
USING (
  result IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = rounds.match_id
      AND (m.player1 = auth.uid() OR m.player2 = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.current_round(_match_id uuid)
RETURNS TABLE(
  id uuid,
  round_number integer,
  my_choice public.play_choice,
  rival_played boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.matches; side text;
BEGIN
  SELECT * INTO m FROM public.matches WHERE public.matches.id = _match_id;
  IF m.id IS NULL THEN RETURN; END IF;
  IF m.player1 = auth.uid() THEN side := 'p1';
  ELSIF m.player2 = auth.uid() THEN side := 'p2';
  ELSE RETURN; END IF;

  RETURN QUERY
  SELECT r.id,
         r.round_number,
         CASE WHEN side = 'p1' THEN r.p1_choice ELSE r.p2_choice END,
         (CASE WHEN side = 'p1' THEN r.p2_choice ELSE r.p1_choice END) IS NOT NULL
  FROM public.rounds r
  WHERE r.match_id = _match_id AND r.result IS NULL
  ORDER BY r.round_number
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.current_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_round(uuid) TO authenticated;

-- 2) Términos y condiciones
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 3) Amistades
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_status_check CHECK (status IN ('pending','accepted','declined')),
  CONSTRAINT friendships_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique UNIQUE (requester_id, addressee_id)
);

GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY friendships_select_own ON public.friendships
FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.send_friend_request(_friend uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE existing public.friendships;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _friend IS NULL OR _friend = auth.uid() THEN RAISE EXCEPTION 'Usuario inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _friend) THEN
    RAISE EXCEPTION 'Usuario inexistente';
  END IF;

  SELECT * INTO existing FROM public.friendships
   WHERE requester_id = _friend AND addressee_id = auth.uid();
  IF existing.id IS NOT NULL THEN
    UPDATE public.friendships SET status = 'accepted', updated_at = now() WHERE id = existing.id;
    RETURN;
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (auth.uid(), _friend, 'pending')
  ON CONFLICT (requester_id, addressee_id)
  DO UPDATE SET status = CASE WHEN public.friendships.status = 'declined' THEN 'pending' ELSE public.friendships.status END,
                updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_friend uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friendships
     SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END,
         updated_at = now()
   WHERE requester_id = _friend AND addressee_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remove_friend(_friend uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
   WHERE (requester_id = auth.uid() AND addressee_id = _friend)
      OR (requester_id = _friend AND addressee_id = auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE(
  id uuid,
  username text,
  status text,
  last_seen timestamptz,
  relation text,
  direction text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.status, p.last_seen, f.status,
         CASE WHEN f.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE auth.uid() IS NOT NULL
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND f.status <> 'declined'
  ORDER BY f.status, p.last_seen DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_friend_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_friend(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
