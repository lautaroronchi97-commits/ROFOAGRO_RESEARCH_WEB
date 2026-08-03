import { DatosDia } from "../datos-dia";
import { getDiasColor } from "../data";

export default async function MesaColorPage() {
  const { fechaHoy, dias } = await getDiasColor();

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Datos del día (color de la rueda)</h1>
        <p className="admin-sub">
          Lo que viste hoy en la rueda (negocios, sensaciones, precios que te pasaron). Alimenta el
          informe diario.
        </p>
      </div>
      <DatosDia fechaHoy={fechaHoy} dias={dias} />
    </section>
  );
}
