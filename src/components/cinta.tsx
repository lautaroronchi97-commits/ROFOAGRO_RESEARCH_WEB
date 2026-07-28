import type { CintaData } from "@/lib/market";
import { nfmt, pfmt, dirOf, arrowOf } from "@/lib/format";

/** Una tanda de indicadores (JSX reusado dos veces para el marquee sin costura). */
function Tanda({ data, duplicado }: { data: CintaData; duplicado: boolean }) {
  return (
    <>
      {data.items.map((it) => {
        const dir = it.change === null ? null : dirOf(it.change);
        return (
          <span className="rib" key={`${duplicado ? "dup-" : ""}${it.label}`} aria-hidden={duplicado || undefined}>
            <span className="rl">{it.label}</span>
            <span className="rv">{nfmt(it.value, it.decimals)}</span>
            {dir && (
              <span className={`rd ${dir}`}>
                {arrowOf(dir)} {pfmt(it.change, 2)}
              </span>
            )}
            {it.sample && (
              <span className="rib-ej" title="Dato provisorio">
                prov.
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

/**
 * Cinta de indicadores (módulo 0). Dólares en vivo; pizarra de ejemplo.
 * La tanda se renderiza DOS veces (la 2ª `aria-hidden`, solo decorativa): el
 * marquee de `globals.css` (`.ribbon-track` animado, `translateX(-50%)`)
 * necesita el doble de contenido para loopear sin costura — con
 * `prefers-reduced-motion` la animación no corre y queda el scroll manual
 * de siempre, así que el contenido duplicado no se nota (recorta con overflow).
 */
export function Cinta({ data }: { data: CintaData }) {
  return (
    <section className="ribbon" aria-label="Cinta de indicadores de mercado">
      <div className="ribbon-vp">
        <div className="ribbon-track">
          <Tanda data={data} duplicado={false} />
          {/* Oculta por defecto (.ribbon-dup, display:none) — solo existe para el
              marquee animado; con reduced-motion nunca se muestra (ver globals.css). */}
          <span className="ribbon-dup">
            <Tanda data={data} duplicado={true} />
          </span>
        </div>
      </div>
    </section>
  );
}
