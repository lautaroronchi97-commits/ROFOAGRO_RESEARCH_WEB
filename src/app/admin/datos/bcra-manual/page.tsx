import { BcraManual } from "../bcra-manual";
import { getBcraManualData } from "../data";

export default async function BcraManualPage() {
  const { fechaDefault, recientes, faltantes } = await getBcraManualData();

  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Compras BCRA (MULC) — carga manual</h1>
        <p className="admin-sub">
          Tapa el rezago de la API oficial (~3-4 días hábiles) para cualquier fecha reciente.
        </p>
      </div>
      <BcraManual fechaDefault={fechaDefault} recientes={recientes} faltantes={faltantes} />
    </section>
  );
}
