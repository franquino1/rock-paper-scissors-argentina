import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import {
  CHOICES,
  CHOICE_ICON,
  CHOICE_LABEL,
  isOnline,
  modeLabel,
  targetScore,
  whyWins,
  type Choice,
  type CurrentRound,
  type Match,
  type PlayerRow,
  type Round,
} from "@/lib/game";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/partida/$matchId")({
  head: () => ({
    meta: [
      { title: "Partida — Piedra, Papel o Tijera" },
      {
        name: "description",
        content: "Elegí tu jugada y mirá el resultado en vivo, ronda por ronda.",
      },
      { property: "og:title", content: "Partida — Piedra, Papel o Tijera" },
      { property: "og:description", content: "Piedra, papel o tijera: elegí y que gane el mejor." },
    ],
  }),
  component: MatchScreen,
});

function MatchScreen() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const { userId, profile, beat } = usePlayer();

  const [match, setMatch] = useState<Match | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<CurrentRound | null>(null);
  const [rival, setRival] = useState<PlayerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [friendSent, setFriendSent] = useState(false);

  const load = useCallback(async () => {
    const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (!m) {
      setNotFound(true);
      return;
    }
    setMatch(m as Match);
    // Solo devuelve rondas ya resueltas: la jugada del rival nunca llega antes de tiempo.
    const { data: rs } = await supabase
      .from("rounds")
      .select("*")
      .eq("match_id", matchId)
      .order("round_number", { ascending: true });
    setRounds((rs ?? []) as Round[]);
    // La ronda en curso llega enmascarada: solo mi jugada y si el rival ya jugó.
    const { data: cr } = await supabase.rpc("current_round", { _match_id: matchId });
    setCurrentRound((((cr ?? []) as CurrentRound[])[0] ?? null) as CurrentRound | null);
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        () => void load(),
      )
      // Realtime solo entrega rondas con resultado calculado (lo garantiza la seguridad
      // de la base): la jugada del rival nunca viaja antes del reveal.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `match_id=eq.${matchId}` },
        () => void load(),
      )
      .subscribe();
    const id = window.setInterval(() => void load(), 5_000);
    return () => {
      window.clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [matchId, load]);

  const mySide: "p1" | "p2" = match && match.player2 === userId ? "p2" : "p1";
  const rivalId = match ? (mySide === "p1" ? match.player2 : match.player1) : null;

  // Datos y presencia del rival (consulta acotada, sin exponer estadísticas)
  useEffect(() => {
    if (!rivalId) {
      setRival(null);
      return;
    }
    let active = true;
    const loadRival = async () => {
      const { data } = await supabase.rpc("players_by_ids", { _ids: [rivalId] });
      if (!active) return;
      setRival((((data ?? []) as PlayerRow[])[0] ?? null) as PlayerRow | null);
    };
    void loadRival();
    const id = window.setInterval(() => void loadRival(), 15_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [rivalId]);

  useEffect(() => {
    if (!match) return;
    void beat(match.status === "in_progress" ? "in_match" : "online");
  }, [match?.status, match, beat]);

  const lastResolved = useMemo(
    () => [...rounds].filter((r) => r.result !== null).pop() ?? null,
    [rounds],
  );

  const myChoice = currentRound?.my_choice ?? null;

  const rivalName = match?.vs_bot ? "La app 🤖" : (rival?.username ?? "Rival");
  const myName = profile?.username ?? "Vos";
  const myScore = match ? (mySide === "p1" ? match.p1_score : match.p2_score) : 0;
  const rivalScore = match ? (mySide === "p1" ? match.p2_score : match.p1_score) : 0;

  const pick = async (choice: Choice) => {
    if (!match || !currentRound || myChoice || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("play_round_choice", {
      _match_id: match.id,
      _choice: choice,
    });
    setBusy(false);
    if (error) {
      toast.error("No pudimos enviar tu jugada");
      return;
    }
    void load();
  };

  const leave = async () => {
    if (!match) return;
    setBusy(true);
    await supabase.rpc("leave_match", { _match_id: match.id });
    setBusy(false);
    void navigate({ to: "/menu" });
  };

  const playAgain = async () => {
    if (!match || !userId) return;
    setBusy(true);
    if (match.vs_bot) {
      const { data } = await supabase.rpc("create_bot_match", { _mode: match.mode });
      setBusy(false);
      if (data) {
        void navigate({ to: "/partida/$matchId", params: { matchId: data } });
        return;
      }
    } else if (rivalId) {
      const { data } = await supabase.rpc("create_invite", {
        _rival: rivalId,
        _mode: match.mode,
      });
      setBusy(false);
      if (data) {
        toast.success(`Revancha enviada a ${rivalName}`);
        void navigate({ to: "/partida/$matchId", params: { matchId: data } });
        return;
      }
    }
    setBusy(false);
    void navigate({ to: "/menu" });
  };

  const addFriend = async () => {
    if (!rivalId) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_friend_request", { _friend: rivalId });
    setBusy(false);
    if (error) {
      toast.error("No pudimos enviar la solicitud");
      return;
    }
    setFriendSent(true);
    toast.success(`Le mandamos la solicitud a ${rivalName}`);
  };

  const friendButton = !match?.vs_bot && rivalId && (
    <Button
      size="lg"
      variant="secondary"
      className="h-13 w-full text-base"
      disabled={busy || friendSent}
      onClick={addFriend}
    >
      {friendSent ? "Solicitud enviada ✅" : `👥 Agregar a ${rivalName} como amigo`}
    </Button>
  );

  if (notFound) {
    return (
      <Centered>
        <p className="text-lg font-bold">No encontramos esa partida.</p>
        <Button className="mt-4" onClick={() => void navigate({ to: "/menu" })}>
          Volver al menú
        </Button>
      </Centered>
    );
  }

  if (!match) {
    return (
      <Centered>
        <p className="animate-pulse text-4xl">🪨 📄 ✂️</p>
        <p className="mt-3 text-sm text-muted-foreground">Cargando partida…</p>
      </Centered>
    );
  }

  if (match.status === "invited") {
    return (
      <Centered>
        <p className="text-5xl">✉️</p>
        <h1 className="mt-4 text-2xl font-extrabold">Esperando a {rivalName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le mandamos la invitación para jugar {modeLabel(match.mode)}.
        </p>
        <div className="mt-6 w-full space-y-3">
          {friendButton}
          <Button variant="outline" className="w-full" disabled={busy} onClick={leave}>
            Cancelar invitación
          </Button>
        </div>
      </Centered>
    );
  }

  if (match.status === "waiting") {
    return (
      <Centered>
        <p className="animate-bounce text-5xl">🎲</p>
        <h1 className="mt-4 text-2xl font-extrabold">Buscando rival…</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te avisamos apenas alguien entre a jugar {modeLabel(match.mode)}.
        </p>
        <Button variant="outline" className="mt-6" disabled={busy} onClick={leave}>
          Cancelar búsqueda
        </Button>
      </Centered>
    );
  }

  if (match.status === "declined" || match.status === "cancelled") {
    const iWon = match.winner_side === mySide;
    return (
      <Centered>
        <p className="text-5xl">🚪</p>
        <h1 className="mt-4 text-2xl font-extrabold">
          {match.status === "declined" ? "Invitación rechazada" : "Partida abandonada"}
        </h1>
        {match.status === "cancelled" && match.winner_side && (
          <p className="mt-1 text-sm text-muted-foreground">
            {iWon ? "Ganás por abandono del rival." : "La partida quedó sin terminar."}
          </p>
        )}
        <Button className="mt-6" onClick={() => void navigate({ to: "/menu" })}>
          Volver al menú
        </Button>
      </Centered>
    );
  }

  if (match.status === "finished") {
    const iWon = match.winner_side === mySide;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="surface-card animate-pop-in p-6 text-center">
          <p className="text-6xl">{iWon ? "🏆" : "😖"}</p>
          <h1 className="mt-3 text-3xl font-extrabold">{iWon ? "¡Ganaste!" : "Perdiste"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {modeLabel(match.mode)} · ganó{" "}
            <span className="font-bold text-foreground">{iWon ? myName : rivalName}</span>
          </p>
          <p className="mt-4 text-2xl font-extrabold">
            Vos {myScore} - {rivalScore} {rivalName}
          </p>
        </div>

        <RoundHistory rounds={rounds} mySide={mySide} myName={myName} rivalName={rivalName} />

        <div className="mt-6 space-y-3">
          <Button size="lg" className="h-14 w-full text-base" disabled={busy} onClick={playAgain}>
            Jugar de nuevo
          </Button>
          {friendButton}
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full text-base"
            onClick={() => void navigate({ to: "/menu" })}
          >
            Volver al menú
          </Button>
        </div>
      </main>
    );
  }

  const rivalOffline = !match.vs_bot && rival && !isOnline(rival);
  const waitingRival = Boolean(myChoice) && !match.vs_bot;

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
      <div className="surface-card mb-5 p-4">
        <p className="text-center text-xs text-muted-foreground">
          {modeLabel(match.mode)} · primero en {targetScore(match.mode)}
        </p>
        <div className="mt-2 flex items-center justify-between text-center">
          <div className="flex-1">
            <p className="truncate text-sm font-bold">{myName}</p>
            <p className="text-3xl font-extrabold text-primary-deep">{myScore}</p>
          </div>
          <span className="px-2 text-xs text-muted-foreground">vs</span>
          <div className="flex-1">
            <p className="truncate text-sm font-bold">{rivalName}</p>
            <p className="text-3xl font-extrabold text-accent-foreground">{rivalScore}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Ronda {currentRound?.round_number ?? rounds.length}
        </p>
      </div>

      {rivalOffline && (
        <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-bold">El rival parece desconectado.</p>
          <p className="text-muted-foreground">Podés esperarlo o abandonar la partida.</p>
        </div>
      )}

      {lastResolved && (
        <div key={lastResolved.id} className="surface-card animate-pop-in mb-4 p-4">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            Resultado de la ronda {lastResolved.round_number}
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="animate-clash text-5xl">
              {CHOICE_ICON[(mySide === "p1" ? lastResolved.p1_choice : lastResolved.p2_choice)!]}
            </span>
            <span className="text-xl">💥</span>
            <span className="animate-clash-mirror text-5xl">
              {CHOICE_ICON[(mySide === "p1" ? lastResolved.p2_choice : lastResolved.p1_choice)!]}
            </span>
          </div>
          <p className="mt-3 text-center text-sm">
            <span className="font-bold">{myName}</span> eligió{" "}
            {CHOICE_LABEL[(mySide === "p1" ? lastResolved.p1_choice : lastResolved.p2_choice)!]} —{" "}
            <span className="font-bold">{rivalName}</span> eligió{" "}
            {CHOICE_LABEL[(mySide === "p1" ? lastResolved.p2_choice : lastResolved.p1_choice)!]}
          </p>
          <p className="mt-1 text-center font-display text-lg font-extrabold">
            {lastResolved.result === "empate"
              ? "¡Empate! Se repite la ronda"
              : lastResolved.result === mySide
                ? `Ganó ${myName}`
                : `Ganó ${rivalName}`}
          </p>
          {lastResolved.result !== "empate" && (
            <p className="text-center text-xs text-muted-foreground">
              {lastResolved.result === "p1"
                ? whyWins(lastResolved.p1_choice!, lastResolved.p2_choice!)
                : whyWins(lastResolved.p2_choice!, lastResolved.p1_choice!)}
            </p>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-center text-lg font-extrabold">
          {myChoice ? "Jugada confirmada" : "Elegí tu jugada"}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {CHOICES.map((c) => {
            const selected = myChoice === c.value;
            const locked = Boolean(myChoice) && !selected;
            return (
              <button
                key={c.value}
                onClick={() => void pick(c.value)}
                disabled={Boolean(myChoice) || busy}
                aria-label={c.label}
                className={
                  "surface-card flex aspect-square flex-col items-center justify-center gap-1 transition-all active:scale-95 " +
                  (selected ? "ring-4 ring-primary " : "") +
                  (locked ? "opacity-40 grayscale" : "")
                }
              >
                <span className="text-4xl">{locked ? "🔒" : c.icon}</span>
                <span className="text-xs font-bold">{c.label}</span>
              </button>
            );
          })}
        </div>
        {waitingRival && (
          <p className="mt-4 animate-pulse text-center text-sm text-muted-foreground">
            Esperando al rival…
          </p>
        )}
      </section>

      <RoundHistory rounds={rounds} mySide={mySide} myName={myName} rivalName={rivalName} />

      <Button variant="ghost" className="mt-6 w-full" disabled={busy} onClick={leave}>
        Abandonar partida
      </Button>
    </main>
  );
}

function RoundHistory({
  rounds,
  mySide,
  myName,
  rivalName,
}: {
  rounds: Round[];
  mySide: "p1" | "p2";
  myName: string;
  rivalName: string;
}) {
  const played = rounds.filter((r) => r.result !== null);
  if (played.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-bold text-muted-foreground">Rondas jugadas</h3>
      <ul className="space-y-2">
        {played.map((r) => {
          const mine = mySide === "p1" ? r.p1_choice : r.p2_choice;
          const theirs = mySide === "p1" ? r.p2_choice : r.p1_choice;
          return (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-sm"
            >
              <span className="text-xs text-muted-foreground">#{r.round_number}</span>
              <span>
                {myName} {mine ? CHOICE_ICON[mine] : "—"} vs {theirs ? CHOICE_ICON[theirs] : "—"}{" "}
                {rivalName}
              </span>
              <span className="text-xs font-bold">
                {r.result === "empate" ? "Empate" : r.result === mySide ? "Ganaste" : "Perdiste"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  );
}
