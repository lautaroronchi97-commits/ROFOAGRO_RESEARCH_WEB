import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RefreshOnFocus } from "@/components/refresh-on-focus";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SeccionBeacon } from "@/components/seccion-beacon";
import { Watermark } from "@/components/watermark";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/sidebar-provider";
import { BIBLIOTECA, BIBLIOTECA_ADMIN } from "@/lib/biblioteca";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { requireAprobado, getAcceso } from "@/lib/auth/dal";

/**
 * Layout compartido del sitio (C25 — biblioteca + sidebar): masthead mínimo + shell de
 * dos columnas (sidebar fija en desktop, drawer en mobile) + el resto del andamiaje
 * común (footer, marca de agua, beacon). Es un layout anidado (hay un root
 * `app/layout.tsx` con <html>/<body>), así que navegar entre secciones NO recarga la
 * página.
 *
 * OJO — la cinta NO se sumó acá a propósito, aunque el árbol del plan la nombra junto
 * al masthead: medido con un build real, meter `getCintaData()` en el layout compartido
 * arrastraba a TODAS las páginas (incluidas las de mesa que hoy son 100% estáticas, sin
 * ISR — `/comercio/puertos`, `/granos/view`, etc.) a revalidar cada ~30-60s, violando la
 * guarda dura "con el flag apagado, cero cambios de render, solo de navegación". La
 * cinta se queda donde ya estaba (dentro de `(site)/page.tsx`, la home) — la sidebar
 * cubre la navegación, que era el pedido real.
 *
 * Gate de auth (defensa en profundidad además del proxy): SOLO cuando AUTH_ENFORCED
 * está prendido exige un usuario aprobado (chequeo seguro contra la base) y calcula
 * las secciones visibles + si es admin, para filtrar la sidebar. El enforcement
 * autoritativo POR sección vive en cada página (requireSeccion), porque los layouts
 * no re-renderizan al navegar. Con el flag apagado NO se lee la sesión (ni acá ni en
 * la sidebar) — estas páginas siguen siendo estáticas/ISR, la sidebar simplemente
 * muestra los 8 grupos completos (mismo criterio que la nav de siempre).
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let visibles: string[] | undefined;
  let esAdmin = false;
  let email: string | null = null;

  if (AUTH_ENFORCED) {
    const perfil = await requireAprobado();
    email = perfil.email;
    const acceso = await getAcceso();
    visibles = acceso?.visibles;
    esAdmin = acceso?.esAdmin ?? false;
  }

  const grupos = visibles ? BIBLIOTECA.filter((g) => visibles.includes(g.key)) : BIBLIOTECA;

  return (
    <SidebarProvider>
      <RefreshOnFocus />
      <SiteHeader />
      <div className="site-shell">
        <Sidebar grupos={grupos} esAdmin={esAdmin} adminItems={BIBLIOTECA_ADMIN.items} />
        <div className="site-main">
          <Breadcrumbs />
          {children}
        </div>
      </div>
      <div className="awn" aria-hidden="true" />
      <SiteFooter />
      {/* Marca de agua sutil ("ROFO AGRO · email"): solo con login activo y solo para
          clientes — los admins no la ven (relevamiento 29/07, punto 14). */}
      {AUTH_ENFORCED && email && !esAdmin && <Watermark email={email} />}
      {/* Registro de visita por sección: solo con login activo (beacon liviano). */}
      {AUTH_ENFORCED && <SeccionBeacon />}
    </SidebarProvider>
  );
}
