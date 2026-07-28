import type { Metadata } from "next";
import { NoticiasPanel } from "@/components/noticias-panel";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Noticias · ROFO AGRO",
  description: "Portal de noticias del agro: granos, dólar, clima, exportaciones e informes.",
};

export default async function NoticiasPage() {
  await requireSeccion("noticias");
  return (
    <>
      <main className="wrap">
        <div className="col">
          <PageHead kicker="Portal del agro · 30 fuentes" title="Noticias" />
          <NoticiasPanel />
        </div>
      </main>
    </>
  );
}
