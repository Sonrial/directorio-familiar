import { randomUUID } from "node:crypto";
import { audit, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { contactSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, HttpError, normalizeMethod } from "@/lib/security";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().slice(0, 200) ?? "";
    const kind = url.searchParams.get("kind") ?? "all";
    const status = url.searchParams.get("status") ?? "all";
    const pattern = `%${q}%`;
    const sql = getDb();
    const rows = await sql`
      SELECT c.*,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', m.id, 'type', m.type, 'label', m.label, 'value', m.value,
          'is_primary', m.is_primary) ORDER BY m.is_primary DESC, m.created_at)
          FROM contact_methods m WHERE m.contact_id = c.id), '[]'::jsonb) AS methods,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'label', a.label, 'line1', a.line1, 'line2', a.line2,
          'city', a.city, 'region', a.region, 'postal_code', a.postal_code,
          'country', a.country, 'is_primary', a.is_primary) ORDER BY a.is_primary DESC, a.created_at)
          FROM addresses a WHERE a.contact_id = c.id), '[]'::jsonb) AS addresses,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', cr.id, 'platform', cr.platform, 'username', cr.username,
          'url', cr.url, 'notes', cr.notes, 'updated_at', cr.updated_at)
          ORDER BY cr.platform)
          FROM credentials cr WHERE cr.contact_id = c.id), '[]'::jsonb) AS credentials,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', n.id, 'body', n.body, 'created_at', n.created_at) ORDER BY n.created_at DESC)
          FROM notes n WHERE n.contact_id = c.id), '[]'::jsonb) AS notes,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', cat.id, 'name', cat.name, 'color', cat.color) ORDER BY cat.name)
          FROM contact_categories cc JOIN categories cat ON cat.id = cc.category_id
          WHERE cc.contact_id = c.id), '[]'::jsonb) AS categories
      FROM contacts c
      WHERE (${q} = '' OR c.display_name ILIKE ${pattern}
        OR COALESCE(c.legal_name, '') ILIKE ${pattern}
        OR COALESCE(c.document_number, '') ILIKE ${pattern}
        OR COALESCE(c.tax_id, '') ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM contact_methods sm
          WHERE sm.contact_id = c.id AND sm.value ILIKE ${pattern}))
        AND (${kind} = 'all' OR c.kind = ${kind})
        AND (${status} = 'all' OR c.status = ${status})
      ORDER BY c.updated_at DESC, c.display_name
      LIMIT 500
    `;
    return Response.json({ contacts: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");
    const data = parsed.data;
    const sql = getDb();
    const id = randomUUID();
    const queries = [
      sql`INSERT INTO contacts (
        id, kind, first_name, middle_name, last_name, second_last_name, display_name,
        legal_name, document_type, document_number, tax_id, verification_digit,
        website, birth_date, status, custom_fields, created_by, updated_by
      ) VALUES (
        ${id}, ${data.kind}, ${data.first_name || null}, ${data.middle_name || null},
        ${data.last_name || null}, ${data.second_last_name || null}, ${data.display_name},
        ${data.legal_name || null}, ${data.document_type || null}, ${data.document_number || null},
        ${data.tax_id || null}, ${data.verification_digit || null}, ${data.website || null},
        ${data.birth_date || null}, ${data.status}, ${JSON.stringify(data.custom_fields)}::jsonb,
        ${user.id}, ${user.id})`,
      ...data.methods.map((method) => sql`
        INSERT INTO contact_methods (contact_id, type, label, value, normalized_value, is_primary)
        VALUES (${id}, ${method.type}, ${method.label}, ${method.value},
          ${normalizeMethod(method.type, method.value)}, ${method.is_primary})`),
      ...data.addresses.map((address) => sql`
        INSERT INTO addresses (contact_id, label, line1, line2, city, region, postal_code, country, is_primary)
        VALUES (${id}, ${address.label}, ${address.line1}, ${address.line2 || null},
          ${address.city || null}, ${address.region || null}, ${address.postal_code || null},
          ${address.country}, ${address.is_primary})`),
      ...data.categories.map((categoryId) => sql`
        INSERT INTO contact_categories (contact_id, category_id)
        VALUES (${id}, ${categoryId}) ON CONFLICT DO NOTHING`),
    ];
    if (data.note) {
      queries.push(sql`INSERT INTO notes (contact_id, body, created_by)
        VALUES (${id}, ${data.note}, ${user.id})`);
    }
    await sql.transaction(queries);
    await audit(user.id, "contact.create", "contact", id, { name: data.display_name });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

