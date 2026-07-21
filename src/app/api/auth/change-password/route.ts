import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { audit, requireUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { passwordSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser({ allowPasswordChange: true });
    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Contraseña inválida");
    }
    const sql = getDb();
    const rows = (await sql`SELECT password_hash FROM users WHERE id = ${user.id}`) as {
      password_hash: string;
    }[];
    if (!rows[0] || !(await bcrypt.compare(parsed.data.currentPassword, rows[0].password_hash))) {
      throw new HttpError(400, "La contraseña actual no es correcta");
    }
    if (await bcrypt.compare(parsed.data.newPassword, rows[0].password_hash)) {
      throw new HttpError(400, "La nueva contraseña debe ser diferente");
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await sql`
      UPDATE users SET password_hash = ${hash}, must_change_password = false,
        updated_at = now() WHERE id = ${user.id}
    `;
    const currentToken = (await cookies()).get(SESSION_COOKIE)?.value;
    if (currentToken) {
      await sql`DELETE FROM sessions WHERE user_id = ${user.id} AND token_hash <> ${sha256(currentToken)}`;
    }
    await audit(user.id, "password.change", "user", user.id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
