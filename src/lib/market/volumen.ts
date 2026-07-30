import "server-only";
import { cache } from "react";
import type { Meta } from "./types";
import { fetchJson, asArr, asObj, asNum, asStr } from "./http";
import { getMaeOficial, getNotes } from "./fuentes";

/* ---------------- Módulo 7: Panel cambiario / volumen (MAE) ---------------- */

export type VolCat = { nombre: string; grupo: string; volumenUsd: number; share: number };

export type VolumenData = {
  cats: VolCat[];
  oficial: number | null;
  oficialVarPct: number | null;
  /** Suma del nominal operado en TODOS los dólar linked (D*) del feed — no es USD, es
   * volumen nominal (importe operado en pesos), por eso va aparte de `cats` (que sí es MAE en
   * USD). `null` si el feed de notas cayó. */
  volumenLinkedNominal: number | null;
  meta: Meta;
};

export const getVolumenCambiario = cache(async (): Promise<VolumenData> => {
  const [r, mae, notes] = await Promise.all([
    fetchJson("https://api.marketdata.mae.com.ar/api/mercado/volumen-categoria/USD"),
    getMaeOficial(),
    getNotes(),
  ]);

  const problemas: string[] = [];
  const cats: VolCat[] = [];
  if (r.ok) {
    const arr = asArr(r.data) ?? [];
    for (const it of arr) {
      const o = asObj(it);
      if (!o) continue;
      const nombre = asStr(o.nombre);
      const grupo = asStr(o.grupo);
      const volumen = asNum(o.volumen);
      const share = asNum(o.share);
      if (nombre && grupo && volumen !== null && share !== null) {
        cats.push({ nombre, grupo, volumenUsd: volumen, share });
      }
    }
  }
  if (cats.length === 0) problemas.push("MAE volumen caído");
  if (mae.valor === null) problemas.push("oficial MAE caído");

  let volumenLinkedNominal: number | null = null;
  if (notes) {
    volumenLinkedNominal = notes
      .filter((n) => /^D\d/.test(n.symbol))
      .reduce((acc, n) => acc + (n.v ?? 0), 0);
  } else {
    problemas.push("volumen dólar linked caído");
  }

  return {
    cats,
    oficial: mae.valor,
    oficialVarPct: mae.varPct,
    volumenLinkedNominal,
    meta: {
      source: "MAE",
      updatedAt: Date.now(),
      status: cats.length > 0 ? "real" : "parcial",
      problemas,
    },
  };
});
