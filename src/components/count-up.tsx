"use client";

import * as React from "react";
import { nfmt } from "@/lib/format";

/**
 * Número que "asienta" al montar: arranca unos puntos abajo del valor real y
 * cuenta hasta él en ~700ms (rAF). El SSR ya trae el valor FINAL formateado —
 * sin flash de ceros, sin layout shift, sin mismatch de hidratación (el efecto
 * recién corre en el cliente, después del primer paint). Con
 * `prefers-reduced-motion` no anima: queda el valor servido tal cual.
 * Pensado para UN número protagonista por página (la placa del hero), no para
 * tablas — cada instancia es un client component con su propio rAF.
 */
export function CountUp({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const desde = value * 0.92;
    const dur = 700;
    let t0: number | null = null;
    let raf = 0;
    const paso = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
      el.textContent = nfmt(desde + (value - desde) * eased, decimals);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);

  return <span ref={ref}>{nfmt(value, decimals)}</span>;
}
