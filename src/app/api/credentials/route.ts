import { randomUUID } from "node:crypto";
import { audit, requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { credentialSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const parsed = credentialSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");
    const data = parsed.data;
    const encrypted = encryptSecret(data.secret);
    const id = randomUUID();
    await getDb()`
      INSERT INTO credentials (id, contact_id, platform, username, secret_ciphertext,
        secret_iv, secret_tag, url, notes, created_by, updated_by)
      VALUES (${id}, ${data.contact_id || null}, ${data.platform}, ${data.username || null},
        ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.tag}, ${data.url || null},
        ${data.notes || null}, ${user.id}, ${user.id})
    `;
    await audit(user.id, "credential.create", "credential", id, { platform: data.platform });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

