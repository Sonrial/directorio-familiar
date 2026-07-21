import { audit, requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const rows = (await getDb()`
      SELECT secret_ciphertext, secret_iv, secret_tag, platform
      FROM credentials WHERE id=${id} LIMIT 1
    `) as { secret_ciphertext: string; secret_iv: string; secret_tag: string; platform: string }[];
    if (!rows[0]) throw new HttpError(404, "Credencial no encontrada");
    const value = decryptSecret({
      ciphertext: rows[0].secret_ciphertext,
      iv: rows[0].secret_iv,
      tag: rows[0].secret_tag,
    });
    await audit(user.id, "credential.reveal", "credential", id, { platform: rows[0].platform });
    return Response.json({ secret: value });
  } catch (error) {
    return errorResponse(error);
  }
}

