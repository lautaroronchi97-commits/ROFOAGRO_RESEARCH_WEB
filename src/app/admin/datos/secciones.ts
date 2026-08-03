export type SeccionDatos = {
  slug: string;
  nombre: string;
  descripcion: string;
  cadencia: string;
};

/**
 * Las 9 cargas manuales de /admin/datos, una página propia por c/u (antes convivían todas
 * en un solo page.tsx largo con anclas). Fuente compartida por el índice (`page.tsx`, cards)
 * y la sub-nav (`datos-nav.tsx`, pestañas) para no repetir nombres/descripciones dos veces.
 */
export const SECCIONES_DATOS: SeccionDatos[] = [
  {
    slug: "agrochat",
    nombre: "Comercialización (Agrochat)",
    descripcion: "Export semanal de compras por grano, sector y campaña, en toneladas.",
    cadencia: "semanal",
  },
  {
    slug: "camiones",
    nombre: "Camiones en puerto (Williams)",
    descripcion: "Export de Williams Entregas vía Agrochat, por zona y grano.",
    cadencia: "irregular, sin cadencia fija",
  },
  {
    slug: "mesa-color",
    nombre: "Datos del día (color de la rueda)",
    descripcion: "Lo que viste hoy en la rueda: negocios, sensaciones, precios que te pasaron.",
    cadencia: "diaria, días hábiles",
  },
  {
    slug: "bcra-manual",
    nombre: "Compras BCRA (MULC) — manual",
    descripcion: "Tapa el rezago de la API oficial para cualquier fecha reciente.",
    cadencia: "diaria hábil, tapa el rezago de la API",
  },
  {
    slug: "dea",
    nombre: "Estimaciones DEA-SAGyP",
    descripcion: "CSV oficial de producción nacional por cultivo y campaña.",
    cadencia: "semanal",
  },
  {
    slug: "pas",
    nombre: "Estimaciones BCBA-PAS",
    descripcion: "Histórico de producción del Panorama Agrícola Semanal.",
    cadencia: "en cada salida del informe (sin fecha fija)",
  },
  {
    slug: "pas-zonas",
    nombre: "BCBA-PAS por zona agroecológica",
    descripcion: "Producción desglosada por zona (16 zonas canónicas).",
    cadencia: "en cada salida del informe (sin fecha fija)",
  },
  {
    slug: "pas-condicion",
    nombre: "Condición de cultivos BCBA-PAS",
    descripcion: "Condición semanal + fenología, un archivo por cultivo.",
    cadencia: "semanal (4 archivos, uno por cultivo)",
  },
  {
    slug: "lecap",
    nombre: "Pago final de letras (LECAP)",
    descripcion: "Importe al vencimiento de cada LECAP/BONCAP para Sintéticos.",
    cadencia: "esporádica (~cada 1-2 meses)",
  },
];
