import { PasZonasUploader } from "../pas-zonas-uploader";

export default function PasZonasPage() {
  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>BCBA-PAS por zona agroecológica</h1>
        <p className="admin-sub">
          Bajá <code>reporte_1.xlsx</code> (zonas) de bolsadecereales.com/estimaciones-agricolas y subilo
          acá. Alimenta <code>/produccion/zonas</code>.
        </p>
      </div>
      <PasZonasUploader />
    </section>
  );
}
