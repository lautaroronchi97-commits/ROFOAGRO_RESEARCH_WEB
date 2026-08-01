import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="foot-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rofoagro-isotipo.svg" alt="" className="foot-iso" width={36} height={20} aria-hidden="true" />
        <span className="fb-name" aria-hidden="true">
          <span className="rf">ROFO</span> <span className="agro">AGRO</span>
        </span>
        <span className="fb-sub" aria-hidden="true">Research de granos</span>
        <Link href="/bienvenida" className="foot-inst">Conocé ROFO AGRO →</Link>
      </div>
      <div className="src">
        <b>ROFO AGRO</b>
        <span className="src-chip">Elaboración propia · datos de mercado</span>
      </div>
      <p className="disc">
        Información y análisis de mercado de carácter general. No constituye asesoramiento ni
        recomendación de inversión personalizada (Ley 26.831). Las decisiones y su resultado son
        responsabilidad del usuario.
      </p>
      <p className="foot-legal">
        <Link href="/privacidad">Política de privacidad</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/terminos">Condiciones de servicio</Link>
      </p>
    </footer>
  );
}
