# Piedra, Papel o Tijera

Juego online del clásico argentino, pensado primero para el celular. Creás tu usuario, elegís el formato de la serie y jugás contra la compu, contra un amigo o contra un rival al azar que esté conectado.

## Qué se puede hacer

- **Cuenta propia**: registro e inicio de sesión con nombre de usuario único (sin confirmación de mail).
- **Tres formatos de serie**: partida única, mejor de 3 y mejor de 5, con marcador en vivo.
- **Tres tipos de rival**:
  - la app (bot), que responde al instante,
  - un jugador específico, mediante invitación que se acepta o rechaza en el momento,
  - un rival aleatorio, con una sala de espera que empareja a dos jugadores.
- **Jugada bloqueada**: una vez elegida piedra, papel o tijera, no se puede cambiar, y las otras opciones quedan deshabilitadas.
- **Empates**: se repite la ronda sin sumar puntos.
- **Puntos y ranking**: +5 por ganarle al bot, +10 contra una persona, +15 en mejor de 5, más bonus por racha. Tabla de posiciones con el usuario propio destacado.
- **Rachas y logros**: contador de victorias seguidas y ocho insignias desbloqueables, visibles en el perfil.

## Ejemplo rápido

1. Te registrás con el usuario `charly_51`.
2. En el menú tocás **Jugar ahora**.
3. Elegís **Mejor de 3**.
4. Seleccionás **Contra la app**.
5. Jugás piedra, papel o tijera: la compu elige al instante y se muestra el resultado de la ronda.
6. Si ganás la serie, sumás puntos, subís en el ranking y desbloqueás logros.

## Tecnologías

- TanStack Start (React 19 + TypeScript) con enrutado por archivos
- Tailwind CSS v4 y componentes shadcn/ui
- Supabase: autenticación, PostgreSQL, Realtime y funciones RPC
- Bun como gestor de paquetes y Vite como bundler

## Cómo correrlo localmente

Necesitás [Bun](https://bun.sh) (o Node.js con npm).

```sh
git clone <url-del-repositorio>
cd <nombre-del-repositorio>
bun install
bun run dev
```

La app queda disponible en `http://localhost:8080`.

### Variables de entorno

El proyecto lee la configuración del backend desde un archivo `.env` en la raíz:

```sh
VITE_SUPABASE_URL="https://<tu-proyecto>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<tu-clave-publicable>"
VITE_SUPABASE_PROJECT_ID="<tu-project-id>"
```

Si trabajás desde Lovable, estas variables ya vienen configuradas.

### Base de datos

Las migraciones SQL están en `supabase/migrations/` y se aplican en orden cronológico. Incluyen las tablas `profiles`, `matches`, `rounds`, `achievements` y `user_achievements`, junto con sus políticas de seguridad y funciones.

## Scripts

| Comando | Descripción |
| --- | --- |
| `bun run dev` | Servidor de desarrollo con recarga en caliente |
| `bun run build` | Compilación de producción |
| `bun run build:dev` | Compilación en modo desarrollo |
| `bun run preview` | Sirve la compilación de producción |
| `bun run lint` | Análisis estático con ESLint |
| `bun run format` | Formateo con Prettier |

## Estructura del proyecto

```text
src/
  routes/
    index.tsx                  Login y registro
    __root.tsx                 Layout general
    _authenticated/
      route.tsx                Protección de rutas privadas
      menu.tsx                 Menú, modos, rivales e invitaciones
      partida.$matchId.tsx     Pantalla de partida y resultado
      ranking.tsx              Tabla de posiciones
      perfil.tsx               Estadísticas, racha y logros
  lib/                         Lógica de juego y utilidades
  hooks/                       Sesión y perfil del jugador
  components/ui/               Componentes de interfaz
  integrations/supabase/       Cliente y tipos del backend
supabase/migrations/           Esquema, políticas y funciones SQL
```

## Seguridad

Todas las tablas tienen Row Level Security activada. Las escrituras de partidas y rondas no se hacen directamente contra las tablas: pasan por funciones RPC validadas en el servidor, que determinan el lado del jugador, impiden jugar por el rival y generan la jugada del bot del lado del servidor. Los perfiles exponen públicamente solo datos limitados (nombre de usuario, puntos, racha).

## Créditos

Proyecto construido con [Lovable](https://lovable.dev).
