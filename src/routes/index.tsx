import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { usePlayer } from "@/hooks/usePlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Piedra, Papel o Tijera — Entrá y jugá" },
      {
        name: "description",
        content:
          "Creá tu usuario y jugá Piedra, Papel o Tijera en vivo: contra un amigo, un rival al azar o la compu.",
      },
      { property: "og:title", content: "Piedra, Papel o Tijera — Entrá y jugá" },
      {
        property: "og:description",
        content: "El clásico argentino, ahora online: mejor de 1, 3 o 5.",
      },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const { session, loading } = usePlayer();
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/menu", replace: true });
  }, [loading, session, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setBusy(false);
    if (error) {
      toast.error("No pudimos entrar", { description: error.message });
      return;
    }
    void navigate({ to: "/menu", replace: true });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,18}$/.test(clean)) {
      toast.error("Nombre de usuario inválido", {
        description: "Entre 3 y 18 caracteres: letras, números, punto o guión bajo.",
      });
      return;
    }
    setBusy(true);
    const taken = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", clean)
      .maybeSingle();
    if (taken.data) {
      setBusy(false);
      toast.error("Ese nombre ya está tomado", { description: "Probá con otro." });
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: clean },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) {
      toast.error("No pudimos crear la cuenta", { description: error.message });
      return;
    }
    if (!data.session) {
      toast.success("¡Listo! Revisá tu correo", {
        description: "Te enviamos un link para confirmar la cuenta y empezar a jugar.",
      });
      return;
    }
    void navigate({ to: "/menu", replace: true });
  };

  const googleSignIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("No pudimos entrar con Google");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/menu", replace: true });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-sun text-4xl shadow-pop">
          ✂️
        </div>
        <h1 className="text-4xl leading-tight font-extrabold tracking-tight">
          Piedra, Papel
          <br />o Tijera
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El clásico de siempre, ahora contra quien quieras.
        </p>
      </header>

      <div className="surface-card p-5">
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Ingresar</TabsTrigger>
            <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="pt-4">
            <form className="space-y-4" onSubmit={signIn}>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-12"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="h-12"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
                Entrar a jugar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="pt-4">
            <form className="space-y-4" onSubmit={signUp}>
              <div className="space-y-1.5">
                <Label htmlFor="username">Nombre de usuario</Label>
                <Input
                  id="username"
                  required
                  placeholder="ej: alexia_10"
                  className="h-12"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Es el nombre que van a ver tus rivales.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Contraseña</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
                Crear mi cuenta
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-13 w-full text-base"
          disabled={busy}
          onClick={googleSignIn}
        >
          Continuar con Google
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        🇦🇷 Hecho para jugar entre amigos, en el celu.
      </p>
    </main>
  );
}
