/**
 * Kill-switch operativo (Fase 5 del checklist de pre-lanzamiento): banner de "no
 * operar con esta información" para cuando se detecta un dato mal en producción y
 * hace falta avisar ANTES de tener el fix listo. Apagado por defecto — mismo patrón
 * que `AUTH_ENFORCED`, un solo env var booleano.
 *
 * Ojo operativo: en Vercel, cambiar un env var no alcanza — hay que hacer un
 * Redeploy (sin tocar código, "Redeploy" desde el dashboard) para que la próxima
 * build lo lea. Documentado en `docs/PRELAUNCH_CHECKLIST.md`.
 */
const ACTIVO = process.env.KILL_SWITCH_ACTIVO === "true";
const MENSAJE_DEFAULT = "Datos en revisión — no operar con esta información.";

export function KillSwitchBanner() {
  if (!ACTIVO) return null;
  const mensaje = process.env.KILL_SWITCH_MENSAJE?.trim() || MENSAJE_DEFAULT;

  return (
    <div className="ks-banner" role="alert">
      <span className="ks-banner-ic" aria-hidden="true">
        ⚠
      </span>
      <p className="ks-banner-msg">{mensaje}</p>
    </div>
  );
}
