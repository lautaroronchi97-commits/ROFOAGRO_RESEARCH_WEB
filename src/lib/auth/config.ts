/**
 * Configuración central de autenticación (Etapa 1 del login — ver docs/PLAN_LOGIN.md).
 *
 * Regla de oro de esta etapa: con `AUTH_ENFORCED` APAGADO la web es idéntica a
 * como era antes del login (el proxy hace passthrough y el layout no lee cookies,
 * así se preserva el render estático/ISR de las páginas de datos). El gate solo se
 * activa cuando Lautaro prende el flag por variable de entorno en Vercel.
 */

/** Interruptor maestro. Apagado por defecto: la web sigue pública como hoy. */
export const AUTH_ENFORCED = process.env.AUTH_ENFORCED === "true";

/**
 * Admin(s) sembrados: al registrarse con uno de estos emails, el trigger de la
 * base los marca rol=admin + estado=aprobado (no pasan por aprobación). Mauro se
 * promueve a admin desde el panel (Etapa 2) cuando se registre — decisión 10 del plan.
 * (Mismo listado hardcodeado en la migración `handle_new_user`; mantener en sync.)
 */
export const ADMIN_SEED_EMAILS = ["lautaroronchi97@gmail.com"];

/**
 * Las secciones del sitio con su clave canónica, etiqueta y ruta. Fuente única
 * para la nav, el filtro de permisos y los checkboxes del panel admin (Etapa 2).
 * ("informes" sumada en MP1 de PLAN_INFORMES.md, 22/07/2026.)
 */
export const SECCIONES_META = [
  { key: "granos", label: "Granos", href: "/granos" },
  { key: "dolar", label: "Dólar y tasas", href: "/dolar" },
  { key: "comercio", label: "Comercio exterior", href: "/comercio" },
  { key: "calculadoras", label: "Calculadoras", href: "/calculadoras" },
  { key: "graficos", label: "Gráficos", href: "/graficos" },
  { key: "produccion", label: "Producción", href: "/produccion" },
  { key: "noticias", label: "Noticias", href: "/noticias" },
  { key: "informes", label: "Informes", href: "/informes" },
] as const;

/** Clave canónica de una sección (derivada de la metadata). */
export type SeccionKey = (typeof SECCIONES_META)[number]["key"];

/** Claves canónicas de las secciones (permisos por sección). */
export const SECCIONES: readonly SeccionKey[] = SECCIONES_META.map((s) => s.key);

/** Etiqueta legible de una sección (para el panel y las pantallas de acceso). */
export function nombreSeccion(key: string): string {
  return SECCIONES_META.find((s) => s.key === key)?.label ?? key;
}

/**
 * Mapea una ruta a la clave de sección que la protege (o null si no es una de las
 * 7 secciones gateadas: home, admin, sin-acceso, pantallas de auth…). Match por
 * prefijo para cubrir subpáginas (p. ej. `/calculadoras/a-fijar` → `calculadoras`).
 */
export function seccionDeRuta(pathname: string): SeccionKey | null {
  const hit = SECCIONES_META.find(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`)
  );
  return hit ? (hit.key as SeccionKey) : null;
}

/**
 * Prefijos de ruta que NUNCA exigen login (aunque el flag esté prendido): las
 * propias pantallas de auth, el callback de OAuth, la pantalla de "sesión cerrada
 * en otro dispositivo" y las páginas legales (`/privacidad`, `/terminos` — Google
 * exige que el link de política de privacidad de la marca OAuth sea accesible sin
 * login). La raíz `/` NO va acá: con el flag prendido, un visitante sin sesión cae
 * en el caso genérico de ruta protegida → `/ingresar`; con sesión, `/` es el
 * tablero.
 *
 * `/bienvenida` (la landing institucional) SE SACÓ de esta lista el 05/08/2026:
 * Lautaro pidió bajarla de producción del todo, no solo del flujo de entrada — la
 * ruta ya no existe (`src/app/bienvenida/` se movió a `docs/backup/landing-
 * bienvenida-2026-08-05/`), así que con el flag prendido un visitante que la pida
 * cae en el mismo caso genérico que cualquier otra ruta protegida.
 */
export const RUTAS_PUBLICAS = [
  "/ingresar",
  "/registro",
  "/pendiente",
  "/recuperar",
  "/completar",
  "/auth",
  "/sesion-cerrada",
  "/privacidad",
  "/terminos",
];

/** ¿La ruta es una de las públicas de auth? (match por prefijo de segmento). */
export function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
