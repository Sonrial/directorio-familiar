import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/security";

export async function GET() {
  try {
    const user = await requireUser();
    const sql = getDb();
    const [categories, users, audit] = await Promise.all([
      sql`SELECT id, name, color FROM categories ORDER BY name`,
      sql`SELECT id, email, name, role, active, last_login_at
          FROM users ORDER BY role, name`,
      user.role === "admin"
        ? sql`SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata,
            a.created_at, u.name AS user_name
            FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id
            ORDER BY a.created_at DESC LIMIT 30`
        : Promise.resolve([]),
    ]);
    return Response.json({ categories, users, audit });
  } catch (error) {
    return errorResponse(error);
  }
}

