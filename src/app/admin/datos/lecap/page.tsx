import { LecapUploader } from "../lecap-uploader";
import { getLecapActuales } from "../data";

export default async function LecapPage() {
  const lecapActuales = await getLecapActuales();

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Pago final de letras (sintéticos)</h1>
        <p className="admin-sub">
          Cargá el pago final (importe al vencimiento) de cada LECAP/BONCAP para el panel{" "}
          <code>/dolar</code> (Sintéticos). Es un dato casi estático: solo se actualiza cuando el Tesoro
          emite letras nuevas.
        </p>
      </div>
      <LecapUploader actuales={lecapActuales} />
    </section>
  );
}
