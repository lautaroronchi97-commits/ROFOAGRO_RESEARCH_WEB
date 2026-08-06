import type { Metadata } from "next";
import { MonitorMercados } from "@/components/monitor-mercados";
import { requireSeccion } from "@/lib/auth/dal";
import { PageHead } from "@/components/page-head";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Monitor de mercados · Granos · ROFO AGRO",
  description: "Soja, aceite y harina de soja, maíz y trigo de Chicago en USD/tn, más referencias macro.",
};

export default async function MonitorPage() {
  await requireSeccion("granos", "/granos/monitor");
  return (
    <main className="wrap">
      <div className="col">
        <PageHead kicker="Chicago · macro" title="Monitor de mercados" lede="Chicago en USD/tn y referencias macro (petróleo, oro, dólar) del día." />
        <MonitorMercados />
      </div>
    </main>
  );
}
