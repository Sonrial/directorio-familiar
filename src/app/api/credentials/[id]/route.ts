import { audit, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertSameOrigin, errorResponse } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

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

