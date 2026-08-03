import { requireAdmin } from "@/lib/auth/dal";
import { DatosNav } from "./datos-nav";

/**
 * Layout de /admin/datos: 9 páginas propias, una por carga manual (ver `secciones.ts`),
 * más el índice. Antes era un solo page.tsx larguísimo con todas las cargas mezcladas por
 * anclas — separadas acá, con `DatosNav` como sub-pestañas para moverse entre ellas.
 * requireAdmin() de nuevo acá (además del layout de /admin), como el resto de las páginas
 * hermanas.
 */
export default async function DatosLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div>
      <DatosNav />
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}
