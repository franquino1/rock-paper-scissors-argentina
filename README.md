# Argentinian Rock Paper Scissors

# Prompt para Lovable — App "Piedra, Papel o Tijera"

Copiá y pegá el siguiente texto completo en Lovable para iniciar el proyecto:

---

Quiero que crees una aplicación móvil (mobile-first, responsive) llamada **"Piedra, Papel o Tijera"**, un juego clásico argentino, con backend real usando Supabase (autenticación, base de datos y funcionalidad en tiempo real).

## 1. Estética y diseño

- Diseño con identidad visual argentina: paleta de colores celeste y blanco (bandera argentina) combinada con acentos cálidos y vibrantes (por ejemplo, amarillo sol, naranja o detalles inspirados en el sol de mayo) para darle un toque festivo y no monótono.

- Estilo mobile-first: botones grandes y táctiles, tipografía clara y legible, animaciones simples al elegir una opción y al mostrar el resultado (por ejemplo, un pequeño efecto de "choque" entre los íconos de piedra, papel y tijera).

- Usar íconos ilustrados (no solo texto) para representar piedra 🪨, papel 📄 y tijera ✂️, con buen contraste y tamaño cómodo para tocar con el dedo.

- Pantallas principales: Login/Registro, Menú principal, Selección de modo de juego, Selección de rival, Pantalla de partida, Pantalla de resultado.

## 2. Autenticación y usuarios (Supabase Auth)

- Sistema de registro e inicio de sesión con **nombre de usuario** único (además de email y contraseña, ya que Supabase Auth lo requiere, pero lo que se muestra en el juego es el nombre de usuario elegido).

- Cada usuario tiene un perfil simple con: nombre de usuario, estado (online/offline/en partida) y un contador básico de partidas ganadas/perdidas (opcional, pero deseable).

- Usar Supabase Realtime o una tabla de "presencia" para saber qué usuarios están **conectados en este momento**, ya que esto es necesario para la opción de rival aleatorio.

## 3. Modos de juego (cantidad de partidas)

Antes de empezar, el jugador debe elegir uno de estos tres formatos:

1. **Una sola partida** (single round): gana quien gane esa única jugada.

2. **Mejor de 3**: gana el primero en llegar a 2 puntos.

3. **Mejor de 5**: gana el primero en llegar a 3 puntos.

Mostrar el marcador parcial en pantalla durante toda la serie (ej: "Vos 1 - 0 Rival").

## 4. Selección de rival

Después de elegir el formato, el jugador elige contra quién jugar, con tres opciones:

1. **Jugar contra otro usuario específico**: mostrar una lista o buscador de usuarios registrados (idealmente los que están online) para elegir un rival y enviarle una invitación a la partida. El otro usuario debe poder aceptar o rechazar la invitación en tiempo real (notificación dentro de la app).

2. **Jugar contra un rival aleatorio**: la app empareja automáticamente al usuario con otro jugador que esté online y disponible en ese momento (sistema de matchmaking simple: el usuario entra a una "sala de espera" hasta que otro jugador aleatorio también busque partida, y ahí se los conecta).

3. **Jugar contra la app (bot)**: la aplicación elige su jugada de forma aleatoria e instantánea, sin necesidad de conexión con otro usuario.

## 5. Mecánica del juego

- Cada jugador debe elegir una opción entre **piedra, papel o tijera**.

- Una vez que un jugador elige una opción, **esa elección queda confirmada y bloqueada**: no puede cambiarla, y las otras dos opciones deben quedar visualmente deshabilitadas (por ejemplo, atenuadas o con un candado) para ese jugador.

- Mientras el jugador espera a que el rival elija, mostrar un estado de "Esperando al rival..." (esto no aplica contra la app, que responde al instante).

- Cuando **ambos jugadores** ya eligieron, la app revela las dos jugadas al mismo tiempo y calcula el resultado según estas reglas:

  - Piedra le gana a Tijera (la rompe).

  - Tijera le gana a Papel (lo corta).

  - Papel le gana a Piedra (lo envuelve).

  - Si ambos eligen lo mismo, es empate y se vuelve a jugar esa ronda (no suma puntos a nadie).

- El resultado de cada ronda debe mostrarse indicando claramente:

  - El **nombre de cada jugador** y la **opción que eligió** (ej: "Alexia eligió Piedra 🪨 — Rival eligió Tijera ✂️").

  - Quién ganó la ronda.

- Al finalizar la serie (según el modo elegido: 1, mejor de 3 o mejor de 5), mostrar una pantalla final con el resultado global, el nombre del ganador y un botón para "Jugar de nuevo" o "Volver al menú".

## 6. Estructura de datos sugerida en Supabase

- Tabla `profiles`: id de usuario, username, estado online, estadísticas (ganadas/perdidas).

- Tabla `matches`: id de partida, jugador 1, jugador 2 (o "bot"), modo de juego (1/3/5), estado (esperando/en curso/finalizada), ganador.

- Tabla `rounds`: id de ronda, id de partida, jugada de jugador 1, jugada de jugador 2, resultado de la ronda.

- Usar Supabase Realtime (subscripciones) para sincronizar en vivo el estado de la partida entre ambos dispositivos: cuando un jugador elige su jugada, el otro dispositivo debe detectarlo automáticamente sin necesidad de recargar la pantalla.

## 7. Consideraciones adicionales

- Manejar el caso de que un jugador se desconecte a mitad de partida (mostrar mensaje y opción de cancelar/abandonar).

- Validar que no se pueda enviar una jugada dos veces en la misma ronda.

- La interfaz debe sentirse rápida y fluida, con transiciones suaves entre pantallas, priorizando siempre la experiencia en celular.

---

*Fin del prompt para copiar en Lovable.*

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ecf659a1-944a-4ffc-96a6-af4a4ece4a22).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
