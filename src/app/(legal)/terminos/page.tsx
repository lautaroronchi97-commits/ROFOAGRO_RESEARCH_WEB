import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones de servicio · ROFO AGRO",
  description: "Condiciones de uso del Sitio de ROFO AGRO.",
};

/** Condiciones de servicio (pública — ver RUTAS_PUBLICAS en src/lib/auth/config.ts). */
export default function TerminosPage() {
  return (
    <article>
      <p className="lp-eyebrow lp-eyebrow-gold">Legal</p>
      <h1 className="lp-h1">Condiciones de servicio</h1>
      <p className="lp-p">Última actualización: 23 de julio de 2026.</p>

      <p className="lp-p">
        Estas condiciones rigen el uso de la web de research de ROFO AGRO (el
        &ldquo;Sitio&rdquo;). Al crear una cuenta o usar el Sitio, las aceptás. Si no estás de
        acuerdo, no lo uses.
      </p>

      <h2 className="lp-h2">1. Qué es el Sitio</h2>
      <p className="lp-p">
        El Sitio es un servicio de research de mercado de granos para clientes de ROFO AGRO.{" "}
        <strong>No es</strong> una plataforma de trading, no ejecuta operaciones y no reemplaza
        el asesoramiento de tu corredor.
      </p>

      <h2 className="lp-h2">2. Naturaleza informativa — sin asesoramiento de inversión</h2>
      <p className="lp-p">
        Todo el research que provee el Sitio tiene fines informativos. <strong>No constituye
        recomendación ni asesoramiento de inversión.</strong> Las decisiones que tomes con esa
        información, y sus resultados, son responsabilidad tuya.
      </p>

      <h2 className="lp-h2">3. Exactitud de los datos</h2>
      <p className="lp-p">
        Los datos se toman de fuentes públicas y de mercado (bolsas, organismos oficiales,
        mercados de futuros) y están sujetos a revisión — pueden contener errores, demoras o
        interrupciones que no dependen de nosotros. Cuando un dato es provisorio o de una
        fuente estimativa, el Sitio lo aclara.
      </p>

      <h2 className="lp-h2">4. Tu cuenta</h2>
      <ul className="legal-list">
        <li>El alta es manual: creamos tu cuenta y la habilitamos según el vínculo con tu empresa.</li>
        <li>La cuenta es personal e intransferible — no compartas tu usuario ni tu contraseña. Por seguridad, cada cuenta admite una única sesión activa a la vez.</li>
        <li>Sos responsable de la actividad que ocurra con tu cuenta.</li>
        <li>Podemos suspender o bloquear una cuenta ante un uso indebido (compartir accesos, intentar vulnerar la seguridad del Sitio, uso comercial no autorizado de los contenidos).</li>
      </ul>

      <h2 className="lp-h2">5. Propiedad intelectual</h2>
      <p className="lp-p">
        El diseño, la marca y los contenidos elaborados por ROFO AGRO (análisis, informes,
        interpretaciones) son propiedad de ROFO AGRO. Podés usarlos para tu actividad habitual
        como cliente; no está permitido redistribuirlos comercialmente sin nuestro permiso.
      </p>

      <h2 className="lp-h2">6. Disponibilidad del servicio</h2>
      <p className="lp-p">
        Hacemos lo posible para que el Sitio esté disponible, pero puede haber interrupciones
        por mantenimiento, fallas de nuestros proveedores (hosting, base de datos, fuentes de
        datos externas) u otras causas fuera de nuestro control.
      </p>

      <h2 className="lp-h2">7. Cambios</h2>
      <p className="lp-p">
        Podemos actualizar estas condiciones o el Sitio mismo. Si el cambio es relevante, lo
        vamos a avisar. El uso continuado del Sitio después de un cambio implica que lo
        aceptás.
      </p>

      <h2 className="lp-h2">8. Ley aplicable</h2>
      <p className="lp-p">Estas condiciones se rigen por las leyes de la República Argentina.</p>

      <h2 className="lp-h2">9. Contacto</h2>
      <p className="lp-p">
        Cualquier consulta sobre estas condiciones, escribinos. Ver también nuestra{" "}
        <a href="/privacidad">política de privacidad</a>.
      </p>
    </article>
  );
}
