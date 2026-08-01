/**
 * Locale es-AR propio para ECharts — registrado una sola vez al importar este módulo.
 *
 * ECharts trae un locale "ES" oficial (`echarts/i18n/langES.js`), pero sus abreviaturas de
 * mes vienen en minúscula ("ene", "feb"...) — el resto del sitio usa SIEMPRE 3 letras en
 * mayúscula (`MESES_ES` de `src/lib/dates.ts`: "ENE", "FEB"...). Sin este locale, ECharts
 * arranca en inglés por defecto — los ejes de tiempo mostraban "Jul"/"Oct"/"Apr" (bug real,
 * encontrado al revisar la migración de `EvolucionChart`) y los tooltips del toolbox decían
 * "Save as Image" en vez de "Guardar como imagen". Se registra acá para que TODOS los charts
 * de tiempo del sitio hereden la convención real de una sola vez, sin tocar cada uno por
 * separado.
 *
 * El resto de los textos (toolbox/leyenda) son la traducción oficial de `echarts/i18n/langES.js`
 * copiada a mano — no se importa ese archivo directo: es un módulo UMD sin tipos, atado a una
 * ruta interna de la librería que el propio proyecto de ECharts no promete mantener estable
 * entre versiones.
 */
import * as echarts from "echarts";
import { MESES_ES } from "@/lib/dates";

const ES_LOCALE = {
  time: {
    month: [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ],
    monthAbbr: [...MESES_ES],
    dayOfWeek: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    dayOfWeekAbbr: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  },
  legend: {
    selector: { all: "Todas", inverse: "Inversa" },
  },
  toolbox: {
    brush: {
      title: {
        rect: "Selección de cuadro",
        polygon: "Selección de lazo",
        lineX: "Seleccionar horizontalmente",
        lineY: "Seleccionar verticalmente",
        keep: "Mantener selección",
        clear: "Despejar selecciones",
      },
    },
    dataView: { title: "Ver datos", lang: ["Ver datos", "Cerrar", "Actualizar"] },
    dataZoom: { title: { zoom: "Zoom", back: "Restablecer zoom" } },
    magicType: {
      title: { line: "Cambiar a gráfico de líneas", bar: "Cambiar a gráfico de barras", stack: "Pila", tiled: "Teja" },
    },
    restore: { title: "Restaurar" },
    saveAsImage: { title: "Guardar como imagen", lang: ["Clic derecho para guardar imagen"] },
  },
};

export const ROFO_LOCALE_ID = "ROFO_ES";

// `LocaleOption` de echarts exige TODOS los campos del locale EN completo (incluidos
// aria/series.typeNames de ~20 tipos de gráfico que este sitio no usa: pie/radar/sankey/etc.)
// — a nivel de runtime ECharts cae al inglés campo por campo si falta alguno, no hace falta
// completarlos todos para que funcione.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
echarts.registerLocale(ROFO_LOCALE_ID, ES_LOCALE as any);
