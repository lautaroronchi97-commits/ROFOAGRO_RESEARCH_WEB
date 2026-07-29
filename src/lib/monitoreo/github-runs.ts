import "server-only";
import { REPO_GITHUB, WORKFLOWS, type Workflow } from "./catalogo";

/**
 * Último run real de cada workflow, vía la API pública de GitHub Actions. Requiere
 * `GH_MONITOR_TOKEN` (fine-grained, SOLO LECTURA de Actions sobre este repo — Lautaro lo crea
 * y lo carga en Vercel; ver docs/sesiones/2026-07-29-panel-conexiones.md). Sin el token, el
 * panel degrada solo a la frescura de datos (`./frescura`) — no hay ningún otro dato en el
 * repo que diga "¿corrió el cron anoche?": ni `ingest_log` ni ningún registro propio existen
 * (ver el research de esta sesión), la API de GitHub es la única fuente real de ese hecho.
 */

export type EstadoRun = "success" | "failure" | "en-curso" | "desconocido";

export type RunWorkflow = Workflow & {
  estado: EstadoRun;
  fecha: string | null;
  urlRun: string | null;
};

export type GithubRunsResult =
  | { disponible: true; runs: RunWorkflow[] }
  | { disponible: false; motivo: "sin-token" | "error"; detalle?: string };

type ApiRun = {
  status: string; // "completed" | "in_progress" | "queued" | "waiting" | ...
  conclusion: string | null; // "success" | "failure" | "cancelled" | "timed_out" | "action_required" | "skipped" | null
  run_started_at: string;
  updated_at: string;
  html_url: string;
};

function mapEstado(run: ApiRun | undefined): EstadoRun {
  if (!run) return "desconocido";
  if (run.status !== "completed") return "en-curso";
  if (run.conclusion === "success" || run.conclusion === "skipped") return "success";
  if (run.conclusion == null) return "desconocido";
  return "failure";
}

/** Nunca tira: un workflow puntual con error de red no debe tumbar el bloque entero de runs
 *  (los otros 15 workflows siguen siendo información útil). */
async function ultimoRun(token: string, archivo: string): Promise<ApiRun | undefined> {
  try {
    const url = `https://api.github.com/repos/${REPO_GITHUB}/actions/workflows/${archivo}.yml/runs?per_page=1`;
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { workflow_runs?: ApiRun[] };
    return j.workflow_runs?.[0];
  } catch {
    return undefined;
  }
}

export async function getGithubRuns(): Promise<GithubRunsResult> {
  const token = process.env.GH_MONITOR_TOKEN;
  if (!token) return { disponible: false, motivo: "sin-token" };

  try {
    const runs = await Promise.all(
      WORKFLOWS.map(async (w): Promise<RunWorkflow> => {
        const run = await ultimoRun(token, w.archivo);
        return {
          ...w,
          estado: mapEstado(run),
          fecha: run?.updated_at ?? null,
          urlRun: run?.html_url ?? null,
        };
      }),
    );
    return { disponible: true, runs };
  } catch (e) {
    return { disponible: false, motivo: "error", detalle: e instanceof Error ? e.message : String(e) };
  }
}
