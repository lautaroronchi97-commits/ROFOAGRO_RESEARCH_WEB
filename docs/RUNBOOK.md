# RUNBOOK — qué hacer cuando algo se rompe

> Página de 1 sola pantalla, pensada para leer rápido en el momento en que algo anda mal, no
> para leer antes. Guardá el link. Si algo de acá queda viejo (cambia un menú de Vercel, etc.)
> corregilo — es más útil corregido que perfecto.
>
> Piezas que este runbook usa, construidas el 01/08/2026 (C29, checklist en
> [`PRELAUNCH_CHECKLIST.md`](PRELAUNCH_CHECKLIST.md)):
> - **`/api/health`** — abrí `https://rofoagro.com.ar/api/health` en cualquier momento. Si dice
>   `"status":"ok"` la app y la base están respondiendo. Si tarda mucho, no carga, o dice
>   `"degraded"`, hay un problema real (no es que "se ve mal en tu pantalla", es un problema del
>   lado del servidor).
> - **Kill-switch**: banner rojo arriba de toda la web de cliente, con el texto "Datos en
>   revisión — no operar con esta información." Lo prendés vos desde Vercel (paso a paso en el
>   escenario B).
> - **Instant Rollback**: volver al deploy de ANTES en 1 clic, sin tocar código (ya viene con el
>   plan Pro que contrataste).

---

## A) La web está caída (no carga, tira error para todos)

1. Abrí `https://rofoagro.com.ar/api/health`. Si no carga NADA (ni siquiera el JSON), es un
   problema de la app entera, no de un dato puntual — seguí con el resto de estos pasos. Si
   carga y dice `"supabase":false`, es la base de datos la que está caída/lenta, no el código —
   andá directo al punto 4.
2. **¿Hiciste un deploy hace poco?** Vercel → proyecto **rofo-agro-web** → pestaña
   **Deployments**. Si el último deploy de Production es de los últimos minutos/horas y coincide
   con cuando empezó el problema, es casi seguro la causa.
3. **Instant Rollback** (recupera el sitio en ~1 minuto, sin tocar código): en esa misma lista de
   *Deployments*, buscá el deploy anterior al que rompió (el que funcionaba bien) → los 3
   puntitos (`...`) al lado → **"Promote to Production"** (o **"Instant Rollback"**, el nombre
   exacto puede variar según la versión de la UI de Vercel). Confirmá. La web vuelve a como
   estaba antes — el deploy roto queda ahí para diagnosticar con calma, sin apuro.
4. **Si es la base (Supabase)**: `https://vercel.com` no te ayuda acá. Andá a
   `https://supabase.com/dashboard` → proyecto **ROFO_AGRO_BASES_DE_DATOS** → si hay un aviso de
   incidente arriba, es un problema del lado de Supabase (esperá, no hay nada que hacer del
   lado nuestro). Si no hay aviso, revisá *Settings → Usage* por si te quedaste sin cuota del
   plan (poco probable, pero es gratis chequear).
5. Avisale a Claude Code (o abrí una sesión nueva) con lo que viste en estos 4 pasos — con el
   Instant Rollback ya hecho, no hay apuro: podés diagnosticar con la web funcionando de nuevo.

## B) Hay un dato mal en la web (un número que no cierra, algo mal calculado)

**Regla de oro: primero el banner, después investigar.** No hace falta tener el fix listo para
avisar — es al revés: avisás YA y arreglás con tiempo.

1. **Prendé el kill-switch**: Vercel → proyecto **rofo-agro-web** → *Settings → Environment
   Variables* → buscá **`KILL_SWITCH_ACTIVO`** → editá su valor a `true` (si no existe todavía,
   creala con ese nombre y ese valor, scope **Production**). Opcional: `KILL_SWITCH_MENSAJE` si
   querés un texto más específico que el default ("Datos en revisión — no operar con esta
   información.").
2. **Redeploy** (⚠️ este paso es obligatorio — cambiar la variable sola NO alcanza): *Deployments*
   → deploy de arriba de todo → `...` → **Redeploy**. En 1-2 minutos el banner rojo aparece
   arriba de toda la web de cliente.
3. Investigá con calma (o pedile a Claude Code que investigue): ¿es un bug de cálculo, un dato
   mal cargado, una fuente que falló? `/admin/conexiones` te muestra el estado de cada ingesta.
4. Con el fix ya probado y andando: apagá el kill-switch (`KILL_SWITCH_ACTIVO=false` o borrá la
   variable) → Redeploy de nuevo → listo, banner afuera.

## C) Un cliente te reporta un dato que no le cierra

1. **Antes que nada, reproducilo vos** contra la fuente primaria (la pizarra CAC real, el sitio
   de A3, el WASDE del USDA, lo que corresponda) — no le contestes "debe ser un error" ni
   "gracias, lo vemos" sin haber mirado el número real primero.
2. Si el cliente tiene razón (el dato de la web está mal): activá el kill-switch (escenario B,
   pasos 1-2) mientras lo arreglás — aunque sea un solo panel, más vale un banner de más que un
   cliente operando con un número mal 20 minutos.
3. Arreglalo, verificalo contra la fuente primaria de nuevo, apagá el kill-switch (escenario B,
   paso 4).
4. **Comunicale al cliente** qué pasó y que ya está resuelto — en 2-3 líneas, sin tecnicismos.
   Un error reconocido y arreglado rápido genera más confianza que ninguno, no menos.

## D) Contactos y accesos

- **Vos (Lautaro)**: admin de todo — Vercel, Supabase, GitHub, `/admin` de la web.
- **Mauro**: admin de la web (`/admin`). Acceso de emergencia a Vercel/Supabase/GitHub — 🖐
  **pendiente** (ver `PRELAUNCH_CHECKLIST.md`, Fase 5): sumarlo como miembro del team en cada
  plataforma, sin compartir contraseñas, 2FA propio en cada una.
- **Supabase**: proyecto `ROFO_AGRO_BASES_DE_DATOS`, dashboard en supabase.com.
- **Vercel**: proyecto `rofo-agro-web`, dashboard en vercel.com.
- **Dominio**: `rofoagro.com.ar`, DNS delegado a Vercel (nameservers `ns1`/`ns2.vercel-dns.com`).
- **Monitoreo externo** (opcional, gratis): un servicio tipo UptimeRobot pingueando
  `https://rofoagro.com.ar/api/health` cada 5 minutos te avisa por mail/WhatsApp ANTES de que un
  cliente te escriba — todavía no está configurado (queda como paso manual tuyo si te interesa).
