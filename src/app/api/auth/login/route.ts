import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/security";

type LoginUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  active: boolean;
  must_change_password: boolean;
  failed_login_count: number;
  locked_until: string | null;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, "Correo o contraseña inválidos");
    const { email, password } = parsed.data;
    const sql = getDb();
    const rows = (await sql`
      SELECT id, email, name, password_hash, active, must_change_password,
             failed_login_count, locked_until
      FROM users WHERE email = ${email} LIMIT 1
    `) as LoginUser[];
    const user = rows[0];
    if (!user) {
      await bcrypt.hash(password, 12);
      throw new HttpError(401, "Correo o contraseña inválidos");
    }
    if (!user.active) throw new HttpError(401, "Correo o contraseña inválidos");
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new HttpError(429, "Demasiados intentos. Intenta nuevamente en 15 minutos");
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = user.failed_login_count + 1;
      await sql`
        UPDATE users
        SET failed_login_count = ${attempts},
            locked_until = CASE WHEN ${attempts} >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
            updated_at = now()
        WHERE id = ${user.id}
      `;
      throw new HttpError(401, "Correo o contraseña inválidos");
    }
    await sql`
      UPDATE users SET failed_login_count = 0, locked_until = NULL,
        last_login_at = now(), updated_at = now() WHERE id = ${user.id}
    `;
    await createSession(user.id, request);
    return Response.json({
      user: { id: user.id, email: user.email, name: user.name },
      mustChangePassword: user.must_change_password,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

