import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Edge Functions de Supabase: código Deno (jsr:/https imports, globals de Deno),
    // no del proyecto Next → fuera del lint/typecheck de la web.
    "supabase/functions/**",
    // Backups de código dado de baja (ver README dentro de cada carpeta): rutas de
    // import rotas a propósito (los módulos originales se movieron), no forman
    // parte del build → fuera del lint/typecheck de la web.
    "docs/backup/**",
  ]),
]);

export default eslintConfig;
