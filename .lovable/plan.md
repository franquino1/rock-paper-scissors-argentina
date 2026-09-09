# Plan: resolver advertencias de seguridad y verificar el juego

## Objetivo
Terminar de corregir las 10 advertencias del linter de Supabase sobre funciones `SECURITY DEFINER` ejecutables por usuarios autenticados, asegurar que el frontend siga funcionando con las nuevas reglas de acceso, y validar el flujo completo del juego.

## Estado actual
- Se aplicó una migración que revocó escrituras directas en `matches` y `rounds` para usuarios autenticados.
- Se crearon funciones RPC `SECURITY DEFINER` para crear partidas, responder invitaciones, buscar rival aleatorio, jugar rondas y leer datos públicos.
- El linter de Supabase reportó 10 advertencias: "Signed-In Users Can Execute SECURITY DEFINER Function".
- El frontend fue migrado para usar esas RPCs y pasó el typecheck, pero no se pudo verificar con Playwright porque el entorno de preview no tenía sesión activa.

## Pasos

### 1. Revisar y ajustar las funciones RPC
Auditar cada función RPC y decidir si puede ser `SECURITY INVOKER` con policies granulares o si debe seguir siendo `SECURITY DEFINER`:

- **Funciones de solo lectura pública** (`list_players`, `players_by_ids`, `leaderboard`, `my_rank`): convertir a `SECURITY INVOKER` y agregar policies `SELECT` que permitan a usuarios autenticados leer solo los campos públicos de `profiles`.
- **Funciones de escritura de partidas/rondas** (`create_bot_match`, `create_invite`, `respond_invite`, `join_random_match`, `leave_match`, `play_round_choice`):
  - Evaluar convertir a `SECURITY INVOKER` con policies `INSERT`/`UPDATE` restrictivas (por ejemplo: un jugador solo puede insertar una partida donde él sea `player1`; solo puede actualizar su propia jugada en `rounds`; solo puede actualizar `matches` si es participante y solo ciertos campos).
  - Si alguna operación requiere privilegios elevados (por ejemplo, emparejamiento aleatorio atómico), mantener `SECURITY DEFINER` pero asegurar que la validación de `auth.uid()` sea estricta y documentar por qué no puede ser `SECURITY INVOKER`.

### 2. Ajustar policies de tablas
- `profiles`: permitir `SELECT` autenticado solo de campos públicos (`id`, `username`, `status`, `last_seen`, `wins`, `puntos_totales`, `current_streak`, `best_streak`).
- `matches`: permitir `SELECT` solo a participantes; permitir `INSERT`/`UPDATE` controlado según las reglas del juego.
- `rounds`: permitir `INSERT`/`UPDATE` solo a participantes y solo de su propia jugada.

### 3. Actualizar frontend si cambian las firmas
Si alguna función RPC cambia de nombre o firma, actualizar:
- `src/routes/_authenticated/menu.tsx`
- `src/routes/_authenticated/partida.$matchId.tsx`
- `src/routes/_authenticated/ranking.tsx`
- `src/routes/_authenticated/perfil.tsx`

### 4. Verificar tipos
Ejecutar `bunx tsgo --noEmit` y corregir cualquier error de TypeScript.

### 5. Pruebas end-to-end autenticadas
Obtener una sesión de prueba con `lovable auth-session --json` y ejecutar el flujo completo con Playwright:
- Registro sin confirmación de email.
- Partida contra el bot (mejor de 3 y mejor de 5).
- Empates que repiten ronda.
- Verificación de puntos, racha y logros.
- Acceso a Ranking y Perfil.

### 6. Escanear seguridad nuevamente
Volver a ejecutar el escáner de seguridad para confirmar que:
- Los tres hallazgos originales (`rounds_cross_side_write`, `matches_select_random_waiting_exposure`, `profiles_select_limited_all_authenticated`) quedan resueltos.
- No aparecen nuevos hallazgos críticos por las funciones RPC.

## Entregable
Backend sin advertencias de linter, frontend actualizado si es necesario, y flujo de juego verificado con pruebas reales.
