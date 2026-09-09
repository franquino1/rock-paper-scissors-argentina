import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import type { Achievement } from "@/lib/game";
import { getMyPrivateStats, type PrivateStats } from "@/lib/stats.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil y logros — Piedra, Papel o Tijera" },
      {
        name: "description",
        content: "Tus puntos, tu racha de victorias y las insignias que fuiste desbloqueando.",
      },
      { property: "og:title", content: "Mi perfil y logros — Piedra, Papel o Tijera" },
      { property: "og:description", content: "Puntos, racha e insignias del jugador." },
    ],
  }),
  component: PerfilScreen,
});

function PerfilScreen() {
  const navigate = useNavigate();
  const { userId, profile } = usePlayer();
  const [catalog, setCatalog] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Record<string, string>>({});
  const [rank, setRank] = useState<number | null>(null);
  const [privateStats, setPrivateStats] = useState<PrivateStats | null>(null);


  const load = useCallback(async () => {
    if (!userId) return;
    const [all, mine, ranking] = await Promise.all([
      supabase
        .from("achievements")
        .select("code, title, description, icon, sort_order")
        .order("sort_order"),
      supabase.from("user_achievements").select("code, unlocked_at").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("id")
        .order("puntos_totales", { ascending: false })
        .order("wins", { ascending: false })
        .limit(200),
    ]);
    setCatalog((all.data ?? []) as Achievement[]);
    setUnlocked(
      Object.fromEntries(
        ((mine.data ?? []) as { code: string; unlocked_at: string }[]).map((r) => [
          r.code,
          r.unlocked_at,
        ]),
      ),
    );
    const idx = ((ranking.data ?? []) as { id: string }[]).findIndex((r) => r.id === userId);
    setRank(idx >= 0 ? idx + 1 : null);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Mi perfil</p>
          <h1 className="text-2xl font-extrabold">{profile?.username ?? "…"}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/menu" })}>
          Volver
        </Button>
      </header>

      <section className="surface-card animate-pop-in bg-gradient-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-90">Puntos totales</p>
        <p className="text-5xl font-extrabold">{profile?.puntos_totales ?? 0}</p>
        <p className="mt-1 text-sm opacity-90">
          {rank ? `Estás en el puesto #${rank} del ranking` : "Sin puesto todavía"}
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-extrabold">🔥 {profile?.current_streak ?? 0}</p>
          <p className="text-xs text-muted-foreground">Racha actual</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-extrabold">🏅 {profile?.best_streak ?? 0}</p>
          <p className="text-xs text-muted-foreground">Mejor racha</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-extrabold">{profile?.wins ?? 0}</p>
          <p className="text-xs text-muted-foreground">Ganadas</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-extrabold">{privateStats?.losses ?? 0}</p>
          <p className="text-xs text-muted-foreground">Perdidas</p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xl font-extrabold">Mis logros</h2>
        <ul className="space-y-2">
          {catalog.map((a) => {
            const got = Boolean(unlocked[a.code]);
            return (
              <li
                key={a.code}
                className={
                  "surface-card flex items-center gap-3 p-4 " + (got ? "" : "opacity-55 grayscale")
                }
              >
                <span className="text-3xl">{got ? a.icon : "🔒"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.description}</span>
                </span>
                {got && <span className="text-xs font-semibold text-success">¡Listo!</span>}
              </li>
            );
          })}
          {catalog.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">Cargando logros…</li>
          )}
        </ul>
      </section>
    </main>
  );
}
