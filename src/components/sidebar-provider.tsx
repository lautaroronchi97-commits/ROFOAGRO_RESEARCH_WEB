"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type SidebarShell = { open: boolean; toggle: () => void; close: () => void };

const Ctx = createContext<SidebarShell | null>(null);

/**
 * Contexto del drawer mobile de la sidebar (C25). Envuelve todo el shell del sitio
 * (`(site)/layout.tsx`) para que el botón hamburguesa del masthead (server component,
 * renderiza `<SidebarToggle/>` client como hijo) y el panel de la sidebar (otro client
 * component, hermano) compartan el mismo estado sin acoplarse entre sí.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cerrar el drawer al navegar: patrón "ajustar estado cuando cambia una prop"
  // (react.dev/learn/you-might-not-need-an-effect) en vez de un efecto — evita el
  // render extra de un useEffect([pathname]) que llama setState directo.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Bloquear el scroll del body mientras el drawer está abierto (mobile).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  return <Ctx.Provider value={{ open, toggle, close }}>{children}</Ctx.Provider>;
}

export function useSidebarShell(): SidebarShell {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebarShell debe usarse dentro de <SidebarProvider>");
  return ctx;
}
