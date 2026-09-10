import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — Piedra, Papel o Tijera" },
      {
        name: "description",
        content:
          "Reglas de uso de Piedra, Papel o Tijera: juego limpio, sin trampas y solo para entretenimiento.",
      },
      { property: "og:title", content: "Términos y Condiciones — Piedra, Papel o Tijera" },
      { property: "og:description", content: "Cómo se usa la app y qué esperamos de cada jugador." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-8 pb-12">
      <h1 className="text-3xl font-extrabold">Términos y Condiciones</h1>
      <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-bold text-foreground">1. Uso de la app.</span> Piedra, Papel o Tijera
          es un juego para divertirse entre amigos. Al crear tu cuenta te comprometés a usarla de
          buena fe y a tratar con respeto al resto de los jugadores.
        </p>
        <p>
          <span className="font-bold text-foreground">2. Nada de trampas.</span> Está prohibido usar
          programas automáticos, cuentas falsas o cualquier truco para ver la jugada del rival, subir
          puntos o alterar el ranking, las rachas y los logros. Si lo detectamos, podemos borrar los
          puntos o cerrar la cuenta.
        </p>
        <p>
          <span className="font-bold text-foreground">3. Solo entretenimiento.</span> El juego no
          otorga premios ni dinero. Los puntos, medallas y posiciones son simbólicos.
        </p>
        <p>
          <span className="font-bold text-foreground">4. Disponibilidad.</span> Hacemos lo posible
          para que la app funcione siempre, pero no garantizamos que esté disponible sin
          interrupciones. Puede haber cortes, mantenimientos o cambios en las funciones.
        </p>
        <p>
          <span className="font-bold text-foreground">5. Cambios.</span> Si actualizamos estos
          términos, la versión vigente será siempre la publicada en esta página.
        </p>
      </div>
      <Link to="/" className="mt-8 block text-center text-sm font-bold text-primary-deep">
        Volver
      </Link>
    </main>
  );
}
