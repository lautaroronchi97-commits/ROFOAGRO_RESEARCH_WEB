import { hoyCordobaISO } from "@/lib/dates";
import { DeaUploader } from "../dea-uploader";

export default function DeaPage() {
  const fechaHoy = hoyCordobaISO();

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Estimaciones DEA-SAGyP</h1>
        <p className="admin-sub">
          La fuente automática está bloqueada por IP — bajá el CSV oficial de{" "}
          <code>datosestimaciones.magyp.gob.ar</code> desde tu navegador y subilo acá.
        </p>
      </div>
      <DeaUploader hoy={fechaHoy} />
    </section>
  );
}
