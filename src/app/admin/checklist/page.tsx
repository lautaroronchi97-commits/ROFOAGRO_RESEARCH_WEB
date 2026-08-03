import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { hoyCordobaISO } from "@/lib/dates";
import { ahoraCordoba } from "@/lib/rueda";
import { getFrescura } from "@/lib/monitoreo/frescura";
import { getCargasManuales } from "@/lib/monitoreo/manual";
import { getGithubRuns } from "@/lib/monitoreo/github-runs";
import { getRoutines } from "@/lib/monitoreo/routines";
import { WORKFLOWS } from "@/lib/monitoreo/catalogo";
import { estadoWorkflow } from "@/lib/monitoreo/workflow-estado";
import { fmtFecha } from "@/lib/monitoreo/fmt";
import { AdminChip } from "@/components/admin-chip";

export const metadata = { title: "Checklist diario · Administración · ROFO AGRO" };

/**
 * "¿Qué tengo que hacer hoy?" pedido por Lautaro (03/08/2026, sesión de diagnóstico de
 * ingestas/checks): un solo lugar con SOLO lo que necesita su atención — nada de lo que ya
 * está bien, a diferencia de /admin/conexiones (el inventario completo). Reusa el mismo motor
 * (`getCargasManuales`/`getFrescura`/`getGithubRuns`/`getRoutines`, `src/lib/monitoreo/`) y
 * solo reagrupa el resultado en 4 baldes por urgencia/tipo de acción:
 *   1. Se rompió (rojo)      — un cron falló. No es tarea tuya, pero conviene que lo sepas.
 *   2. No se generó (rojo)   — una Routine de research no produjo lo suyo en su ventana.
 *   3. Tenés que cargar (dorado/rojo) — cargas manuales pendientes/atrasadas, CON acción directa.
 *   4. Atrasado por la fuente (neutro) — el cron corre bien, pero el organismo no publicó
 *      (ej. CONAB, ver docs/sesiones/2026-08-03-diagnostico-ingestas-checks.md) — sin acción,
 *      solo para tenerlo presente.
 * Sin badge en la nav a propósito: calcular esto pega contra Supabase (~14 queries de
 * getFrescura) + la API de GitHub en CADA página del panel si viviera en el layout — se calcula
 * solo acá, donde Lautoro ya vino a mirarlo.
 */

function fechaLegible(hoyISO: string): string {
  const d = new Date(`${hoyISO}T12:00:00-03:00`);
  const s = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Grupo({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div className="admin-hd">
        <h2 className="admin-h1" style={{ fontSize: "1.2rem" }}>{titulo}</h2>
        <p className="admin-sub">{sub}</p>
      </div>
      <div className="chk-grid">{children}</div>
    </div>
  );
}

export default async function ChecklistPage() {
  await requireAdmin();
  const hoy = hoyCordobaISO();
  const ahora = ahoraCordoba();

  const [cargas, frescura, githubRuns, routines] = await Promise.all([
    getCargasManuales(hoy),
    getFrescura(),
    getGithubRuns(),
    getRoutines(hoy, ahora.min),
  ]);

  const checksPorNombre = frescura.checks;
  const runsPorArchivo = new Map(githubRuns.disponible ? githubRuns.runs.map((r) => [r.archivo, r]) : []);
  const filasWorkflow = WORKFLOWS.map((w) => ({ w, ...estadoWorkflow(w, runsPorArchivo.get(w.archivo), checksPorNombre) }));

  const rotos = filasWorkflow.filter((f) => f.color === "rojo");
  const atrasadosFuente = filasWorkflow.filter((f) => f.color === "dorado" && f.texto === "Run OK, dato atrasado");
  const cargasPendientes = [...cargas]
    .filter((c) => c.estado !== "al-dia")
    .sort((a, b) => Number(b.estado === "atrasado") - Number(a.estado === "atrasado"));
  const routinesRotas = routines.filter((r) => r.estado === "atrasado");

  const totalAccion = rotos.length + routinesRotas.length + cargasPendientes.length;
  const todoEnOrden = totalAccion === 0 && atrasadosFuente.length === 0;

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1">Checklist de hoy</h1>
        <p className="admin-sub">
          {fechaLegible(hoy)}. Solo lo que necesita tu atención — para el inventario completo
          (incluido lo que ya está bien), ver <Link href="/admin/conexiones">Conexiones</Link>.
        </p>
      </div>

      {todoEnOrden ? (
        <div className="chk-ok">
          <span className="chk-ok-ico">✓</span>
          <div>
            <p className="chk-ok-t">Todo en orden.</p>
            <p className="admin-card-meta">Nada roto, nada atrasado, nada pendiente de cargar.</p>
          </div>
        </div>
      ) : (
        <div className="lu-kpis">
          <div className="lu-kpi">
            <span className="lu-kpi-v">{rotos.length + routinesRotas.length}</span>
            <span className="lu-kpi-l">Se rompió</span>
          </div>
          <div className="lu-kpi">
            <span className="lu-kpi-v">{cargasPendientes.length}</span>
            <span className="lu-kpi-l">Tenés que cargar</span>
          </div>
          <div className="lu-kpi">
            <span className="lu-kpi-v">{atrasadosFuente.length}</span>
            <span className="lu-kpi-l">Atrasado (fuente)</span>
          </div>
        </div>
      )}

      {rotos.length > 0 && (
        <Grupo titulo="🔴 Se rompió" sub="Algo del código/infraestructura falló — no es una carga tuya, pero conviene que lo sepas (y nos avises si no se arregla solo).">
          {rotos.map(({ w, texto }) => (
            <div key={w.archivo} className="chk-item chk-item-rojo">
              <div className="chk-item-hd">
                <span className="chk-item-t">{w.nombre}</span>
                <AdminChip color="rojo" texto={texto} />
              </div>
              <p className="admin-card-meta">Horario habitual: {w.horarioArt}.</p>
            </div>
          ))}
        </Grupo>
      )}

      {routinesRotas.length > 0 && (
        <Grupo titulo="🟣 No se generó" sub="Informes o views de research que debían salir solos y no salieron.">
          {routinesRotas.map((r) => (
            <div key={r.id} className="chk-item chk-item-rojo">
              <div className="chk-item-hd">
                <span className="chk-item-t">{r.nombre}</span>
                <AdminChip color="rojo" texto="Atrasado" />
              </div>
              <p className="admin-card-meta">{r.detalle} Ventana esperada: {fmtFecha(r.fechaEsperada)}.</p>
            </div>
          ))}
        </Grupo>
      )}

      {cargasPendientes.length > 0 && (
        <Grupo titulo="🟠 Tenés que cargar algo" sub="Lo que solo entra a la base si vos lo subís.">
          {cargasPendientes.map((c) => (
            <div key={c.id} className={`chk-item ${c.estado === "atrasado" ? "chk-item-rojo" : "chk-item-dorado"}`}>
              <div className="chk-item-hd">
                <span className="chk-item-t">{c.nombre}</span>
                <AdminChip color={c.estado === "atrasado" ? "rojo" : "dorado"} texto={c.estado === "atrasado" ? "Atrasado" : "Pendiente"} />
              </div>
              <p className="admin-card-meta">{c.detalle}</p>
              <Link href={c.href} className="admin-btn admin-btn-ok chk-item-btn">
                Ir a cargar →
              </Link>
            </div>
          ))}
        </Grupo>
      )}

      {atrasadosFuente.length > 0 && (
        <Grupo
          titulo="🟡 Atrasado por la fuente"
          sub="El cron corre bien todos los días — el organismo de origen todavía no publicó. Sin acción tuya, es solo para tenerlo presente."
        >
          {atrasadosFuente.map(({ w }) => {
            const propios = checksPorNombre.filter(
              (c) => w.checkNombres.includes(c.nombre) && (c.estado === "atrasado" || c.estado === "error"),
            );
            return (
              <div key={w.archivo} className="chk-item">
                <span className="chk-item-t">{w.nombre}</span>
                {propios.map((c) => (
                  <p key={c.nombre} className="admin-card-meta">
                    último dato {fmtFecha(c.fecha)} ({c.dias}d · umbral {c.maxDias}d, {c.cadencia}).
                  </p>
                ))}
              </div>
            );
          })}
        </Grupo>
      )}
    </section>
  );
}
