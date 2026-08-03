import { PasCondicionUploader } from "../pas-condicion-uploader";

export default function PasCondicionPage() {
  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Condición de cultivos BCBA-PAS</h1>
        <p className="admin-sub">
          Un archivo por cultivo (girasol/soja/maíz/trigo) de bolsadecereales.com/estimaciones-agricolas.
          Alimenta <code>/produccion/condicion</code>.
        </p>
      </div>
      <PasCondicionUploader />
    </section>
  );
}
