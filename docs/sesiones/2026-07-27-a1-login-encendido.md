# Sesión 2026-07-27 — A1: login encendido (`AUTH_ENFORCED=true`)

- **Rama:** `claude/plan-desarrollo-auditoria-kxn0qz` · **PR:** #_ (base `main`) — solo docs, cero código
- **Objetivo pedido por Lautaro:** "vamos a terminar con el login. Describime paso por paso" — cerrar
  A1 del backlog maestro (`auditoria/E7-sintesis.md` §4), la Parte C de `GUIA_LOGIN_SETUP.md`.

## Hecho
- Repaso guiado de la Parte C de `docs/GUIA_LOGIN_SETUP.md` (Etapa 3 §3), paso a paso, sin suponer
  qué ya estaba hecho — se confirmó con Lautaro en cada paso:
  1. Centro de verificación de Google (Auth Platform) → ya mostraba "Se verificó la información de
     tu marca" (resultado del rebranding a ROFO AGRO + dominio `rofoagro.com.ar` del 24/07).
  2. Publishing status del OAuth consent screen → **Publish App** (pasó a producción sin pedir
     revisión manual — scopes básicos email/perfil).
  3. **Chequeo por SQL antes de prender el flag** (`profiles`, proyecto `gbpfgfeksqmzmsxnxiwg`):
     solo la cuenta de Lautaro existía (`rol=admin`, `estado=aprobado`), `empresas` en 0 filas,
     ningún pendiente → confirmado que encender no bloquea a nadie ni requiere tener a Mauro
     registrado antes.
  4. Lautaro prendió `AUTH_ENFORCED=true` en Vercel (scope Production) + Redeploy → confirmado:
     incógnito a `rofoagro.com.ar` muestra `/bienvenida`.
- **Bug real encontrado y arreglado en el momento** (config, no código): al loguearse con Google,
  el navegador caía en `http://localhost:3000/?code=...` (`ERR_CONNECTION_REFUSED`). Diagnosticado
  leyendo `src/app/(auth)/google-button.tsx` (usa `window.location.origin` — el navegador SÍ estaba
  en `rofoagro.com.ar`, descartando el diagnóstico del 24/07 de "navegador con localhost
  autocompletado") + `src/app/auth/actions.ts` (`getOrigin()`). El síntoma (`/?code=...` en la
  RAÍZ, no en `/auth/callback`) es la firma característica de Supabase cayendo al **Site URL** por
  defecto porque el `redirectTo` pedido no matcheaba ninguna entrada de **Redirect URLs** — esa
  lista quedó con las URLs de antes del dominio propio (`rofoagro-research-web.vercel.app` +
  `localhost:3000`), nunca se agregó `rofoagro.com.ar` al conectar el dominio el 24/07, y el Site
  URL había quedado en `http://localhost:3000` desde el setup inicial. **Fix**: Supabase →
  *Authentication → URL Configuration* → Site URL → `https://rofoagro.com.ar`; Redirect URLs →
  sumar `https://rofoagro.com.ar/auth/callback` y `https://rofoagro.com.ar/**` (sin borrar las
  viejas). Confirmado por Lautaro: login con Google funciona de punta a punta.

## Decisiones tomadas (y por qué)
- Prender el flag sin esperar a que Mauro se registre — no había nadie pendiente que se pudiera
  ver afectado, y es reversible en 1 minuto (`AUTH_ENFORCED=false` + Redeploy).

## Verificado
- Por SQL contra la base real (`profiles`/`empresas`) antes de tocar el flag.
- En navegador real por Lautoro: `/bienvenida` en incógnito, login con Google de punta a punta
  con el dominio propio.
- Sin cambios de código en esta sesión — solo verificación + 1 fix de configuración en Supabase +
  el flag en Vercel.

## Quedó pendiente / en vuelo
- **Mauro** no se registró todavía — cuando lo haga, Lautaro lo promueve a admin desde
  `/admin → Usuarios` (no requiere sesión nueva).
- **A6** (probar `/admin/datos` logueado) sigue abierto — ahora que el login funciona de punta a
  punta es un buen momento para retomarlo: quedan Agrochat, Williams camiones, BCBA-PAS, compras
  BCRA manual, pago final LECAP, y confirmar el fix de payload de DEA del 24/07.
- Con el login prendido, **C18/V0 (las 3 Routines de informes no producen nada)** pasa a ser lo más
  urgente del backlog — nada relacionado con esta sesión, pero es lo próximo lógico.
- Renames de plataforma pendientes del rebranding (repo GitHub, proyecto Vercel, remitente Resend)
  — sin relación con el login, quedan anotados en `sesiones/2026-07-24-rebrand-rofo-agro.md`.

## Trampas descubiertas (para la próxima sesión)
- **Cuando Supabase Auth no encuentra el `redirectTo` pedido en la lista de Redirect URLs, NO
  tira error — cae en silencio al Site URL configurado**, y el síntoma es un redirect a la RAÍZ
  del Site URL con `?code=...` colgado (no a `/auth/callback`). Si en el futuro se agrega otro
  dominio/subdominio a la web, hay que sumarlo a mano en *Authentication → URL Configuration* de
  Supabase — no alcanza con conectarlo en Vercel/DNS ni con la verificación de marca de Google.
