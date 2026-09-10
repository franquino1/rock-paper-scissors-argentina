import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de Privacidad — Piedra, Papel o Tijera" },
      {
        name: "description",
        content:
          "Qué datos guarda Piedra, Papel o Tijera: nombre de usuario, email y estadísticas de juego. No los compartimos.",
      },
      { property: "og:title", content: "Política de Privacidad — Piedra, Papel o Tijera" },
      { property: "og:description", content: "Tus datos, en claro: qué guardamos y para qué." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-8 pb-12">
      <h1 className="text-3xl font-extrabold">Política de Privacidad</h1>
      <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-bold text-foreground">Qué guardamos.</span> Tu nombre de usuario, tu
          email, tus estadísticas de juego (partidas ganadas y perdidas, puntos, rachas, logros), tu
          lista de amigos y la fecha en que aceptaste estos textos.
        </p>
        <p>
          <span className="font-bold text-foreground">Para qué.</span> Para que puedas entrar a tu
          cuenta, jugar con otras personas, ver el ranking y recuperar tu progreso.
        </p>
        <p>
          <span className="font-bold text-foreground">Qué ven los demás.</span> Otros jugadores ven
          tu nombre de usuario, si estás conectado y tus puntos en el ranking. Tu email nunca se
          muestra.
        </p>
        <p>
          <span className="font-bold text-foreground">Con quién los compartimos.</span> Con nadie. No
          vendemos ni cedemos tus datos a terceros; solo se usan para que la app funcione.
        </p>
        <p>
          <span className="font-bold text-foreground">Borrado.</span> Si querés que eliminemos tu
          cuenta y tus datos, escribinos y lo hacemos.
        </p>
      </div>
      <Link to="/" className="mt-8 block text-center text-sm font-bold text-primary-deep">
        Volver
      </Link>
    </main>
  );
}
