import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, sha256 } from "./crypto";

describe("bóveda de credenciales", () => {
  beforeEach(() => {
    process.env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("cifra y descifra sin almacenar el texto original", () => {
    const encrypted = encryptSecret("Clave-Muy-Secreta-123!");
    expect(encrypted.ciphertext).not.toContain("Clave-Muy-Secreta");
    expect(decryptSecret(encrypted)).toBe("Clave-Muy-Secreta-123!");
  });

  it("rechaza contenido manipulado", () => {
    const encrypted = encryptSecret("secreto");
    encrypted.tag = Buffer.alloc(16, 0).toString("base64");
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("genera hashes deterministas", () => {
    expect(sha256("sesión")).toHaveLength(64);
    expect(sha256("sesión")).toBe(sha256("sesión"));
  });
});
