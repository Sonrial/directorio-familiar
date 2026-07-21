import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().nullable();

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(200),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z
    .string()
    .min(12, "Usa al menos 12 caracteres")
    .max(200)
    .regex(/[a-z]/, "Incluye una minúscula")
    .regex(/[A-Z]/, "Incluye una mayúscula")
    .regex(/[0-9]/, "Incluye un número")
    .regex(/[^A-Za-z0-9]/, "Incluye un símbolo"),
});

export const methodSchema = z.object({
  type: z.enum(["phone", "mobile", "email", "other"]),
  label: z.string().trim().min(1).max(60).default("Principal"),
  value: z.string().trim().min(1).max(320),
  is_primary: z.boolean().default(false),
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(60).default("Principal"),
  line1: z.string().trim().min(1).max(500),
  line2: optionalText,
  city: optionalText,
  region: optionalText,
  postal_code: optionalText,
  country: z.string().trim().min(1).max(120).default("Colombia"),
  is_primary: z.boolean().default(false),
});

export const contactSchema = z
  .object({
    kind: z.enum(["person", "company"]).default("person"),
    first_name: optionalText,
    middle_name: optionalText,
    last_name: optionalText,
    second_last_name: optionalText,
    display_name: z.string().trim().min(2).max(240),
    legal_name: optionalText,
    document_type: optionalText,
    document_number: optionalText,
    tax_id: optionalText,
    verification_digit: optionalText,
    website: z.union([z.url(), z.literal(""), z.null()]).optional(),
    birth_date: z.union([z.iso.date(), z.literal(""), z.null()]).optional(),
    status: z.enum(["active", "inactive"]).default("active"),
    custom_fields: z.record(z.string(), z.string()).default({}),
    methods: z.array(methodSchema).max(30).default([]),
    addresses: z.array(addressSchema).max(20).default([]),
    categories: z.array(z.string().uuid()).max(20).default([]),
    note: z.string().trim().max(10000).optional().nullable(),
  })
  .strict();

export const credentialSchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  platform: z.string().trim().min(1).max(160),
  username: optionalText,
  secret: z.string().min(1).max(5000),
  url: z.union([z.url(), z.literal(""), z.null()]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const credentialUpdateSchema = credentialSchema
  .omit({ contact_id: true, secret: true })
  .extend({ secret: z.string().max(5000).optional() })
  .strict();

