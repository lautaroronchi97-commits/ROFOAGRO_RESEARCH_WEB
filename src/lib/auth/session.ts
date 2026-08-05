import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, authConfigured } from "./env";
import { AUTH_ENFORCED, esRutaPublica } from "./config";
import { sessionIdDeToken, deviceDeUA } from "./session-id";

/**
 * Refresco de sesión + gate optimista para `proxy.ts` (corre antes del render en
 * cada request, incluso en las RSC de navegación cliente). Ver docs/PLAN_LOGIN.md §3.3/§3.4.
 *
 * - Refresca los tokens de Supabase y los reescribe en la respuesta (imprescindible
 *   para que la sesión SSR no se caiga sola).
 * - Chequeo OPTIMISTA (solo presencia de sesión, sin tocar `profiles`): si el flag
 *   está prendido y un usuario sin sesión pide una ruta protegida → redirect a /ingresar.
 *   La verificación autoritativa (estado aprobado + permisos por sección) vive en el
 *   layout/DAL (chequeo seguro contra la base), no acá.
 * - SESIÓN ÚNICA (Etapa 3): con el flag prendido, en cada request se compara el
 *   `session_id` del cookie contra la sesión vigente (`tocar_sesion`). Si otro
 *   dispositivo tomó la cuenta → 'kicked'; 7 días sin uso → 'expired' → se cierra la
 *   sesión LOCAL (sin revocar la del otro dispositivo) y se manda a /sesion-cerrada.
 * - ENTRADA (05/08/2026): con el flag prendido, un visitante sin sesión que pide la
 *   raíz cae directo en `/ingresar` (ruta protegida genérica, sin caso especial) — la
 *   landing institucional `/bienvenida` queda fuera del flujo de entrada, pero sigue
 *   viva y pública para linkearla aparte (footer, `docs/marca`, etc.).
 *
 * Con `AUTH_ENFORCED` apagado esta función NO se ejecuta para el sitio (el proxy hace
 * passthrough); solo corre en `/admin` para refrescar la sesión del admin.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!authConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE: no meter lógica entre createServerClient y getUser (recomendación de
  // @supabase/ssr para no desincronizar el refresco de tokens).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    // Falla de red/Supabase: degradar a "sin sesión" en vez de tumbar el proxy.
    return response;
  }

  const path = request.nextUrl.pathname;
  const esAdmin = path === "/admin" || path.startsWith("/admin/");

  // /admin: exige sesión SIEMPRE (aun con el flag global apagado). El chequeo
  // autoritativo de rol admin vive en el layout de /admin (requireAdmin); acá solo
  // el gate optimista de "sin sesión → a ingresar".
  if (esAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  if (!AUTH_ENFORCED) return response;

  // Sesión única + timeout de 7 días: solo cuando hay usuario logueado.
  if (user) {
    const kick = await chequearSesionUnica(request, supabase, user.id);
    if (kick) {
      const url = request.nextUrl.clone();
      url.pathname = "/sesion-cerrada";
      url.search = kick === "expired" ? "?motivo=expirada" : "";
      const redir = NextResponse.redirect(url);
      // Trasladar al redirect las cookies que `signOut` dejó limpias en `response`.
      for (const c of response.cookies.getAll()) redir.cookies.set(c);
      return redir;
    }
  }

  // Usuario sin sesión pidiendo una ruta protegida → a la pantalla de ingreso.
  if (!user && !esRutaPublica(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = path && path !== "/" ? `?next=${encodeURIComponent(path)}` : "";
    return NextResponse.redirect(url);
  }

  // Usuario con sesión que cae en las pantallas de ingreso/registro/landing → a la home.
  if (user && (path === "/ingresar" || path === "/registro" || path === "/bienvenida")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Chequeo de sesión única (Etapa 3). Devuelve `"kicked"` / `"expired"` si esta
 * sesión ya no es la vigente (y en ese caso cierra la sesión LOCAL, sin revocar la
 * del otro dispositivo), o `null` si sigue siendo válida. El `session_id` sale del
 * JWT decodificado localmente (es estable entre refrescos de token).
 */
async function chequearSesionUnica(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<"kicked" | "expired" | null> {
  let sid: string | null = null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    sid = sessionIdDeToken(session?.access_token);
  } catch {
    return null; // Falla de red/Supabase: no kickear por un problema transitorio.
  }
  if (!sid) return null;

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const ua = request.headers.get("user-agent");

  let estado: string | null = null;
  try {
    const { data } = await supabase.rpc("tocar_sesion", {
      p_session_id: sid,
      p_device: deviceDeUA(ua),
      p_ip: ip,
    });
    estado = data;
  } catch {
    return null; // Falla de red/Supabase: no kickear por un problema transitorio.
  }

  if (estado !== "kicked" && estado !== "expired") return null;

  // Auditar el kickeo mientras todavía hay sesión (RLS: user_id = auth.uid()).
  if (estado === "kicked") {
    try {
      await supabase.from("access_log").insert({
        user_id: userId,
        evento: "kickeado",
        ip,
        user_agent: ua,
      });
    } catch {
      // La auditoría no debe impedir el cierre de la sesión.
    }
  }

  // Cierre LOCAL: limpia las cookies de este dispositivo sin tocar la sesión que
  // legítimamente tomó la cuenta en el otro dispositivo.
  await supabase.auth.signOut({ scope: "local" });
  return estado;
}
