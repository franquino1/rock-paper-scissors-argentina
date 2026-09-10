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
  component: Privacy;
}

function Privacy() {
  return null;
}
