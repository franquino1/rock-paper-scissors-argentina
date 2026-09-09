# README para Piedra, Papel o Tijera

## Objetivo
Reemplazar el README genérico de Lovable por uno completo y claro que documente la app "Piedra, Papel o Tijera" para quien la clone desde GitHub.

## Contenido a incluir
1. **Título y descripción**: app mobile-first del juego clásico argentino con modo online, ranking y logros.
2. **Demo / enlaces**: mencionar que se despliega desde Lovable (sin exponer URLs sensibles).
3. **Stack tecnológico**: TanStack Start, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase (Auth + PostgreSQL + Realtime), Bun.
4. **Requisitos previos**: Node.js/Bun, cuenta de Supabase/Lovable Cloud.
5. **Instalación local**:
   - Clonar
   - Instalar dependencias con `bun install`
   - Variables de entorno (`.env`)
   - Correr migraciones de Supabase
   - `bun dev`
6. **Scripts disponibles**: `dev`, `build`, `build:dev`, `preview`, `lint`, `format`.
7. **Estructura del proyecto**: resumen de `src/routes`, `src/lib`, `src/components`, `supabase/migrations`.
8. **Funcionalidades principales**: autenticación, partidas contra bot/rival específico/aleatorio, modos 1/3/5, ranking, rachas, logros, seguridad vía RLS/RPCs.
9. **Backend / seguridad**: nota sobre políticas RLS y funciones RPC `SECURITY DEFINER`.
10. **Licencia**: MIT o similar según preferencia del usuario.

## Entregable
Archivo `README.md` reescrito con markdown limpio, sin emojis, en español (idioma de la app), listo para publicar en GitHub.

## Verificación
- `bunx tsgo --noEmit` debe seguir pasando.
- Previsualizar el README renderizado en el editor para confirmar que no hay enlaces rotos ni secciones vacías.
