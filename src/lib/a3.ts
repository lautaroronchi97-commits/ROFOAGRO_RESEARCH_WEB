import "server-only";

/**
 * Cliente de la API de A3 / Cocos xOMS (Primary).
 * Las credenciales se leen de variables de entorno — NUNCA se hardcodean:
 *   A3_API_BASE, A3_USERNAME, A3_PASSWORD
 * (se cargan en .env.local local y en Vercel > Environment Variables).
 * Se usa para futuros de granos (segmento DDA) y dólar (DDF) cuando esté configurado.
 */

const BASE = process.env.A3_API_BASE ?? "https://api.cocos.xoms.com.ar";

export function a3Configured(): boolean {
  return Boolean(process.env.A3_USERNAME && process.env.A3_PASSWORD);
}

// El token dura 24h; lo cacheamos en memoria del server (~23h).
let cachedToken: { token: string; ts: number } | null = null;

/**
 * Fuerza a pedir un token nuevo en la próxima llamada a `getA3Token`. A3
 * invalida el token del lado del servidor si alguien vuelve a loguearse con
 * las mismas credenciales en otro lado (app/eTrader) — el WebSocket de
 * a3-live.ts no recibe ningún error explícito en ese caso, solo se queda sin
 * snapshots. Sin este invalidado manual, el caché (~23h) mantendría el token
 * muerto hasta su vencimiento natural aunque el problema de origen ya se haya
 * resuelto.
 */
export function invalidateA3Token(): void {
  cachedToken = null;
}

export async function getA3Token(): Promise<string | null> {
  if (!a3Configured()) return null;
  if (cachedToken && Date.now() - cachedToken.ts < 23 * 3600 * 1000) return cachedToken.token;
  try {
    const res = await fetch(`${BASE}/auth/getToken`, {
      method: "POST",
      headers: {
        "X-Username": process.env.A3_USERNAME as string,
        "X-Password": process.env.A3_PASSWORD as string,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const token = res.headers.get("X-Auth-Token");
    if (!token) return null;
    cachedToken = { token, ts: Date.now() };
    return token;
  } catch {
    return null;
  }
}

async function authFetch<T>(path: string, revalidate: number): Promise<T | null> {
  const token = await getA3Token();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Auth-Token": token },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Token revocado/expirado (A3 invalida el token al re-loguear en otro lado):
      // limpiamos el caché en memoria para forzar re-auth en la próxima llamada.
      if (res.status === 401 || res.status === 403) cachedToken = null;
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Lista de símbolos de un segmento: DDA (granos), DDF (dólar). */
export async function getA3InstrumentsBySegment(segment: "DDA" | "DDF"): Promise<string[]> {
  const json = await authFetch<{ instruments?: { symbol: string }[] }>(
    `/rest/instruments/bySegment?MarketSegmentID=${segment}&MarketID=ROFX`,
    3600,
  );
  return (json?.instruments ?? []).map((i) => i.symbol);
}
