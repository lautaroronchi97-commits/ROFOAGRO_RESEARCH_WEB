import { describe, it, expect } from "vitest";
import {
  fechaWilliams,
  parseCsvLine,
  parseCsv,
  numCamion,
  parseZonasWilliams,
  crossCheckLocalidades,
  parseCamionesUpload,
} from "./williams";

describe("camiones/williams.ts — parser del backfill Williams Entregas", () => {
  it("fechaWilliams: 'ene 2, 2018' → '2018-01-02' (mes abreviado español, día sin padding)", () => {
    expect(fechaWilliams("ene 2, 2018")).toBe("2018-01-02");
    expect(fechaWilliams("jul 22, 2026")).toBe("2026-07-22");
    expect(fechaWilliams("dic 31, 2025")).toBe("2025-12-31");
  });

  it("fechaWilliams: texto inválido → null", () => {
    expect(fechaWilliams("")).toBeNull();
    expect(fechaWilliams("2026-07-22")).toBeNull();
    expect(fechaWilliams("xyz 1, 2020")).toBeNull();
  });

  it("parseCsvLine: campo con coma entre comillas se mantiene como UN campo", () => {
    expect(parseCsvLine('"ene 2, 2018",256,378,454,1160')).toEqual(["ene 2, 2018", "256", "378", "454", "1160"]);
  });

  it("parseCsvLine: campos sin comillas", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("numCamion: vacío → 0 (decisión: día real sin entradas, no dato faltante)", () => {
    expect(numCamion("")).toBe(0);
    expect(numCamion(undefined)).toBe(0);
    expect(numCamion(" ")).toBe(0);
    expect(numCamion("123")).toBe(123);
  });

  it("parseCsv: header + filas de un CSV chico", () => {
    const txt = 'Date,A,B\n"ene 2, 2018",1,2\n"ene 3, 2018",3,4\n';
    const { header, rows } = parseCsv(txt);
    expect(header).toEqual(["Date", "A", "B"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["ene 2, 2018", "1", "2"]);
  });

  it("parseZonasWilliams: mapea las 4 columnas a las claves SAGyP y suma el total del día", () => {
    const txt =
      "Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona\n" +
      '"ene 2, 2018",256,378,454,1160\n';
    const { filas, totales, filasInvalidas } = parseZonasWilliams(txt);
    expect(filasInvalidas).toBe(0);
    expect(filas).toHaveLength(4);
    expect(filas).toContainEqual({ fecha: "2018-01-02", clave: "DARSENA_BSAS_ER", cantidad: 256 });
    expect(filas).toContainEqual({ fecha: "2018-01-02", clave: "NECOCHEA", cantidad: 378 });
    expect(filas).toContainEqual({ fecha: "2018-01-02", clave: "BAHIA_BLANCA", cantidad: 454 });
    expect(filas).toContainEqual({ fecha: "2018-01-02", clave: "ROSARIO_ALEDANOS", cantidad: 1160 });
    expect(totales).toEqual([{ fecha: "2018-01-02", cantidad: 256 + 378 + 454 + 1160 }]);
  });

  it("parseZonasWilliams: celda vacía cuenta como 0, no rompe el parseo", () => {
    const txt =
      "Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona\n" +
      '"ene 2, 2018",,378,454,1160\n';
    const { filas, totales } = parseZonasWilliams(txt);
    expect(filas.find((f) => f.clave === "DARSENA_BSAS_ER")?.cantidad).toBe(0);
    expect(totales[0]!.cantidad).toBe(378 + 454 + 1160);
  });

  it("parseZonasWilliams: fila con fecha inválida se descarta y cuenta en filasInvalidas", () => {
    const txt =
      "Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona\n" +
      "no-es-fecha,1,2,3,4\n" +
      '"ene 2, 2018",256,378,454,1160\n';
    const { filas, filasInvalidas } = parseZonasWilliams(txt);
    expect(filasInvalidas).toBe(1);
    expect(filas).toHaveLength(4); // solo la fila válida
  });

  it("crossCheckLocalidades: cobertura 100% cuando las localidades mapeadas explican TODA la zona", () => {
    const zonas =
      "Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona\n" +
      '"ene 2, 2018",1,2,454,1000\n';
    const loc =
      "Date,Alvear,Arroyo Seco,General Lagos,Ramallo,Rosario,Timbues,San Lorenzo,Bahia Blanca\n" +
      '"ene 2, 2018",100,100,100,100,300,150,150,454\n';
    const r = crossCheckLocalidades(zonas, loc);
    expect(r.dias).toBe(1);
    expect(r.coberturaGranRosarioPct).toBeCloseTo(100, 6); // 100+100+100+100+300+150+150=1000
    expect(r.coberturaBahiaPct).toBeCloseTo(100, 6);
  });

  it("crossCheckLocalidades: cobertura parcial cuando la zona SAGyP incluye localidades sin mapeo", () => {
    const zonas =
      "Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona\n" +
      '"ene 2, 2018",1,2,454,2000\n'; // la zona real es más grande que la suma de localidades mapeadas
    const loc =
      "Date,Alvear,Arroyo Seco,General Lagos,Ramallo,Rosario,Timbues,San Lorenzo,San Nicolas,Bahia Blanca\n" +
      '"ene 2, 2018",100,100,100,100,300,150,150,1000,454\n'; // San Nicolas (sin mapeo) no cuenta
    const r = crossCheckLocalidades(zonas, loc);
    expect(r.coberturaGranRosarioPct).toBeCloseTo(50, 6); // 1000 mapeadas / 2000 de la zona
  });
});

describe("camiones/williams.ts — parseCamionesUpload (uploader /admin/datos + loader backfill)", () => {
  it("detecta formato ZONAS y devuelve las 4 zonas", () => {
    const txt =
      "Date,Darsenas y Bs As,Puertos de Necochea,Puertos-B.Blanca,Rosario y Zona\n" +
      '"ene 2, 2018",256,378,454,1160\n';
    const r = parseCamionesUpload(txt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.formato).toBe("zonas");
    expect(r.zonasCubiertas.sort()).toEqual(
      ["ROSARIO_ALEDANOS", "DARSENA_BSAS_ER", "NECOCHEA", "BAHIA_BLANCA"].sort(),
    );
    expect(r.filas).toHaveLength(4);
    expect(r.advertencias).toHaveLength(0);
  });

  it("detecta formato LOCALIDADES y deriva SOLO Gran Rosario + Bahía Blanca, con advertencia", () => {
    const txt =
      "Date,Alvear,Arroyo Seco,General Lagos,Ramallo,Rosario,Timbues,San Lorenzo,San Nicolas,Bahia Blanca\n" +
      '"ene 2, 2018",10,10,10,10,10,10,10,999,50\n';
    const r = parseCamionesUpload(txt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.formato).toBe("localidades");
    expect(r.zonasCubiertas.sort()).toEqual(["ROSARIO_ALEDANOS", "BAHIA_BLANCA"].sort());
    // 7 localidades mapeadas × 10 = 70 (San Nicolas NO cuenta, sin mapeo)
    expect(r.filas.find((f) => f.clave === "ROSARIO_ALEDANOS")?.cantidad).toBe(70);
    expect(r.filas.find((f) => f.clave === "BAHIA_BLANCA")?.cantidad).toBe(50);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });

  it("detecta formato CRUDO/tidy (Date,Cultivo,Localidad,Puerto,Zona,Cantidad de Camiones), agrupa por zona", () => {
    // Fixture real: 2 terminales de la misma zona el mismo día (verificado contra el CSV real de
    // Williams el 27/07/2026) — confirma que suma dentro de la zona, no solo mapea 1:1.
    const txt =
      "Date,Cultivo,Localidad,Puerto,Zona,Cantidad de Camiones\n" +
      "2026-07-01,Total,Alvear,Pta Alvear - Cargill,Rosario y Zona,369.0\n" +
      "2026-07-01,Total,Arroyo Seco,Arroyo Seco - ADM AGRO,Rosario y Zona,285.0\n" +
      "2026-07-01,Total,Bahia Blanca,Cargill - Bahía Blanca,Puertos-B.Blanca,359.0\n";
    const r = parseCamionesUpload(txt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.formato).toBe("crudo");
    expect(r.serieDetectada).toBe("TOTAL");
    expect(r.filas).toContainEqual({ fecha: "2026-07-01", clave: "ROSARIO_ALEDANOS", cantidad: 369 + 285 });
    expect(r.filas).toContainEqual({ fecha: "2026-07-01", clave: "BAHIA_BLANCA", cantidad: 359 });
    expect(r.advertencias).toHaveLength(0);
  });

  it("formato CRUDO con dos cultivos mezclados ('Total' + 'Maiz') → error explícito, no suma a ciegas", () => {
    const txt =
      "Date,Cultivo,Localidad,Puerto,Zona,Cantidad de Camiones\n" +
      "2026-07-01,Total,Alvear,Pta Alvear - Cargill,Rosario y Zona,369.0\n" +
      "2026-07-01,Maiz,Alvear,Pta Alvear - Cargill,Rosario y Zona,100.0\n";
    const r = parseCamionesUpload(txt);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/mezcla más de un cultivo/i);
  });

  it("formato desconocido → error, sin inventar datos", () => {
    const r = parseCamionesUpload("Date,ColumnaRara\n2020-01-01,5\n");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/no reconozco/i);
  });

  it("CSV vacío → error", () => {
    const r = parseCamionesUpload("");
    expect(r.ok).toBe(false);
  });
});
