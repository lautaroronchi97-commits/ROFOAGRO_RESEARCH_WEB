import { hoyCordobaISO } from "@/lib/dates";
import { PasUploader } from "../pas-uploader";

export default function PasPage() {
  const fechaHoy = hoyCordobaISO();

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Estimaciones BCBA-PAS</h1>
        <p className="admin-sub">
          La fuente automática está bloqueada por Cloudflare — bajá{" "}
          <code>historico_pas_datasets.csv</code> de bolsadecereales.com/estimaciones-agricolas y subilo acá.
        </p>
      </div>
      <PasUploader hoy={fechaHoy} />
    </section>
  );
}
