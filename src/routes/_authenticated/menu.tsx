import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { MODES, isOnline, modeLabel, type Match, type PlayerRow } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menú — Piedra, Papel o Tijera" },
      {
        name: "description",
        content: "Elegí el formato, el rival y arrancá la partida: amigo, rival al azar o la compu.",
      },
      { property: "og:title", content: "Menú — Piedra, Papel o Tijera" },
      { property: "og:description", content: "Elegí formato y rival para tu próxima partida." },
    ],
  }),
  component: MenuScreen,
});

type Step = "inicio" | "modo" | "rival";

function MenuScreen() {
  const navigate = useNavigate();
  const { userId, profile, beat } = usePlayer();
  const [step, setStep] = useState<Step>("inicio");
  const [mode, setMode] = useState<number>(1);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [invites, setInvites] = useState<(Match & { rival: PlayerRow | null })[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const loadPlayers = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc("list_players", { _limit: 60 });
    setPlayers((data ?? []) as PlayerRow[]);
  }, [userId]);

  const loadInvites = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("player2", userId)
      .eq("status", "invited")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Match[];
    const ids = list.map((m) => m.player1);
    let profilesById: Record<string, PlayerRow> = {};
    if (ids.length) {
      const { data: profs } = await supabase.rpc("players_by_ids", { _ids: ids });
      profilesById = Object.fromEntries(((profs ?? []) as PlayerRow[]).map((p) => [p.id, p]));
    }
    setInvites(list.map((m) => ({ ...m, rival: profilesById[m.player1] ?? null })));
  }, [userId]);

  useEffect(() => {
    void beat("online");
    void loadPlayers();
    void loadInvites();
  }, [beat, loadPlayers, loadInvites]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("menu-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void loadPlayers();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `player2=eq.${userId}` },
        () => {
          void loadInvites();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadPlayers, loadInvites]);

  const online = useMemo(() => players.filter((p) => isOnline(p)), [players]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term ? players : online;
    return base.filter((p) => p.username.toLowerCase().includes(term)).slice(0, 20);
  }, [players, online, search]);

  const acceptInvite = async (match: Match) => {
    setBusy(true);
    const { error } = await supabase
      .from("matches")
      .update({ status: "in_progress" })
      .eq("id", match.id)
      .eq("status", "invited");
    setBusy(false);
    if (error) {
      toast.error("No pudimos aceptar la invitación");
      return;
    }
    void navigate({ to: "/partida/$matchId", params: { matchId: match.id } });
  };

  const declineInvite = async (match: Match) => {
    await supabase.from("matches").update({ status: "declined" }).eq("id", match.id);
    void loadInvites();
  };

  const invitePlayer = async (rival: Profile) => {
    if (!userId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("matches")
      .insert({ player1: userId, player2: rival.id, mode, status: "invited" })
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast.error("No pudimos enviar la invitación");
      return;
    }
    toast.success(`Invitación enviada a ${rival.username}`);
    void navigate({ to: "/partida/$matchId", params: { matchId: data.id } });
  };

  const playRandom = async () => {
    if (!userId) return;
    setBusy(true);
    const { data: open } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "waiting")
      .eq("is_random", true)
      .eq("mode", mode)
      .is("player2", null)
      .neq("player1", userId)
      .order("created_at", { ascending: true })
      .limit(5);

    for (const candidate of (open ?? []) as Match[]) {
      const { data: joined } = await supabase
        .from("matches")
        .update({ player2: userId, status: "in_progress" })
        .eq("id", candidate.id)
        .eq("status", "waiting")
        .is("player2", null)
        .select("id")
        .maybeSingle();
      if (joined) {
        setBusy(false);
        void navigate({ to: "/partida/$matchId", params: { matchId: joined.id } });
        return;
      }
    }

    const { data, error } = await supabase
      .from("matches")
      .insert({ player1: userId, mode, is_random: true, status: "waiting" })
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast.error("No pudimos abrir la sala de espera");
      return;
    }
    void navigate({ to: "/partida/$matchId", params: { matchId: data.id } });
  };

  const playBot = async () => {
    if (!userId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("matches")
      .insert({ player1: userId, mode, vs_bot: true, status: "in_progress" })
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast.error("No pudimos empezar la partida");
      return;
    }
    void navigate({ to: "/partida/$matchId", params: { matchId: data.id } });
  };

  const signOut = async () => {
    if (userId) await supabase.from("profiles").update({ status: "offline" }).eq("id", userId);
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Hola de nuevo</p>
          <h1 className="text-2xl font-extrabold">{profile?.username ?? "…"}</h1>
          <p className="text-xs text-muted-foreground">
            {profile
              ? `${profile.puntos_totales} pts · ${profile.wins} ganadas` +
                (profile.current_streak >= 3 ? ` · 🔥${profile.current_streak}` : "")
              : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Salir
        </Button>
      </header>

      {invites.length > 0 && (
        <section className="mb-5 space-y-3">
          {invites.map((inv) => (
            <div key={inv.id} className="surface-card animate-pop-in p-4">
              <p className="text-sm">
                <span className="font-bold">{inv.rival?.username ?? "Alguien"}</span> te invitó a
                jugar <span className="font-semibold">{modeLabel(inv.mode)}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => acceptInvite(inv)}>
                  Aceptar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => declineInvite(inv)}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {step === "inicio" && (
        <section className="animate-pop-in space-y-4">
          <div className="surface-card bg-gradient-primary p-6 text-center text-primary-foreground">
            <div className="mb-2 text-5xl">🪨 📄 ✂️</div>
            <h2 className="text-2xl font-extrabold">¿Arrancamos?</h2>
            <p className="mt-1 text-sm opacity-90">Elegí el formato y contra quién jugás.</p>
          </div>
          <Button size="lg" className="h-14 w-full text-lg" onClick={() => setStep("modo")}>
            Jugar ahora
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="h-13"
              onClick={() => navigate({ to: "/ranking" })}
            >
              🏆 Ranking
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="h-13"
              onClick={() => navigate({ to: "/perfil" })}
            >
              🎖️ Mis logros
            </Button>
          </div>
          <div className="surface-card p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Cómo se gana</p>
            <p className="mt-1">🪨 rompe ✂️ · ✂️ corta 📄 · 📄 envuelve 🪨</p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {online.length} jugador{online.length === 1 ? "" : "es"} conectado
            {online.length === 1 ? "" : "s"} ahora
          </p>
        </section>
      )}

      {step === "modo" && (
        <section className="animate-pop-in space-y-3">
          <h2 className="text-xl font-extrabold">¿Cuántas partidas?</h2>
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setMode(m.value);
                setStep("rival");
              }}
              className="surface-card flex w-full items-center justify-between p-5 text-left transition-transform active:scale-[0.98]"
            >
              <span>
                <span className="block text-lg font-bold">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.detail}</span>
              </span>
              <span className="text-2xl">›</span>
            </button>
          ))}
          <Button variant="ghost" className="w-full" onClick={() => setStep("inicio")}>
            Volver
          </Button>
        </section>
      )}

      {step === "rival" && (
        <section className="animate-pop-in space-y-4">
          <div>
            <h2 className="text-xl font-extrabold">¿Contra quién?</h2>
            <p className="text-xs text-muted-foreground">Formato: {modeLabel(mode)}</p>
          </div>

          <Button
            size="lg"
            className="h-14 w-full justify-between text-base"
            disabled={busy}
            onClick={playRandom}
          >
            <span>Rival al azar</span>
            <span className="text-xl">🎲</span>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-14 w-full justify-between text-base"
            disabled={busy}
            onClick={playBot}
          >
            <span>Contra la app</span>
            <span className="text-xl">🤖</span>
          </Button>

          <div className="surface-card p-4">
            <p className="mb-2 font-bold">Invitar a un jugador</p>
            <Input
              className="h-12"
              placeholder="Buscar por nombre de usuario"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="mt-3 space-y-2">
              {visible.length === 0 && (
                <li className="py-3 text-center text-sm text-muted-foreground">
                  {search ? "No encontramos ese usuario." : "No hay nadie conectado por ahora."}
                </li>
              )}
              {visible.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        "h-2.5 w-2.5 rounded-full " +
                        (isOnline(p) ? "bg-success" : "bg-muted-foreground/40")
                      }
                    />
                    <span className="font-semibold">{p.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {isOnline(p) ? (p.status === "in_match" ? "en partida" : "conectado") : "off"}
                    </span>
                  </span>
                  <Button size="sm" disabled={busy} onClick={() => invitePlayer(p)}>
                    Invitar
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <Button variant="ghost" className="w-full" onClick={() => setStep("modo")}>
            Volver
          </Button>
        </section>
      )}
    </main>
  );
}
