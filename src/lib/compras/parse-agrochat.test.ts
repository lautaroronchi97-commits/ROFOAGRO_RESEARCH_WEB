import { describe, it, expect } from "vitest";
import { parseAgrochat, CABECERA_ESPERADA } from "./parse-agrochat";

// Sin ficha directa en E2 (auditoría E4, hallazgo #12 — esta lib quedó fuera del alcance de
// E2, que auditó negociado.ts, el consumidor). Casos armados a mano contra el formato real
// documentado en el header del archivo y verificados contra data/compras/*.csv.
function csv(filas: string[]): Uint8Array {
  const texto = [CABECERA_ESPERADA, ...filas].join("\n");
  return new TextEncoder().encode(texto);
}

describe("compras/parse-agrochat.ts", () => {
  it("parsea una fila válida completa (trigo, exportador)", () => {
    const r = parseAgrochat(
      csv(["08/07/2026,trigo,exportador,25/26,150500,16238900,12319200,3919800,2488700,1431100"]),
      "test.csv",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({
      fecha: "2026-07-08",
      grano_raw: "trigo",
      codigo_interno: "WHEAT",
      campana: "2025/26",
      sector: "EXPORTACION",
      toneladas: 16238900,
      semanal_tn: 150500,
      fuente: "AGROCHAT",
    });
  });

  it("num(): un punto con grupos de 3 dígitos es separador de miles; un punto suelto es decimal (artefacto de float)", () => {
    const r = parseAgrochat(
      csv([
        "08/07/2026,soja,exportador,25/26,1.500,64099.99999999999,,,,",
        "15/07/2026,soja,exportador,25/26,2.500,12.345,,,,",
      ]),
      "test.csv",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0]!.toneladas).toBeCloseTo(64099.99999999999, 4); // punto decimal, NO separador de miles
    expect(r.filas[1]!.toneladas).toBe(12345); // "12.345" = grupo de 3 dígitos -> miles
  });

  it("fechaISO: acepta DD/MM/AAAA y también ISO AAAA-MM-DD (fallback — auditoría E4 #2)", () => {
    const r = parseAgrochat(
      csv(["2026-07-08,trigo,exportador,25/26,100,1000,,,,"]),
      "test.csv",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas[0]!.fecha).toBe("2026-07-08");
  });

  it("dedup por clave (campana, codigo_interno, sector, fecha): queda la primera aparición", () => {
    const r = parseAgrochat(
      csv([
        "08/07/2026,trigo,exportador,25/26,100,1000,,,,",
        "08/07/2026,trigo,exportador,25/26,999,9999,,,,",
      ]),
      "test.csv",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
    expect(r.duplicadas).toBe(1);
    expect(r.filas[0]!.toneladas).toBe(1000); // la primera, no la segunda
  });

  it("descarta filas con grano/sector no mapeable, sin tumbar el resto", () => {
    const r = parseAgrochat(
      csv([
        "08/07/2026,trigo,exportador,25/26,100,1000,,,,",
        "08/07/2026,grano-inventado,exportador,25/26,100,1000,,,,",
      ]),
      "test.csv",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
    expect(r.descartadas).toBe(1);
  });

  it("fila sin total_comprado_acumulado NI compras_semanales -> descartada (sin dato útil)", () => {
    const r = parseAgrochat(
      csv([
        "08/07/2026,trigo,exportador,25/26,150500,16238900,,,,", // válida
        "15/07/2026,trigo,exportador,25/26,,,,,,", // sin dato útil -> descartada
      ]),
      "test.csv",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas).toHaveLength(1);
    expect(r.descartadas).toBe(1);
  });

  it("archivo con UNA sola fila sin dato útil -> ok:false (0 filas válidas)", () => {
    const r = parseAgrochat(csv(["08/07/2026,trigo,exportador,25/26,,,,,,"]), "test.csv");
    expect(r.ok).toBe(false);
  });

  it("guard anti falso-verde: archivo con contenido pero ninguna fila parsea -> error, no silencio", () => {
    const filasMalas = Array.from({ length: 15 }, (_, i) => `fila-mala-${i},x,y,z,,,,,,,`);
    const r = parseAgrochat(csv(filasMalas), "test.csv");
    expect(r.ok).toBe(false);
  });

  it("archivo vacío -> error explícito", () => {
    const r = parseAgrochat(new Uint8Array(0), "test.csv");
    expect(r.ok).toBe(false);
  });

  it("cabecera sin las columnas mínimas -> error de formato", () => {
    const r = parseAgrochat(new TextEncoder().encode("a,b,c\n1,2,3"), "test.csv");
    expect(r.ok).toBe(false);
  });

  it("archivo más grande que MAX_BYTES -> error sin intentar parsear", () => {
    const grande = new Uint8Array(16 * 1024 * 1024);
    const r = parseAgrochat(grande, "test.csv");
    expect(r.ok).toBe(false);
  });

  describe("export CRUDO de Agrochat (Date/Country/Sector/Crop/Harvest, miles de tn, con 'Total')", () => {
    // Fixture real: fila de cebada cervecera exportador 24/25 del 01/07/2026 (verificado contra
    // el csv_content ya transformado por Agrochat el 27/07/2026). Trae el caso de punto flotante
    // 516.8*1000 = 516799,9999999994 en IEEE754 — Python trunca con `.astype(int)`, no redondea.
    const crudoTxt = [
      "Date,Country,Sector,Crop,Harvest,Semanal,Total Comprado,Total Precio Hecho,Total a Fijar,Total Fijado,Saldo a Fijar",
      "2026-07-01,Argentina,Compras de la industria,Cebada Cervecera,24/25,0.2,1372.7,690.5,682.2,681.9,0.3",
      "2026-07-01,Argentina,Compras sector exportador,Cebada Cervecera,24/25,0.0,1131.9,516.8,516.8,615.0,0.0",
      "2026-07-01,Argentina,Total,Cebada Cervecera,24/25,0.2,2504.6,1207.3,1199.0,1296.9,0.3",
    ].join("\n");

    it("filtra la fila 'Total', mapea sector/grano y convierte miles -> tn enteras (truncado, no redondeo)", () => {
      const r = parseAgrochat(new TextEncoder().encode(crudoTxt), "data_2.csv");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.totalCrudas).toBe(2); // "Total" descartada antes de contar
      expect(r.filas).toHaveLength(2);
      const exportador = r.filas.find((f) => f.sector === "EXPORTACION")!;
      expect(exportador).toMatchObject({
        fecha: "2026-07-01",
        grano_raw: "cebada cervecera",
        codigo_interno: "MALT",
        campana: "2024/25",
        sector: "EXPORTACION",
        toneladas: 1131900,
        precio_hecho_tn: 516799, // NO 516800: reproduce el truncado de Agrochat, no redondeo
        fijado_tn: 615000,
      });
      const industria = r.filas.find((f) => f.sector === "INDUSTRIA")!;
      expect(industria.toneladas).toBe(1372700);
      expect(r.advertencias[0]).toMatch(/export crudo de Agrochat/);
    });

    it("una fila con Sector no mapeable (ni Industria/Exportador/Total conocido) se descarta sin romper el resto", () => {
      const conSectorRaro = crudoTxt + "\n2026-07-01,Argentina,Otro sector raro,Cebada Cervecera,24/25,1.0,10.0,,,, ";
      const r = parseAgrochat(new TextEncoder().encode(conSectorRaro), "data_2.csv");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.filas).toHaveLength(2); // la fila rara no suma ni rompe nada
    });
  });
});
