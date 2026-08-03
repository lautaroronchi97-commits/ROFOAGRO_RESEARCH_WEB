import Link from "next/link";
import { PromptCamiones } from "../prompt-camiones";
import { UploaderCamiones } from "../uploader-camiones";

export default function CamionesPage() {
  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Camiones en puerto</h1>
        <p className="admin-sub">
          Subí el export de Williams Entregas (vía Agrochat) para actualizar{" "}
          <Link href="/comercio/camiones">Camiones en puerto</Link> — es SIEMPRE carga manual (Williams no
          tiene API pública). Un archivo por serie: el total sin filtrar, o un grano puntual (Agrochat no
          banca los 3 juntos por tamaño). Elegí la serie, previsualizá y confirmá.
        </p>
      </div>
      <PromptCamiones />
      <UploaderCamiones />
    </section>
  );
}
