"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { nfmt } from "@/lib/format";
import { Panel, PanelHead } from "../panel";
import { SourceStamp } from "../source-stamp";
import { QueEsEsto } from "../que-es-esto";
import { RangoChips } from "../rango-chips";
import { CamionesChart } from "./camiones-chart";
import { WilliamsChart } from "./williams-chart";
import { EmpresasTabla } from "./empresas-tabla";
import { EmpresasHistograma } from "./empresas-histograma";
import type { PlantasData } from "@/lib/camiones/plantas";
import type { CamionesData } from "@/lib/camiones/camiones";
import { PRODUCTO_SERIE_CLAVES, PRODUCTO_SERIE_DISPLAY, type ProductoSerie } from "@/lib/camiones/config";

/**
 * Orquestador de `/comercio/camiones` (relevamiento web R9, punto 53): un único filtro de grano
 * transversal a toda la página + coordinación de "máx una tabla abierta a la vez". Reemplaza
 * `plantas-panel.tsx`/`camiones-panel.tsx` (ambos ahora acá, único lugar donde vive el estado
 * compartido — esos 2 componentes eran Server Components async y no podían compartir estado de
 * cliente entre sí). `page.tsx` sigue fetcheando los datos (server-only) y los pasa como props.
 */

function IconPulso() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8.5h3l2-4 2.5 7 2-3h3.5" />
    </svg>
  );
}
function IconCamion() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 4.5h6.5v6H1.5z" />
      <path d="M8 7h3.5l2 2.5v1H8z" />
      <circle cx="4" cy="11.5" r="1.2" />
      <circle cx="11.5" cy="11.5" r="1.2" />
    </svg>
  );
}

function ddmm(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
function fmtDelta(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${nfmt(v, 0)}`;
}
function clsDelta(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return v > 0 ? "pos" : "neg";
}

export function CamionesClient({
  plantas,
  camiones,
  esAdmin,
}: {
  plantas: PlantasData;
  camiones: CamionesData;
  esAdmin: boolean;
}) {
  const granosPresentes = useMemo(() => {
    const set = new Set<string>();
    plantas.porGrano.forEach((s) => set.add(s.key));
    camiones.productosDisponibles.forEach((p) => set.add(p));
    return set;
  }, [plantas.porGrano, camiones.productosDisponibles]);

  const opcionesGrano = useMemo(
    () => PRODUCTO_SERIE_CLAVES.filter((k) => k === "TOTAL" || granosPresentes.has(k)),
    [granosPresentes],
  );

  const [granoFiltro, setGranoFiltro] = useState<ProductoSerie>("TOTAL");
  const [tablaAbierta, setTablaAbierta] = useState<"agro" | "williams" | null>(null);
  const granoDisplay = PRODUCTO_SERIE_DISPLAY[granoFiltro];

  const serieAgro = granoFiltro === "TOTAL" ? null : plantas.porGrano.find((s) => s.key === granoFiltro);
  const kpiTotalAgro =
    granoFiltro === "TOTAL"
      ? { total: plantas.totalDia, deltaDia: plantas.deltaDiaAnterior, deltaInteranual: plantas.deltaInteranual }
      : {
          total: serieAgro?.puntos[serieAgro.puntos.length - 1]?.cantidad ?? null,
          deltaDia: null as number | null,
          deltaInteranual: null as PlantasData["deltaInteranual"],
        };
  const chartsAgro = granoFiltro === "TOTAL" ? plantas.porGrano : plantas.porGrano.filter((s) => s.key === granoFiltro);

  const puntosTotal = useMemo(
    () =>
      camiones.porZona.flatMap((s) =>
        s.puntos.map((p) => ({ fecha: p.fecha, zona: s.zona, producto: "TOTAL", cantidad: p.cantidad })),
      ),
    [camiones.porZona],
  );

  return (
    <>
      {opcionesGrano.length > 1 && (
        <RangoChips
          opciones={opcionesGrano.map((k) => ({ label: PRODUCTO_SERIE_DISPLAY[k], value: k }))}
          valor={granoFiltro}
          onChange={setGranoFiltro}
          label="Filtrar por grano"
        />
      )}

      <Panel id="comercio-camiones-plantas">
        <PanelHead
          glyph={<IconPulso />}
          title="Pulso diario Up River"
          sub={`Día al ${ddmm(plantas.fecha)} · por planta y empresa`}
          stamp={<SourceStamp meta={plantas.meta} ocultarFuente />}
        />

        {plantas.fecha === null ? (
          <p className="dim" style={{ padding: "8px 2px" }}>
            Sin datos todavía. {plantas.meta.problemas[0] ?? ""}
          </p>
        ) : (
          <>
            <div className="lu-kpis">
              <div className="lu-kpi">
                <span className="lu-kpi-v">{kpiTotalAgro.total == null ? "—" : nfmt(kpiTotalAgro.total, 0)}</span>
                <span className="lu-kpi-l">
                  camiones el {ddmm(plantas.fecha)}
                  {granoFiltro === "TOTAL" && plantas.plantasReportadas ? ` (${plantas.plantasReportadas} plantas)` : ""}
                </span>
              </div>
              {granoFiltro === "TOTAL" && (
                <div className="lu-kpi">
                  <span className={`lu-kpi-v ${clsDelta(kpiTotalAgro.deltaDia)}`}>{fmtDelta(kpiTotalAgro.deltaDia)}</span>
                  <span className="lu-kpi-l">vs día anterior con dato</span>
                </div>
              )}
              {granoFiltro === "TOTAL" && (
                <div className="lu-kpi">
                  <span className={`lu-kpi-v ${clsDelta(kpiTotalAgro.deltaInteranual?.valor)}`}>
                    {kpiTotalAgro.deltaInteranual ? `${kpiTotalAgro.deltaInteranual.pct >= 0 ? "+" : ""}${nfmt(kpiTotalAgro.deltaInteranual.pct, 1)}%` : "—"}
                  </span>
                  <span className="lu-kpi-l">
                    {kpiTotalAgro.deltaInteranual ? `vs mismo día de ${kpiTotalAgro.deltaInteranual.fecha.slice(0, 4)}` : "vs año pasado"}
                  </span>
                </div>
              )}
              {granoFiltro === "TOTAL" && (
                <div className="lu-kpi">
                  <span className="lu-kpi-v">{plantas.granoLider ? plantas.granoLider.display : "—"}</span>
                  <span className="lu-kpi-l">
                    grano líder{plantas.granoLider ? ` (${nfmt(plantas.granoLider.cantidad, 0)})` : ""}
                  </span>
                </div>
              )}
            </div>

            {chartsAgro.length > 0 && (
              <>
                <h3 className="lu-h3">Por grano (Up River + Paraná Bs As)</h3>
                <CamionesChart
                  series={chartsAgro}
                  tituloAria="Camiones diarios por grano — Agroentregas"
                  tablaColapsable
                  tablaAbierta={tablaAbierta === "agro"}
                  onToggleTabla={() => setTablaAbierta((v) => (v === "agro" ? null : "agro"))}
                />
              </>
            )}

            {esAdmin && plantas.porEmpresa.length > 0 && (
              <>
                <h3 className="lu-h3">Quién recibió camiones el {ddmm(plantas.fecha)} (mesa)</h3>
                <EmpresasTabla empresas={plantas.porEmpresa} granoFiltro={granoFiltro} granoDisplay={granoDisplay} />
                <EmpresasHistograma empresas={plantas.porEmpresa} granoFiltro={granoFiltro} />
              </>
            )}
          </>
        )}

        <QueEsEsto
          paraQue={
            <>
              Es el <strong>pulso diario</strong> de la descarga de camiones en las plantas y terminales del núcleo
              de embarque de Up River y el Paraná bonaerense. A diferencia del panel de abajo (que cubre todo el
              país pero se actualiza cuando Lautaro sube el archivo), este llega <strong>solo, todos los días</strong>.
              Sirve para ver hoy mismo si la mercadería está entrando o si el productor frenó, y —en la vista de
              mesa— <strong>qué exportador está levantando</strong>.
            </>
          }
          comoSeCalcula={
            <>
              Se ingiere automáticamente dos veces por día. Este total <strong>no es el nacional</strong>: cubre
              Up River y el Paraná bonaerense, sin Bahía Blanca ni Necochea — por eso no se compara ni se suma con
              el panel de abajo. Los valores son <strong>cantidad de camiones</strong> (vehículos), no toneladas.
              El comparativo interanual es contra el <strong>mismo día de la semana</strong> del año pasado.
            </>
          }
        />
      </Panel>

      <Panel id="comercio-camiones">
        <PanelHead
          glyph={<IconCamion />}
          title="Camiones en puerto — nacional"
          sub={`Día al ${ddmm(camiones.fecha)} · por zona portuaria`}
          stamp={<SourceStamp meta={camiones.meta} />}
        />
        {camiones.fecha === null ? (
          <p className="dim" style={{ padding: "8px 2px" }}>
            Sin datos todavía. {camiones.meta.problemas[0] ?? ""}
          </p>
        ) : (
          <WilliamsChart
            puntos={camiones.porZonaProducto}
            puntosTotal={puntosTotal}
            producto={granoFiltro}
            productoDisplay={granoDisplay}
            liderHoy={camiones.productoLiderHoy}
            tablaAbierta={tablaAbierta === "williams"}
            onToggleTabla={() => setTablaAbierta((v) => (v === "williams" ? null : "williams"))}
          />
        )}

        <QueEsEsto
          paraQue={
            <>
              Muestra <strong>cuántos camiones entraron a puertos, fábricas y molinos</strong> cada día en todo el
              país, por zona portuaria y por grano. Es una señal de presión de <strong>oferta física</strong>: más
              camiones de lo normal para la época = más mercadería entrando; menos = el productor retiene o hay
              cuello de botella logístico. El modo &quot;por campaña&quot; superpone varios años sobre el mismo
              calendario agrícola para comparar el ritmo de una campaña contra las anteriores.
            </>
          }
          comoSeCalcula={
            <>
              Carga manual, sin cadencia fija — se actualiza cuando hay un archivo nuevo. Los valores son{" "}
              <strong>cantidad de camiones</strong> (vehículos), no toneladas.
            </>
          }
        />

        <p className="ng-admin-link dim">
          <Link href="/admin/datos">Actualizar serie →</Link>
        </p>
      </Panel>
    </>
  );
}
