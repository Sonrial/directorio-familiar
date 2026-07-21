import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { audit, requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { assertSameOrigin, errorResponse, HttpError, normalizeMethod } from "@/lib/security";

type CsvRow = Record<string, string>;

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function splitName(value: string) {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  return [parts[0] || null, parts.slice(1).join(" ") || null] as const;
}

function splitList(value: string) {
  return clean(value).split("|").map((part) => part.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Selecciona un archivo CSV");
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "El archivo supera el máximo de 5 MB");
    const text = await file.text();
    let rows: CsvRow[];
    try {
      rows = parse(text, {
        columns: (headers: string[]) => headers.map((header) => header.trim().toLowerCase()),
        delimiter: ";",
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as CsvRow[];
    } catch {
      throw new HttpError(400, "No fue posible leer el CSV. Usa la plantilla de importación");
    }
    if (!rows.length) throw new HttpError(400, "El archivo no contiene registros");
    if (rows.length > 3000) throw new HttpError(400, "Importa máximo 3.000 filas por archivo");
    if (!Object.hasOwn(rows[0], "tipo") || !Object.hasOwn(rows[0], "nombre_mostrar")) {
      throw new HttpError(400, "Faltan columnas requeridas. Descarga y usa la plantilla");
    }

    const groups = new Map<string, CsvRow[]>();
    rows.forEach((row, index) => {
      const key = clean(row.registro_id) || `fila-${index + 2}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    const sql = getDb();
    let imported = 0;
    let skipped = 0;
    const errors: { registro: string; error: string }[] = [];

    for (const [recordKey, group] of groups) {
      const row = group[0];
      const document = clean(row.numero_documento);
      const taxId = clean(row.nit);
      const email = clean(row.correo).toLowerCase();
      const duplicates = (await sql`
        SELECT id FROM contacts c
        WHERE (${document} <> '' AND c.document_number = ${document})
          OR (${taxId} <> '' AND c.tax_id = ${taxId})
          OR (${email} <> '' AND EXISTS (
            SELECT 1 FROM contact_methods m WHERE m.contact_id=c.id
              AND m.type='email' AND m.normalized_value=${email}))
        LIMIT 1
      `) as { id: string }[];
      if (duplicates[0]) {
        skipped += 1;
        continue;
      }
      try {
        const contactId = randomUUID();
        const [firstName, middleName] = splitName(row.nombres);
        const [lastName, secondLastName] = splitName(row.apellidos);
        const kind = clean(row.tipo).toLowerCase() === "empresa" ? "company" : "person";
        const legalName = clean(row.razon_social);
        const displayName = clean(row.nombre_mostrar) || legalName ||
          [clean(row.nombres), clean(row.apellidos)].filter(Boolean).join(" ");
        if (!displayName) throw new Error("Falta el nombre del contacto");

        const categoryNames = splitList(row.categorias);
        for (const name of categoryNames) {
          await sql`INSERT INTO categories(name) VALUES (${name}) ON CONFLICT(name) DO NOTHING`;
        }
        const categoryRows = categoryNames.length
          ? ((await sql`SELECT id FROM categories WHERE name = ANY(${categoryNames})`) as { id: string }[])
          : [];
        const queries = [
          sql`INSERT INTO contacts (id, kind, first_name, middle_name, last_name,
            second_last_name, display_name, legal_name, document_type, document_number,
            tax_id, verification_digit, website, status, created_by, updated_by)
          VALUES (${contactId}, ${kind}, ${firstName}, ${middleName}, ${lastName},
            ${secondLastName}, ${displayName}, ${legalName || null},
            ${clean(row.tipo_documento) || null}, ${document || null}, ${taxId || null},
            ${clean(row.digito_verificacion) || null}, ${clean(row.sitio_web) || null},
            ${clean(row.estado).toLowerCase() === "inactivo" ? "inactive" : "active"},
            ${user.id}, ${user.id})`,
        ];
        const methods = [
          { type: "phone", value: clean(row.telefono) },
          { type: "mobile", value: clean(row.celular) },
          { type: "email", value: email },
        ].filter((item) => item.value);
        methods.forEach((method, index) => queries.push(sql`
          INSERT INTO contact_methods(contact_id, type, label, value, normalized_value, is_primary)
          VALUES (${contactId}, ${method.type}, 'Principal', ${method.value},
            ${normalizeMethod(method.type, method.value)}, ${index === 0})`));
        if (clean(row.direccion)) queries.push(sql`
          INSERT INTO addresses(contact_id, label, line1, city, region, country, is_primary)
          VALUES (${contactId}, 'Principal', ${clean(row.direccion)}, ${clean(row.ciudad) || null},
            ${clean(row.departamento) || null}, ${clean(row.pais) || "Colombia"}, true)`);
        if (clean(row.notas)) queries.push(sql`
          INSERT INTO notes(contact_id, body, created_by)
          VALUES (${contactId}, ${clean(row.notas)}, ${user.id})`);
        categoryRows.forEach((category) => queries.push(sql`
          INSERT INTO contact_categories(contact_id, category_id)
          VALUES (${contactId}, ${category.id}) ON CONFLICT DO NOTHING`));
        group.forEach((credentialRow) => {
          const platform = clean(credentialRow.plataforma);
          const secret = clean(credentialRow.contrasena_plataforma);
          if (!platform || !secret) return;
          const encrypted = encryptSecret(secret);
          queries.push(sql`
            INSERT INTO credentials(contact_id, platform, username, secret_ciphertext,
              secret_iv, secret_tag, url, notes, created_by, updated_by)
            VALUES (${contactId}, ${platform}, ${clean(credentialRow.usuario_plataforma) || null},
              ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.tag},
              ${clean(credentialRow.url_plataforma) || null},
              ${clean(credentialRow.notas_credencial) || null}, ${user.id}, ${user.id})`);
        });
        await sql.transaction(queries);
        imported += 1;
      } catch (error) {
        errors.push({
          registro: recordKey,
          error: error instanceof Error ? error.message.slice(0, 180) : "Error desconocido",
        });
      }
    }
    await audit(user.id, "import.csv", "directory", null, {
      imported,
      skipped,
      errors: errors.length,
      filename: file.name.slice(0, 200),
    });
    return Response.json({ imported, skipped, errors: errors.slice(0, 50) });
  } catch (error) {
    return errorResponse(error);
  }
}

