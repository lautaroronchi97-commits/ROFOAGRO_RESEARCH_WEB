import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · ROFO AGRO",
  description: "Qué datos recopila ROFO AGRO, para qué los usa y cómo los protege.",
};

/**
 * Política de privacidad (pública, fuera del gate de auth — ver RUTAS_PUBLICAS).
 * Describe el modelo REAL de datos del login (Etapas 1-3 de PLAN_LOGIN.md): registro
 * con email/contraseña o Google, aprobación manual, permisos por sección, sesión
 * única, historial de accesos. Ningún dato de esta página está inventado: refleja
 * las tablas `profiles`/`access_log`/`sesiones_activas` y los proveedores que ya
 * integra el repo (Supabase, Google, Resend, Vercel).
 */
export default function PrivacidadPage() {
  return (
    <article>
      <p className="lp-eyebrow lp-eyebrow-gold">Legal</p>
      <h1 className="lp-h1">Política de privacidad</h1>
      <p className="lp-p">Última actualización: 1 de agosto de 2026.</p>

      <p className="lp-p">
        Esta web (el &ldquo;Sitio&rdquo;) es la herramienta de research que ROFO AGRO usa con
        sus clientes. Esta política explica qué datos personales recopilamos cuando creás una
        cuenta o usás el Sitio, para qué los usamos y qué derechos tenés sobre ellos.
      </p>

      <h2 className="lp-h2">1. Qué datos recopilamos</h2>
      <p className="lp-p">
        <strong>Datos que nos das al registrarte</strong>: nombre y apellido, empresa, teléfono
        y email (formulario propio) — o, si elegís entrar con Google, el nombre, el email y la
        foto de perfil que Google nos comparte (usamos únicamente los datos básicos de
        identificación de tu cuenta de Google; no accedemos a tu Gmail, Drive ni ningún otro
        servicio de Google).
      </p>
      <p className="lp-p">
        <strong>Datos que se generan con el uso</strong>: un registro de tus inicios de sesión y
        de las secciones que visitás (fecha, dirección IP y navegador), y un identificador de
        sesión para poder ofrecer una única sesión activa por usuario. Usamos cookies técnicas
        necesarias para mantenerte identificado mientras navegás — no usamos cookies de
        publicidad ni de rastreo de terceros.
      </p>

      <h2 className="lp-h2">2. Para qué los usamos</h2>
      <ul className="legal-list">
        <li>Para crear tu cuenta y aprobarte el acceso (el alta es manual, la revisa nuestro equipo).</li>
        <li>Para mostrarte la información según los permisos que tiene tu empresa.</li>
        <li>Para seguridad: detectar el uso de una cuenta desde más de un dispositivo a la vez.</li>
        <li>Para comunicarnos con vos: avisos de tu registro, informes que solicitaste, novedades del servicio.</li>
      </ul>

      <h2 className="lp-h2">3. Con quién los compartimos</h2>
      <p className="lp-p">
        No vendemos ni cedemos tus datos a terceros con fines comerciales. Para operar el
        Sitio, usamos proveedores que procesan datos en nuestro nombre, bajo sus propias
        políticas de privacidad y con las medidas de seguridad estándar de la industria:
      </p>
      <ul className="legal-list">
        <li><strong>Supabase</strong> — base de datos y autenticación (aloja tu cuenta y los registros de uso).</li>
        <li><strong>Google</strong> — solo si elegís iniciar sesión con tu cuenta de Google.</li>
        <li><strong>Resend</strong> — envío de los mails del servicio (avisos, informes).</li>
        <li><strong>Vercel</strong> — hosting del Sitio.</li>
      </ul>

      <h2 className="lp-h2">4. Cuánto tiempo los conservamos</h2>
      <p className="lp-p">
        Mientras tu cuenta esté activa. El historial de accesos se conserva con fines de
        seguridad y auditoría. Si pedís que demos de baja tu cuenta, eliminamos o
        anonimizamos tus datos personales, salvo que tengamos que conservar algo por una
        obligación legal.
      </p>

      <h2 className="lp-h2">5. Tus derechos</h2>
      <p className="lp-p">
        Como titular de tus datos personales (Ley 25.326), en cualquier momento podés pedirnos
        <strong> acceder</strong> a tus datos, <strong>rectificarlos</strong> si están mal,
        <strong> cancelarlos</strong> (eliminarlos) u <strong>oponerte</strong> a un uso puntual
        que no te parezca correcto, además de dar de baja tu cuenta. Escribinos y lo
        resolvemos.
      </p>

      <h2 className="lp-h2">6. Seguridad</h2>
      <p className="lp-p">
        Tu contraseña nunca la vemos ni la guardamos nosotros — la maneja Supabase Auth con
        hashing estándar de la industria. El acceso a los datos de cada empresa está
        restringido por reglas de seguridad a nivel de base de datos (RLS), y cada cuenta
        solo puede tener una sesión activa a la vez.
      </p>

      <h2 className="lp-h2">7. Autoridad de control</h2>
      <p className="lp-p">
        Si en algún momento considerás que no respetamos tus derechos sobre tus datos
        personales, además de escribirnos podés presentar un reclamo ante la{" "}
        <strong>Agencia de Acceso a la Información Pública (AAIP)</strong>, el organismo que
        controla el cumplimiento de la Ley 25.326 en Argentina.
      </p>

      <h2 className="lp-h2">8. Cambios a esta política</h2>
      <p className="lp-p">
        Si actualizamos esta política de forma relevante, lo vamos a avisar en el Sitio. Podés
        volver a esta página cuando quieras para ver la versión vigente.
      </p>

      <h2 className="lp-h2">9. Contacto</h2>
      <p className="lp-p">
        Ante cualquier duda sobre tus datos, escribinos.
      </p>
    </article>
  );
}
