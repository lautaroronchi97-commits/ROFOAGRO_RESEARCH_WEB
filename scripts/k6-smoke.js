// Smoke test de k6 (C29/Fase 5, PRELAUNCH_CHECKLIST.md — opcional, NO forma parte de CI:
// el load testing formal quedó descartado para esta escala; esto es solo un chequeo manual
// de "¿el sitio responde bien bajo una carga chica?", para correr a mano cuando haga falta
// (antes de un pico de tráfico esperado, después de un cambio grande de infra, etc.).
//
// Requiere el binario de k6 (no es un script de Node): https://k6.io/docs/get-started/installation/
//
// Uso:
//   k6 run scripts/k6-smoke.js
//   k6 run -e BASE_URL=https://rofoagro.com.ar scripts/k6-smoke.js
//
// Objetivo (Informe 3 §7): 5 VUs × 1 min, p95 < 500ms, tasa de error < 1%. Solo pega a rutas
// PÚBLICAS de verdad (`src/lib/auth/config.ts` RUTAS_PUBLICAS + /api/health) — con
// AUTH_ENFORCED prendido en producción, el resto del sitio redirige (307) a /ingresar sin
// sesión, así que no tiene sentido medirlas acá.

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const RUTAS_PUBLICAS = [
  "/", // sin sesión, con el flag prendido redirige a /bienvenida (200 final)
  "/bienvenida",
  "/ingresar",
  "/registro",
  "/privacidad",
  "/terminos",
  "/api/health",
  "/opengraph-image",
];

export default function smoke() {
  const ruta = RUTAS_PUBLICAS[Math.floor(Math.random() * RUTAS_PUBLICAS.length)];
  const res = http.get(`${BASE_URL}${ruta}`);
  check(res, {
    "status 200": (r) => r.status === 200,
  });
  sleep(1);
}
