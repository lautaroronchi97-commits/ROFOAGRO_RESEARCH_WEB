"use client";

import { useActionState } from "react";
import { enviarConsultaAction } from "@/app/bienvenida/actions";
import type { FormState } from "@/app/auth/actions";

/**
 * Formulario de contacto de la landing. Usa el mismo patrón de server action +
 * useActionState que el registro. Al enviarse con éxito reemplaza el form por un
 * acuse (sin prometer que "te contactamos"). Campos: nombre · email · teléfono ·
 * empresa/campo · mensaje, + honeypot oculto anti-spam.
 */
export function ContactoForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    enviarConsultaAction,
    undefined,
  );

  if (state?.ok) {
    return (
      <div className="lp-form-ok" role="status">
        <span className="lp-form-ok-check" aria-hidden="true">✓</span>
        <p className="lp-form-ok-title">{state.ok}</p>
        <p className="lp-form-ok-sub">Tu consulta quedó registrada.</p>
      </div>
    );
  }

  return (
    <form action={action} className="auth-form lp-form">
      <div className="lp-form-row">
        <label className="auth-field">
          <span>Nombre y apellido</span>
          <input className="auth-input" type="text" name="nombre" autoComplete="name" required />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input className="auth-input" type="email" name="email" autoComplete="email" required />
        </label>
      </div>
      <div className="lp-form-row">
        <label className="auth-field">
          <span>Teléfono</span>
          <input className="auth-input" type="tel" name="telefono" autoComplete="tel" />
        </label>
        <label className="auth-field">
          <span>Empresa / campo</span>
          <input className="auth-input" type="text" name="empresa" autoComplete="organization" />
        </label>
      </div>
      <label className="auth-field">
        <span>Mensaje</span>
        <textarea
          className="auth-input lp-textarea"
          name="mensaje"
          rows={4}
          placeholder="Contanos de tu empresa y qué querés lograr."
          required
        />
      </label>

      {/* honeypot: oculto para humanos, tentador para bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="lp-honeypot"
      />

      {state?.error && (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
        {pending ? "Enviando…" : "Enviar consulta"}
      </button>
    </form>
  );
}
