CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.username) = lower(trim(COALESCE(_username, '')))
  ) AND trim(COALESCE(_username, '')) ~ '^[a-zA-Z0-9_.]{3,18}$';
$$;

REVOKE ALL ON FUNCTION public.username_available(text) FROM public;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;