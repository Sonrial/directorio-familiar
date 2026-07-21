"use client";

import { FormEvent, useState } from "react";
import { BookUser, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

export function LoginScreen() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No fue posible iniciar sesión");
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-lockup brand-lockup-large">
          <span className="brand-mark"><BookUser aria-hidden="true" /></span>
          <span><strong>DIRECTORIO</strong><small>Familiar &amp; seguro</small></span>
        </div>
        <div className="login-message">
          <span className="eyebrow"><ShieldCheck size={16} /> Bóveda privada</span>
          <h1>La libreta de siempre, disponible para toda la familia.</h1>
          <p>Personas, empresas, direcciones y accesos importantes organizados en un solo lugar.</p>
        </div>
        <div className="security-note"><LockKeyhole size={18} /><span>Datos cifrados y acceso limitado a cuatro cuentas familiares.</span></div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand"><BookUser size={22} /><strong>Directorio Familiar</strong></div>
          <span className="eyebrow gold">ACCESO PRIVADO</span>
          <h2>Bienvenido</h2>
          <p>Ingresa con el correo familiar autorizado.</p>
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" required placeholder="nombre@gmail.com" /></label>
          <label>Contraseña<span className="password-field"><input name="password" type={show ? "text" : "password"} autoComplete="current-password" required placeholder="Tu contraseña" /><button type="button" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button login-button" disabled={loading}>{loading ? "Verificando…" : "Ingresar al directorio"}</button>
          <small className="privacy-copy">Si no reconoces este sitio, no ingreses ninguna información.</small>
        </form>
      </section>
    </main>
  );
}

