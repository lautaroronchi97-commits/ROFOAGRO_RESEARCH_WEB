"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const emptySubscribe = () => () => {};

/** Botón claro ⇄ oscuro. La etiqueta nombra la acción (a qué modo pasa el click). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true recién en el cliente (evita mismatch de hidratación sin setState-en-effect)
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      className="toggle"
      type="button"
      aria-pressed={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="ic" aria-hidden="true" />
      <span className="lbl">{isDark ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
