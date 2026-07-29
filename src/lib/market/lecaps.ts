import "server-only";
import { cache } from "react";
import type { Meta } from "./types";
import { getNotes, getBonds, type NoteRow } from "./fuentes";
import { vencFromTicker } from "./tickers";

/* ---------------- Módulo 6: LECAPs + BONCAPs (data912) — base para sintéticos ---------------- */

export type Lecap = {
  symbol: string;
  px: number;
  varPct: number | null;
  dias: number | null;
  venc: number | null;
};

export type LecapsData = { lecaps: Lecap[]; meta: Meta };

/** LECAP = "letra" en `arg_notes` (prefijo S); BONCAP = "título" en `arg_bonds` (prefijo T). */
function mapearLetras(rows: NoteRow[] | null, prefijo: "S" | "T", now: number): Lecap[] {
  const re = prefijo === "S" ? /^S\d/ : /^T\d/;
  return (rows ?? [])
    .filter((n) => re.test(n.symbol) && !n.symbol.endsWith("D"))
    .map((n) => {
      const px = n.c ?? (n.px_bid !== null && n.px_ask !== null ? (n.px_bid + n.px_ask) / 2 : null);
      if (px === null || px <= 0) return null;
      const venc = vencFromTicker(n.symbol);
      const dias = venc ? Math.max(0, Math.round((venc - now) / 86400000)) : null;
      return { symbol: n.symbol, px, varPct: n.pct_change, dias, venc };
    })
    .filter((x): x is Lecap => x !== null);
}

export const getLecaps = cache(async (): Promise<LecapsData> => {
  const [notes, bonds] = await Promise.all([getNotes(), getBonds()]);
  const now = Date.now();

  const lecaps: Lecap[] = [...mapearLetras(notes, "S", now), ...mapearLetras(bonds, "T", now)].sort(
    (a, b) => (a.venc ?? 1e15) - (b.venc ?? 1e15),
  );

  return {
    lecaps,
    meta: {
      source: "Mercado de deuda local",
      updatedAt: now,
      status: notes || bonds ? "real" : "parcial",
      problemas: notes || bonds ? [] : ["data912 caído"],
    },
  };
});
