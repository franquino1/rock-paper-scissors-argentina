import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { MODES, isOnline, type FriendRow } from "@/lib/game";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/amigos")({
  head: () => ({
    meta: [
      { title: "Mis amigos — Piedra, Papel o Tijera" },
      {
        name: "description",
        content: "Mirá quién de tus amigos está conectado e invitalo a jugar al instante.",
      },
      { property: "og:title", content: "Mis amigos — Piedra, Papel o Tijera" },
      {
        property: "og:description",
        content: "Tu lista de amigos con estado en vivo y revanchas a un toque.",
      },
    ],
  }),
  component: FriendsScreen,
});

function FriendsScreen() {
  const navigate = useNavigate();
  const { userId, beat } = usePlayer();
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [mode, setMode] = useState(3);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc("list_friends");
    setRows((data ?? []) as FriendRow[]);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    void beat("online");
    void load();
  }, [beat, load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("friends-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void load();
      })
      .subscribe();
    const id = window.setInterval(() => void load(), 20_000);
    return () => {
      window.clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const friends = useMemo(() => rows.filter((r) => r.relation === "accepted"), [rows]);
  const incoming = useMemo(
    () => rows.filter((r) => r.relation === "pending" && r.direction === "incoming"),
    [rows],
  );
  const outgoing = useMemo(
    () => rows.filter((r) => r.relation === "pending" && r.direction === "outgoing"),
    [rows],
  );

  const respond = async (friend: FriendRow, accept: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("respond_friend_request", {
      _friend: friend.id,
      _accept: accept,
    });
    setBusy(false);
    if (error) {
      toast.error("No pudimos responder la solicitud");
      return;
    }
    toast.success(accept ? `${friend.username} ya es tu amigo` : "Solicitud rechazada");
    void load();
  };

  const remove = async (friend: FriendRow) => {
    setBusy(true);
    await supabase.rpc("remove_friend", { _friend: friend.id });
    setBusy(false);
    void load();
  };

  const invite = async (friend: FriendRow) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_invite", { _rival: friend.id, _mode: mode });
    setBusy(false);
    if (error || !data) {
      toast.error("No pudimos enviar la invitación");
      return;
    }
    toast.success(`Invitación enviada a ${friend.username}`);
    void navigate({ to: "/partida/$matchId", params: { matchId: data } });
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold">Mis amigos</h1>
        <p className="text-xs text-muted-foreground">
          Verde = conectado ahora mismo. Invitalos a jugar de una.
        </p>
      </header>

      {incoming.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground">Solicitudes recibidas</h2>
          {incoming.map((f) => (
            <div key={f.id} className="surface-card animate-pop-in p-4">
              <p className="text-sm">
                <span className="font-bold">{f.username}</span> te quiere agregar como amigo
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => respond(f, true)}>
                  Aceptar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => respond(f, false)}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="surface-card mb-4 p-4">
        <p className="mb-2 text-sm font-bold">Formato de la invitación</p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <Button
              key={m.value}
              size="sm"
              variant={mode === m.value ? "default" : "secondary"}
              onClick={() => setMode(m.value)}
            >
              {m.value === 1 ? "Única" : `Mejor de ${m.value}`}
            </Button>
          ))}
        </div>
      </div>

      <section className="surface-card p-4">
        <p className="mb-3 font-bold">
          Amigos ({friends.filter((f) => isOnline(f)).length} conectado
          {friends.filter((f) => isOnline(f)).length === 1 ? "" : "s"})
        </p>
        <ul className="space-y-3">
          {loaded && friends.length === 0 && (
            <li className="py-3 text-center text-sm text-muted-foreground">
              Todavía no agregaste amigos. Agregalos cuando juegues una partida.
            </li>
          )}
          {friends.map((f) => {
            const online = isOnline(f);
            return (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      "h-2.5 w-2.5 rounded-full " +
                      (online ? "bg-success" : "bg-muted-foreground/40")
                    }
                  />
                  <span>
                    <span className="block font-semibold">{f.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {online ? (f.status === "in_match" ? "En partida" : "Conectado") : "Desconectado"}
                    </span>
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" disabled={busy || !online} onClick={() => invite(f)}>
                    Invitar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(f)}>
                    Quitar
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {outgoing.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">Solicitudes enviadas</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-sm"
              >
                <span className="font-semibold">{f.username}</span>
                <span className="text-xs text-muted-foreground">Esperando respuesta</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="ghost" className="mt-6 w-full" onClick={() => navigate({ to: "/menu" })}>
        Volver al menú
      </Button>
    </main>
  );
}
