import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { type LeaderRow } from "@/lib/game";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — Piedra, Papel o Tijera" },
      {
        name: "description",
        content: "Tabla de posiciones: quién suma más puntos jugando Piedra, Papel o Tijera.",
      },
      { property: "og:title", content: "Ranking — Piedra, Papel o Tijera" },
      { property: "og:description", content: "Mirá los puntajes y tu puesto en la tabla." },
    ],
  }),
  component: RankingScreen,
});

function RankingScreen() {
  const navigate = useNavigate();
  const { userId } = usePlayer();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [board, rank] = await Promise.all([
      supabase.rpc("leaderboard", { _limit: 100 }),
      supabase.rpc("my_rank"),
    ]);
    setRows((board.data ?? []) as LeaderRow[]);
    setMyRank(typeof rank.data === "number" ? rank.data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Tabla de posiciones</h1>
          <p className="text-xs text-muted-foreground">
            {myRank ? `Estás en el puesto #${myRank}` : "Ganá una partida para entrar al ranking"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/menu" })}>
          Volver
        </Button>
      </header>

      <section className="surface-card animate-pop-in divide-y divide-border p-2">
        {loading && <p className="p-4 text-center text-sm text-muted-foreground">Cargando…</p>}
        {!loading && rows.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">Todavía no hay puntajes.</p>
        )}
        {rows.map((p, i) => (
          <div
            key={p.id}
            className={
              "flex items-center gap-3 rounded-xl px-3 py-3 " +
              (p.id === userId ? "bg-primary/10 font-bold" : "")
            }
          >
            <span className="w-7 text-center text-sm text-muted-foreground">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {p.username}
              {p.current_streak >= 3 && (
                <span className="ml-1 text-xs text-warning">🔥{p.current_streak}</span>
              )}
            </span>
            <span className="text-right text-sm">
              <span className="font-extrabold">{p.puntos_totales}</span>
              <span className="text-muted-foreground"> pts</span>
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
