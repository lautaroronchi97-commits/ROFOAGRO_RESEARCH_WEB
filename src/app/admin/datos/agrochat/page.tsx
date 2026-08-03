import Link from "next/link";
import { PromptAgrochat } from "../prompt-agrochat";
import { Uploader } from "../uploader";

export default function AgrochatPage() {
  return (
    <section>
      <div className="admin-hd">
        <h1 className="admin-h1" style={{ fontSize: "1.3rem" }}>Comercialización (Agrochat)</h1>
        <p className="admin-sub">
          Subí el export semanal de Agrochat (compras por grano, sector y campaña, en toneladas) para
          actualizar la serie que alimenta <Link href="/comercio/negociado">Negociado por producto</Link> y
          el índice de <Link href="/comercio/temperatura">Calor de mercadería</Link>. Primero previsualizá
          (no escribe nada), después confirmá la carga.
        </p>
      </div>
      <PromptAgrochat />
      <Uploader />
    </section>
  );
}
