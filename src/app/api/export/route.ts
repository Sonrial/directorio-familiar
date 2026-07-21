import bcrypt from "bcryptjs";
import { stringify } from "csv-stringify/sync";
import { audit, requireUser } from "@/lib/auth";
import { decryptSecret, encryptBackup } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/security";

export async function GET() {
  try {
    const user = await requireUser();
    const sql = getDb();
    const rows = (await sql`
      SELECT c.*,
        COALESCE((SELECT string_agg(m.value, ' | ' ORDER BY m.is_primary DESC)
          FROM contact_methods m WHERE m.contact_id=c.id AND m.type='phone'), '') AS telefonos,
        COALESCE((SELECT string_agg(m.value, ' | ' ORDER BY m.is_primary DESC)
          FROM contact_methods m WHERE m.contact_id=c.id AND m.type='mobile'), '') AS celulares,
        COALESCE((SELECT string_agg(m.value, ' | ' ORDER BY m.is_primary DESC)
          FROM contact_methods m WHERE m.contact_id=c.id AND m.type='email'), '') AS correos,
        COALESCE((SELECT string_agg(concat_ws(', ', a.line1, a.city, a.region, a.country), ' | ')
          FROM addresses a WHERE a.contact_id=c.id), '') AS direcciones,
        COALESCE((SELECT string_agg(cat.name, ' | ' ORDER BY cat.name)
          FROM contact_categories cc JOIN categories cat ON cat.id=cc.category_id
          WHERE cc.contact_id=c.id), '') AS categorias,
        COALESCE((SELECT string_agg(n.body, ' | ' ORDER BY n.created_at)
          FROM notes n WHERE n.contact_id=c.id), '') AS notas
      FROM contacts c ORDER BY c.display_name
    `) as Record<string, unknown>[];
    const csv = stringify(
      rows.map((row) => ({
        registro_id: row.id,
        tipo: row.kind === "company" ? "empresa" : "persona",
        nombre_mostrar: row.display_name,
        nombres: [row.first_name, row.middle_name].filter(Boolean).join(" "),
        apellidos: [row.last_name, row.second_last_name].filter(Boolean).join(" "),
        razon_social: row.legal_name ?? "",
        tipo_documento: row.document_type ?? "",
        numero_documento: row.document_number ?? "",
        nit: row.tax_id ?? "",
        digito_verificacion: row.verification_digit ?? "",
        telefonos: row.telefonos,
        celulares: row.celulares,
        correos: row.correos,
        direcciones: row.direcciones,
        ciudad: "",
        departamento: "",
        pais: "",
        sitio_web: row.website ?? "",
        categorias: row.categorias,
        notas: row.notas,
        estado: row.status === "active" ? "activo" : "inactivo",
      })),
      { header: true, delimiter: ";", bom: true },
    );
    await audit(user.id, "export.csv", "directory", null, { records: rows.length });
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="directorio-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = (await request.json()) as { currentPassword?: string; backupPassword?: string };
    if (!body.currentPassword || !body.backupPassword || body.backupPassword.length < 12) {
      throw new HttpError(400, "La clave del respaldo debe tener al menos 12 caracteres");
    }
    const sql = getDb();
    const authRows = (await sql`SELECT password_hash FROM users WHERE id=${user.id}`) as {
      password_hash: string;
    }[];
    if (!authRows[0] || !(await bcrypt.compare(body.currentPassword, authRows[0].password_hash))) {
      throw new HttpError(401, "La contraseña de tu cuenta no es correcta");
    }
    const [contacts, methods, addresses, notes, categories, links, credentials] = await Promise.all([
      sql`SELECT * FROM contacts ORDER BY created_at`,
      sql`SELECT * FROM contact_methods ORDER BY created_at`,
      sql`SELECT * FROM addresses ORDER BY created_at`,
      sql`SELECT * FROM notes ORDER BY created_at`,
      sql`SELECT * FROM categories ORDER BY name`,
      sql`SELECT * FROM contact_categories`,
      sql`SELECT * FROM credentials ORDER BY created_at`,
    ]);
    const safeCredentials = (credentials as Record<string, unknown>[]).map((row) => ({
      id: row.id,
      contact_id: row.contact_id,
      platform: row.platform,
      username: row.username,
      secret: decryptSecret({
        ciphertext: String(row.secret_ciphertext),
        iv: String(row.secret_iv),
        tag: String(row.secret_tag),
      }),
      url: row.url,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    const encrypted = encryptBackup(
      { exportedAt: new Date().toISOString(), contacts, methods, addresses, notes, categories, links, credentials: safeCredentials },
      body.backupPassword,
    );
    await audit(user.id, "export.encrypted_backup", "directory", null, {
      records: (contacts as unknown[]).length,
      credentials: safeCredentials.length,
    });
    return new Response(encrypted, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="respaldo-directorio-${new Date().toISOString().slice(0, 10)}.dfbackup"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

