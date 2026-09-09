import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/game";

async function ensureProfile(session: Session): Promise<Profile | null> {
  const userId = session.user.id;
  const existing = await supabase
    .from("profiles")
    .select("id, username, status, last_seen, wins, losses")
    .eq("id", userId)
    .maybeSingle();

  if (existing.data) return existing.data as Profile;

  const meta = session.user.user_metadata as { username?: string } | null;
  const base = (meta?.username || session.user.email?.split("@")[0] || "jugador")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 18);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base || "jugador" : `${base || "jugador"}${attempt + 1}`;
    const inserted = await supabase
      .from("profiles")
      .insert({ id: userId, username: candidate, status: "online" })
      .select("id, username, status, last_seen, wins, losses")
      .maybeSingle();
    if (inserted.data) return inserted.data as Profile;
    if (inserted.error?.code !== "23505") return null;
    // Puede haber sido creado en paralelo, o el nombre ya estar tomado.
    const again = await supabase
      .from("profiles")
      .select("id, username, status, last_seen, wins, losses")
      .eq("id", userId)
      .maybeSingle();
    if (again.data) return again.data as Profile;
  }
  return null;

}

/** Sesión + perfil del jugador, con "latido" de presencia cada 30 s. */
export function usePlayer() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const p = await ensureProfile(next);
      if (!active) return;
      setProfile(p);
      setLoading(false);
    };

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      void load(next);
    });
    void supabase.auth.getSession().then(({ data: d }) => load(d.session));

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const beat = useCallback(
    async (status: "online" | "in_match" = "online") => {
      if (!userId) return;
      await supabase
        .from("profiles")
        .update({ status, last_seen: new Date().toISOString() })
        .eq("id", userId);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    void beat();
    const id = window.setInterval(() => void beat(), 30_000);
    return () => window.clearInterval(id);
  }, [userId, beat]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, status, last_seen, wins, losses")
      .eq("id", userId)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }, [userId]);

  return { session, userId, profile, loading, beat, refreshProfile };
}
