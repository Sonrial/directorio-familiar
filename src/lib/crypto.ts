import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";

const AAD = Buffer.from("directorio-familiar:v1", "utf8");

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function vaultKey() {
  const encoded = process.env.VAULT_ENCRYPTION_KEY;
  if (!encoded) throw new Error("VAULT_ENCRYPTION_KEY no está configurada");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("VAULT_ENCRYPTION_KEY debe tener 32 bytes");
  return key;
}

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    vaultKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function encryptBackup(payload: unknown, passphrase: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("directorio-backup:v1", "utf8"));
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return JSON.stringify({
    format: "directorio-familiar-backup",
    version: 1,
    kdf: "scrypt",
    cipher: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
}

