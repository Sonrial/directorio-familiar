import { audit, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { contactSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, HttpError, normalizeMethod } from "@/lib/security";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");
    const data = parsed.data;
    const sql = getDb();
    const queries = [
      sql`UPDATE contacts SET kind=${data.kind}, first_name=${data.first_name || null},
        middle_name=${data.middle_name || null}, last_name=${data.last_name || null},
        second_last_name=${data.second_last_name || null}, display_name=${data.display_name},
        legal_name=${data.legal_name || null}, document_type=${data.document_type || null},
        document_number=${data.document_number || null}, tax_id=${data.tax_id || null},
        verification_digit=${data.verification_digit || null}, website=${data.website || null},
        birth_date=${data.birth_date || null}, status=${data.status},
        custom_fields=${JSON.stringify(data.custom_fields)}::jsonb,
        updated_by=${user.id}, updated_at=now() WHERE id=${id}`,
      sql`DELETE FROM contact_methods WHERE contact_id=${id}`,
      sql`DELETE FROM addresses WHERE contact_id=${id}`,
      sql`DELETE FROM contact_categories WHERE contact_id=${id}`,
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
    await sql.transaction(queries);
    await audit(user.id, "contact.update", "contact", id, { name: data.display_name });
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
    await getDb()`UPDATE contacts SET status='inactive', updated_by=${user.id}, updated_at=now() WHERE id=${id}`;
    await audit(user.id, "contact.archive", "contact", id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

