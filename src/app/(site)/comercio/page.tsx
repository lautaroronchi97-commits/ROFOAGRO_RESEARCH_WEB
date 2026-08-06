import type { Metadata } from "next";
import Link from "next/link";
import { requireSeccion, getAcceso, itemVisible } from "@/lib/auth/dal";
import { authConfigured } from "@/lib/auth/env";
import { getPerfil } from "@/lib/auth/dal";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { PageHead } from "@/components/page-head";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Comercio exterior · ROFO AGRO",
  description: "Declaraciones juradas de venta al exterior (DJVE) de granos y subproductos.",
};

// Datos públicos (como la DJVE, decisión de Lautoro 22/07): visibles siempre, sin gate de admin.
const PUBLICO = [
  { href: "/comercio/djve", nombre: "DJVE", desc: "Declaraciones juradas de venta al exterior, por producto." },
  { href: "/comercio/camiones", nombre: "Camiones en puerto", desc: "Entrada diaria de camiones a puertos, fábricas y molinos, por zona y producto (Williams Entregas)." },
];

// Análisis de mesa (protegidos SIEMPRE, decisión 1 del plan de puertos): las tarjetas
// solo se muestran a admins; las páginas están gateadas con requireAdmin igual.
const ANALISIS = [
  { href: "/comercio/puertos", nombre: "Puertos · Line-up", desc: "Foto del line-up de buques: exportaciones por producto, zona y empresa." },
  { href: "/comercio/empresas", nombre: "Empresas exportadoras", desc: "Cobertura DJVE vs line-up por empresa: quién está corto, avance de campaña y ritmo." },
  { href: "/comercio/senal", nombre: "Señal física → precio", desc: "Semáforo que cruza la demanda física de exportación con la capacidad de pago." },
  { href: "/comercio/embarques", nombre: "Mesa de embarque", desc: "El programa de embarques declarado (DJVE) por mes y producto, en idioma A3." },
  { href: "/comercio/temperatura", nombre: "Calor de mercadería", desc: "Índice MESA: qué grano está caliente (diferir) y cuál pesado (vender ya), a percentil estacional." },
  { href: "/comercio/negociado", nombre: "Negociado por producto", desc: "Volumen negociado semanal/mensual (SIO Granos): % sobre cosecha, % priceado e histograma." },
];

export default async function ComercioPage() {
  await requireSeccion("comercio");
  // Guardado por authConfigured: sin auth configurada no lee cookies → la página sigue estática.
  const perfil = authConfigured() ? await getPerfil() : null;
  const esAdmin = perfil?.rol === "admin";
  // Permisos por ítem (06/08/2026): NO-OP con el flag apagado.
  const acceso = AUTH_ENFORCED ? await getAcceso() : null;
  const publico = PUBLICO.filter((a) => itemVisible(acceso, "comercio", a.href));

  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="DJVE · line-up · camiones" title="Comercio exterior" lede="Declaraciones de venta al exterior de granos y subproductos." />

          <nav className="hub-grid" aria-label="Datos públicos" style={{ marginBottom: 18 }}>
            {publico.map((a) => (
              <Link key={a.href} href={a.href} className="hub-card">
                <span className="hub-card-name">{a.nombre}</span>
                <span className="hub-card-desc">{a.desc}</span>
                <span className="hub-card-go" aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>

          {esAdmin && (
            <nav className="hub-grid" aria-label="Análisis de mesa" style={{ marginBottom: 18 }}>
              {ANALISIS.map((a) => (
                <Link key={a.href} href={a.href} className="hub-card">
                  <span className="hub-card-name">{a.nombre}</span>
                  <span className="hub-card-desc">{a.desc}</span>
                  <span className="hub-card-go" aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>
          )}
        </div>
      </main>
    </>
  );
}
