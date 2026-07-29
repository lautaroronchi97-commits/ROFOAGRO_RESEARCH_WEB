import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { hoyCordobaISO } from "@/lib/dates";
import { isoMenosDias, huecosHabiles } from "@/lib/monitoreo/manual";
import { Uploader } from "./uploader";
import { PromptAgrochat } from "./prompt-agrochat";
import { UploaderCamiones } from "./uploader-camiones";
import { PromptCamiones } from "./prompt-camiones";
import { DatosDia, type DiaColor } from "./datos-dia";
import { BcraManual, type PuntoReciente } from "./bcra-manual";
import { DeaUploader } from "./dea-uploader";
import { PasUploader } from "./pas-uploader";
import { PasZonasUploader } from "./pas-zonas-uploader";
import { LecapUploader } from "./lecap-uploader";

/**
 * Pestaña DATOS del panel admin: actualizar series que se cargan a mano (sin cron), subiendo
 * exports de Agrochat/Williams — comercialización de granos (tabla `compras`), camiones en
 * puerto (tabla `camiones`, Williams Entregas), "color de la rueda" del informe diario (MP1),
 * compras BCRA (MULC) para cualquier fecha reciente (tapa el rezago de la ingesta automática),
 * y estimaciones DEA-SAGyP + BCBA-PAS (lotes L5/A3 — fuentes bloqueadas por IP/Cloudflare).
 * Protegida como las páginas hermanas: requireAdmin acá mismo (además del layout), y cada
 * server action vuelve a exigir admin en su primera línea; la escritura va por RPC con guard
 * is_admin() (sin service key en la web).
 */
export default async function DatosPage() {
  await requireAdmin();

  const fechaHoy = hoyCordobaISO();
  const desde14 = isoMenosDias(fechaHoy, 14);
  const supabase = await createSupabaseServerClient();
  const [{ data: colorRows }, { data: informesDiarios }, { data: bcraRows }, { data: lecapRows }] = await Promise.all([
    supabase.from("mesa_color").select("fecha,texto").gte("fecha", desde14).order("fecha", { ascending: false }),
    supabase.from("informes_generados").select("fecha").eq("tipo", "diario").gte("fecha", desde14),
    supabase
      .from("compras_bcra")
      .select("fecha,monto_musd,fuente")
      .gte("fecha", desde14)
      .order("fecha", { ascending: false }),
    supabase
      .from("lecap_pago_final")
      .select("ticker,pago_final,fecha_vencimiento")
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
  ]);
  // Historial de "color de la rueda" (últimos 14 días con dato + hoy siempre presente, aunque
  // esté vacío) con el flag "tomado" = ya existe el registro del informe diario de esa fecha
  // (informes_generados.tipo='diario') → esa fila queda de solo lectura.
  const coloresPorFecha = new Map(
    ((colorRows ?? []) as { fecha: string; texto: string }[]).map((f) => [f.fecha, f.texto]),
  );
  const fechasTomadas = new Set(
    ((informesDiarios ?? []) as { fecha: string }[]).map((f) => f.fecha),
  );
  const fechasColor = new Set([fechaHoy, ...coloresPorFecha.keys()]);
  const diasColor: DiaColor[] = Array.from(fechasColor)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((fecha) => ({
      fecha,
      texto: coloresPorFecha.get(fecha) ?? "",
      tomado: fechasTomadas.has(fecha),
    }));

  const bcraRecientes = (bcraRows ?? []) as { fecha: string; monto_musd: number; fuente: "manual" | "api" }[];
  const bcraPuntos: PuntoReciente[] = bcraRecientes.map((r) => ({ fecha: r.fecha, montoMusd: r.monto_musd, fuente: r.fuente }));
  const bcraFechas = new Set(bcraPuntos.map((p) => p.fecha));
  const bcraFaltantes = huecosHabiles(fechaHoy, 14, bcraFechas);
  const bcraFechaDefault = bcraFaltantes.length > 0 ? bcraFaltantes[bcraFaltantes.length - 1]! : isoMenosDias(fechaHoy, 1);
  const lecapActuales = (lecapRows ?? []) as { ticker: string; pago_final: number; fecha_vencimiento: string | null }[];

  return (
    <section>
      <div id="agrochat" className="admin-hd">
        <h1 className="admin-h1">Datos · Serie de comercialización</h1>
        <p className="admin-sub">
          Subí el export semanal de Agrochat (compras por grano, sector y campaña, en toneladas) para
          actualizar la serie que alimenta <Link href="/comercio/negociado">Negociado por producto</Link> y
          el índice de <Link href="/comercio/temperatura">Calor de mercadería</Link>. Primero previsualizá
          (no escribe nada), después confirmá la carga.
        </p>
      </div>
      <PromptAgrochat />
      <Uploader />

      <div id="camiones" className="admin-hd" style={{ marginTop: 32 }}>
        <h2 className="admin-h1" style={{ fontSize: "1.3rem" }}>Datos · Camiones en puerto</h2>
        <p className="admin-sub">
          Subí el export de Williams Entregas (vía Agrochat) para actualizar{" "}
          <Link href="/comercio/camiones">Camiones en puerto</Link> — es SIEMPRE carga manual (Williams no
          tiene API pública). Un archivo por serie: el total sin filtrar, o un grano puntual (Agrochat no
          banca los 3 juntos por tamaño). Elegí la serie, previsualizá y confirmá.
        </p>
      </div>
      <PromptCamiones />
      <UploaderCamiones />

      <div id="mesa-color">
        <DatosDia fechaHoy={fechaHoy} dias={diasColor} />
      </div>
      <div id="bcra-manual">
        <BcraManual fechaDefault={bcraFechaDefault} recientes={bcraPuntos.slice(0, 8)} faltantes={bcraFaltantes} />
      </div>
      <div id="dea">
        <DeaUploader hoy={fechaHoy} />
      </div>
      <div id="pas">
        <PasUploader hoy={fechaHoy} />
      </div>
      <div id="pas-zonas">
        <PasZonasUploader />
      </div>

      <div id="lecap" className="admin-hd" style={{ marginTop: 32 }}>
        <h2 className="admin-h1" style={{ fontSize: "1.3rem" }}>Datos · Pago final de letras (sintéticos)</h2>
        <p className="admin-sub">
          Cargá el pago final (importe al vencimiento) de cada LECAP/BONCAP para el panel{" "}
          <Link href="/dolar">Sintéticos</Link>. Es un dato casi estático: solo se actualiza cuando el Tesoro
          emite letras nuevas.
        </p>
      </div>
      <LecapUploader actuales={lecapActuales} />
    </section>
  );
}
