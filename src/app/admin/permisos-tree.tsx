"use client";

import { useState } from "react";
import type { GrupoPermiso } from "@/lib/biblioteca";

/**
 * Árbol de permisos por sección + ítem (pedido de Lautaro 06/08/2026): cada sección es
 * un checkbox de siempre (`name="secciones"`, igual que antes) y, si tiene ítems
 * configurables (dedupeados por ruta — `biblioteca.itemsConfigurables`, más de 1 real),
 * se abre una sub-lista de checkboxes (`name="items__<seccionKey>"`) para elegir cuáles
 * ve la empresa/usuario. Tildar TODOS los ítems de una sección es equivalente a no
 * restringir nada — `normalizarItems()` (server) lo normaliza así al guardar.
 *
 * Controlado a propósito (no `defaultChecked`): al apagar una sección, sus ítems quedan
 * deshabilitados PERO conservan el estado tildado en memoria (así reactivarla no pierde
 * lo que ya estaba elegido). Secciones con 0 o 1 ítem configurable (Gráficos, Informes,
 * Noticias) no muestran sub-lista: no hay nada que gatear aparte del todo/nada de hoy.
 */
export function PermisosTree({
  grupos,
  seccionesActivas,
  itemsRestringidos,
  disabled,
}: {
  grupos: GrupoPermiso[];
  seccionesActivas: Set<string>;
  itemsRestringidos: Record<string, string[]>;
  /** Deshabilita el árbol entero (ej. mientras "usar permisos individuales" está apagado). */
  disabled?: boolean;
}) {
  const [activas, setActivas] = useState(seccionesActivas);
  const [items, setItems] = useState<Record<string, Set<string>>>(() => {
    const out: Record<string, Set<string>> = {};
    for (const g of grupos) {
      out[g.key] = new Set(itemsRestringidos[g.key] ?? g.items.map((it) => it.href));
    }
    return out;
  });

  function toggleSeccion(key: string, checked: boolean) {
    setActivas((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleItem(key: string, href: string, checked: boolean) {
    setItems((prev) => {
      const set = new Set(prev[key]);
      if (checked) set.add(href);
      else set.delete(href);
      return { ...prev, [key]: set };
    });
  }

  return (
    <fieldset className="admin-secciones-fs">
      <legend>Secciones y reportes habilitados</legend>
      <div className="admin-permisos">
        {grupos.map((g) => {
          const on = activas.has(g.key);
          const itemsSet = items[g.key] ?? new Set<string>();
          const mostrarItems = g.items.length > 1;
          return (
            <div key={g.key} className="admin-permiso-grupo">
              <label className="admin-check admin-check-strong">
                <input
                  type="checkbox"
                  name="secciones"
                  value={g.key}
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => toggleSeccion(g.key, e.target.checked)}
                />
                <span>{g.label}</span>
              </label>
              {mostrarItems && (
                <div className={`admin-permiso-items ${on && !disabled ? "" : "is-disabled"}`}>
                  {g.items.map((it) => (
                    <label key={it.href} className="admin-check admin-check-sub">
                      <input
                        type="checkbox"
                        name={`items__${g.key}`}
                        value={it.href}
                        checked={itemsSet.has(it.href)}
                        disabled={disabled || !on}
                        onChange={(e) => toggleItem(g.key, it.href, e.target.checked)}
                      />
                      <span>{it.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
