/**
 * Cabecera editorial de sección (rediseño premium 28/07/2026): kicker con las
 * fuentes/alcance de la sección + título en display + lede opcional. Reemplaza
 * el par `<h1 className="sr">` + `<h2 className="sec-title">` que tenían las
 * páginas de sección — el h1 pasa a ser visible (mismo texto semántico, ahora
 * con jerarquía real). El kicker NO es decoración: nombra qué fuentes/series
 * cubre la sección.
 */
export function PageHead({ kicker, title, lede }: { kicker: string; title: string; lede?: string }) {
  return (
    <header className="page-hd">
      <div className="page-hd-kicker">{kicker}</div>
      <h1 className="page-hd-title">{title}</h1>
      {lede && <p className="page-hd-lede">{lede}</p>}
    </header>
  );
}
