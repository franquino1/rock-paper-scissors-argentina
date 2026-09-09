DROP POLICY "rounds_select" ON public.rounds;
DROP POLICY "rounds_insert" ON public.rounds;
DROP POLICY "rounds_update" ON public.rounds;

CREATE POLICY "rounds_select" ON public.rounds FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = rounds.match_id AND (m.player1 = auth.uid() OR m.player2 = auth.uid())));
CREATE POLICY "rounds_insert" ON public.rounds FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = rounds.match_id AND (m.player1 = auth.uid() OR m.player2 = auth.uid())));
CREATE POLICY "rounds_update" ON public.rounds FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = rounds.match_id AND (m.player1 = auth.uid() OR m.player2 = auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = rounds.match_id AND (m.player1 = auth.uid() OR m.player2 = auth.uid())));

DROP FUNCTION IF EXISTS public.is_match_participant(UUID);
DROP FUNCTION IF EXISTS public.username_available(TEXT);

REVOKE ALL ON FUNCTION public.apply_round_result() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_match_rounds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_round_result() FROM PUBLIC, anon, authenticated;