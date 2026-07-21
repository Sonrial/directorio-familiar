import { describe, expect, it } from "vitest";
import { assertSameOrigin, HttpError, normalizeMethod } from "./security";

describe("controles HTTP", () => {
  it("bloquea solicitudes de otro origen", () => {
    const request = new Request("https://directorio.test/api/contacts", {
      headers: { origin: "https://sitio-malicioso.test" },
    });
    expect(() => assertSameOrigin(request)).toThrow(HttpError);
  });

  it("acepta el mismo origen", () => {
    const request = new Request("https://directorio.test/api/contacts", {
      headers: { origin: "https://directorio.test" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("normaliza correos y teléfonos", () => {
    expect(normalizeMethod("email", "  Persona@Ejemplo.COM ")).toBe("persona@ejemplo.com");
    expect(normalizeMethod("mobile", "+57 (310) 555-6677")).toBe("+573105556677");
  });
});
