# Backup — landing institucional `/bienvenida` (bajada del 05/08/2026)

Copia íntegra de la landing de venta que vivía en `/bienvenida` antes de que Lautaro pidiera
bajarla ("no la quiero viva"). No se borra nada — queda acá tal cual estaba, lista para
reactivar cuando la quiera retomar.

## Qué contiene
- `app-bienvenida/` → era `src/app/bienvenida/` (`page.tsx`, `layout.tsx`, `actions.ts` del
  formulario de contacto).
- `components-landing/` → era `src/components/landing/` (`landing-topbar.tsx`,
  `contacto-form.tsx`), únicos consumidores de la landing.

## Por qué no quedó como ruta muerta en `src/app/`
Next.js rutea por estructura de carpetas: cualquier cosa bajo `src/app/` queda servida. Para
que `/bienvenida` deje de estar "viva" de verdad (no solo fuera del flujo de entrada, como en
el commit anterior) había que sacarla de `src/app/`, no alcanzaba con un flag.

## Cómo reactivarla
1. `git mv docs/backup/landing-bienvenida-2026-08-05/app-bienvenida src/app/bienvenida`
2. `git mv docs/backup/landing-bienvenida-2026-08-05/components-landing src/components/landing`
3. Revisar los links que se sacaron al bajarla (footer `SiteFooter`, nav de `(legal)/layout.tsx`
   apuntando a `/ingresar` en vez de `/bienvenida`) y devolverlos si corresponde.
4. Sumar `/bienvenida` de nuevo a `RUTAS_PUBLICAS` en `src/lib/auth/config.ts` si el login va a
   estar prendido.
5. El CSS `.lp-*` de `globals.css` (sección "Landing institucional") **no se tocó** — lo siguen
   usando `/privacidad` y `/terminos`, así que ya está disponible sin que haga falta restaurar
   nada de estilos.

No hace falta ninguna migración de base de datos: el formulario de contacto usa `enviarConsulta`
de `src/lib/auth/emails.ts`, que no se tocó.
