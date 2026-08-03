import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { hoyCordobaISO } from "@/lib/dates";
import { ahoraCordoba, algunaRuedaAbierta } from "@/lib/rueda";
import { a3Ping } from "@/lib/a3-live";
import { supabaseConfigured } from "@/lib/supabase";
import { getFrescura, type EstadoChequeo } from "@/lib/monitoreo/frescura";
import { getCargasManuales, contarCargasPendientes, type CargaManualEstado, type EstadoManual } from "@/lib/monitoreo/manual";
import { getGithubRuns, type EstadoRun } from "@/lib/monitoreo/github-runs";
import { getRoutines, type RoutineEstado, type EstadoRoutine } from "@/lib/monitoreo/routines";
import { WORKFLOWS } from "@/lib/monitoreo/catalogo";
import { estadoWorkflow, type Color } from "@/lib/monitoreo/workflow-estado";
import { fmtFecha, fmtFechaHora } from "@/lib/monitoreo/fmt";
import { AdminChip } from "@/components/admin-chip";

export const metadata = { title: "Conexiones · Administración · ROFO AGRO" };

/**
 * Panel "de un vistazo" pedido por Lautaro: qué carga manual falta, qué cron corrió/no corrió,
 * si las 3 Routines produjeron lo suyo, y si A3 está trayendo datos en vivo. Solo LECTURA +
 * links (decisión de la sesión, ver docs/sesiones/2026-07-29-panel-conexiones.md): "correr
 * ahora" queda para el link directo a GitHub o a la sección de /admin/datos.
 *
 * Es el inventario COMPLETO (incluye lo que está OK) — para "qué necesita mi atención hoy" en
 * un solo vistazo, sin lo que ya está bien, ver /admin/checklist (03/08/2026).
 */

const chip = (color: Color, texto: string) => <AdminChip color={color} texto={texto} />;

const COLOR_MANUAL: Record<EstadoManual, Color> = { "al-dia": "verde", pendiente: "dorado", atrasado: "rojo" };
const TEXTO_MANUAL: Record<EstadoManual, string> = { "al-dia": "Al día", pendiente: "Pendiente", atrasado: "Atrasado" };
const TEXTO_ROUTINE: Record<EstadoRoutine, string> = { ok: "OK", pendiente: "Pendiente", atrasado: "Atrasado" };
const COLOR_CHECK: Record<EstadoChequeo, Color> = { ok: "verde", atrasado: "rojo", error: "rojo", "sin-datos": "neutro" };
const COLOR_RUN: Record<EstadoRun, Color> = { success: "verde", failure: "rojo", "en-curso": "dorado", desconocido: "neutro" };
const TEXTO_RUN: Record<EstadoRun, string> = { success: "OK", failure: "Falló", "en-curso": "Corriendo", desconocido: "Sin runs" };

export default async function ConexionesPage() {
  await requireAdmin();

  const hoy = hoyCordobaISO();
  const ahora = ahoraCordoba();

  const [frescura, cargas, githubRuns, routines, a3, rueda] = await Promise.all([
    getFrescura(),
    getCargasManuales(hoy),
    getGithubRuns(),
    getRoutines(hoy, ahora.min),
    a3Ping(),
    Promise.resolve(algunaRuedaAbierta()),
  ]);

  const cargasPendientes = contarCargasPendientes(cargas);
  const runsPorArchivo = new Map(githubRuns.disponible ? githubRuns.runs.map((r) => [r.archivo, r]) : []);
  const checksPorNombre = frescura.checks;

  const filasWorkflow = WORKFLOWS.map((w) => ({
    w,
    run: runsPorArchivo.get(w.archivo),
    ...estadoWorkflow(w, runsPorArchivo.get(w.archivo), checksPorNombre),
  }));
  const cronsConProblema = filasWorkflow.filter((f) => f.color === "rojo").length;

  const a3Color: Color =
    a3.estado === "ok" ? "verde" : a3.estado === "sin-config" ? "neutro" : rueda ? "rojo" : "neutro";
  const a3Texto =
    a3.estado === "sin-config"
      ? "Sin credenciales"
      : a3.estado === "ok"
        ? `OK (${a3.latenciaMs != null ? `${a3.latenciaMs}ms` : "—"})`
        : rueda
          ? "Caído en rueda"
          : "Sin datos (fuera de rueda)";

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1">Conexiones</h1>
        <p className="admin-sub">
          Estado de todas las conexiones externas: cargas manuales, crons de GitHub Actions, las 3
          Routines de research y el feed en vivo de A3. Solo lectura — para actuar, cada fila linkea a
          donde corresponde (el uploader en <Link href="/admin/datos">Datos</Link>, o el workflow en
          GitHub). Es el inventario completo, incluido lo que ya está bien — para solo lo que
          necesita tu atención hoy, ver el <Link href="/admin/checklist">Checklist diario</Link>.
        </p>
      </div>

      <div className="lu-kpis">
        <div className="lu-kpi">
          <span className="lu-kpi-v">{cargasPendientes}</span>
          <span className="lu-kpi-l">Cargas pendientes</span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{cronsConProblema}</span>
          <span className="lu-kpi-l">Crons con problema</span>
        </div>
        <div className="lu-kpi">
          <span className="lu-kpi-v">{a3.estado === "ok" ? "OK" : a3.estado === "sin-config" ? "—" : "✗"}</span>
          <span className="lu-kpi-l">A3 en vivo</span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- Cargas manuales */}
      <div className="admin-hd" style={{ marginTop: 32 }}>
        <h2 className="admin-h1" style={{ fontSize: "1.3rem" }}>Cargas manuales</h2>
        <p className="admin-sub">Lo que solo entra si vos lo subís — qué falta y desde cuándo.</p>
      </div>
      <div className="admin-tabla-wrap">
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Carga</th>
              <th>Última</th>
              <th>Detalle</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargas.map((c: CargaManualEstado) => (
              <tr key={c.id}>
                <td>
                  {c.nombre}
                  <div className="admin-card-meta">{c.cadenciaTexto}</div>
                </td>
                <td className="admin-td-ts">
                  {fmtFecha(c.ultimaFecha)}
                  {c.diasDesde != null && c.diasDesde >= 0 && <div className="admin-card-meta">hace {c.diasDesde}d</div>}
                </td>
                <td>{c.detalle}</td>
                <td>{chip(COLOR_MANUAL[c.estado], TEXTO_MANUAL[c.estado])}</td>
                <td>
                  <Link href={c.href} className="admin-btn admin-btn-ghost">
                    Ir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------------------- Crons automáticos */}
      <div className="admin-hd" style={{ marginTop: 32 }}>
        <h2 className="admin-h1" style={{ fontSize: "1.3rem" }}>Crons automáticos</h2>
        <p className="admin-sub">
          {githubRuns.disponible
            ? "Último run real de cada workflow (GitHub Actions) y frescura del dato que produce."
            : "Sin GH_MONITOR_TOKEN configurado: se muestra solo la frescura del dato en la base (no el resultado real del run). Ver la guía en la bitácora de esta sesión para cargar el token."}
        </p>
      </div>
      <div className="admin-tabla-wrap">
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Horario (ART)</th>
              <th>Último run</th>
              <th>Dato</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filasWorkflow.map(({ w, run, color, texto }) => {
              const propios = checksPorNombre.filter((c) => w.checkNombres.includes(c.nombre));
              return (
                <tr key={w.archivo}>
                  <td>{w.nombre}</td>
                  <td className="admin-card-meta">{w.horarioArt}</td>
                  <td>
                    {run ? (
                      <>
                        {chip(COLOR_RUN[run.estado], TEXTO_RUN[run.estado])}
                        <div className="admin-card-meta">
                          {fmtFechaHora(run.fecha)}
                          {run.urlRun && (
                            <>
                              {" · "}
                              <a href={run.urlRun} target="_blank" rel="noreferrer">
                                Ver →
                              </a>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {propios.length === 0
                      ? "—"
                      : propios.map((c) => (
                          <div key={c.nombre} className="admin-card-meta">
                            {c.fecha ? `${fmtFecha(c.fecha)} (${c.dias}d)` : "sin datos"}
                          </div>
                        ))}
                  </td>
                  <td>{chip(color, texto)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------------------- Routines de Claude */}
      <div className="admin-hd" style={{ marginTop: 32 }}>
        <h2 className="admin-h1" style={{ fontSize: "1.3rem" }}>Routines de research</h2>
        <p className="admin-sub">Informe diario, informe semanal y view de mercado — no viven en el repo, se detectan por lo que producen.</p>
      </div>
      <div className="sf-grid">
        {routines.map((r: RoutineEstado) => (
          <div key={r.id} className={`sf-card sf-${r.estado === "ok" ? "firme" : r.estado === "pendiente" ? "mixto" : "flojo"}`}>
            <div className="sf-top">
              <span className="sf-grano">{r.nombre}</span>
              <span className="sf-nivel">{TEXTO_ROUTINE[r.estado]}</span>
            </div>
            <div className="sf-titulo">{r.horarioArt}</div>
            <p className="sf-lectura">
              {r.detalle} Ventana esperada: {fmtFecha(r.fechaEsperada)}.
            </p>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------------- En vivo / estructural */}
      <div className="admin-hd" style={{ marginTop: 32 }}>
        <h2 className="admin-h1" style={{ fontSize: "1.3rem" }}>En vivo y estructural</h2>
      </div>
      <div className="admin-cards">
        <div className="admin-card">
          <div className="admin-card-hd">
            <p className="admin-card-name">A3 (WebSocket en vivo)</p>
            {chip(a3Color, a3Texto)}
          </div>
          <p className="admin-card-meta">
            {rueda ? "Rueda abierta ahora." : "Rueda cerrada — un feed caído acá no es anómalo."}
            {a3.symbol && ` Símbolo de prueba: ${a3.symbol}.`}
          </p>
        </div>
        <div className="admin-card">
          <div className="admin-card-hd">
            <p className="admin-card-name">Supabase</p>
            {chip(supabaseConfigured() ? "verde" : "rojo", supabaseConfigured() ? "Configurado" : "Sin credenciales")}
          </div>
          <p className="admin-card-meta">Si todos los checks de abajo fallan a la vez, revisar acá primero.</p>
        </div>
        {frescura.matviews.map((m) => (
          <div key={m.nombre} className="admin-card">
            <div className="admin-card-hd">
              <p className="admin-card-name">Matview {m.nombre}</p>
              {chip(COLOR_CHECK[m.estado === "sin-refrescar" ? "atrasado" : m.estado], m.estado === "ok" ? "Al día" : m.estado === "sin-refrescar" ? "Sin refrescar" : m.estado === "sin-datos" ? "Sin datos" : "Error")}
            </div>
            <p className="admin-card-meta">
              {m.mvFecha ? `Matview ${fmtFecha(m.mvFecha)} vs base ${fmtFecha(m.baseFecha)} (rezago ${m.rezago}d).` : "Sin filas."}
            </p>
          </div>
        ))}
        {frescura.futuro.map((f) => (
          <div key={f.nombre} className="admin-card">
            <div className="admin-card-hd">
              <p className="admin-card-name">{f.nombre}</p>
              {chip(f.estado === "ok" ? "verde" : "rojo", f.estado === "ok" ? "OK" : "Por agotarse")}
            </div>
            <p className="admin-card-meta">{f.restantes != null ? `${f.restantes}d de futuro (mínimo ${f.minDiasFuturo}d).` : "Sin datos."} {f.nota}</p>
          </div>
        ))}
        <div className="admin-card">
          <div className="admin-card-hd">
            <p className="admin-card-name">Seed calendario oficial</p>
            {chip(frescura.seedCalendario.estado === "ok" ? "verde" : "rojo", frescura.seedCalendario.estado === "ok" ? "OK" : "Por agotarse")}
          </div>
          <p className="admin-card-meta">
            Sembrado hasta {fmtFecha(frescura.seedCalendario.fecha)} ({frescura.seedCalendario.restantes}d de futuro).
          </p>
        </div>
      </div>
    </section>
  );
}
