import { audit, requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { credentialUpdateSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = credentialUpdateSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");

    const data = parsed.data;
    const sql = getDb();
    let rows: { id: string }[];

    if (data.secret) {
      const encrypted = encryptSecret(data.secret);
      rows = (await sql`
        UPDATE credentials SET platform=${data.platform}, username=${data.username || null},
          secret_ciphertext=${encrypted.ciphertext}, secret_iv=${encrypted.iv},
          secret_tag=${encrypted.tag}, url=${data.url || null}, notes=${data.notes || null},
          updated_by=${user.id}, last_rotated_at=now(), updated_at=now()
        WHERE id=${id} RETURNING id
      `) as { id: string }[];
    } else {
      rows = (await sql`
        UPDATE credentials SET platform=${data.platform}, username=${data.username || null},
          url=${data.url || null}, notes=${data.notes || null},
          updated_by=${user.id}, updated_at=now()
        WHERE id=${id} RETURNING id
      `) as { id: string }[];
    }

    if (!rows[0]) throw new HttpError(404, "Credencial no encontrada");
    await audit(user.id, "credential.update", "credential", id, {
      platform: data.platform,
      passwordChanged: Boolean(data.secret),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const rows = (await getDb()`DELETE FROM credentials WHERE id=${id} RETURNING platform`) as {
      platform: string;
    }[];
    await audit(user.id, "credential.delete", "credential", id, {
      platform: rows[0]?.platform ?? "",
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

