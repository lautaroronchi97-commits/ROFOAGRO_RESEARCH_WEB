import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENFORCED } from "@/lib/auth/config";
import { updateSession } from "@/lib/auth/session";

/**
 * Proxy (en Next.js 16 el "middleware" se llama `proxy`, runtime Node.js). Gate de
 * autenticación optimista — corre antes del render en cada request. Ver docs/PLAN_LOGIN.md §3.3.
 *
 * Con `AUTH_ENFORCED` APAGADO hace passthrough inmediato: NO llama a Supabase ni
 * toca cookies → la web queda exactamente igual que hoy y las páginas de datos siguen
 * siendo estáticas/ISR. Solo con el flag prendido se activan el refresco de sesión y
 * los redirects.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  const esAdmin = path === "/admin" || path.startsWith("/admin/");

  // E5 #5: las rutas con auth PROPIA por token (las consumen las Routines de informes,
  // que fetchean sin cookies) no pasan por el gate de sesión — con el flag prendido el
  // redirect a /ingresar les llegaba ANTES de que su token corriera y mataba MP1/MP3.
  // `/informes/plantilla/` son las placas que screenshotea Playwright con un page.goto
  // pelado (sin sesión): validan el mismo INFORME_TOKEN por searchParam dentro de la
  // página, así que también tienen que saltear el gate. Sin esto la Routine diaria
  // se lleva el HTML de /ingresar en vez de la placa (27/07/2026).
  // `/api/health` (01/08/2026) es del mismo tipo: pensado para que un monitor externo
  // (UptimeRobot/similar) lo pegue sin sesión — mismo bug si queda atrás del gate.
  if (
    path.startsWith("/api/views/") ||
    path.startsWith("/api/informes/") ||
    path.startsWith("/informes/plantilla/") ||
    path === "/api/health"
  ) {
    return NextResponse.next();
  }

  // E5 #12c: el bodySizeLimit de server actions es GLOBAL (16 MB, por el uploader admin) →
  // acá se acota temprano todo POST público; solo /admin necesita bodies grandes.
  if (request.method === "POST" && !esAdmin) {
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > 2_000_000) return new NextResponse("Payload demasiado grande.", { status: 413 });
  }

  // El panel /admin está SIEMPRE protegido (aun con el flag global apagado); por eso
  // se refresca su sesión aunque `AUTH_ENFORCED` esté off. El resto del sitio solo
  // pasa por el gate cuando el flag está prendido → con el flag off queda estático/ISR.
  if (!AUTH_ENFORCED && !esAdmin) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // Corre en todo salvo estáticos, imágenes, favicon, robots, sitemap y los assets de
  // marca (logo/isotipo en /public): sirven a visitantes sin sesión (landing/login), así
  // que el gate NO debe redirigirlos cuando `AUTH_ENFORCED` esté prendido.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|rofoagro-logo.svg|rofoagro-isotipo.svg|robots.txt|sitemap.xml).*)",
  ],
};
