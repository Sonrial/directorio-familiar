import { describe, expect, it } from "vitest";
import { credentialSchema, credentialUpdateSchema } from "./schemas";

const credentialFields = {
  platform: "DIAN",
  username: "contador@example.com",
  url: "https://www.dian.gov.co",
  notes: "Cuenta principal",
};

describe("credential schemas", () => {
  it("requires a password when creating a credential", () => {
    expect(credentialSchema.safeParse(credentialFields).success).toBe(false);
  });

  it("allows editing metadata without replacing the password", () => {
    expect(credentialUpdateSchema.safeParse(credentialFields).success).toBe(true);
  });

  it("accepts a new password when rotating a credential", () => {
    expect(credentialUpdateSchema.safeParse({ ...credentialFields, secret: "Nueva-clave-123!" }).success).toBe(true);
  });
});
